import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Task } from '../types';
import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns';

interface TaskCardProps {
  task: Task;
  onPress: () => void;
  onComplete: () => void;
  onDelete: () => void;
}

const priorityColors: Record<string, { bg: string; text: string; icon: string }> = {
  urgent: { bg: '#FEE2E2', text: '#DC2626', icon: 'alert-circle' },
  high: { bg: '#FEF3C7', text: '#D97706', icon: 'arrow-up-circle' },
  medium: { bg: '#DBEAFE', text: '#2563EB', icon: 'remove-circle' },
  low: { bg: '#D1FAE5', text: '#059669', icon: 'arrow-down-circle' },
};

const statusIcons: Record<string, string> = {
  pending: 'ellipse-outline',
  in_progress: 'time-outline',
  completed: 'checkmark-circle',
  cancelled: 'close-circle',
};

export default function TaskCard({ task, onPress, onComplete, onDelete }: TaskCardProps) {
  const priorityStyle = priorityColors[task.priority] || priorityColors.medium;
  const isCompleted = task.status === 'completed';
  
  const formatDueDate = (dateStr: string | undefined) => {
    if (!dateStr) return null;
    try {
      const date = parseISO(dateStr);
      if (isToday(date)) return 'Today';
      if (isTomorrow(date)) return 'Tomorrow';
      if (isPast(date)) return 'Overdue';
      return format(date, 'MMM d');
    } catch {
      return dateStr;
    }
  };

  const dueDateText = formatDueDate(task.due_date);
  const isOverdue = dueDateText === 'Overdue' && !isCompleted;

  return (
    <TouchableOpacity
      style={[styles.container, isCompleted && styles.completedContainer]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <TouchableOpacity
        style={styles.checkButton}
        onPress={onComplete}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons
          name={isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
          size={28}
          color={isCompleted ? '#10B981' : '#9CA3AF'}
        />
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={[styles.title, isCompleted && styles.completedText]} numberOfLines={2}>
          {task.title}
        </Text>
        
        {task.description ? (
          <Text style={styles.description} numberOfLines={1}>
            {task.description}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          <View style={[styles.priorityBadge, { backgroundColor: priorityStyle.bg }]}>
            <Ionicons name={priorityStyle.icon as any} size={12} color={priorityStyle.text} />
            <Text style={[styles.priorityText, { color: priorityStyle.text }]}>
              {task.priority}
            </Text>
          </View>

          {task.category && (
            <View style={styles.categoryBadge}>
              <Ionicons name="folder-outline" size={12} color="#6B7280" />
              <Text style={styles.categoryText}>{task.category}</Text>
            </View>
          )}

          {dueDateText && (
            <View style={[styles.dueDateBadge, isOverdue && styles.overdueBadge]}>
              <Ionicons
                name="calendar-outline"
                size={12}
                color={isOverdue ? '#DC2626' : '#6B7280'}
              />
              <Text style={[styles.dueDateText, isOverdue && styles.overdueText]}>
                {dueDateText}
              </Text>
            </View>
          )}
        </View>

        {task.language_detected && task.language_detected !== 'unknown' && (
          <View style={styles.languageIndicator}>
            <Ionicons name="language-outline" size={10} color="#9CA3AF" />
            <Text style={styles.languageText}>{task.language_detected.toUpperCase()}</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={onDelete}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="trash-outline" size={20} color="#9CA3AF" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    alignItems: 'flex-start',
  },
  completedContainer: {
    backgroundColor: '#F9FAFB',
    opacity: 0.8,
  },
  checkButton: {
    marginRight: 12,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    gap: 4,
  },
  categoryText: {
    fontSize: 11,
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  dueDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    gap: 4,
  },
  overdueBadge: {
    backgroundColor: '#FEE2E2',
  },
  dueDateText: {
    fontSize: 11,
    color: '#6B7280',
  },
  overdueText: {
    color: '#DC2626',
    fontWeight: '600',
  },
  languageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  languageText: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  deleteButton: {
    padding: 4,
  },
});
