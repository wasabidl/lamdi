import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { X, Sparkles } from 'lucide-react-native';

interface TextInputModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (text: string, languageHint?: string) => void;
  isLoading?: boolean;
}

const languages = [
  { code: undefined, label: 'Auto-detect', flag: '\ud83c\udf10' },
  { code: 'en', label: 'English', flag: '\ud83c\uddec\ud83c\udde7' },
  { code: 'cs', label: '\u010ce\u0161tina', flag: '\ud83c\udde8\ud83c\uddff' },
  { code: 'vi', label: 'Ti\u1ebfng Vi\u1ec7t', flag: '\ud83c\uddfb\ud83c\uddf3' },
];

export default function TextInputModal({ visible, onClose, onSubmit, isLoading }: TextInputModalProps) {
  const [text, setText] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string | undefined>(undefined);

  const handleSubmit = () => {
    if (text.trim()) {
      onSubmit(text.trim(), selectedLanguage);
      setText('');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Add Task</Text>
            <TouchableOpacity testID="close-text-modal" onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close" accessibilityRole="button">
              <X size={22} color="#5C6A5D" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>Describe your task naturally — Lamdi will understand</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.langRow}>
            {languages.map((l) => (
              <TouchableOpacity
                key={l.code || 'auto'}
                testID={`lang-${l.code || 'auto'}`}
                style={[styles.langChip, selectedLanguage === l.code && styles.langChipActive]}
                onPress={() => setSelectedLanguage(l.code)}
                accessibilityLabel={l.label}
                accessibilityRole="button"
              >
                <Text style={styles.langFlag}>{l.flag}</Text>
                <Text style={[styles.langLabel, selectedLanguage === l.code && styles.langLabelActive]}>
                  {l.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TextInput
            testID="task-text-input"
            style={styles.input}
            placeholder="e.g. Call supplier Nguyen about rice delivery tomorrow..."
            placeholderTextColor="#B8C4B9"
            multiline
            numberOfLines={4}
            value={text}
            onChangeText={setText}
            autoFocus
            textAlignVertical="top"
          />

          <View style={styles.examples}>
            <Text style={styles.exTitle}>Try saying:</Text>
            <Text style={styles.exItem}>{'\u2022'} "Order 50kg rice from Nguyen, urgent"</Text>
            <Text style={styles.exItem}>{'\u2022'} "Z\u00edtra zavolat do banky"</Text>
            <Text style={styles.exItem}>{'\u2022'} "Nh\u1eafc t\u00f4i ki\u1ec3m tra h\u00e0ng t\u1ed3n kho"</Text>
          </View>

          <TouchableOpacity
            testID="submit-task-button"
            style={[styles.submitBtn, (!text.trim() || isLoading) && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={!text.trim() || isLoading}
            activeOpacity={0.8}
            accessibilityLabel="Create task with AI"
            accessibilityRole="button"
          >
            <Sparkles size={18} color="#FFFFFF" />
            <Text style={styles.submitText}>{isLoading ? 'Processing...' : 'Create Task with AI'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36, maxHeight: '90%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E8EBE8', alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '700', color: '#2D372E' },
  closeBtn: { padding: 6 },
  subtitle: { fontSize: 14, color: '#5C6A5D', marginBottom: 16 },
  langRow: { flexDirection: 'row', marginBottom: 16, flexGrow: 0 },
  langChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24, backgroundColor: '#F4F5F4', marginRight: 8, gap: 6 },
  langChipActive: { backgroundColor: '#E3EAE4', borderWidth: 1.5, borderColor: '#4A6B53' },
  langFlag: { fontSize: 16 },
  langLabel: { fontSize: 13, color: '#5C6A5D' },
  langLabelActive: { color: '#4A6B53', fontWeight: '600' },
  input: { backgroundColor: '#F9F9F6', borderRadius: 16, padding: 16, fontSize: 16, color: '#2D372E', minHeight: 120, borderWidth: 1, borderColor: '#E8EBE8' },
  examples: { marginTop: 16, padding: 14, backgroundColor: '#DDF0E6', borderRadius: 14 },
  exTitle: { fontSize: 12, fontWeight: '700', color: '#3E7D5F', marginBottom: 4 },
  exItem: { fontSize: 12, color: '#3E7D5F', marginVertical: 1 },
  submitBtn: { flexDirection: 'row', backgroundColor: '#4A6B53', borderRadius: 24, padding: 16, alignItems: 'center', justifyContent: 'center', marginTop: 20, gap: 8 },
  submitDisabled: { backgroundColor: '#B8C4B9' },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
