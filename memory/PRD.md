# Lamdi - AI Voice Task Manager
## Product Requirements Document (PRD)

### Overview
Lamdi ("just work" in Vietnamese) is a voice-first, multilingual AI operations manager that turns phone calls, voice notes, and unstructured text into structured, prioritized tasks. Built for non-native speakers, immigrants running small businesses, and people with ADHD who need structure.

### Target Users
- Non-native language speakers (especially Vietnamese-Czech bilingual entrepreneurs)
- People with ADHD who struggle with task organization
- Small business owners managing 40-80 calls/day

### Core Features (MVP)

#### 1. AI-Powered Task Extraction
- Accept natural language input (voice or text)
- Extract actionable tasks with title, description, priority, due date, category
- Support English, Czech, Vietnamese (including code-switching)
- Uses OpenAI GPT-4o via Emergent LLM key
- Confidence scoring for extraction quality

#### 2. Voice Input
- Device microphone recording (expo-audio)
- Text-based fallback for web preview
- Language auto-detection or manual selection

#### 3. Task Management
- Full CRUD (Create, Read, Update, Delete)
- Priority levels: low, medium, high, urgent
- Status tracking: pending, in_progress, completed, cancelled
- Categories: supplier, customer, inventory, staff, finance, personal
- Filter tabs: All, Pending, Completed

#### 4. Learning System
- User corrections stored as learning patterns
- AI learns from corrections to improve future extractions
- Pattern types: phrase_to_priority, keyword_to_category, time_expression, action_verb

#### 5. Statistics Dashboard
- Pending/Completed/Urgent task counts
- Completion rate
- Number of learned patterns

### Tech Stack
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Frontend**: Expo SDK 54, React Native, expo-router
- **AI**: OpenAI GPT-4o (Emergent LLM key)
- **Audio**: expo-audio (SDK 54)
- **State**: Zustand
- **Icons**: lucide-react-native

### Design System
- Organic & Earthy theme (calm, ADHD-friendly)
- Primary: #4A6B53 (forest green)
- Accent: #D48C70 (warm terracotta)
- Large touch targets, clear hierarchy, minimal visual noise

### API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/ | Root info |
| GET | /api/health | Health check |
| GET | /api/stats | Task statistics |
| POST | /api/tasks | Create task |
| GET | /api/tasks | List tasks (filters) |
| GET | /api/tasks/{id} | Get task |
| PUT | /api/tasks/{id} | Update task |
| DELETE | /api/tasks/{id} | Delete task |
| POST | /api/process-input | AI task extraction |
| POST | /api/corrections | Submit correction |
| GET | /api/learning-patterns | View patterns |
| DELETE | /api/learning-patterns/{id} | Delete pattern |

### Future Enhancements
- Push notification reminders (persistent until done)
- Server-side Whisper transcription (real voice-to-text)
- POS integrations (GoKasa, Storyous)
- Team features and multi-location support
- Community referral system
- €30/mo SaaS subscription model
