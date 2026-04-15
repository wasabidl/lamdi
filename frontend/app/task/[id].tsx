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
import { ArrowLeft, Save, Mic, Clock, Globe, Bell, BellOff } from 'lucide-react-native';
import { useTaskStore } from '../../src/stores/taskStore';
import { getTask, updateTask, submitCorrection, configureReminder, disableReminder } from '../../src/services/api';
import { Task, TaskUpdate } from '../../src/types';
import { scheduleTaskReminder, cancelTaskReminder } from '../../src/services/notifications';

const priorities = ['low', 'medium', 'high', 'urgent'] as const;
const statuses = ['pending', 'in_progress', 'completed', 'cancelled'] as const;
const categories = ['supplier', 'customer', 'inventory', 'staff', 'finance', 'personal', 'other'] as const;

const reminderIntervals = [
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hour' },
  { minutes: 120, label: '2 hours' },
  { minutes: 240, label: '4 hours' },
  { minutes: 480, label: '8 hours' },
  { minutes: 1440, label: '24 hours' },
] as const;

const priorityColors: Record<string, { bg: string; text: string }> = {
  urgent: { bg: '#FBEAEB', text: '#D35F5F' },
  high: { bg: '#F9EDDF', text: '#C7823B' },
  medium: { bg: '#E3EAE4', text: '#4A6B53' },
  low: { bg: '#DDF0E6', text: '#3E7D5F' },
};

