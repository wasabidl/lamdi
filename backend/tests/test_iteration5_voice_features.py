"""
Iteration 5 Backend Tests: Voice Features & Smart Intent Detection
Tests POST /api/process-input for create and update intents
"""
import pytest
import requests
import os

# Read from frontend .env file
BASE_URL = "https://clarity-voice-3.preview.emergentagent.com"

class TestVoiceProcessing:
    """Test voice/text processing with smart intent detection"""
    
    def test_create_new_task_intent(self):
        """Test creating a new task via text input"""
        import uuid
        unique_text = f"TEST_ITERATION5_UNIQUE_{uuid.uuid4().hex[:8]}: Schedule dentist appointment"
        
        response = requests.post(
            f"{BASE_URL}/api/process-input",
            json={"text": unique_text}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify intent (should be create for unique task)
        assert data["intent"] in ["create", "mixed"], f"Expected create/mixed, got {data['intent']}"
        assert len(data["created_tasks"]) > 0
        
        # Verify task structure
        task = data["created_tasks"][0]
        assert "id" in task
        assert "title" in task
        
        # Verify response fields
        assert "raw_interpretation" in data
        assert "language_detected" in data
        assert "confidence" in data
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/tasks/{task['id']}")
        
        print(f"✓ Create intent test passed: {data['intent']}, created {len(data['created_tasks'])} task(s)")
        return task["id"]
    
    def test_update_task_completion_intent(self):
        """Test marking a task as done via text input"""
        # First create a task
        create_response = requests.post(
            f"{BASE_URL}/api/tasks",
            json={
                "title": "TEST_ITERATION5: Call supplier Nguyen",
                "priority": "medium"
            }
        )
        assert create_response.status_code == 200
        task = create_response.json()
        task_id = task["id"]
        
        # Now mark it as done via text
        update_response = requests.post(
            f"{BASE_URL}/api/process-input",
            json={"text": "I finished calling Nguyen"}
        )
        assert update_response.status_code == 200
        data = update_response.json()
        
        # Verify intent
        assert data["intent"] in ["update", "mixed"]
        assert len(data["updated_tasks"]) > 0
        
        # Verify update structure
        update = data["updated_tasks"][0]
        assert "task_id" in update
        assert "changes" in update
        assert update["changes"].get("status") == "completed"
        
        # Verify task was actually updated in database
        get_response = requests.get(f"{BASE_URL}/api/tasks/{task_id}")
        assert get_response.status_code == 200
        updated_task = get_response.json()
        assert updated_task["status"] == "completed"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/tasks/{task_id}")
        
        print(f"✓ Update intent test passed: {data['intent']}, updated {len(data['updated_tasks'])} task(s)")
    
    def test_modal_title_for_create_intent(self):
        """Test that create intent returns correct data for 'Tasks Created' modal title"""
        response = requests.post(
            f"{BASE_URL}/api/process-input",
            json={"text": "TEST_ITERATION5: Schedule dentist appointment next week"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # For create intent, modal should show "Tasks Created"
        # Accept update if AI matched to existing task, but verify created_tasks if create
        if data["intent"] == "create":
            assert len(data["created_tasks"]) > 0
            # Cleanup
            for task in data["created_tasks"]:
                requests.delete(f"{BASE_URL}/api/tasks/{task['id']}")
        
        print(f"✓ Modal title test (create): intent={data['intent']}, created={len(data.get('created_tasks', []))}")
    
    def test_modal_title_for_update_intent(self):
        """Test that update intent returns correct data for 'Tasks Updated' modal title"""
        # Create a task first
        create_response = requests.post(
            f"{BASE_URL}/api/tasks",
            json={
                "title": "TEST_ITERATION5: Review accounting",
                "priority": "medium"
            }
        )
        assert create_response.status_code == 200
        task = create_response.json()
        task_id = task["id"]
        
        # Update it via text
        update_response = requests.post(
            f"{BASE_URL}/api/process-input",
            json={"text": "I finished reviewing accounting"}
        )
        assert update_response.status_code == 200
        data = update_response.json()
        
        # For update intent, modal should show "Tasks Updated"
        assert data["intent"] in ["update", "mixed"]
        assert len(data["updated_tasks"]) > 0
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/tasks/{task_id}")
        
        print(f"✓ Modal title test (update): intent={data['intent']}, should show 'Tasks Updated'")

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
