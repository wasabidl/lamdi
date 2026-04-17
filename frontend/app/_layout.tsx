import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { requestNotificationPermissions, startReminderPolling, stopReminderPolling } from '../src/services/notifications';
import api from '../src/services/api';

export default function RootLayout() {
  useEffect(() => {
    // Wake backend immediately so it's ready by the time user submits
    api.get('/health').catch(() => {});

    if (Platform.OS !== 'web') {
      requestNotificationPermissions();
      startReminderPolling(120000);
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
