import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import { Mic, Square } from 'lucide-react-native';

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  isProcessing: boolean;
}

export default function VoiceRecorder({ onTranscription, isProcessing }: VoiceRecorderProps) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => setDuration((d) => d + 1), 1000);

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(ringAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(ringAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();
    } else {
      setDuration(0);
      pulseAnim.setValue(1);
      ringAnim.setValue(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const startRecording = async () => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Permission Needed', 'Microphone access is required to record voice notes.');
        return;
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
    } catch (err) {
      console.error('Recording error:', err);
      // Fallback: prompt for text input directly
      promptTextFallback();
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;
    try {
      await recorder.stop();
      setIsRecording(false);
      // For web/preview, fall back to text prompt since we can't transcribe audio locally
      promptTextFallback();
    } catch (err) {
      console.error('Stop recording error:', err);
      setIsRecording(false);
      promptTextFallback();
    }
  };

  const promptTextFallback = () => {
    if (Platform.OS === 'web') {
      const text = window.prompt('What did you say? (Type your task here):');
      if (text && text.trim()) {
        onTranscription(text.trim());
      }
    } else {
      Alert.prompt(
        'Voice Captured',
        'Type what you said (or edit):',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Create Task',
            onPress: (text) => {
              if (text && text.trim()) onTranscription(text.trim());
            },
          },
        ],
        'plain-text'
      );
    }
  };

  const ringScale = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });
  const ringOpacity = ringAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 0.15, 0] });

  return (
    <View style={styles.container} testID="voice-recorder">
      {isRecording && (
        <View style={styles.durationRow}>
          <View style={styles.liveDot} />
          <Text style={styles.durationText}>Recording {fmt(duration)}</Text>
        </View>
      )}

      <View style={styles.fabWrapper}>
        {isRecording && (
          <Animated.View
            style={[
              styles.ring,
              { transform: [{ scale: ringScale }], opacity: ringOpacity },
            ]}
          />
        )}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            testID="voice-record-button"
            style={[styles.fab, isRecording && styles.fabRecording]}
            onPress={isRecording ? stopRecording : startRecording}
            activeOpacity={0.8}
            accessible
            accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
            accessibilityRole="button"
          >
            {isRecording ? (
              <Square size={28} color="#FFFFFF" fill="#FFFFFF" />
            ) : (
              <Mic size={36} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      <Text style={styles.hint}>{isRecording ? 'Tap to stop' : 'Tap to speak'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 16 },
  durationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#D35F5F', marginRight: 8 },
  durationText: { color: '#D35F5F', fontSize: 15, fontWeight: '600' },
  fabWrapper: { alignItems: 'center', justifyContent: 'center', width: 100, height: 100, marginBottom: 8 },
  ring: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#D48C70',
  },
  fab: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#D48C70',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#D48C70',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  fabRecording: { backgroundColor: '#D35F5F', shadowColor: '#D35F5F' },
  hint: { color: '#5C6A5D', fontSize: 13 },
});