const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#F9EDDF', text: '#C7823B' },
  in_progress: { bg: '#E3EAE4', text: '#4A6B53' },
  completed: { bg: '#DDF0E6', text: '#3E7D5F' },
  cancelled: { bg: '#FBEAEB', text: '#D35F5F' },
};

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { fetchTasks } = useTaskStore();

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<string>('medium');
  const [status, setStatus] = useState<string>('pending');
  const [category, setCategory] = useState<string>('');
  const [dueDate, setDueDate] = useState('');

  // Reminder state
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderInterval, setReminderInterval] = useState(240); // default 4h
  const [reminderSaving, setReminderSaving] = useState(false);

  const [originalValues, setOriginalValues] = useState<Partial<Task>>({});

  useEffect(() => { loadTask(); }, [id]);

  // Auto-set reminder interval based on priority
  useEffect(() => {
    if (priority === 'urgent') setReminderInterval(30);
    else if (priority === 'high') setReminderInterval(120);
    else if (priority === 'medium') setReminderInterval(240);
    else setReminderInterval(480);
  }, [priority]);

  const loadTask = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const t = await getTask(id);
      setTask(t);
      setTitle(t.title);
      setDescription(t.description || '');
      setPriority(t.priority);
      setStatus(t.status);
      setCategory(t.category || '');
      setDueDate(t.due_date || '');
      setReminderEnabled(t.reminder_enabled !== false);
      setOriginalValues({ title: t.title, description: t.description, priority: t.priority, category: t.category, due_date: t.due_date });
    } catch {
      Alert.alert('Error', 'Failed to load task');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSaveReminder = async () => {
    if (!id || !task) return;
    setReminderSaving(true);
    try {
      if (reminderEnabled) {
        await configureReminder(id, reminderInterval);
        if (Platform.OS !== 'web') {
          await scheduleTaskReminder(id, task.title, task.priority, reminderInterval);
        }
        Alert.alert('Reminder Set', `You'll be reminded every ${reminderIntervals.find(r => r.minutes === reminderInterval)?.label || reminderInterval + ' min'} until this task is done.`);
      } else {
        await disableReminder(id);
        if (Platform.OS !== 'web') {
          await cancelTaskReminder(id);
        }
        Alert.alert('Reminder Off', 'Reminders disabled for this task.');
      }
    } catch (err: any) {
      // If 404, it means no reminder exists yet - create one
      if (reminderEnabled) {
        try {
          await configureReminder(id, reminderInterval);
          Alert.alert('Reminder Set', `Reminder created.`);
        } catch {
          Alert.alert('Error', 'Failed to configure reminder');
        }
      }
    } finally {
      setReminderSaving(false);
    }
  };

  const handleSave = async () => {
    if (!id || !task) return;
    setSaving(true);
    try {
      const updates: TaskUpdate = {};
      const corrections: { field: string; original: string; corrected: string }[] = [];

      if (title !== originalValues.title) { updates.title = title; corrections.push({ field: 'title', original: originalValues.title || '', corrected: title }); }
      if (description !== originalValues.description) { updates.description = description; }
      if (priority !== originalValues.priority) { updates.priority = priority; corrections.push({ field: 'priority', original: originalValues.priority || '', corrected: priority }); }
      if (status !== task.status) { updates.status = status; }
      if (category !== originalValues.category) { updates.category = category || undefined; corrections.push({ field: 'category', original: originalValues.category || '', corrected: category }); }
      if (dueDate !== originalValues.due_date) { updates.due_date = dueDate || undefined; corrections.push({ field: 'due_date', original: originalValues.due_date || '', corrected: dueDate }); }

      if (Object.keys(updates).length > 0) {
        await updateTask(id, updates);
        for (const c of corrections) {
          if (task.original_input) {
            try { await submitCorrection(id, c.field, c.original, c.corrected, task.original_input); } catch {}
          }
        }

        // If task completed, cancel reminder
        if (updates.status === 'completed') {
          try {
            await disableReminder(id);
            if (Platform.OS !== 'web') await cancelTaskReminder(id);
          } catch {}
        }

        fetchTasks();
        Alert.alert('Saved', corrections.length > 0 ? 'Task updated! Lamdi is learning from your corrections.' : 'Task updated!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        router.back();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color="#4A6B53" /></View>
      </SafeAreaView>
    );
  }

  if (!task) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><Text style={styles.msg}>Task not found</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity testID="back-button" onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back" accessibilityRole="button">
            <ArrowLeft size={22} color="#2D372E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Task</Text>
          <TouchableOpacity testID="save-button" onPress={handleSave} style={styles.saveBtn} disabled={saving} activeOpacity={0.8}>
            {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
              <><Save size={16} color="#FFFFFF" /><Text style={styles.saveBtnText}>Save</Text></>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
          {/* Original input */}
          {task.original_input && (
            <View style={styles.origBox}>
              <View style={styles.origHeader}>
                <Mic size={14} color="#4A6B53" />
                <Text style={styles.origLabel}>Original Input</Text>
              </View>
              <Text style={styles.origText}>{task.original_input}</Text>
              <Text style={styles.origHint}>Edit fields below to help Lamdi learn your preferences</Text>
            </View>
          )}

          {/* Title */}
          <View style={styles.field}>
            <Text style={styles.label}>Title</Text>
            <TextInput testID="task-title-input" style={styles.input} value={title} onChangeText={setTitle} placeholder="Task title" placeholderTextColor="#B8C4B9" />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput testID="task-desc-input" style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Add details..." placeholderTextColor="#B8C4B9" multiline numberOfLines={4} textAlignVertical="top" />
          </View>

          {/* Priority */}
          <View style={styles.field}>
            <Text style={styles.label}>Priority</Text>
            <View style={styles.optRow}>
              {priorities.map((p) => {
                const c = priorityColors[p];
                return (
                  <TouchableOpacity key={p} testID={`priority-${p}`} style={[styles.chip, priority === p && { backgroundColor: c.bg, borderColor: c.text }]} onPress={() => setPriority(p)}>
                    <Text style={[styles.chipText, priority === p && { color: c.text, fontWeight: '700' }]}>{p}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Status */}
          <View style={styles.field}>
            <Text style={styles.label}>Status</Text>
            <View style={styles.optRow}>
              {statuses.map((s) => {
                const c = statusColors[s];
                return (
                  <TouchableOpacity key={s} testID={`status-${s}`} style={[styles.chip, status === s && { backgroundColor: c.bg, borderColor: c.text }]} onPress={() => setStatus(s)}>
                    <Text style={[styles.chipText, status === s && { color: c.text, fontWeight: '700' }]}>{s.replace('_', ' ')}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Category */}
          <View style={styles.field}>
            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.optRow}>
                {categories.map((c) => (
                  <TouchableOpacity key={c} testID={`category-${c}`} style={[styles.chip, category === c && styles.chipActive]} onPress={() => setCategory(category === c ? '' : c)}>
                    <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Due Date */}
          <View style={styles.field}>
            <Text style={styles.label}>Due Date (YYYY-MM-DD)</Text>
            <TextInput testID="task-duedate-input" style={styles.input} value={dueDate} onChangeText={setDueDate} placeholder="2026-04-20" placeholderTextColor="#B8C4B9" />
          </View>

          {/* ===== REMINDER SECTION ===== */}
          <View style={styles.reminderSection}>
            <View style={styles.reminderHeader}>
              <Bell size={18} color="#D48C70" />
              <Text style={styles.reminderTitle}>Persistent Reminders</Text>
            </View>
            <Text style={styles.reminderDesc}>
              Lamdi will keep reminding you until this task is done. Never forget again.
            </Text>

            {/* Toggle */}
            <View style={styles.reminderToggleRow}>
              <Text style={styles.reminderToggleLabel}>Reminders</Text>
              <TouchableOpacity
                testID="reminder-toggle"
                style={[styles.toggleBtn, reminderEnabled ? styles.toggleOn : styles.toggleOff]}
                onPress={() => setReminderEnabled(!reminderEnabled)}
                activeOpacity={0.7}
              >
                {reminderEnabled ? <Bell size={16} color="#FFFFFF" /> : <BellOff size={16} color="#5C6A5D" />}
                <Text style={[styles.toggleText, reminderEnabled ? styles.toggleTextOn : styles.toggleTextOff]}>
                  {reminderEnabled ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Interval selector */}
            {reminderEnabled && (
              <View style={styles.intervalSection}>
                <Text style={styles.intervalLabel}>Remind me every:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.intervalScroll}>
                  <View style={styles.intervalRow}>
                    {reminderIntervals.map((r) => (
                      <TouchableOpacity
                        key={r.minutes}
                        testID={`interval-${r.minutes}`}
                        style={[
                          styles.intervalChip,
                          reminderInterval === r.minutes && styles.intervalChipActive,
                        ]}
                        onPress={() => setReminderInterval(r.minutes)}
                      >
                        <Text
                          style={[
                            styles.intervalChipText,
                            reminderInterval === r.minutes && styles.intervalChipTextActive,
                          ]}
                        >
                          {r.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                <Text style={styles.intervalHint}>
                  {priority === 'urgent'
                    ? 'Urgent tasks default to 30-min reminders'
                    : priority === 'high'
                    ? 'High priority tasks default to 2-hour reminders'
                    : 'Customize your reminder interval above'}
                </Text>
              </View>
            )}

            {/* Save reminder button */}
            <TouchableOpacity
              testID="save-reminder-button"
              style={styles.reminderSaveBtn}
              onPress={handleSaveReminder}
              disabled={reminderSaving}
              activeOpacity={0.8}
            >
              {reminderSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Bell size={16} color="#FFFFFF" />
                  <Text style={styles.reminderSaveBtnText}>
                    {reminderEnabled ? 'Save Reminder' : 'Turn Off Reminder'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Meta */}
          {task.language_detected && (
            <View style={styles.metaRow}>
              <Globe size={14} color="#5C6A5D" />
              <Text style={styles.metaText}>Detected: {task.language_detected.toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.metaRow}>
            <Clock size={14} color="#5C6A5D" />
            <Text style={styles.metaText}>Created: {new Date(task.created_at).toLocaleString()}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  msg: { fontSize: 16, color: '#5C6A5D' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8EBE8' },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#2D372E' },
  saveBtn: { flexDirection: 'row', backgroundColor: '#4A6B53', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, alignItems: 'center', gap: 6, minWidth: 70, justifyContent: 'center' },
  saveBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },

  content: { flex: 1, padding: 20 },

  origBox: { backgroundColor: '#E3EAE4', borderRadius: 16, padding: 16, marginBottom: 24 },
  origHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  origLabel: { fontSize: 12, fontWeight: '700', color: '#4A6B53' },
  origText: { fontSize: 14, color: '#2D372E', fontStyle: 'italic', lineHeight: 20 },
  origHint: { fontSize: 11, color: '#4A6B53', marginTop: 8, fontWeight: '500' },

  field: { marginBottom: 22 },
  label: { fontSize: 13, fontWeight: '700', color: '#2D372E', marginBottom: 8, letterSpacing: 0.3 },
  input: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, fontSize: 16, color: '#2D372E', borderWidth: 1, borderColor: '#E8EBE8' },
  textArea: { minHeight: 100 },

  optRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E8EBE8' },
  chipActive: { backgroundColor: '#E3EAE4', borderColor: '#4A6B53' },
  chipText: { fontSize: 13, color: '#5C6A5D', textTransform: 'capitalize' },
  chipTextActive: { color: '#4A6B53', fontWeight: '700' },

  // Reminder section
  reminderSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E8EBE8',
  },
  reminderHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  reminderTitle: { fontSize: 16, fontWeight: '700', color: '#2D372E' },
  reminderDesc: { fontSize: 13, color: '#5C6A5D', marginBottom: 16, lineHeight: 18 },

  reminderToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  reminderToggleLabel: { fontSize: 14, fontWeight: '600', color: '#2D372E' },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 6,
  },
  toggleOn: { backgroundColor: '#D48C70' },
  toggleOff: { backgroundColor: '#F4F5F4', borderWidth: 1, borderColor: '#E8EBE8' },
  toggleText: { fontSize: 13, fontWeight: '700' },
  toggleTextOn: { color: '#FFFFFF' },
  toggleTextOff: { color: '#5C6A5D' },

  intervalSection: { marginBottom: 16 },
  intervalLabel: { fontSize: 13, fontWeight: '600', color: '#2D372E', marginBottom: 10 },
  intervalScroll: { flexGrow: 0, marginBottom: 8 },
  intervalRow: { flexDirection: 'row', gap: 8 },
  intervalChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#F9F9F6',
    borderWidth: 1.5,
    borderColor: '#E8EBE8',
  },
  intervalChipActive: {
    backgroundColor: '#FAEFEA',
    borderColor: '#D48C70',
  },
  intervalChipText: { fontSize: 13, color: '#5C6A5D', fontWeight: '500' },
  intervalChipTextActive: { color: '#D48C70', fontWeight: '700' },
  intervalHint: { fontSize: 11, color: '#B8C4B9', fontStyle: 'italic' },

  reminderSaveBtn: {
    flexDirection: 'row',
    backgroundColor: '#D48C70',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  reminderSaveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  metaText: { fontSize: 13, color: '#5C6A5D' },
});
