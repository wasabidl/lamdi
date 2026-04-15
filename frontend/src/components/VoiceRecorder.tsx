import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import { Mic, Square } from 'lucide-react-native';
import { transcribeAudio } from '../services/api';

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  isProcessing: boolean;
}

export default function VoiceRecorder({ onTranscription, isProcessing }: VoiceRecorderProps) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
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
      // Fallback to text prompt on web
      promptTextFallback();
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;
    try {
      await recorder.stop();
      setIsRecording(false);

      const uri = recorder.uri;
      if (uri && Platform.OS !== 'web') {
        // Read audio file as base64 and send to Whisper
        setIsTranscribing(true);
        try {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const ext = uri.split('.').pop() || 'm4a';
          const result = await transcribeAudio(base64, ext);
          if (result.success && result.text && result.text.trim()) {
            onTranscription(result.text.trim());
          } else {
            Alert.alert('No speech detected', 'Could not detect any speech. Please try again.');
          }
        } catch (err: any) {
          console.error('Whisper transcription error:', err);
          Alert.alert('Transcription Error', err.message || 'Failed to transcribe audio. Try typing instead.');
        } finally {
          setIsTranscribing(false);
        }
      } else {
        // Web fallback: prompt for text
        promptTextFallback();
      }
    } catch (err) {
      console.error('Stop recording error:', err);
      setIsRecording(false);
      promptTextFallback();
    }
  };

  const promptTextFallback = () => {
    if (Platform.OS === 'web') {
      const text = window.prompt('Type your task (voice recording not available in web preview):');
      if (text && text.trim()) {
        onTranscription(text.trim());
      }
    }
  };

  const ringScale = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });
  const ringOpacity = ringAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 0.15, 0] });

  const busy = isProcessing || isTranscribing;

  if (busy) {
    return (
      <View style={styles.container} testID="voice-recorder">
        <View style={styles.busyWrap}>
          <ActivityIndicator size="large" color="#4A6B53" />
          <Text style={styles.busyText}>
            {isTranscribing ? 'Transcribing your voice...' : 'Processing your task...'}
          </Text>
        </View>
      </View>
    );
  }

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
            style={[styles.ring, { transform: [{ scale: ringScale }], opacity: ringOpacity }]}
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

      <Text style={styles.hint}>{isRecording ? 'Tap to stop & transcribe' : 'Tap to speak'}</Text>
      {!isRecording && (
        <Text style={styles.subhint}>Voice is transcribed by AI (Whisper)</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 16 },
  durationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#D35F5F', marginRight: 8 },
  durationText: { color: '#D35F5F', fontSize: 15, fontWeight: '600' },
  fabWrapper: { alignItems: 'center', justifyContent: 'center', width: 100, height: 100, marginBottom: 8 },
  ring: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: '#D48C70' },
  fab: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#D48C70',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#D48C70', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 10,
  },
  fabRecording: { backgroundColor: '#D35F5F', shadowColor: '#D35F5F' },
  hint: { color: '#5C6A5D', fontSize: 13 },
  subhint: { color: '#B8C4B9', fontSize: 11, marginTop: 4 },
  busyWrap: { alignItems: 'center', padding: 24 },
  busyText: { color: '#4A6B53', fontSize: 15, fontWeight: '600', marginTop: 12 },
});
