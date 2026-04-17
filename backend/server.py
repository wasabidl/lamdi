from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Form
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta, timezone
import json
import base64
import tempfile
import aiofiles
import asyncio
import google.generativeai as genai

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'lamdi_db')]

# Create the main app
app = FastAPI(title="Lamdi - AI Voice Task Manager")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure Gemini
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== Models ==============

class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = ""
    priority: str = "medium"  # low, medium, high, urgent
    status: str = "pending"  # pending, in_progress, completed, cancelled
    due_date: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = []
    original_input: Optional[str] = None
    language_detected: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    reminder_enabled: bool = True
    reminder_times: List[str] = []

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    priority: str = "medium"
    due_date: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = []
    reminder_enabled: bool = True

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    reminder_enabled: Optional[bool] = None

class Correction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str
    original_extraction: Dict[str, Any]
    corrected_values: Dict[str, Any]
    correction_type: str
    original_input: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class LearningPattern(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pattern_type: str
    trigger_phrase: str
    extracted_value: str
    confidence: float = 1.0
    usage_count: int = 1
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class VoiceInputRequest(BaseModel):
    text: Optional[str] = None
    audio_base64: Optional[str] = None
    language_hint: Optional[str] = None  # en, cs, vi

class TaskExtractionResponse(BaseModel):
    tasks: List[Task]
    raw_interpretation: str
    language_detected: str
    confidence: float

# ============== LLM Helper ==============

def parse_llm_json(response_text: str) -> dict:
    """Parse JSON from LLM response, stripping markdown fences"""
    text = response_text.strip()
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return json.loads(text.strip())

async def call_gemini(system_message: str, user_message: str) -> str:
    """Call Gemini Flash and return response text"""
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="AI not configured. Set GEMINI_API_KEY environment variable."
        )
    if not GEMINI_API_KEY.startswith('AIza'):
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY appears invalid (must start with 'AIza'). Get a new key from aistudio.google.com/apikey"
        )
    model = genai.GenerativeModel(
        model_name='gemini-1.5-flash',
        system_instruction=system_message,
        generation_config=genai.GenerationConfig(
            temperature=0.1,
            max_output_tokens=2048,
        )
    )
    response = await asyncio.to_thread(model.generate_content, user_message)
    return response.text

async def analyze_input_intent(text: str, existing_tasks: List[Dict]) -> Dict[str, Any]:
    """Analyze whether user input is about creating new tasks or updating existing ones"""

    tasks_ctx = ""
    for t in existing_tasks:
        tasks_ctx += f"- ID: {t['id']} | Title: {t['title']} | Status: {t['status']} | Priority: {t['priority']} | Due: {t.get('due_date', 'none')}\n"

    patterns = await db.learning_patterns.find().to_list(100)
    patterns_ctx = ""
    if patterns:
        patterns_ctx = "\nLEARNED USER PREFERENCES:\n"
        for p in patterns:
            patterns_ctx += f"- '{p['trigger_phrase']}' → {p['pattern_type']}: {p['extracted_value']}\n"

    today = datetime.utcnow().strftime("%Y-%m-%d")

    system_message = f"""You are Lamdi, an AI operations manager. You understand English, Czech, and Vietnamese (including code-switching).

Today's date: {today}

EXISTING TASKS:
{tasks_ctx or "No existing tasks."}
{patterns_ctx}

ANALYZE the user's input and determine the INTENT:

1. **CREATE** - User wants to create NEW task(s)
2. **UPDATE** - User is reporting progress, completion, or deadline changes for EXISTING tasks
3. **MIXED** - Some new tasks AND some updates

For UPDATES, match the input to existing tasks by meaning (not exact words).
Examples:
- "I called the supplier" → marks "Call supplier" task as completed
- "Done with inventory" → marks inventory-related task as completed
- "Move the bank call to Friday" → updates due_date of bank-related task
- "Hotovo s dodavatelem" (Czech: done with supplier) → completes supplier task
- "Đã gọi nhà cung cấp" (Vietnamese: already called supplier) → completes supplier task

OUTPUT FORMAT (JSON):
{{
    "intent": "create|update|mixed",
    "new_tasks": [
        {{
            "title": "Task title",
            "description": "Details",
            "priority": "low|medium|high|urgent",
            "due_date": "YYYY-MM-DD or null",
            "category": "category or null",
            "tags": ["tags"]
        }}
    ],
    "task_updates": [
        {{
            "task_id": "id of existing task to update",
            "task_title": "title of matched task",
            "changes": {{
                "status": "completed|pending|in_progress|cancelled or null",
                "due_date": "YYYY-MM-DD or null",
                "priority": "low|medium|high|urgent or null"
            }},
            "reason": "Brief explanation of why this update was matched"
        }}
    ],
    "raw_interpretation": "What you understood from the input",
    "language_detected": "en|cs|vi|mixed",
    "confidence": 0.0-1.0
}}

Only include fields that actually change. Respond with valid JSON only."""

    try:
        response = await call_gemini(system_message, f"User says: {text}")
        logger.info(f"Intent analysis response: {response}")
        return parse_llm_json(response)
    except json.JSONDecodeError as e:
        logger.error(f"Intent JSON parse error: {e}")
        return {
            "intent": "create",
            "new_tasks": [{"title": text[:100], "description": "", "priority": "medium", "due_date": None, "category": None, "tags": []}],
            "task_updates": [],
            "raw_interpretation": text,
            "language_detected": "unknown",
            "confidence": 0.5
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Intent analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"AI processing error: {str(e)}")

