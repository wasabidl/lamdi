import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { CircleCheck, Circle, Trash2, Folder, Calendar, Globe, ArrowUpCircle, ArrowDownCircle, AlertCircle, MinusCircle } from 'lucide-react-native';
import { Task } from '../types';
import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns';

interface TaskCardProps {
  task: Task;
  onPress: () => void;
  onComplete: () => void;
  onDelete: () => void;
}

const priorityConfig: Record<string, { bg: string; text: string; Icon: any }> = {
  urgent: { bg: '#FBEAEB', text: '#D35F5F', Icon: AlertCircle },
  high: { bg: '#F9EDDF', text: '#C7823B', Icon: ArrowUpCircle },
  medium: { bg: '#E3EAE4', text: '#4A6B53', Icon: MinusCircle },
  low: { bg: '#DDF0E6', text: '#3E7D5F', Icon: ArrowDownCircle },
};

export default function TaskCard({ task, onPress, onComplete, onDelete }: TaskCardProps) {
  const pCfg = priorityConfig[task.priority] || priorityConfig.medium;
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
      testID={`task-card-${task.id}`}
      style={[styles.card, isCompleted && styles.cardCompleted]}
      onPress={onPress}
      activeOpacity={0.7}
      accessible
      accessibilityLabel={`Task: ${task.title}, Priority: ${task.priority}`}
      accessibilityRole="button"
    >
      <TouchableOpacity
        testID={`task-check-${task.id}`}
        style={styles.checkBtn}
        onPress={onComplete}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessible
        accessibilityLabel={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
        accessibilityRole="button"
      >
        {isCompleted ? (
          <CircleCheck size={26} color="#3E7D5F" />
        ) : (
          <Circle size={26} color="#B8C4B9" />
        )}
      </TouchableOpacity>

      <View style={styles.body}>
        <Text style={[styles.title, isCompleted && styles.titleDone]} numberOfLines={2}>
          {task.title}
        </Text>

        {task.description ? (
          <Text style={styles.desc} numberOfLines={1}>{task.description}</Text>
        ) : null}

        <View style={styles.metaRow}>
          <View style={[styles.badge, { backgroundColor: pCfg.bg }]}>  
            <pCfg.Icon size={11} color={pCfg.text} />
            <Text style={[styles.badgeText, { color: pCfg.text }]}>{task.priority}</Text>
          </View>

          {task.category ? (
            <View style={styles.tagBadge}>
              <Folder size={11} color="#5C6A5D" />
              <Text style={styles.tagText}>{task.category}</Text>
            </View>
          ) : null}

          {dueDateText ? (
            <View style={[styles.tagBadge, isOverdue && styles.overdueBadge]}>
              <Calendar size={11} color={isOverdue ? '#D35F5F' : '#5C6A5D'} />
              <Text style={[styles.tagText, isOverdue && styles.overdueText]}>{dueDateText}</Text>
            </View>
          ) : null}
        </View>

        {task.language_detected && task.language_detected !== 'unknown' ? (
          <View style={styles.langRow}>
            <Globe size={10} color="#B8C4B9" />
            <Text style={styles.langText}>{task.language_detected.toUpperCase()}</Text>
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        testID={`task-delete-${task.id}`}
        onPress={onDelete}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.deleteBtn}
        accessible
        accessibilityLabel="Delete task"
        accessibilityRole="button"
      >
        <Trash2 size={18} color="#B8C4B9" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: '#E8EBE8',
    alignItems: 'flex-start',
  },
  cardCompleted: { backgroundColor: '#FAFBFA', opacity: 0.75 },
  checkBtn: { marginRight: 12, marginTop: 2 },
  body: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: '#2D372E', marginBottom: 3, lineHeight: 20 },
  titleDone: { textDecorationLine: 'line-through', color: '#B8C4B9' },
  desc: { fontSize: 13, color: '#5C6A5D', marginBottom: 8 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, gap: 4 },
  badgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  tagBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#F4F5F4', borderRadius: 20, gap: 4 },
  tagText: { fontSize: 11, color: '#5C6A5D', textTransform: 'capitalize' },
  overdueBadge: { backgroundColor: '#FBEAEB' },
  overdueText: { color: '#D35F5F', fontWeight: '600' },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  langText: { fontSize: 10, color: '#B8C4B9' },
  deleteBtn: { padding: 4 },
});
