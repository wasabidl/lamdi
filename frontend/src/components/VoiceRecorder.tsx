import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  Animated,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  isProcessing: boolean;
}

export default function VoiceRecorder({ onTranscription, isProcessing }: VoiceRecorderProps) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [permissionResponse, setPermissionResponse] = useState<Audio.PermissionResponse | null>(null);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [recordingDuration, setRecordingDuration] = useState(0);

  useEffect(() => {
    (async () => {
      const permission = await Audio.requestPermissionsAsync();
      setPermissionResponse(permission);
    })();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
      
      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      setRecordingDuration(0);
      pulseAnim.setValue(1);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      if (!permissionResponse?.granted) {
        const permission = await Audio.requestPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission Required', 'Microphone access is needed to record voice notes.');
          return;
        }
        setPermissionResponse(permission);
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const uri = recording.getURI();
      setRecording(null);

      if (uri) {
        // For MVP, we'll show a text input dialog since we don't have server-side transcription yet
        // In production, you'd send the audio to a speech-to-text service
        Alert.prompt(
          'Voice Recording Complete',
          'Please type what you said (or edit the transcription):',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Create Task',
              onPress: (text) => {
                if (text && text.trim()) {
                  onTranscription(text.trim());
                }
              },
            },
          ],
          'plain-text',
          '',
          'default'
        );
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
      Alert.alert('Error', 'Failed to process recording.');
    }
  };

  if (isProcessing) {
    return (
      <View style={styles.container}>
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.processingText}>Processing your voice...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isRecording && (
        <View style={styles.recordingInfo}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>Recording... {formatDuration(recordingDuration)}</Text>
        </View>
      )}
      
      <Animated.View style={[styles.buttonWrapper, { transform: [{ scale: pulseAnim }] }]}>
        <TouchableOpacity
          style={[styles.recordButton, isRecording && styles.recordingActive]}
          onPress={isRecording ? stopRecording : startRecording}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isRecording ? 'stop' : 'mic'}
            size={32}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </Animated.View>
      
      <Text style={styles.hint}>
        {isRecording ? 'Tap to stop' : 'Tap to speak'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  recordingText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonWrapper: {
    marginBottom: 12,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  recordingActive: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  hint: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  processingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  processingText: {
    color: '#6366F1',
    fontSize: 16,
    marginTop: 12,
  },
});
