"""
Lamdi API Backend Tests - NEW FEATURES (Iteration 2)
Tests for:
- Whisper transcription endpoint (POST /api/transcribe-base64)
- Reminder system (configure, pending, acknowledge, disable)
"""
import pytest
import requests
import os
import base64

# Get BASE_URL from environment
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL')
if not BASE_URL:
    raise ValueError("EXPO_PUBLIC_BACKEND_URL not set in environment")

BASE_URL = BASE_URL.rstrip('/')

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture
def cleanup_test_tasks(api_client):
    """Cleanup fixture to remove test tasks and reminders after tests"""
    created_task_ids = []
    
    yield created_task_ids
    
    # Cleanup: delete all test tasks and their reminders
    for task_id in created_task_ids:
        try:
            # Delete reminder first
            api_client.delete(f"{BASE_URL}/api/reminders/{task_id}")
        except:
            pass
        try:
            # Delete task
            api_client.delete(f"{BASE_URL}/api/tasks/{task_id}")
        except:
            pass


class TestWhisperTranscription:
    """Test Whisper transcription endpoint"""
    
    def test_transcribe_base64_endpoint_exists(self, api_client):
        """Test POST /api/transcribe-base64 endpoint exists and returns proper error for invalid audio"""
        # Send invalid base64 audio (just a test string)
        invalid_audio = base64.b64encode(b"not a valid audio file").decode('utf-8')
        
        form_data = {
            'audio_base64': invalid_audio,
            'file_extension': 'm4a',
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/transcribe-base64",
            data=form_data,
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        
        # Endpoint should exist (not 404)
        assert response.status_code != 404, "Transcribe endpoint does not exist"
        
        # Should return error (400 or 500) for invalid audio
        assert response.status_code in [400, 500], f"Expected error status, got {response.status_code}"
        
        print(f"✓ Transcribe endpoint exists and returns error for invalid audio: {response.status_code}")
    
    def test_transcribe_base64_with_language_hint(self, api_client):
        """Test POST /api/transcribe-base64 accepts language_hint parameter"""
        invalid_audio = base64.b64encode(b"test").decode('utf-8')
        
        form_data = {
            'audio_base64': invalid_audio,
            'file_extension': 'm4a',
            'language_hint': 'en'
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/transcribe-base64",
            data=form_data,
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        
        # Should accept language_hint parameter (not 422 validation error)
        assert response.status_code != 422, "Language hint parameter not accepted"
        
        print(f"✓ Transcribe endpoint accepts language_hint parameter")


class TestReminderSystem:
    """Test reminder configuration and management"""
    
    def test_configure_reminder_for_task(self, api_client, cleanup_test_tasks):
        """Test POST /api/reminders/configure creates a reminder"""
        # Create a test task first
        task_payload = {
            "title": "TEST_Reminder Task",
            "priority": "high",
            "status": "pending"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/tasks", json=task_payload)
        assert create_response.status_code == 200
        task_id = create_response.json()["id"]
        cleanup_test_tasks.append(task_id)
        
        # Configure reminder
        reminder_payload = {
            "task_id": task_id,
            "interval_minutes": 120,  # 2 hours
            "enabled": True
        }
        
        response = api_client.post(f"{BASE_URL}/api/reminders/configure", json=reminder_payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert data["interval_minutes"] == 120
        
        print(f"✓ Reminder configured for task {task_id} with 120min interval")
    
    def test_configure_reminder_nonexistent_task(self, api_client):
        """Test POST /api/reminders/configure returns 404 for non-existent task"""
        reminder_payload = {
            "task_id": "nonexistent-task-id-12345",
            "interval_minutes": 240,
            "enabled": True
        }
        
        response = api_client.post(f"{BASE_URL}/api/reminders/configure", json=reminder_payload)
        assert response.status_code == 404
        
        print("✓ Configure reminder returns 404 for non-existent task")
    
    def test_get_pending_reminders(self, api_client, cleanup_test_tasks):
        """Test GET /api/reminders/pending returns pending reminders"""
        # Create a task with reminder
        task_payload = {
            "title": "TEST_Pending Reminder Task",
            "priority": "urgent",
            "status": "pending"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/tasks", json=task_payload)
        task_id = create_response.json()["id"]
        cleanup_test_tasks.append(task_id)
        
        # Configure reminder with immediate next_due
        reminder_payload = {
            "task_id": task_id,
            "interval_minutes": 30,
            "enabled": True
        }
        api_client.post(f"{BASE_URL}/api/reminders/configure", json=reminder_payload)
        
        # Get pending reminders
        response = api_client.get(f"{BASE_URL}/api/reminders/pending")
        assert response.status_code == 200
        
        data = response.json()
        assert "pending_reminders" in data
        assert "count" in data
        assert isinstance(data["pending_reminders"], list)
        assert isinstance(data["count"], int)
        
        # Should include our task (since next_due is set to now)
        assert data["count"] >= 1
        
        # Verify reminder structure
        found_our_reminder = False
        for reminder in data["pending_reminders"]:
            if reminder["task_id"] == task_id:
                found_our_reminder = True
                assert "reminder_id" in reminder
                assert "task_title" in reminder
                assert reminder["task_title"] == task_payload["title"]
                assert "task_priority" in reminder
                assert reminder["task_priority"] == "urgent"
                assert "interval_minutes" in reminder
                assert reminder["interval_minutes"] == 30
                assert "send_count" in reminder
                assert "next_due" in reminder
        
        assert found_our_reminder, "Our reminder not found in pending list"
        
        print(f"✓ Pending reminders endpoint works: {data['count']} pending")
    
    def test_acknowledge_reminder(self, api_client, cleanup_test_tasks):
        """Test POST /api/reminders/acknowledge/{task_id} acknowledges reminder"""
        # Create task with reminder
        task_payload = {
            "title": "TEST_Acknowledge Reminder",
            "priority": "medium",
            "status": "pending"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/tasks", json=task_payload)
        task_id = create_response.json()["id"]
        cleanup_test_tasks.append(task_id)
        
        # Configure reminder
        reminder_payload = {
            "task_id": task_id,
            "interval_minutes": 240,
            "enabled": True
        }
        api_client.post(f"{BASE_URL}/api/reminders/configure", json=reminder_payload)
        
        # Acknowledge reminder
        response = api_client.post(f"{BASE_URL}/api/reminders/acknowledge/{task_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "next_due" in data
        
        # next_due should be a valid ISO datetime string
        assert isinstance(data["next_due"], str)
        assert len(data["next_due"]) > 10  # Basic ISO format check
        
        print(f"✓ Reminder acknowledged, next due: {data['next_due']}")
    
    def test_acknowledge_nonexistent_reminder(self, api_client):
        """Test POST /api/reminders/acknowledge/{task_id} returns 404 for non-existent reminder"""
        response = api_client.post(f"{BASE_URL}/api/reminders/acknowledge/nonexistent-task-12345")
        assert response.status_code == 404
        
        print("✓ Acknowledge returns 404 for non-existent reminder")
    
    def test_disable_reminder(self, api_client, cleanup_test_tasks):
        """Test DELETE /api/reminders/{task_id} disables reminder"""
        # Create task with reminder
        task_payload = {
            "title": "TEST_Disable Reminder",
            "priority": "low",
            "status": "pending"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/tasks", json=task_payload)
        task_id = create_response.json()["id"]
        cleanup_test_tasks.append(task_id)
        
        # Configure reminder
        reminder_payload = {
            "task_id": task_id,
            "interval_minutes": 240,
            "enabled": True
        }
        api_client.post(f"{BASE_URL}/api/reminders/configure", json=reminder_payload)
        
        # Disable reminder
        response = api_client.delete(f"{BASE_URL}/api/reminders/{task_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "disabled" in data["message"].lower()
        
        print(f"✓ Reminder disabled for task {task_id}")
    
    def test_disable_nonexistent_reminder(self, api_client):
        """Test DELETE /api/reminders/{task_id} returns 404 for non-existent reminder"""
        response = api_client.delete(f"{BASE_URL}/api/reminders/nonexistent-task-12345")
        assert response.status_code == 404
        
        print("✓ Disable returns 404 for non-existent reminder")
    
    def test_reminder_intervals_by_priority(self, api_client, cleanup_test_tasks):
        """Test that different priorities can have different reminder intervals"""
        priorities = [
            ("urgent", 30),
            ("high", 120),
            ("medium", 240),
            ("low", 240)
        ]
        
        for priority, expected_interval in priorities:
            # Create task
            task_payload = {
                "title": f"TEST_Reminder {priority}",
                "priority": priority,
                "status": "pending"
            }
            
            create_response = api_client.post(f"{BASE_URL}/api/tasks", json=task_payload)
            task_id = create_response.json()["id"]
            cleanup_test_tasks.append(task_id)
            
            # Configure reminder with priority-based interval
            reminder_payload = {
                "task_id": task_id,
                "interval_minutes": expected_interval,
                "enabled": True
            }
            
            response = api_client.post(f"{BASE_URL}/api/reminders/configure", json=reminder_payload)
            assert response.status_code == 200
            assert response.json()["interval_minutes"] == expected_interval
        
        print(f"✓ Reminder intervals configurable by priority: urgent=30, high=120, medium/low=240")


class TestProcessInputIntegration:
    """Test that process-input still works (regression test)"""
    
    def test_process_input_text_creates_tasks(self, api_client, cleanup_test_tasks):
        """Test POST /api/process-input with text still works"""
        input_payload = {
            "text": "TEST_NEW: Schedule meeting tomorrow at 2pm, high priority",
            "language_hint": "en"
        }
        
        response = api_client.post(f"{BASE_URL}/api/process-input", json=input_payload, timeout=30)
        assert response.status_code == 200
        
        result = response.json()
        assert "tasks" in result
        assert len(result["tasks"]) >= 1
        
        for task in result["tasks"]:
            cleanup_test_tasks.append(task["id"])
        
        print(f"✓ Process-input still works: {len(result['tasks'])} tasks created")
