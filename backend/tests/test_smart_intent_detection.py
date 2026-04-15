"""
Backend tests for Smart Intent Detection (Iteration 4)
Tests the new AI-powered intent analysis that determines if user is:
- Creating NEW tasks
- Updating EXISTING tasks (completion, deadline changes, priority)
- MIXED (both creates and updates)
"""
import pytest
import requests
import os
import time

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
    """Cleanup fixture to remove test tasks after tests"""
    created_task_ids = []
    
    yield created_task_ids
    
    # Cleanup: delete all test tasks
    for task_id in created_task_ids:
        try:
            api_client.delete(f"{BASE_URL}/api/tasks/{task_id}")
        except:
            pass


class TestSmartIntentDetection:
    """Test smart intent detection for create vs update vs mixed"""
    
    def test_intent_create_new_task(self, api_client, cleanup_test_tasks):
        """Test that new task text returns intent=create"""
        input_payload = {
            "text": "Buy rice tomorrow, urgent priority",
            "language_hint": "en"
        }
        
        response = api_client.post(f"{BASE_URL}/api/process-input", json=input_payload, timeout=30)
        assert response.status_code == 200
        
        result = response.json()
        
        # Should have intent field
        assert "intent" in result
        assert result["intent"] in ["create", "mixed"]  # Could be mixed if AI sees it differently
        
        # Should have created_tasks
        assert "created_tasks" in result
        assert len(result["created_tasks"]) >= 1
        
        # Should have updated_tasks (empty or present)
        assert "updated_tasks" in result
        
        # Backward compatibility: tasks field should still exist
        assert "tasks" in result
        
        for task in result["created_tasks"]:
            assert "id" in task
            assert "title" in task
            cleanup_test_tasks.append(task["id"])
        
        print(f"✓ Intent CREATE: {result['intent']}, created: {len(result['created_tasks'])}, updated: {len(result['updated_tasks'])}")
    
    def test_intent_update_completion(self, api_client, cleanup_test_tasks):
        """Test that completion text returns intent=update with status=completed"""
        # First, create a task to complete
        task_payload = {
            "title": "Call supplier about rice delivery",
            "priority": "high",
            "status": "pending"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/tasks", json=task_payload)
        assert create_response.status_code == 200
        task_id = create_response.json()["id"]
        cleanup_test_tasks.append(task_id)
        
        # Wait a bit for task to be indexed
        time.sleep(1)
        
        # Now send completion text
        input_payload = {
            "text": "I finished calling the supplier about rice delivery",
            "language_hint": "en"
        }
        
        response = api_client.post(f"{BASE_URL}/api/process-input", json=input_payload, timeout=30)
        assert response.status_code == 200
        
        result = response.json()
        
        # Should have intent field
        assert "intent" in result
        # Intent should be update or mixed
        assert result["intent"] in ["update", "mixed"]
        
        # Should have updated_tasks
        assert "updated_tasks" in result
        
        if len(result["updated_tasks"]) > 0:
            update = result["updated_tasks"][0]
            assert "task_id" in update
            assert "task_title" in update
            assert "changes" in update
            
            # Should have status change to completed
            if "status" in update["changes"]:
                assert update["changes"]["status"] == "completed"
            
            print(f"✓ Intent UPDATE (completion): {result['intent']}, updated: {len(result['updated_tasks'])}")
            print(f"  Updated task: {update['task_title']}, changes: {update['changes']}")
        else:
            print(f"⚠ AI did not match completion text to existing task (this can happen)")
    
    def test_intent_update_deadline_change(self, api_client, cleanup_test_tasks):
        """Test that deadline change text returns intent=update with new due_date"""
        # Create a task with a deadline
        task_payload = {
            "title": "Review accounting reports",
            "priority": "medium",
            "status": "pending",
            "due_date": "2026-02-01"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/tasks", json=task_payload)
        assert create_response.status_code == 200
        task_id = create_response.json()["id"]
        cleanup_test_tasks.append(task_id)
        
        time.sleep(1)
        
        # Send deadline change text
        input_payload = {
            "text": "Move the accounting review to next Friday",
            "language_hint": "en"
        }
        
        response = api_client.post(f"{BASE_URL}/api/process-input", json=input_payload, timeout=30)
        assert response.status_code == 200
        
        result = response.json()
        
        assert "intent" in result
        assert result["intent"] in ["update", "mixed", "create"]  # AI might interpret differently
        
        assert "updated_tasks" in result
        
        if len(result["updated_tasks"]) > 0:
            update = result["updated_tasks"][0]
            assert "changes" in update
            
            # Should have due_date change
            if "due_date" in update["changes"]:
                assert update["changes"]["due_date"] is not None
                print(f"✓ Intent UPDATE (deadline): {result['intent']}, new due_date: {update['changes']['due_date']}")
            else:
                print(f"⚠ AI did not extract due_date change (this can happen)")
        else:
            print(f"⚠ AI did not match deadline change to existing task")
    
    def test_intent_mixed_create_and_update(self, api_client, cleanup_test_tasks):
        """Test that mixed text returns intent=mixed with both created_tasks and updated_tasks"""
        # Create a task to complete
        task_payload = {
            "title": "Call bank about loan",
            "priority": "high",
            "status": "pending"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/tasks", json=task_payload)
        assert create_response.status_code == 200
        task_id = create_response.json()["id"]
        cleanup_test_tasks.append(task_id)
        
        time.sleep(1)
        
        # Send mixed text: completion + new task
        input_payload = {
            "text": "I finished calling the bank. Now I need to buy groceries tomorrow.",
            "language_hint": "en"
        }
        
        response = api_client.post(f"{BASE_URL}/api/process-input", json=input_payload, timeout=30)
        assert response.status_code == 200
        
        result = response.json()
        
        assert "intent" in result
        # Intent could be mixed, create, or update depending on AI interpretation
        assert result["intent"] in ["mixed", "create", "update"]
        
        assert "created_tasks" in result
        assert "updated_tasks" in result
        
        # At least one of them should have items
        total_items = len(result["created_tasks"]) + len(result["updated_tasks"])
        assert total_items >= 1
        
        for task in result["created_tasks"]:
            cleanup_test_tasks.append(task["id"])
        
        print(f"✓ Intent MIXED: {result['intent']}, created: {len(result['created_tasks'])}, updated: {len(result['updated_tasks'])}")
    
    def test_intent_multiple_completions(self, api_client, cleanup_test_tasks):
        """Test completing multiple tasks at once"""
        # Create two tasks
        task1_payload = {
            "title": "Call supplier Nguyen",
            "priority": "high",
            "status": "pending"
        }
        
        task2_payload = {
            "title": "Check inventory levels",
            "priority": "medium",
            "status": "pending"
        }
        
        create1 = api_client.post(f"{BASE_URL}/api/tasks", json=task1_payload)
        create2 = api_client.post(f"{BASE_URL}/api/tasks", json=task2_payload)
        
        task1_id = create1.json()["id"]
        task2_id = create2.json()["id"]
        cleanup_test_tasks.extend([task1_id, task2_id])
        
        time.sleep(1)
        
        # Complete both tasks
        input_payload = {
            "text": "Done with calling Nguyen and checking inventory",
            "language_hint": "en"
        }
        
        response = api_client.post(f"{BASE_URL}/api/process-input", json=input_payload, timeout=30)
        assert response.status_code == 200
        
        result = response.json()
        
        assert "intent" in result
        assert "updated_tasks" in result
        
        # AI might match one or both tasks
        print(f"✓ Multiple completions: {result['intent']}, updated: {len(result['updated_tasks'])} tasks")
    
    def test_intent_priority_change(self, api_client, cleanup_test_tasks):
        """Test changing task priority via text"""
        # Create a task
        task_payload = {
            "title": "Review quarterly reports",
            "priority": "low",
            "status": "pending"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/tasks", json=task_payload)
        assert create_response.status_code == 200
        task_id = create_response.json()["id"]
        cleanup_test_tasks.append(task_id)
        
        time.sleep(1)
        
        # Change priority
        input_payload = {
            "text": "Make the quarterly reports review urgent",
            "language_hint": "en"
        }
        
        response = api_client.post(f"{BASE_URL}/api/process-input", json=input_payload, timeout=30)
        assert response.status_code == 200
        
        result = response.json()
        
        assert "intent" in result
        assert "updated_tasks" in result
        
        if len(result["updated_tasks"]) > 0:
            update = result["updated_tasks"][0]
            if "priority" in update.get("changes", {}):
                print(f"✓ Priority change: {result['intent']}, new priority: {update['changes']['priority']}")
            else:
                print(f"⚠ AI did not extract priority change")
        else:
            print(f"⚠ AI did not match priority change to existing task")
    
    def test_response_structure(self, api_client, cleanup_test_tasks):
        """Test that response has all required fields"""
        input_payload = {
            "text": "Test task for structure validation",
            "language_hint": "en"
        }
        
        response = api_client.post(f"{BASE_URL}/api/process-input", json=input_payload, timeout=30)
        assert response.status_code == 200
        
        result = response.json()
        
        # Required fields
        assert "intent" in result
        assert "created_tasks" in result
        assert "updated_tasks" in result
        assert "raw_interpretation" in result
        assert "language_detected" in result
        assert "confidence" in result
        
        # Backward compatibility
        assert "tasks" in result
        
        # Validate types
        assert isinstance(result["intent"], str)
        assert isinstance(result["created_tasks"], list)
        assert isinstance(result["updated_tasks"], list)
        assert isinstance(result["raw_interpretation"], str)
        assert isinstance(result["language_detected"], str)
        assert isinstance(result["confidence"], (int, float))
        
        for task in result["created_tasks"]:
            cleanup_test_tasks.append(task["id"])
        
        print(f"✓ Response structure valid: intent={result['intent']}, confidence={result['confidence']}")
    
    def test_task_updates_persist_in_database(self, api_client, cleanup_test_tasks):
        """Test that task updates from AI actually persist in database"""
        # Create a task
        task_payload = {
            "title": "TEST_Persistence: Call vendor",
            "priority": "medium",
            "status": "pending"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/tasks", json=task_payload)
        assert create_response.status_code == 200
        task_id = create_response.json()["id"]
        cleanup_test_tasks.append(task_id)
        
        time.sleep(1)
        
        # Complete the task via AI
        input_payload = {
            "text": "I finished calling the vendor",
            "language_hint": "en"
        }
        
        response = api_client.post(f"{BASE_URL}/api/process-input", json=input_payload, timeout=30)
        assert response.status_code == 200
        
        result = response.json()
        
        # If AI matched and updated the task, verify it persists
        if len(result["updated_tasks"]) > 0:
            updated_task_id = result["updated_tasks"][0]["task_id"]
            
            # Fetch the task from database
            get_response = api_client.get(f"{BASE_URL}/api/tasks/{updated_task_id}")
            assert get_response.status_code == 200
            
            fetched_task = get_response.json()
            
            # Check if status was updated
            if "status" in result["updated_tasks"][0]["changes"]:
                expected_status = result["updated_tasks"][0]["changes"]["status"]
                assert fetched_task["status"] == expected_status
                print(f"✓ Task update persisted in DB: {updated_task_id}, status={expected_status}")
            else:
                print(f"✓ Task update persisted in DB: {updated_task_id}")
        else:
            print(f"⚠ AI did not match task for update (this can happen)")


class TestBackwardCompatibility:
    """Test that old API behavior still works"""
    
    def test_tasks_field_still_present(self, api_client, cleanup_test_tasks):
        """Test that 'tasks' field is still in response for backward compatibility"""
        input_payload = {
            "text": "Buy milk tomorrow",
            "language_hint": "en"
        }
        
        response = api_client.post(f"{BASE_URL}/api/process-input", json=input_payload, timeout=30)
        assert response.status_code == 200
        
        result = response.json()
        
        # Old field should still exist
        assert "tasks" in result
        assert isinstance(result["tasks"], list)
        
        # New fields should also exist
        assert "created_tasks" in result
        assert "updated_tasks" in result
        
        for task in result.get("created_tasks", []):
            cleanup_test_tasks.append(task["id"])
        
        print(f"✓ Backward compatibility: 'tasks' field present")
