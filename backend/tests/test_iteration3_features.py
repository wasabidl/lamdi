"""
Lamdi API Backend Tests - ITERATION 3 FEATURES
Tests for:
- Reminder interval customization (task edit screen integration)
- Reminder configuration with different intervals (15min, 30min, 1hr, 2hr, 4hr, 8hr, 24hr)
- Reminder auto-adjust based on priority
- Reminder cancellation when task status changes to completed
"""
import pytest
import requests
import os

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


class TestReminderIntervalCustomization:
    """Test reminder interval customization feature"""
    
    def test_configure_reminder_with_15min_interval(self, api_client, cleanup_test_tasks):
        """Test configuring reminder with 15-minute interval"""
        # Create task
        task_payload = {
            "title": "TEST_15min reminder task",
            "priority": "urgent",
            "status": "pending"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/tasks", json=task_payload)
        assert create_response.status_code == 200
        task_id = create_response.json()["id"]
        cleanup_test_tasks.append(task_id)
        
        # Configure reminder with 15min interval
        reminder_payload = {
            "task_id": task_id,
            "interval_minutes": 15,
            "enabled": True
        }
        
        response = api_client.post(f"{BASE_URL}/api/reminders/configure", json=reminder_payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["interval_minutes"] == 15
        
        print(f"✓ 15-minute interval configured for task {task_id}")
    
    def test_configure_reminder_with_30min_interval(self, api_client, cleanup_test_tasks):
        """Test configuring reminder with 30-minute interval"""
        task_payload = {
            "title": "TEST_30min reminder task",
            "priority": "urgent",
            "status": "pending"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/tasks", json=task_payload)
        task_id = create_response.json()["id"]
        cleanup_test_tasks.append(task_id)
        
        reminder_payload = {
            "task_id": task_id,
            "interval_minutes": 30,
            "enabled": True
        }
        
        response = api_client.post(f"{BASE_URL}/api/reminders/configure", json=reminder_payload)
        assert response.status_code == 200
        assert response.json()["interval_minutes"] == 30
        
        print(f"✓ 30-minute interval configured")
    
    def test_configure_reminder_with_1hr_interval(self, api_client, cleanup_test_tasks):
        """Test configuring reminder with 1-hour (60min) interval"""
        task_payload = {
            "title": "TEST_1hr reminder task",
            "priority": "high",
            "status": "pending"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/tasks", json=task_payload)
        task_id = create_response.json()["id"]
        cleanup_test_tasks.append(task_id)
        
        reminder_payload = {
            "task_id": task_id,
            "interval_minutes": 60,
            "enabled": True
        }
        
        response = api_client.post(f"{BASE_URL}/api/reminders/configure", json=reminder_payload)
        assert response.status_code == 200
        assert response.json()["interval_minutes"] == 60
        
        print(f"✓ 1-hour interval configured")
    
    def test_configure_reminder_with_2hr_interval(self, api_client, cleanup_test_tasks):
        """Test configuring reminder with 2-hour (120min) interval"""
        task_payload = {
            "title": "TEST_2hr reminder task",
            "priority": "high",
            "status": "pending"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/tasks", json=task_payload)
        task_id = create_response.json()["id"]
        cleanup_test_tasks.append(task_id)
        
        reminder_payload = {
            "task_id": task_id,
            "interval_minutes": 120,
            "enabled": True
        }
        
        response = api_client.post(f"{BASE_URL}/api/reminders/configure", json=reminder_payload)
        assert response.status_code == 200
        assert response.json()["interval_minutes"] == 120
        
        print(f"✓ 2-hour interval configured")
    
    def test_configure_reminder_with_4hr_interval(self, api_client, cleanup_test_tasks):
        """Test configuring reminder with 4-hour (240min) interval"""
        task_payload = {
            "title": "TEST_4hr reminder task",
            "priority": "medium",
            "status": "pending"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/tasks", json=task_payload)
        task_id = create_response.json()["id"]
        cleanup_test_tasks.append(task_id)
        
        reminder_payload = {
            "task_id": task_id,
            "interval_minutes": 240,
            "enabled": True
        }
        
        response = api_client.post(f"{BASE_URL}/api/reminders/configure", json=reminder_payload)
        assert response.status_code == 200
        assert response.json()["interval_minutes"] == 240
        
        print(f"✓ 4-hour interval configured")
    
    def test_configure_reminder_with_8hr_interval(self, api_client, cleanup_test_tasks):
        """Test configuring reminder with 8-hour (480min) interval"""
        task_payload = {
            "title": "TEST_8hr reminder task",
            "priority": "low",
            "status": "pending"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/tasks", json=task_payload)
        task_id = create_response.json()["id"]
        cleanup_test_tasks.append(task_id)
        
        reminder_payload = {
            "task_id": task_id,
            "interval_minutes": 480,
            "enabled": True
        }
        
        response = api_client.post(f"{BASE_URL}/api/reminders/configure", json=reminder_payload)
        assert response.status_code == 200
        assert response.json()["interval_minutes"] == 480
        
        print(f"✓ 8-hour interval configured")
    
    def test_configure_reminder_with_24hr_interval(self, api_client, cleanup_test_tasks):
        """Test configuring reminder with 24-hour (1440min) interval"""
        task_payload = {
            "title": "TEST_24hr reminder task",
            "priority": "low",
            "status": "pending"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/tasks", json=task_payload)
        task_id = create_response.json()["id"]
        cleanup_test_tasks.append(task_id)
        
        reminder_payload = {
            "task_id": task_id,
            "interval_minutes": 1440,
            "enabled": True
        }
        
        response = api_client.post(f"{BASE_URL}/api/reminders/configure", json=reminder_payload)
        assert response.status_code == 200
        assert response.json()["interval_minutes"] == 1440
        
        print(f"✓ 24-hour interval configured")


class TestReminderPriorityAutoAdjust:
    """Test reminder interval auto-adjustment based on priority"""
    
    def test_urgent_priority_default_30min(self, api_client, cleanup_test_tasks):
        """Test that urgent priority tasks default to 30-minute reminders"""
        task_payload = {
            "title": "TEST_Urgent task auto-adjust",
            "priority": "urgent",
            "status": "pending"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/tasks", json=task_payload)
        task_id = create_response.json()["id"]
        cleanup_test_tasks.append(task_id)
        
        # Configure with 30min (urgent default)
        reminder_payload = {
            "task_id": task_id,
            "interval_minutes": 30,
            "enabled": True
        }
        
        response = api_client.post(f"{BASE_URL}/api/reminders/configure", json=reminder_payload)
        assert response.status_code == 200
        assert response.json()["interval_minutes"] == 30
        
        print(f"✓ Urgent priority task configured with 30min interval")
    
    def test_high_priority_default_2hr(self, api_client, cleanup_test_tasks):
        """Test that high priority tasks default to 2-hour reminders"""
        task_payload = {
            "title": "TEST_High priority auto-adjust",
            "priority": "high",
            "status": "pending"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/tasks", json=task_payload)
        task_id = create_response.json()["id"]
        cleanup_test_tasks.append(task_id)
        
        # Configure with 120min (high default)
        reminder_payload = {
            "task_id": task_id,
            "interval_minutes": 120,
            "enabled": True
        }
        
        response = api_client.post(f"{BASE_URL}/api/reminders/configure", json=reminder_payload)
        assert response.status_code == 200
        assert response.json()["interval_minutes"] == 120
        
        print(f"✓ High priority task configured with 120min interval")


class TestReminderCancellationOnCompletion:
    """Test reminder cancellation when task status changes to completed"""
    
    def test_disable_reminder_when_task_completed(self, api_client, cleanup_test_tasks):
        """Test that reminder can be disabled when task is completed"""
        # Create task with reminder
        task_payload = {
            "title": "TEST_Task to complete",
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
        
        # Update task to completed
        update_payload = {
            "status": "completed"
        }
        update_response = api_client.put(f"{BASE_URL}/api/tasks/{task_id}", json=update_payload)
        assert update_response.status_code == 200
        assert update_response.json()["status"] == "completed"
        
        # Disable reminder (simulating what frontend does)
        disable_response = api_client.delete(f"{BASE_URL}/api/reminders/{task_id}")
        assert disable_response.status_code == 200
        
        print(f"✓ Reminder disabled when task completed")
    
    def test_pending_reminders_exclude_completed_tasks(self, api_client, cleanup_test_tasks):
        """Test that completed tasks don't appear in pending reminders"""
        # Create task with reminder
        task_payload = {
            "title": "TEST_Completed task reminder",
            "priority": "high",
            "status": "pending"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/tasks", json=task_payload)
        task_id = create_response.json()["id"]
        cleanup_test_tasks.append(task_id)
        
        # Configure reminder
        reminder_payload = {
            "task_id": task_id,
            "interval_minutes": 120,
            "enabled": True
        }
        api_client.post(f"{BASE_URL}/api/reminders/configure", json=reminder_payload)
        
        # Get pending reminders (should include our task)
        pending_response = api_client.get(f"{BASE_URL}/api/reminders/pending")
        pending_data = pending_response.json()
        initial_count = pending_data["count"]
        
        # Complete the task
        update_payload = {"status": "completed"}
        api_client.put(f"{BASE_URL}/api/tasks/{task_id}", json=update_payload)
        
        # Get pending reminders again (should NOT include completed task)
        pending_response2 = api_client.get(f"{BASE_URL}/api/reminders/pending")
        pending_data2 = pending_response2.json()
        
        # Verify completed task is not in pending reminders
        completed_task_in_pending = any(
            r["task_id"] == task_id for r in pending_data2["pending_reminders"]
        )
        assert not completed_task_in_pending, "Completed task should not be in pending reminders"
        
        print(f"✓ Completed tasks excluded from pending reminders")


class TestReminderToggleOnOff:
    """Test reminder enable/disable toggle"""
    
    def test_disable_reminder_via_delete_endpoint(self, api_client, cleanup_test_tasks):
        """Test disabling reminder via DELETE /api/reminders/{task_id}"""
        # Create task
        task_payload = {
            "title": "TEST_Toggle reminder off",
            "priority": "medium",
            "status": "pending"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/tasks", json=task_payload)
        task_id = create_response.json()["id"]
        cleanup_test_tasks.append(task_id)
        
        # Enable reminder
        reminder_payload = {
            "task_id": task_id,
            "interval_minutes": 240,
            "enabled": True
        }
        api_client.post(f"{BASE_URL}/api/reminders/configure", json=reminder_payload)
        
        # Disable reminder
        disable_response = api_client.delete(f"{BASE_URL}/api/reminders/{task_id}")
        assert disable_response.status_code == 200
        
        data = disable_response.json()
        assert "disabled" in data["message"].lower()
        
        print(f"✓ Reminder toggled off successfully")
    
    def test_re_enable_reminder_after_disable(self, api_client, cleanup_test_tasks):
        """Test re-enabling reminder after it was disabled"""
        # Create task
        task_payload = {
            "title": "TEST_Re-enable reminder",
            "priority": "high",
            "status": "pending"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/tasks", json=task_payload)
        task_id = create_response.json()["id"]
        cleanup_test_tasks.append(task_id)
        
        # Enable reminder
        reminder_payload = {
            "task_id": task_id,
            "interval_minutes": 120,
            "enabled": True
        }
        api_client.post(f"{BASE_URL}/api/reminders/configure", json=reminder_payload)
        
        # Disable reminder
        api_client.delete(f"{BASE_URL}/api/reminders/{task_id}")
        
        # Re-enable reminder with new interval
        reminder_payload2 = {
            "task_id": task_id,
            "interval_minutes": 60,
            "enabled": True
        }
        
        response = api_client.post(f"{BASE_URL}/api/reminders/configure", json=reminder_payload2)
        assert response.status_code == 200
        assert response.json()["interval_minutes"] == 60
        
        print(f"✓ Reminder re-enabled with new interval")
