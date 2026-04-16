// Web stub — expo-notifications is native-only.
// Metro's platform resolution picks this file on web instead of notifications.ts,
// so expo-notifications is never imported in the browser bundle.

export async function requestNotificationPermissions(): Promise<boolean> {
  return false;
}

export async function scheduleTaskReminder(
  _taskId: string,
  _title: string,
  _priority: string,
  _intervalMinutes: number = 240,
): Promise<void> {}

export async function cancelTaskReminder(_taskId: string): Promise<void> {}

export function startReminderPolling(_intervalMs: number = 60000): void {}

export function stopReminderPolling(): void {}
