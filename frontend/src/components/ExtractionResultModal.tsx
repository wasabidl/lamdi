import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TaskExtractionResponse } from '../types';

interface ExtractionResultModalProps {
  visible: boolean;
  result: TaskExtractionResponse | null;
  onClose: () => void;
  onEditTask: (taskId: string) => void;
}

const priorityColors: Record<string, string> = {
  urgent: '#DC2626',
  high: '#D97706',
  medium: '#2563EB',
  low: '#059669',
};

export default function ExtractionResultModal({
  visible,
  result,
  onClose,
  onEditTask,
}: ExtractionResultModalProps) {
  if (!result) return null;

  const confidencePercent = Math.round(result.confidence * 100);
  const confidenceColor = 
    confidencePercent >= 80 ? '#10B981' :
    confidencePercent >= 60 ? '#F59E0B' : '#EF4444';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="sparkles" size={24} color="#6366F1" />
              <Text style={styles.title}>Tasks Created</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{result.tasks.length}</Text>
              <Text style={styles.statLabel}>Tasks</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: confidenceColor }]}>
                {confidencePercent}%
              </Text>
              <Text style={styles.statLabel}>Confidence</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {result.language_detected.toUpperCase()}
              </Text>
              <Text style={styles.statLabel}>Language</Text>
            </View>
          </View>

          <View style={styles.interpretationBox}>
            <Ionicons name="bulb-outline" size={16} color="#6366F1" />
            <Text style={styles.interpretationText}>
              {result.raw_interpretation}
            </Text>
          </View>

          <ScrollView style={styles.taskList} showsVerticalScrollIndicator={false}>
            {result.tasks.map((task, index) => (
              <TouchableOpacity
                key={task.id}
                style={styles.taskItem}
                onPress={() => onEditTask(task.id)}
              >
                <View style={styles.taskHeader}>
                  <View style={styles.taskNumber}>
                    <Text style={styles.taskNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.taskTitle} numberOfLines={2}>
                    {task.title}
                  </Text>
                </View>

                {task.description ? (
                  <Text style={styles.taskDescription} numberOfLines={2}>
                    {task.description}
                  </Text>
                ) : null}

                <View style={styles.taskMeta}>
                  <View
                    style={[
                      styles.priorityBadge,
                      { backgroundColor: `${priorityColors[task.priority]}20` },
                    ]}
                  >
                    <Text
                      style={[
                        styles.priorityText,
                        { color: priorityColors[task.priority] },
                      ]}
                    >
                      {task.priority}
                    </Text>
                  </View>

                  {task.category && (
                    <View style={styles.categoryBadge}>
                      <Ionicons name="folder-outline" size={12} color="#6B7280" />
                      <Text style={styles.categoryText}>{task.category}</Text>
                    </View>
                  )}

                  {task.due_date && (
                    <View style={styles.dateBadge}>
                      <Ionicons name="calendar-outline" size={12} color="#6B7280" />
                      <Text style={styles.dateText}>{task.due_date}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.editHint}>
                  <Text style={styles.editHintText}>Tap to edit & correct</Text>
                  <Ionicons name="create-outline" size={14} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Tap any task to edit. Corrections help Lamdi learn your preferences!
            </Text>
          </View>

          <TouchableOpacity style={styles.doneButton} onPress={onClose}>
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  interpretationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  interpretationText: {
    flex: 1,
    fontSize: 13,
    color: '#4338CA',
    lineHeight: 18,
  },
  taskList: {
    maxHeight: 300,
  },
  taskItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  taskNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  taskNumberText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  taskTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  taskDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 10,
    marginLeft: 34,
  },
  taskMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginLeft: 34,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  categoryText: {
    fontSize: 11,
    color: '#6B7280',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  dateText: {
    fontSize: 11,
    color: '#6B7280',
  },
  editHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 4,
  },
  editHintText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  footer: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  footerText: {
    fontSize: 12,
    color: '#92400E',
    textAlign: 'center',
  },
  doneButton: {
    flexDirection: 'row',
    backgroundColor: '#10B981',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
