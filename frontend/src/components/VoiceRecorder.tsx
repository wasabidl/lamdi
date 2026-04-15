import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Mic, Square, Send, X } from 'lucide-react-native';

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  isProcessing: boolean;
}

// Check Web Speech API availability
const hasWebSpeech = () => {
  if (Platform.OS !== 'web') return false;
  return typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
};

export default function VoiceRecorder({ onTranscription, isProcessing }: VoiceRecorderProps) {
  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation while listening
  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isListening]);

  const startWebSpeech = () => {
    if (!hasWebSpeech()) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = ''; // Auto-detect (browser figures it out)
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalText = '';

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript + ' ';
        } else {
          interim = transcript;
        }
      }
      const combined = (finalText + interim).trim();
      setLiveTranscript(combined);
      setText(combined);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech error:', event.error);
      if (event.error === 'not-allowed') {
        setIsListening(false);
        setExpanded(true);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setLiveTranscript('');
    setText('');
  };

  const stopWebSpeech = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    // Auto-expand to text field so user can review/edit before sending
    if (text.trim()) {
      setExpanded(true);
    }
  };

  const handleMicPress = () => {
    if (isListening) {
      stopWebSpeech();
      return;
    }

    if (hasWebSpeech()) {
      startWebSpeech();
    } else {
      // No Web Speech API — expand to text input
      setExpanded(true);
    }
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (trimmed) {
      onTranscription(trimmed);
      setText('');
      setLiveTranscript('');
      setExpanded(false);
    }
  };

  const handleCancel = () => {
    if (isListening) stopWebSpeech();
    setText('');
    setLiveTranscript('');
    setExpanded(false);
  };

  if (isProcessing) {
    return (
      <View style={styles.container} testID="voice-recorder">
        <View style={styles.busyWrap}>
          <ActivityIndicator size="large" color="#4A6B53" />
          <Text style={styles.busyText}>Lamdi is thinking...</Text>
        </View>
      </View>
    );
  }

  // Listening state — show live transcript with pulsing mic
  if (isListening) {
    return (
      <View style={styles.container} testID="voice-recorder">
        <View style={styles.listeningHeader}>
          <View style={styles.liveDot} />
          <Text style={styles.listeningLabel}>Listening...</Text>
        </View>

        {liveTranscript ? (
          <Text style={styles.liveText}>{liveTranscript}</Text>
        ) : (
          <Text style={styles.liveHint}>Speak now — in any language</Text>
        )}

        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            testID="voice-stop-button"
            style={styles.fabRecording}
            onPress={stopWebSpeech}
            activeOpacity={0.8}
          >
            <Square size={28} color="#FFFFFF" fill="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
        <Text style={styles.hint}>Tap to stop</Text>
      </View>
    );
  }

  // Collapsed state — mic button
  if (!expanded) {
    return (
      <View style={styles.container} testID="voice-recorder">
        <TouchableOpacity
          testID="voice-record-button"
          style={styles.fab}
          onPress={handleMicPress}
          activeOpacity={0.8}
          accessible
          accessibilityLabel="Tap to speak or type a task"
          accessibilityRole="button"
        >
          <Mic size={36} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.hint}>Tap to speak</Text>
        <Text style={styles.subhint}>
          {hasWebSpeech() ? 'Voice recognition active' : 'Speak naturally in any language'}
        </Text>
        <TouchableOpacity
          testID="expand-text-input"
          onPress={() => setExpanded(true)}
          style={styles.typeLink}
        >
          <Text style={styles.typeLinkText}>or type instead</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Expanded text input state
  return (
    <View style={styles.expandedContainer} testID="voice-recorder-expanded">
      <Text style={styles.expandedTitle}>What do you need to do?</Text>
      <Text style={styles.expandedSub}>
        Create tasks, mark done, or change deadlines
      </Text>

      <View style={styles.inputRow}>
        <TextInput
          testID="voice-text-input"
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder='e.g. "I finished calling Nguyen" or "Buy rice tomorrow"'
          placeholderTextColor="#B8C4B9"
          multiline
          autoFocus
          textAlignVertical="top"
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
        />
      </View>

      <View style={styles.examplesRow}>
        <Text style={styles.exLabel}>Try:</Text>
        <TouchableOpacity onPress={() => setText('I finished the inventory check')}>
          <Text style={styles.exChip}>Mark done</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setText('Move bank call to Friday')}>
          <Text style={styles.exChip}>Change date</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setText('Call supplier tomorrow, urgent')}>
          <Text style={styles.exChip}>New task</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          testID="cancel-voice-input"
          style={styles.cancelBtn}
          onPress={handleCancel}
        >
          <X size={16} color="#5C6A5D" />
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>

        {hasWebSpeech() && (
          <TouchableOpacity
            testID="start-voice-btn"
            style={styles.voiceBtn}
            onPress={startWebSpeech}
            activeOpacity={0.8}
          >
            <Mic size={18} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          testID="send-voice-input"
          style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim()}
          activeOpacity={0.8}
        >
          <Send size={18} color="#FFFFFF" />
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 16 },
  fab: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#D48C70',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#D48C70', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 10, marginBottom: 8,
  },
  fabRecording: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#D35F5F',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#D35F5F', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8, marginTop: 12, marginBottom: 8,
  },
  hint: { color: '#5C6A5D', fontSize: 14, fontWeight: '500' },
  subhint: { color: '#B8C4B9', fontSize: 12, marginTop: 4 },
  typeLink: { marginTop: 10 },
  typeLinkText: { color: '#4A6B53', fontSize: 13, fontWeight: '500', textDecorationLine: 'underline' },

  // Listening state
  listeningHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#D35F5F', marginRight: 8 },
  listeningLabel: { color: '#D35F5F', fontSize: 15, fontWeight: '700' },
  liveText: { fontSize: 16, color: '#2D372E', textAlign: 'center', paddingHorizontal: 16, marginBottom: 8, lineHeight: 22 },
  liveHint: { fontSize: 14, color: '#B8C4B9', fontStyle: 'italic', marginBottom: 8 },

  busyWrap: { alignItems: 'center', padding: 24 },
  busyText: { color: '#4A6B53', fontSize: 15, fontWeight: '600', marginTop: 12 },

  // Expanded text input
  expandedContainer: { paddingVertical: 8 },
  expandedTitle: { fontSize: 17, fontWeight: '700', color: '#2D372E', marginBottom: 4 },
  expandedSub: { fontSize: 13, color: '#5C6A5D', marginBottom: 14, lineHeight: 18 },
  inputRow: { marginBottom: 10 },
  input: {
    backgroundColor: '#F9F9F6', borderRadius: 14, padding: 14, fontSize: 15,
    color: '#2D372E', borderWidth: 1, borderColor: '#E8EBE8', minHeight: 80,
  },
  examplesRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  exLabel: { fontSize: 12, color: '#5C6A5D', fontWeight: '600' },
  exChip: {
    fontSize: 12, color: '#D48C70', backgroundColor: '#FAEFEA',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, overflow: 'hidden',
  },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, gap: 4 },
  cancelText: { color: '#5C6A5D', fontSize: 14, fontWeight: '500' },
  voiceBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#D48C70',
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtn: {
    flex: 1, flexDirection: 'row', backgroundColor: '#4A6B53', borderRadius: 14,
    padding: 14, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  sendBtnDisabled: { backgroundColor: '#B8C4B9' },
  sendText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
