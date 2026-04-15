import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { requestNotificationPermissions, startReminderPolling, stopReminderPolling } from '../src/services/notifications';

export default function RootLayout() {
  useEffect(() => {
    // Request notification permissions on app start
    if (Platform.OS !== 'web') {
      requestNotificationPermissions();
      startReminderPolling(120000); // Poll every 2 minutes
    }
    return () => stopReminderPolling();
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="task/[id]" />
      </Stack>
    </>
  );
}