async def extract_tasks_from_input(text: str, language_hint: Optional[str] = None) -> Dict[str, Any]:
    """Use LLM to extract structured tasks from unstructured voice/text input"""

    patterns = await db.learning_patterns.find().to_list(100)
    patterns_context = ""
    if patterns:
        patterns_context = "\n\nLEARNED USER PREFERENCES:\n"
        for p in patterns:
            patterns_context += f"- When user says '{p['trigger_phrase']}', they usually mean {p['pattern_type']}: {p['extracted_value']}\n"

    system_message = f"""You are Lamdi, an AI operations manager specialized in extracting tasks from voice messages and unstructured text.

CAPABILITIES:
- Understand English, Czech (čeština), and Vietnamese (tiếng Việt)
- Handle code-switching (mixing languages mid-sentence)
- Extract actionable tasks from casual conversation
- Infer priorities, deadlines, and categories

TASK EXTRACTION RULES:
1. Extract ALL actionable items as separate tasks
2. Infer priority: urgent (today/ASAP), high (this week), medium (default), low (whenever)
3. Parse time expressions: "zítra" (tomorrow), "ngày mai" (tomorrow), "příští týden" (next week), "tuần sau" (next week)
4. Detect categories: supplier, customer, inventory, staff, finance, personal
5. If input is ambiguous, create a clarification task
{patterns_context}

OUTPUT FORMAT (JSON):
{{
    "tasks": [
        {{
            "title": "Clear, actionable task title",
            "description": "Additional context if any",
            "priority": "low|medium|high|urgent",
            "due_date": "YYYY-MM-DD or null",
            "category": "category_name or null",
            "tags": ["relevant", "tags"]
        }}
    ],
    "raw_interpretation": "Brief explanation of what you understood",
    "language_detected": "en|cs|vi|mixed",
    "confidence": 0.0-1.0
}}

Always respond with valid JSON only."""

    user_msg = f"Extract tasks from this input (language hint: {language_hint or 'auto-detect'}):\n\n{text}"

    try:
        response = await call_gemini(system_message, user_msg)
        logger.info(f"LLM Response: {response}")
        return parse_llm_json(response)
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}")
        return {
            "tasks": [{"title": text[:100], "description": "", "priority": "medium", "due_date": None, "category": None, "tags": []}],
            "raw_interpretation": "Could not fully parse input, created basic task",
            "language_detected": language_hint or "unknown",
            "confidence": 0.5
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"LLM error: {e}")
        raise HTTPException(status_code=500, detail=f"AI processing error: {str(e)}")

# ============== Routes ==============

