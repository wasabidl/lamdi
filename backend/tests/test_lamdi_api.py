"""
Lamdi API Backend Tests
Tests all CRUD operations, AI task extraction, and stats endpoints
"""
import pytest
import requests
import os
import time

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
    """Cleanup fixture to remove test tasks after tests"""
    created_task_ids = []
    
    yield created_task_ids
    
    # Cleanup: delete all test tasks
    for task_id in created_task_ids:
        try:
            api_client.delete(f"{BASE_URL}/api/tasks/{task_id}")
        except:
            pass

class TestBasicEndpoints:
    """Test basic API endpoints"""
    
    def test_root_endpoint(self, api_client):
        """Test GET /api/ returns version info"""
        response = api_client.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "Lamdi" in data["message"]
        assert "version" in data
        print(f"✓ Root endpoint: {data}")
    
    def test_health_check(self, api_client):
        """Test GET /api/health returns healthy status"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        print(f"✓ Health check: {data}")
    
    def test_stats_endpoint(self, api_client):
        """Test GET /api/stats returns task statistics"""
        response = api_client.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_tasks" in data
        assert "pending" in data
        assert "completed" in data
        assert "completion_rate" in data
        assert "urgent_tasks" in data
        assert "high_priority_tasks" in data
        assert "learned_patterns" in data
        assert "corrections_made" in data
        
        # Validate data types
        assert isinstance(data["total_tasks"], int)
        assert isinstance(data["pending"], int)
        assert isinstance(data["completed"], int)
        assert isinstance(data["completion_rate"], (int, float))
        print(f"✓ Stats: {data}")


class TestTaskCRUD:
    """Test Task CRUD operations with Create→GET verification"""
    
    def test_create_task_and_verify(self, api_client, cleanup_test_tasks):
        """Test POST /api/tasks creates task and verify with GET"""
        task_payload = {
            "title": "TEST_Sample Task",
            "description": "This is a test task",
            "priority": "high",
            "due_date": "2026-05-01",
            "category": "personal",
            "tags": ["test", "sample"]
        }
        
        # Create task
        create_response = api_client.post(f"{BASE_URL}/api/tasks", json=task_payload)
        assert create_response.status_code == 200
        
        created_task = create_response.json()
        assert created_task["title"] == task_payload["title"]
        assert created_task["description"] == task_payload["description"]
        assert created_task["priority"] == task_payload["priority"]
        assert created_task["due_date"] == task_payload["due_date"]
        assert created_task["category"] == task_payload["category"]
        assert created_task["status"] == "pending"
        assert "id" in created_task
        assert "created_at" in created_task
        
        task_id = created_task["id"]
        cleanup_test_tasks.append(task_id)
        
        # Verify with GET
        get_response = api_client.get(f"{BASE_URL}/api/tasks/{task_id}")
        assert get_response.status_code == 200
        
        fetched_task = get_response.json()
        assert fetched_task["id"] == task_id
        assert fetched_task["title"] == task_payload["title"]
        print(f"✓ Task created and verified: {task_id}")
    
    def test_get_all_tasks(self, api_client):
        """Test GET /api/tasks returns list of tasks"""
        response = api_client.get(f"{BASE_URL}/api/tasks")
        assert response.status_code == 200
        
        tasks = response.json()
        assert isinstance(tasks, list)
        print(f"✓ Retrieved {len(tasks)} tasks")
    
    def test_get_tasks_with_filters(self, api_client, cleanup_test_tasks):
        """Test GET /api/tasks with status filter"""
        # Create a pending task
        task_payload = {
            "title": "TEST_Filtered Task",
            "priority": "medium",
            "status": "pending"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/tasks", json=task_payload)
        assert create_response.status_code == 200
        task_id = create_response.json()["id"]
        cleanup_test_tasks.append(task_id)
        
        # Filter by status
        response = api_client.get(f"{BASE_URL}/api/tasks?status=pending")
        assert response.status_code == 200
        
        tasks = response.json()
        assert isinstance(tasks, list)
        # All returned tasks should be pending
        for task in tasks:
            assert task["status"] == "pending"
        print(f"✓ Filter by status works: {len(tasks)} pending tasks")
    
    def test_update_task_and_verify(self, api_client, cleanup_test_tasks):
        """Test PUT /api/tasks/{id} updates task and verify changes"""
        # Create task
        task_payload = {
            "title": "TEST_Task to Update",
            "priority": "low",
            "status": "pending"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/tasks", json=task_payload)
        assert create_response.status_code == 200
        task_id = create_response.json()["id"]
        cleanup_test_tasks.append(task_id)
        
        # Update task to completed
        update_payload = {
            "status": "completed",
            "priority": "high"
        }
        
        update_response = api_client.put(f"{BASE_URL}/api/tasks/{task_id}", json=update_payload)
        assert update_response.status_code == 200
        
        updated_task = update_response.json()
        assert updated_task["status"] == "completed"
        assert updated_task["priority"] == "high"
        assert "completed_at" in updated_task
        
        # Verify with GET
        get_response = api_client.get(f"{BASE_URL}/api/tasks/{task_id}")
        assert get_response.status_code == 200
        
        fetched_task = get_response.json()
        assert fetched_task["status"] == "completed"
        assert fetched_task["priority"] == "high"
        print(f"✓ Task updated and verified: {task_id}")
    
    def test_delete_task_and_verify(self, api_client):
        """Test DELETE /api/tasks/{id} deletes task and verify with 404"""
        # Create task
        task_payload = {
            "title": "TEST_Task to Delete",
            "priority": "medium"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/tasks", json=task_payload)
        assert create_response.status_code == 200
        task_id = create_response.json()["id"]
        
        # Delete task
        delete_response = api_client.delete(f"{BASE_URL}/api/tasks/{task_id}")
        assert delete_response.status_code == 200
        
        data = delete_response.json()
        assert "message" in data
        
        # Verify task is gone (should return 404)
        get_response = api_client.get(f"{BASE_URL}/api/tasks/{task_id}")
        assert get_response.status_code == 404
        print(f"✓ Task deleted and verified: {task_id}")
    
    def test_get_nonexistent_task(self, api_client):
        """Test GET /api/tasks/{id} returns 404 for non-existent task"""
        response = api_client.get(f"{BASE_URL}/api/tasks/nonexistent-id-12345")
        assert response.status_code == 404
        print("✓ Non-existent task returns 404")


class TestAITaskExtraction:
    """Test AI-powered task extraction from text input"""
    
    def test_process_english_input(self, api_client, cleanup_test_tasks):
        """Test POST /api/process-input with English text"""
        input_payload = {
            "text": "Call supplier about urgent rice delivery tomorrow and check inventory next week",
            "language_hint": "en"
        }
        
        response = api_client.post(f"{BASE_URL}/api/process-input", json=input_payload)
        assert response.status_code == 200
        
        result = response.json()
        assert "tasks" in result
        assert "raw_interpretation" in result
        assert "language_detected" in result
        assert "confidence" in result
        
        # Should detect English
        assert result["language_detected"] in ["en", "english", "mixed"]
        
        # Should create at least one task
        assert len(result["tasks"]) >= 1
        
        # Verify task structure
        for task in result["tasks"]:
            assert "id" in task
            assert "title" in task
            assert "priority" in task
            assert task["priority"] in ["low", "medium", "high", "urgent"]
            cleanup_test_tasks.append(task["id"])
        
        print(f"✓ English extraction: {len(result['tasks'])} tasks, confidence: {result['confidence']}")
        print(f"  Interpretation: {result['raw_interpretation']}")
    
    def test_process_czech_input(self, api_client, cleanup_test_tasks):
        """Test POST /api/process-input with Czech text"""
        input_payload = {
            "text": "Zítra zavolat do banky ohledně půjčky a příští týden zkontrolovat účetnictví",
            "language_hint": "cs"
        }
        
        # AI processing may take time
        response = api_client.post(f"{BASE_URL}/api/process-input", json=input_payload, timeout=30)
        assert response.status_code == 200
        
        result = response.json()
        assert "tasks" in result
        assert "language_detected" in result
        
        # Should detect Czech
        assert result["language_detected"] in ["cs", "czech", "mixed"]
        
        # Should create tasks
        assert len(result["tasks"]) >= 1
        
        for task in result["tasks"]:
            cleanup_test_tasks.append(task["id"])
        
        print(f"✓ Czech extraction: {len(result['tasks'])} tasks, language: {result['language_detected']}")
    
    def test_process_vietnamese_input(self, api_client, cleanup_test_tasks):
        """Test POST /api/process-input with Vietnamese text"""
        input_payload = {
            "text": "Gọi nhà cung cấp Nguyễn về đơn hàng gạo ngày mai",
            "language_hint": "vi"
        }
        
        response = api_client.post(f"{BASE_URL}/api/process-input", json=input_payload, timeout=30)
        assert response.status_code == 200
        
        result = response.json()
        assert "tasks" in result
        assert "language_detected" in result
        
        # Should detect Vietnamese
        assert result["language_detected"] in ["vi", "vietnamese", "mixed"]
        
        # Should create tasks
        assert len(result["tasks"]) >= 1
        
        for task in result["tasks"]:
            cleanup_test_tasks.append(task["id"])
        
        print(f"✓ Vietnamese extraction: {len(result['tasks'])} tasks, language: {result['language_detected']}")
    
    def test_process_input_without_text(self, api_client):
        """Test POST /api/process-input without text returns 400"""
        input_payload = {}
        
        response = api_client.post(f"{BASE_URL}/api/process-input", json=input_payload)
        assert response.status_code == 400
        print("✓ Empty input returns 400")
    
    def test_ai_extracted_tasks_persist(self, api_client, cleanup_test_tasks):
        """Test that AI-extracted tasks are actually saved to database"""
        input_payload = {
            "text": "TEST_AI: Buy groceries today, urgent priority",
            "language_hint": "en"
        }
        
        response = api_client.post(f"{BASE_URL}/api/process-input", json=input_payload, timeout=30)
        assert response.status_code == 200
        
        result = response.json()
        assert len(result["tasks"]) >= 1
        
        task_id = result["tasks"][0]["id"]
        cleanup_test_tasks.append(task_id)
        
        # Verify task persists in database
        get_response = api_client.get(f"{BASE_URL}/api/tasks/{task_id}")
        assert get_response.status_code == 200
        
        fetched_task = get_response.json()
        assert fetched_task["id"] == task_id
        assert "original_input" in fetched_task
        assert fetched_task["original_input"] == input_payload["text"]
        print(f"✓ AI-extracted task persists in DB: {task_id}")


class TestStatsAccuracy:
    """Test that stats endpoint returns accurate counts"""
    
    def test_stats_reflect_task_changes(self, api_client, cleanup_test_tasks):
        """Test that stats update when tasks are created/completed"""
        # Get initial stats
        initial_stats = api_client.get(f"{BASE_URL}/api/stats").json()
        initial_total = initial_stats["total_tasks"]
        initial_pending = initial_stats["pending"]
        
        # Create a pending task
        task_payload = {
            "title": "TEST_Stats Task",
            "priority": "medium",
            "status": "pending"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/tasks", json=task_payload)
        task_id = create_response.json()["id"]
        cleanup_test_tasks.append(task_id)
        
        # Get updated stats
        updated_stats = api_client.get(f"{BASE_URL}/api/stats").json()
        
        # Total should increase by 1
        assert updated_stats["total_tasks"] == initial_total + 1
        assert updated_stats["pending"] == initial_pending + 1
        
        print(f"✓ Stats updated correctly after task creation")
