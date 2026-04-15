import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getPendingReminders, acknowledgeReminder, configureReminder } from '../services/api';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

export async function scheduleTaskReminder(taskId: string, title: string, priority: string, intervalMinutes: number = 240) {
  // Configure reminder on backend
  await configureReminder(taskId, intervalMinutes);

  // Schedule local notification
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  const priorityEmoji = priority === 'urgent' ? '🔴' : priority === 'high' ? '🟠' : '🔵';

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${priorityEmoji} Task Reminder`,
      body: title,
      data: { taskId, type: 'task_reminder' },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: intervalMinutes * 60,
      repeats: true,
    },
  });
}

export async function cancelTaskReminder(taskId: string) {
  // Get all scheduled notifications and cancel ones for this task
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.content.data?.taskId === taskId) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
}

// Poll backend for pending reminders and fire local notifications
let pollInterval: NodeJS.Timeout | null = null;

export function startReminderPolling(intervalMs: number = 60000) {
  if (pollInterval) return;

  pollInterval = setInterval(async () => {
    try {
      const { pending_reminders } = await getPendingReminders();
      for (const rem of pending_reminders) {
        // Send immediate notification
        const priorityEmoji = rem.task_priority === 'urgent' ? '🔴' : rem.task_priority === 'high' ? '🟠' : '🔵';
        
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `${priorityEmoji} Pending Task`,
            body: `${rem.task_title} (reminded ${rem.send_count + 1}x)`,
            data: { taskId: rem.task_id, type: 'persistent_reminder' },
            sound: true,
          },
          trigger: null, // Immediate
        });

        // Acknowledge so next reminder is scheduled
        await acknowledgeReminder(rem.task_id);
      }
    } catch (err) {
      // Silent fail - don't disrupt UX
      console.log('Reminder poll error:', err);
    }
  }, intervalMs);
}

export function stopReminderPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}