@api_router.get("/")
async def root():
    return {"message": "Lamdi API - AI Voice Task Manager", "version": "1.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# ----- Task CRUD -----

@api_router.post("/tasks", response_model=Task)
async def create_task(task_input: TaskCreate):
    task = Task(**task_input.dict())
    await db.tasks.insert_one(task.dict())
    return task

@api_router.get("/tasks", response_model=List[Task])
async def get_tasks(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 100
):
    query = {}
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    if category:
        query["category"] = category
    tasks = await db.tasks.find(query).sort("created_at", -1).to_list(limit)
    return [Task(**task) for task in tasks]

@api_router.get("/tasks/{task_id}", response_model=Task)
async def get_task(task_id: str):
    task = await db.tasks.find_one({"id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return Task(**task)

@api_router.put("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, task_update: TaskUpdate):
    task = await db.tasks.find_one({"id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    update_data = {k: v for k, v in task_update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    if task_update.status == "completed" and task.get("status") != "completed":
        update_data["completed_at"] = datetime.utcnow()
    await db.tasks.update_one({"id": task_id}, {"$set": update_data})
    updated_task = await db.tasks.find_one({"id": task_id})
    return Task(**updated_task)

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    result = await db.tasks.delete_one({"id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted successfully"}

# ----- Voice/Text Processing -----

@api_router.post("/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    language_hint: Optional[str] = Form(None)
):
    return {"text": "", "success": False, "message": "Use text input on web."}

@api_router.post("/transcribe-base64")
async def transcribe_audio_base64(
    audio_base64: str = Form(...),
    file_extension: str = Form(default="m4a"),
    language_hint: Optional[str] = Form(None)
):
    return {"text": "", "success": False, "message": "Use text input on web."}

class SmartProcessResponse(BaseModel):
    intent: str
    created_tasks: List[Task] = []
    updated_tasks: List[Dict[str, Any]] = []
    raw_interpretation: str
    language_detected: str
    confidence: float

@api_router.post("/process-input")
async def process_voice_input(request: VoiceInputRequest):
    """Smart processing: creates NEW tasks OR updates EXISTING ones based on intent"""

    text_to_process = request.text
    if not text_to_process:
        raise HTTPException(status_code=400, detail="No input provided")

    existing_tasks = await db.tasks.find(
        {"status": {"$nin": ["completed", "cancelled"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)

    analysis = await analyze_input_intent(text_to_process, existing_tasks)

    intent = analysis.get("intent", "create")
    created_tasks = []
    updated_tasks = []

    for task_data in analysis.get("new_tasks", []):
        task = Task(
            title=task_data.get("title", "Untitled Task"),
            description=task_data.get("description", ""),
            priority=task_data.get("priority", "medium"),
            due_date=task_data.get("due_date"),
            category=task_data.get("category"),
            tags=task_data.get("tags", []),
            original_input=text_to_process,
            language_detected=analysis.get("language_detected", "unknown")
        )
        await db.tasks.insert_one(task.dict())
        created_tasks.append(task)

    for update_data in analysis.get("task_updates", []):
        task_id = update_data.get("task_id")
        changes = update_data.get("changes", {})
        reason = update_data.get("reason", "")
        if not task_id or not changes:
            continue
        existing = await db.tasks.find_one({"id": task_id})
        if not existing:
            continue
        update_fields = {"updated_at": datetime.utcnow()}
        for field, value in changes.items():
            if value is not None:
                update_fields[field] = value
        if changes.get("status") == "completed":
            update_fields["completed_at"] = datetime.utcnow()
            await db.reminders.update_one({"task_id": task_id}, {"$set": {"enabled": False}})
        await db.tasks.update_one({"id": task_id}, {"$set": update_fields})
        updated_tasks.append({
            "task_id": task_id,
            "task_title": update_data.get("task_title", existing.get("title", "")),
            "changes": changes,
            "reason": reason
        })

    return {
        "intent": intent,
        "created_tasks": [t.dict() for t in created_tasks],
        "updated_tasks": updated_tasks,
        "raw_interpretation": analysis.get("raw_interpretation", ""),
        "language_detected": analysis.get("language_detected", "unknown"),
        "confidence": analysis.get("confidence", 0.5),
        "tasks": [t.dict() for t in created_tasks],
    }

# ----- Corrections & Learning -----

@api_router.post("/corrections")
async def submit_correction(
    task_id: str = Form(...),
    correction_type: str = Form(...),
    original_value: str = Form(...),
    corrected_value: str = Form(...),
    original_input: str = Form(...)
):
    correction = Correction(
        task_id=task_id,
        original_extraction={"field": correction_type, "value": original_value},
        corrected_values={correction_type: corrected_value},
        correction_type=correction_type,
        original_input=original_input
    )
    await db.corrections.insert_one(correction.dict())
    await learn_from_correction(correction)
    return {"message": "Correction recorded and learning updated", "correction_id": correction.id}

async def learn_from_correction(correction: Correction):
    system_message = """You are analyzing user corrections to extract learning patterns.

Given the original input and the correction made, identify what phrase or keyword the user used
that should map to their corrected value.

OUTPUT FORMAT (JSON):
{
    "pattern_type": "phrase_to_priority|keyword_to_category|time_expression|action_verb",
    "trigger_phrase": "the exact phrase from input",
    "extracted_value": "what it should map to"
}

Return ONLY valid JSON."""

    prompt = f"""Original input: "{correction.original_input}"
Correction type: {correction.correction_type}
Original extraction: {correction.original_extraction}
User corrected to: {correction.corrected_values}

What pattern should I learn from this?"""

    try:
        response = await call_gemini(system_message, prompt)
        pattern_data = parse_llm_json(response)
        existing = await db.learning_patterns.find_one({
            "pattern_type": pattern_data["pattern_type"],
            "trigger_phrase": pattern_data["trigger_phrase"]
        })
        if existing:
            await db.learning_patterns.update_one(
                {"id": existing["id"]},
                {"$set": {"extracted_value": pattern_data["extracted_value"], "updated_at": datetime.utcnow()},
                 "$inc": {"usage_count": 1}}
            )
        else:
            pattern = LearningPattern(
                pattern_type=pattern_data["pattern_type"],
                trigger_phrase=pattern_data["trigger_phrase"],
                extracted_value=pattern_data["extracted_value"]
            )
            await db.learning_patterns.insert_one(pattern.dict())
    except Exception as e:
        logger.error(f"Learning pattern extraction error: {e}")

@api_router.get("/learning-patterns", response_model=List[LearningPattern])
async def get_learning_patterns():
    patterns = await db.learning_patterns.find().to_list(100)
    return [LearningPattern(**p) for p in patterns]

@api_router.delete("/learning-patterns/{pattern_id}")
async def delete_learning_pattern(pattern_id: str):
    result = await db.learning_patterns.delete_one({"id": pattern_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pattern not found")
    return {"message": "Pattern deleted"}

# ----- Reminders -----

class ReminderConfig(BaseModel):
    task_id: str
    interval_minutes: int = 240
    enabled: bool = True

@api_router.post("/reminders/configure")
async def configure_reminder(config: ReminderConfig):
    task = await db.tasks.find_one({"id": config.task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    reminder_data = {
        "id": str(uuid.uuid4()),
        "task_id": config.task_id,
        "interval_minutes": config.interval_minutes,
        "enabled": config.enabled,
        "last_sent": None,
        "next_due": datetime.utcnow().isoformat(),
        "send_count": 0,
        "created_at": datetime.utcnow(),
    }
    await db.reminders.update_one({"task_id": config.task_id}, {"$set": reminder_data}, upsert=True)
    return {"message": "Reminder configured", "interval_minutes": config.interval_minutes}

@api_router.get("/reminders/pending")
async def get_pending_reminders():
    now = datetime.utcnow().isoformat()
    reminders = await db.reminders.find({"enabled": True}).to_list(100)
    pending = []
    for rem in reminders:
        task = await db.tasks.find_one({"id": rem["task_id"]})
        if task and task.get("status") not in ["completed", "cancelled"]:
            next_due = rem.get("next_due", now)
            if next_due <= now:
                pending.append({
                    "reminder_id": rem.get("id", ""),
                    "task_id": rem["task_id"],
                    "task_title": task.get("title", ""),
                    "task_priority": task.get("priority", "medium"),
                    "interval_minutes": rem.get("interval_minutes", 240),
                    "send_count": rem.get("send_count", 0),
                    "next_due": next_due,
                })
    return {"pending_reminders": pending, "count": len(pending)}

@api_router.post("/reminders/acknowledge/{task_id}")
async def acknowledge_reminder(task_id: str):
    reminder = await db.reminders.find_one({"task_id": task_id})
    if not reminder:
        raise HTTPException(status_code=404, detail="No reminder for this task")
    interval = reminder.get("interval_minutes", 240)
    next_due = (datetime.utcnow() + timedelta(minutes=interval)).isoformat()
    await db.reminders.update_one(
        {"task_id": task_id},
        {"$set": {"last_sent": datetime.utcnow().isoformat(), "next_due": next_due}, "$inc": {"send_count": 1}}
    )
    return {"message": "Reminder acknowledged", "next_due": next_due}

@api_router.delete("/reminders/{task_id}")
async def disable_reminder(task_id: str):
    result = await db.reminders.update_one({"task_id": task_id}, {"$set": {"enabled": False}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="No reminder for this task")
    return {"message": "Reminder disabled"}

# ----- Stats -----

@api_router.get("/stats")
async def get_stats():
    total_tasks = await db.tasks.count_documents({})
    pending = await db.tasks.count_documents({"status": "pending"})
    completed = await db.tasks.count_documents({"status": "completed"})
    patterns_count = await db.learning_patterns.count_documents({})
    corrections_count = await db.corrections.count_documents({})
    urgent = await db.tasks.count_documents({"priority": "urgent", "status": {"$ne": "completed"}})
    high = await db.tasks.count_documents({"priority": "high", "status": {"$ne": "completed"}})
    return {
        "total_tasks": total_tasks,
        "pending": pending,
        "completed": completed,
        "completion_rate": round(completed / total_tasks * 100, 1) if total_tasks > 0 else 0,
        "urgent_tasks": urgent,
        "high_priority_tasks": high,
        "learned_patterns": patterns_count,
        "corrections_made": corrections_count
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
