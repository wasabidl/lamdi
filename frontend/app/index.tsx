import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  StatusBar,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { CheckSquare, ListFilter } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTaskStore } from '../src/stores/taskStore';
import TaskCard from '../src/components/TaskCard';
import VoiceRecorder from '../src/components/VoiceRecorder';
import ExtractionResultModal from '../src/components/ExtractionResultModal';
import { Task } from '../src/types';
import { scheduleTaskReminder, cancelTaskReminder } from '../src/services/notifications';

type FilterType = 'all' | 'pending' | 'completed';

export default function HomeScreen() {
  const router = useRouter();
  const {
    tasks, stats, isLoading, error,
    fetchTasks, fetchStats, processVoiceInput, completeTask, removeTask, clearError,
  } = useTaskStore();

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [showExtractionResult, setShowExtractionResult] = useState(false);
  const [extractionResult, setExtractionResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [slowRequest, setSlowRequest] = useState(false);

  useEffect(() => { fetchTasks(); fetchStats(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTasks();
    await fetchStats();
    setRefreshing(false);
  }, []);

  const handleVoiceTranscription = async (text: string) => {
    setIsProcessing(true);
    setSlowRequest(false);
    const slowTimer = setTimeout(() => setSlowRequest(true), 10000);
    try {
      const result = await processVoiceInput(text);
      setExtractionResult(result);
      setShowExtractionResult(true);
      fetchStats();
      // Auto-schedule reminders for newly created tasks
      const created = result.created_tasks || result.tasks || [];
      for (const task of created) {
        const interval = task.priority === 'urgent' ? 30 : task.priority === 'high' ? 120 : 240;
        scheduleTaskReminder(task.id, task.title, task.priority, interval).catch(() => {});
      }
      // Cancel reminders for completed tasks
      for (const update of (result.updated_tasks || [])) {
        if (update.changes?.status === 'completed') {
          cancelTaskReminder(update.task_id).catch(() => {});
        }
      }
    } catch (err: any) {
      const detail = (err as any).response?.data?.detail || err.message || 'Failed to process input';
      Alert.alert('Error', detail);
    } finally {
      clearTimeout(slowTimer);
      setIsProcessing(false);
      setSlowRequest(false);
    }
  };

  const handleCompleteTask = async (task: Task) => {
    try {
      await completeTask(task.id);
      fetchStats();
      // Cancel reminder when task is completed
      cancelTaskReminder(task.id).catch(() => {});
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update task');
    }
  };

  const handleDeleteTask = (task: Task) => {
    Alert.alert('Delete Task', `Delete "${task.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await removeTask(task.id); fetchStats(); }
          catch (err: any) { Alert.alert('Error', err.message || 'Failed to delete'); }
        },
      },
    ]);
  };

  const filtered = tasks.filter((t) => {
    if (filter === 'pending') return t.status !== 'completed';
    if (filter === 'completed') return t.status === 'completed';
    return true;
  });

  const renderHeader = () => (
    <View style={styles.hdr}>
      {/* Welcome */}
      <View style={styles.welcome}>
        <Text style={styles.welcomeLabel}>Welcome to</Text>
        <Text style={styles.brand}>Lamdi</Text>
        <Text style={styles.tagline}>Your AI Operations Manager</Text>
      </View>

      {/* Stats */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{stats.pending}</Text>
            <Text style={styles.statLbl}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: '#3E7D5F' }]}>{stats.completed}</Text>
            <Text style={styles.statLbl}>Done</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: '#D35F5F' }]}>{stats.urgent_tasks}</Text>
            <Text style={styles.statLbl}>Urgent</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: '#D48C70' }]}>{stats.learned_patterns}</Text>
            <Text style={styles.statLbl}>Learned</Text>
          </View>
        </View>
      )}

      {/* Voice + text input */}
      <View style={styles.inputCard}>
        <VoiceRecorder onTranscription={handleVoiceTranscription} isProcessing={isProcessing} />
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {(['all', 'pending', 'completed'] as FilterType[]).map((f) => (
          <TouchableOpacity
            key={f}
            testID={`filter-${f}`}
            style={[styles.filterChip, filter === f && styles.filterActive]}
            onPress={() => setFilter(f)}
          >
            {f === 'completed' ? <CheckSquare size={13} color={filter === f ? '#FFFFFF' : '#5C6A5D'} /> : <ListFilter size={13} color={filter === f ? '#FFFFFF' : '#5C6A5D'} />}
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.listHdr}>
        <Text style={styles.listTitle}>Your Tasks</Text>
        <Text style={styles.listCount}>{filtered.length} tasks</Text>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.empty}>
      <CheckSquare size={56} color="#E8EBE8" />
      <Text style={styles.emptyTitle}>No tasks yet</Text>
      <Text style={styles.emptySub}>Tap the microphone or type to add your first task</Text>
    </View>
  );

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errWrap}>
          <Text style={styles.errText}>{error}</Text>
          <TouchableOpacity testID="retry-button" style={styles.retryBtn} onPress={() => { clearError(); fetchTasks(); }}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9F9F6" />

      <FlatList
        testID="task-list"
        data={filtered}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={!isLoading ? renderEmpty : null}
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            onPress={() => router.push(`/task/${item.id}`)}
            onComplete={() => handleCompleteTask(item)}
            onDelete={() => handleDeleteTask(item)}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4A6B53" />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {isProcessing && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#4A6B53" />
            <Text style={styles.loadingText}>
              {slowRequest ? 'Waking up server\u2026 first request may take ~60s' : 'Lamdi is thinking\u2026'}
            </Text>
          </View>
        </View>
      )}

      <ExtractionResultModal
        visible={showExtractionResult}
        result={extractionResult}
        onClose={() => setShowExtractionResult(false)}
        onEditTask={(taskId) => { setShowExtractionResult(false); router.push(`/task/${taskId}`); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F6' },
  hdr: { paddingHorizontal: 20 },

  welcome: { alignItems: 'center', paddingTop: Platform.OS === 'android' ? 44 : 16, paddingBottom: 20 },
  welcomeLabel: { fontSize: 13, color: '#5C6A5D', letterSpacing: 1 },
  brand: { fontSize: 40, fontWeight: '800', color: '#4A6B53', letterSpacing: -1 },
  tagline: { fontSize: 13, color: '#B8C4B9', marginTop: 2 },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 8 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E8EBE8' },
  statNum: { fontSize: 22, fontWeight: '700', color: '#2D372E' },
  statLbl: { fontSize: 11, color: '#5C6A5D', marginTop: 2 },

  inputCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#E8EBE8' },

  filterRow: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8EBE8', gap: 6 },
  filterActive: { backgroundColor: '#4A6B53', borderColor: '#4A6B53' },
  filterText: { fontSize: 13, color: '#5C6A5D', fontWeight: '500' },
  filterTextActive: { color: '#FFFFFF' },

  listHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  listTitle: { fontSize: 18, fontWeight: '700', color: '#2D372E' },
  listCount: { fontSize: 13, color: '#5C6A5D' },

  listContent: { paddingBottom: 100 },

  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#5C6A5D', marginTop: 16 },
  emptySub: { fontSize: 14, color: '#B8C4B9', textAlign: 'center', marginTop: 8 },

  errWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  errText: { fontSize: 16, color: '#D35F5F', textAlign: 'center', marginBottom: 20 },
  retryBtn: { backgroundColor: '#4A6B53', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16 },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(249,249,246,0.9)', justifyContent: 'center', alignItems: 'center' },
  loadingBox: { alignItems: 'center', padding: 32, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#E8EBE8' },
  loadingText: { color: '#4A6B53', fontSize: 16, fontWeight: '600', marginTop: 16 },
});
