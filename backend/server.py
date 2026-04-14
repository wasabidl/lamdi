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
from datetime import datetime, timedelta
import json
import base64
from emergentintegrations.llm.chat import LlmChat, UserMessage
import asyncio

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

# Get Emergent LLM Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

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
    original_input: Optional[str] = None  # Original voice/text input
    language_detected: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    reminder_enabled: bool = True
    reminder_times: List[str] = []  # ISO datetime strings

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
    correction_type: str  # title, priority, due_date, category, etc.
    original_input: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class LearningPattern(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pattern_type: str  # phrase_to_priority, keyword_to_category, time_expression, etc.
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

async def extract_tasks_from_input(text: str, language_hint: Optional[str] = None) -> Dict[str, Any]:
    """Use LLM to extract structured tasks from unstructured voice/text input"""
    
    # Get learned patterns to enhance extraction
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

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"task-extraction-{uuid.uuid4()}",
        system_message=system_message
    ).with_model("openai", "gpt-4o")
    
    user_msg = f"Extract tasks from this input (language hint: {language_hint or 'auto-detect'}):\n\n{text}"
    
    try:
        response = await chat.send_message(UserMessage(text=user_msg))
        logger.info(f"LLM Response: {response}")
        
        # Parse JSON from response
        response_text = response.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        result = json.loads(response_text.strip())
        return result
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}, response: {response}")
        # Return a basic task if parsing fails
        return {
            "tasks": [{
                "title": text[:100],
                "description": text if len(text) > 100 else "",
                "priority": "medium",
                "due_date": None,
                "category": None,
                "tags": []
            }],
            "raw_interpretation": "Could not fully parse input, created basic task",
            "language_detected": language_hint or "unknown",
            "confidence": 0.5
        }
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
    """Create a new task manually"""
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
    """Get all tasks with optional filters"""
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
    """Get a specific task"""
    task = await db.tasks.find_one({"id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return Task(**task)

@api_router.put("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, task_update: TaskUpdate):
    """Update a task"""
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
    """Delete a task"""
    result = await db.tasks.delete_one({"id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted successfully"}

# ----- Voice/Text Processing -----

@api_router.post("/process-input", response_model=TaskExtractionResponse)
async def process_voice_input(request: VoiceInputRequest):
    """Process voice/text input and extract tasks"""
    
    text_to_process = request.text
    
    # If audio is provided, we'd transcribe it here
    # For MVP, we'll use the text directly or assume client-side transcription
    if request.audio_base64 and not text_to_process:
        # In production, we'd use Whisper or similar for transcription
        # For now, return an error if only audio without text
        raise HTTPException(
            status_code=400, 
            detail="Audio-only processing not yet supported. Please include text transcription."
        )
    
    if not text_to_process:
        raise HTTPException(status_code=400, detail="No input provided")
    
    # Extract tasks using LLM
    extraction_result = await extract_tasks_from_input(
        text_to_process, 
        request.language_hint
    )
    
    # Create tasks in database
    created_tasks = []
    for task_data in extraction_result.get("tasks", []):
        task = Task(
            title=task_data.get("title", "Untitled Task"),
            description=task_data.get("description", ""),
            priority=task_data.get("priority", "medium"),
            due_date=task_data.get("due_date"),
            category=task_data.get("category"),
            tags=task_data.get("tags", []),
            original_input=text_to_process,
            language_detected=extraction_result.get("language_detected", "unknown")
        )
        await db.tasks.insert_one(task.dict())
        created_tasks.append(task)
    
    return TaskExtractionResponse(
        tasks=created_tasks,
        raw_interpretation=extraction_result.get("raw_interpretation", ""),
        language_detected=extraction_result.get("language_detected", "unknown"),
        confidence=extraction_result.get("confidence", 0.5)
    )

# ----- Corrections & Learning -----

@api_router.post("/corrections")
async def submit_correction(
    task_id: str = Form(...),
    correction_type: str = Form(...),
    original_value: str = Form(...),
    corrected_value: str = Form(...),
    original_input: str = Form(...)
):
    """Submit a correction to learn from user feedback"""
    
    correction = Correction(
        task_id=task_id,
        original_extraction={"field": correction_type, "value": original_value},
        corrected_values={correction_type: corrected_value},
        correction_type=correction_type,
        original_input=original_input
    )
    
    await db.corrections.insert_one(correction.dict())
    
    # Create or update learning pattern
    # Find keywords in original input that might relate to the correction
    await learn_from_correction(correction)
    
    return {"message": "Correction recorded and learning updated", "correction_id": correction.id}

async def learn_from_correction(correction: Correction):
    """Extract patterns from corrections to improve future extractions"""
    
    # Use LLM to identify what triggered the wrong extraction
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

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"learning-{uuid.uuid4()}",
        system_message=system_message
    ).with_model("openai", "gpt-4o")
    
    prompt = f"""Original input: "{correction.original_input}"
Correction type: {correction.correction_type}
Original extraction: {correction.original_extraction}
User corrected to: {correction.corrected_values}

What pattern should I learn from this?"""
    
    try:
        response = await chat.send_message(UserMessage(text=prompt))
        response_text = response.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        pattern_data = json.loads(response_text.strip())
        
        # Check if pattern already exists
        existing = await db.learning_patterns.find_one({
            "pattern_type": pattern_data["pattern_type"],
            "trigger_phrase": pattern_data["trigger_phrase"]
        })
        
        if existing:
            # Update existing pattern
            await db.learning_patterns.update_one(
                {"id": existing["id"]},
                {
                    "$set": {
                        "extracted_value": pattern_data["extracted_value"],
                        "updated_at": datetime.utcnow()
                    },
                    "$inc": {"usage_count": 1}
                }
            )
        else:
            # Create new pattern
            pattern = LearningPattern(
                pattern_type=pattern_data["pattern_type"],
                trigger_phrase=pattern_data["trigger_phrase"],
                extracted_value=pattern_data["extracted_value"]
            )
            await db.learning_patterns.insert_one(pattern.dict())
            
    except Exception as e:
        logger.error(f"Learning pattern extraction error: {e}")
        # Non-fatal, continue without learning

@api_router.get("/learning-patterns", response_model=List[LearningPattern])
async def get_learning_patterns():
    """Get all learned patterns"""
    patterns = await db.learning_patterns.find().to_list(100)
    return [LearningPattern(**p) for p in patterns]

@api_router.delete("/learning-patterns/{pattern_id}")
async def delete_learning_pattern(pattern_id: str):
    """Delete a learned pattern"""
    result = await db.learning_patterns.delete_one({"id": pattern_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pattern not found")
    return {"message": "Pattern deleted"}

# ----- Stats -----

@api_router.get("/stats")
async def get_stats():
    """Get task statistics"""
    total_tasks = await db.tasks.count_documents({})
    pending = await db.tasks.count_documents({"status": "pending"})
    completed = await db.tasks.count_documents({"status": "completed"})
    patterns_count = await db.learning_patterns.count_documents({})
    corrections_count = await db.corrections.count_documents({})
    
    # Tasks by priority
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
