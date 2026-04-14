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
import { Ionicons } from '@expo/vector-icons';

interface TextInputModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (text: string, languageHint?: string) => void;
  isLoading?: boolean;
}

const languages = [
  { code: undefined, label: 'Auto-detect', flag: '🌐' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'cs', label: 'Čeština', flag: '🇨🇿' },
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
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

  const placeholders = [
    'Call supplier Nguyen about rice delivery tomorrow...',
    'Zavolej do skladu ohledně zítřejší dodávky...',
    'Gọi cho nhà cung cấp về đơn hàng ngày mai...',
    'Remind me to check inventory tonight...',
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Add Task</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Describe your task naturally - Lamdi will understand
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.languageSelector}>
            {languages.map((lang) => (
              <TouchableOpacity
                key={lang.code || 'auto'}
                style={[
                  styles.languageButton,
                  selectedLanguage === lang.code && styles.languageButtonActive,
                ]}
                onPress={() => setSelectedLanguage(lang.code)}
              >
                <Text style={styles.languageFlag}>{lang.flag}</Text>
                <Text
                  style={[
                    styles.languageLabel,
                    selectedLanguage === lang.code && styles.languageLabelActive,
                  ]}
                >
                  {lang.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TextInput
            style={styles.input}
            placeholder={placeholders[Math.floor(Math.random() * placeholders.length)]}
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            value={text}
            onChangeText={setText}
            autoFocus
            textAlignVertical="top"
          />

          <View style={styles.exampleContainer}>
            <Text style={styles.exampleTitle}>Examples:</Text>
            <Text style={styles.exampleText}>• "Order 50kg rice from Nguyen, urgent"</Text>
            <Text style={styles.exampleText}>• "Zítra zavolat do banky"</Text>
            <Text style={styles.exampleText}>• "Nhắc tôi kiểm tra hàng tồn kho"</Text>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, (!text.trim() || isLoading) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!text.trim() || isLoading}
          >
            <Ionicons name="sparkles" size={20} color="#FFFFFF" />
            <Text style={styles.submitButtonText}>
              {isLoading ? 'Processing...' : 'Create Task with AI'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  languageSelector: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
    gap: 6,
  },
  languageButtonActive: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  languageFlag: {
    fontSize: 16,
  },
  languageLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  languageLabelActive: {
    color: '#6366F1',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  exampleContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
  },
  exampleTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 4,
  },
  exampleText: {
    fontSize: 12,
    color: '#047857',
    marginVertical: 2,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#6366F1',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#C7D2FE',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
