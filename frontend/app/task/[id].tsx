import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTaskStore } from '../../src/stores/taskStore';
import { getTask, updateTask, submitCorrection } from '../../src/services/api';
import { Task, TaskUpdate } from '../../src/types';

const priorities = ['low', 'medium', 'high', 'urgent'] as const;
const statuses = ['pending', 'in_progress', 'completed', 'cancelled'] as const;
const categories = ['supplier', 'customer', 'inventory', 'staff', 'finance', 'personal', 'other'] as const;

const priorityColors: Record<string, { bg: string; text: string }> = {
  urgent: { bg: '#FEE2E2', text: '#DC2626' },
  high: { bg: '#FEF3C7', text: '#D97706' },
  medium: { bg: '#DBEAFE', text: '#2563EB' },
  low: { bg: '#D1FAE5', text: '#059669' },
};

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { fetchTasks } = useTaskStore();

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Editable fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<string>('medium');
  const [status, setStatus] = useState<string>('pending');
  const [category, setCategory] = useState<string>('');
  const [dueDate, setDueDate] = useState('');
  
  // Track original values for correction
  const [originalValues, setOriginalValues] = useState<Partial<Task>>({});

  useEffect(() => {
    loadTask();
  }, [id]);

  const loadTask = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const taskData = await getTask(id);
      setTask(taskData);
      setTitle(taskData.title);
      setDescription(taskData.description || '');
      setPriority(taskData.priority);
      setStatus(taskData.status);
      setCategory(taskData.category || '');
      setDueDate(taskData.due_date || '');
      setOriginalValues({
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority,
        category: taskData.category,
        due_date: taskData.due_date,
      });
    } catch (err: any) {
      Alert.alert('Error', 'Failed to load task');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id || !task) return;
    
    setSaving(true);
    try {
      const updates: TaskUpdate = {};
      const corrections: { field: string; original: string; corrected: string }[] = [];

      if (title !== originalValues.title) {
        updates.title = title;
        corrections.push({ field: 'title', original: originalValues.title || '', corrected: title });
      }
      if (description !== originalValues.description) {
        updates.description = description;
      }
      if (priority !== originalValues.priority) {
        updates.priority = priority;
        corrections.push({ field: 'priority', original: originalValues.priority || '', corrected: priority });
      }
      if (status !== task.status) {
        updates.status = status;
      }
      if (category !== originalValues.category) {
        updates.category = category || undefined;
        corrections.push({ field: 'category', original: originalValues.category || '', corrected: category });
      }
      if (dueDate !== originalValues.due_date) {
        updates.due_date = dueDate || undefined;
        corrections.push({ field: 'due_date', original: originalValues.due_date || '', corrected: dueDate });
      }

      if (Object.keys(updates).length > 0) {
        await updateTask(id, updates);
        
        // Submit corrections for learning
        for (const correction of corrections) {
          if (task.original_input) {
            try {
              await submitCorrection(
                id,
                correction.field,
                correction.original,
                correction.corrected,
                task.original_input
              );
            } catch (e) {
              console.log('Correction submission failed:', e);
            }
          }
        }
        
        fetchTasks();
        Alert.alert('Success', 'Task updated! Lamdi is learning from your corrections.', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        router.back();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      </SafeAreaView>
    );
  }

  if (!task) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Task not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Task</Text>
          <TouchableOpacity onPress={handleSave} style={styles.saveButton} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {task.original_input && (
            <View style={styles.originalInputBox}>
              <View style={styles.originalInputHeader}>
                <Ionicons name="mic-outline" size={16} color="#6366F1" />
                <Text style={styles.originalInputLabel}>Original Input</Text>
              </View>
              <Text style={styles.originalInputText}>{task.original_input}</Text>
              <Text style={styles.correctionHint}>
                Edit fields below to help Lamdi learn your preferences
              </Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Task title"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Add details..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Priority</Text>
            <View style={styles.optionsRow}>
              {priorities.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.optionButton,
                    priority === p && { backgroundColor: priorityColors[p].bg },
                  ]}
                  onPress={() => setPriority(p)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      priority === p && { color: priorityColors[p].text, fontWeight: '600' },
                    ]}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Status</Text>
            <View style={styles.optionsRow}>
              {statuses.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.optionButton,
                    status === s && styles.optionButtonActive,
                  ]}
                  onPress={() => setStatus(s)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      status === s && styles.optionTextActive,
                    ]}
                  >
                    {s.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.optionsRow}>
                {categories.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.optionButton,
                      category === c && styles.optionButtonActive,
                    ]}
                    onPress={() => setCategory(category === c ? '' : c)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        category === c && styles.optionTextActive,
                      ]}
                    >
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Due Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="2025-07-15"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {task.language_detected && (
            <View style={styles.metaInfo}>
              <Ionicons name="language-outline" size={16} color="#6B7280" />
              <Text style={styles.metaText}>
                Detected language: {task.language_detected.toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.metaInfo}>
            <Ionicons name="time-outline" size={16} color="#6B7280" />
            <Text style={styles.metaText}>
              Created: {new Date(task.created_at).toLocaleString()}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  saveButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  originalInputBox: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  originalInputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  originalInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366F1',
  },
  originalInputText: {
    fontSize: 14,
    color: '#4338CA',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  correctionHint: {
    fontSize: 11,
    color: '#6366F1',
    marginTop: 8,
    fontWeight: '500',
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  textArea: {
    minHeight: 100,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionButtonActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  optionText: {
    fontSize: 13,
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  optionTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  metaText: {
    fontSize: 13,
    color: '#6B7280',
  },
});
