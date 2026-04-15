import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { Mic, Send } from 'lucide-react-native';

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  isProcessing: boolean;
}

export default function VoiceRecorder({ onTranscription, isProcessing }: VoiceRecorderProps) {
  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState(false);

  const handleSend = () => {
    const trimmed = text.trim();
    if (trimmed) {
      onTranscription(trimmed);
      setText('');
      setExpanded(false);
    }
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

  if (!expanded) {
    return (
      <View style={styles.container} testID="voice-recorder">
        <TouchableOpacity
          testID="voice-record-button"
          style={styles.fab}
          onPress={() => setExpanded(true)}
          activeOpacity={0.8}
          accessible
          accessibilityLabel="Add voice or text task"
          accessibilityRole="button"
        >
          <Mic size={36} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.hint}>Tap to add a task</Text>
        <Text style={styles.subhint}>Speak naturally in any language</Text>
      </View>
    );
  }

  return (
    <View style={styles.expandedContainer} testID="voice-recorder-expanded">
      <Text style={styles.expandedTitle}>What do you need to do?</Text>
      <Text style={styles.expandedSub}>
        Say it naturally — create tasks, mark done, change deadlines
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
          onPress={() => { setText(''); setExpanded(false); }}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="send-voice-input"
          style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim()}
          activeOpacity={0.8}
        >
          <Send size={18} color="#FFFFFF" />
          <Text style={styles.sendText}>Send to Lamdi</Text>
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
    shadowColor: '#D48C70', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 10,
    marginBottom: 8,
  },
  hint: { color: '#5C6A5D', fontSize: 14, fontWeight: '500' },
  subhint: { color: '#B8C4B9', fontSize: 12, marginTop: 4 },
  busyWrap: { alignItems: 'center', padding: 24 },
  busyText: { color: '#4A6B53', fontSize: 15, fontWeight: '600', marginTop: 12 },

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
  exChip: { fontSize: 12, color: '#D48C70', backgroundColor: '#FAEFEA', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, overflow: 'hidden' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 16 },
  cancelText: { color: '#5C6A5D', fontSize: 14, fontWeight: '500' },
  sendBtn: {
    flex: 1, flexDirection: 'row', backgroundColor: '#4A6B53', borderRadius: 14,
    padding: 14, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  sendBtnDisabled: { backgroundColor: '#B8C4B9' },
  sendText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
