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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTaskStore } from '../src/stores/taskStore';
import TaskCard from '../src/components/TaskCard';
import VoiceRecorder from '../src/components/VoiceRecorder';
import TextInputModal from '../src/components/TextInputModal';
import ExtractionResultModal from '../src/components/ExtractionResultModal';
import { Task, TaskExtractionResponse } from '../src/types';

type FilterType = 'all' | 'pending' | 'completed';

export default function HomeScreen() {
  const router = useRouter();
  const {
    tasks,
    stats,
    isLoading,
    error,
    lastExtraction,
    fetchTasks,
    fetchStats,
    processVoiceInput,
    completeTask,
    removeTask,
    clearError,
  } = useTaskStore();

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [showTextInput, setShowTextInput] = useState(false);
  const [showExtractionResult, setShowExtractionResult] = useState(false);
  const [extractionResult, setExtractionResult] = useState<TaskExtractionResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchTasks();
    fetchStats();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTasks();
    await fetchStats();
    setRefreshing(false);
  }, []);

  const handleVoiceTranscription = async (text: string) => {
    setIsProcessing(true);
    try {
      const result = await processVoiceInput(text);
      setExtractionResult(result);
      setShowExtractionResult(true);
      fetchStats();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to process voice input');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTextSubmit = async (text: string, languageHint?: string) => {
    setShowTextInput(false);
    setIsProcessing(true);
    try {
      const result = await processVoiceInput(text, languageHint);
      setExtractionResult(result);
      setShowExtractionResult(true);
      fetchStats();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to process input');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteTask = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      await completeTask(task.id);
      fetchStats();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update task');
    }
  };

  const handleDeleteTask = (task: Task) => {
    Alert.alert(
      'Delete Task',
      `Are you sure you want to delete "${task.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeTask(task.id);
              fetchStats();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete task');
            }
          },
        },
      ]
    );
  };

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'pending') return task.status !== 'completed';
    if (filter === 'completed') return task.status === 'completed';
    return true;
  });

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>Welcome to</Text>
        <Text style={styles.appName}>Lamdi</Text>
        <Text style={styles.tagline}>Your AI Operations Manager</Text>
      </View>

      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#10B981' }]}>{stats.completed}</Text>
            <Text style={styles.statLabel}>Done</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#EF4444' }]}>{stats.urgent_tasks}</Text>
            <Text style={styles.statLabel}>Urgent</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#6366F1' }]}>{stats.learned_patterns}</Text>
            <Text style={styles.statLabel}>Learned</Text>
          </View>
        </View>
      )}

      <View style={styles.inputSection}>
        <VoiceRecorder
          onTranscription={handleVoiceTranscription}
          isProcessing={isProcessing}
        />
        
        <TouchableOpacity
          style={styles.textInputButton}
          onPress={() => setShowTextInput(true)}
        >
          <Ionicons name="text" size={20} color="#6366F1" />
          <Text style={styles.textInputButtonText}>Or type your task</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        {(['all', 'pending', 'completed'] as FilterType[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterButton, filter === f && styles.filterButtonActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.taskListHeader}>
        <Text style={styles.taskListTitle}>Your Tasks</Text>
        <Text style={styles.taskCount}>{filteredTasks.length} tasks</Text>
      </View>
    </View>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="checkbox-outline" size={64} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>No tasks yet</Text>
      <Text style={styles.emptySubtitle}>
        Tap the microphone or type to add your first task
      </Text>
    </View>
  );

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => { clearError(); fetchTasks(); }}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={!isLoading ? renderEmptyList : null}
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            onPress={() => router.push(`/task/${item.id}`)}
            onComplete={() => handleCompleteTask(item)}
            onDelete={() => handleDeleteTask(item)}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {isLoading && !refreshing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      )}

      <TextInputModal
        visible={showTextInput}
        onClose={() => setShowTextInput(false)}
        onSubmit={handleTextSubmit}
        isLoading={isProcessing}
      />

      <ExtractionResultModal
        visible={showExtractionResult}
        result={extractionResult}
        onClose={() => setShowExtractionResult(false)}
        onEditTask={(taskId) => {
          setShowExtractionResult(false);
          router.push(`/task/${taskId}`);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  headerContainer: {
    paddingHorizontal: 16,
  },
  welcomeSection: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    paddingBottom: 20,
  },
  welcomeText: {
    fontSize: 14,
    color: '#6B7280',
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#6366F1',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  inputSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  textInputButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  textInputButtonText: {
    color: '#6366F1',
    fontSize: 14,
    fontWeight: '500',
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  filterButtonActive: {
    backgroundColor: '#6366F1',
  },
  filterText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  taskListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  taskListTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  taskCount: {
    fontSize: 13,
    color: '#6B7280',
  },
  listContent: {
    paddingBottom: 100,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
