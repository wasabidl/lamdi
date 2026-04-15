import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { X, Sparkles, Check, Pencil, Lightbulb, Folder, Calendar, CheckCircle, RefreshCw } from 'lucide-react-native';

interface ExtractionResultModalProps {
  visible: boolean;
  result: any | null;
  onClose: () => void;
  onEditTask: (taskId: string) => void;
}

const priorityColors: Record<string, { bg: string; text: string }> = {
  urgent: { bg: '#FBEAEB', text: '#D35F5F' },
  high: { bg: '#F9EDDF', text: '#C7823B' },
  medium: { bg: '#E3EAE4', text: '#4A6B53' },
  low: { bg: '#DDF0E6', text: '#3E7D5F' },
};

export default function ExtractionResultModal({ visible, result, onClose, onEditTask }: ExtractionResultModalProps) {
  if (!result) return null;

  const pct = Math.round((result.confidence || 0.5) * 100);
  const confColor = pct >= 80 ? '#3E7D5F' : pct >= 60 ? '#C7823B' : '#D35F5F';
  const intent = result.intent || 'create';
  const createdTasks = result.created_tasks || result.tasks || [];
  const updatedTasks = result.updated_tasks || [];
  const hasCreates = createdTasks.length > 0;
  const hasUpdates = updatedTasks.length > 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Sparkles size={22} color="#D48C70" />
              <Text style={styles.title}>
                {intent === 'update' ? 'Tasks Updated' : intent === 'mixed' ? 'Tasks Processed' : 'Tasks Created'}
              </Text>
            </View>
            <TouchableOpacity testID="close-extraction-modal" onPress={onClose} style={styles.closeBtn}>
              <X size={22} color="#5C6A5D" />
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            {hasCreates && (
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{createdTasks.length}</Text>
                <Text style={styles.statLabel}>Created</Text>
              </View>
            )}
            {hasCreates && hasUpdates && <View style={styles.divider} />}
            {hasUpdates && (
              <View style={styles.statItem}>
                <Text style={[styles.statVal, { color: '#3E7D5F' }]}>{updatedTasks.length}</Text>
                <Text style={styles.statLabel}>Updated</Text>
              </View>
            )}
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: confColor }]}>{pct}%</Text>
              <Text style={styles.statLabel}>Confidence</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{(result.language_detected || '?').toUpperCase()}</Text>
              <Text style={styles.statLabel}>Language</Text>
            </View>
          </View>

          <View style={styles.interp}>
            <Lightbulb size={14} color="#4A6B53" />
            <Text style={styles.interpText}>{result.raw_interpretation}</Text>
          </View>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {/* Task Updates */}
            {updatedTasks.map((update: any, i: number) => (
              <View key={`update-${i}`} style={styles.updateItem}>
                <View style={styles.updateHeader}>
                  <CheckCircle size={20} color="#3E7D5F" />
                  <Text style={styles.updateTitle} numberOfLines={1}>{update.task_title}</Text>
                </View>
                <View style={styles.updateChanges}>
                  {update.changes?.status === 'completed' && (
                    <View style={styles.changeBadge}>
                      <CheckCircle size={12} color="#3E7D5F" />
                      <Text style={styles.changeGreen}>Marked as done</Text>
                    </View>
                  )}
                  {update.changes?.due_date && (
                    <View style={styles.changeBadge}>
                      <Calendar size={12} color="#C7823B" />
                      <Text style={styles.changeOrange}>Moved to {update.changes.due_date}</Text>
                    </View>
                  )}
                  {update.changes?.priority && (
                    <View style={styles.changeBadge}>
                      <RefreshCw size={12} color="#4A6B53" />
                      <Text style={styles.changeGreen}>Priority → {update.changes.priority}</Text>
                    </View>
                  )}
                </View>
                {update.reason && <Text style={styles.updateReason}>{update.reason}</Text>}
              </View>
            ))}

            {/* New Tasks */}
            {createdTasks.map((task: any, i: number) => {
              const pc = priorityColors[task.priority] || priorityColors.medium;
              return (
                <TouchableOpacity key={task.id || i} testID={`extraction-task-${i}`} style={styles.taskItem} onPress={() => onEditTask(task.id)} activeOpacity={0.7}>
                  <View style={styles.taskHead}>
                    <View style={styles.num}><Text style={styles.numText}>{i + 1}</Text></View>
                    <Text style={styles.taskTitle} numberOfLines={2}>{task.title}</Text>
                  </View>
                  {task.description ? <Text style={styles.taskDesc} numberOfLines={2}>{task.description}</Text> : null}
                  <View style={styles.taskMeta}>
                    <View style={[styles.badge, { backgroundColor: pc.bg }]}>
                      <Text style={[styles.badgeText, { color: pc.text }]}>{task.priority}</Text>
                    </View>
                    {task.category ? (
                      <View style={styles.tagBadge}><Folder size={10} color="#5C6A5D" /><Text style={styles.tagText}>{task.category}</Text></View>
                    ) : null}
                    {task.due_date ? (
                      <View style={styles.tagBadge}><Calendar size={10} color="#5C6A5D" /><Text style={styles.tagText}>{task.due_date}</Text></View>
                    ) : null}
                  </View>
                  <View style={styles.editRow}>
                    <Text style={styles.editHint}>Tap to edit & correct</Text>
                    <Pencil size={12} color="#B8C4B9" />
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {hasUpdates ? 'Lamdi matched your message to existing tasks!' : 'Corrections help Lamdi learn your preferences!'}
            </Text>
          </View>

          <TouchableOpacity testID="extraction-done-button" style={styles.doneBtn} onPress={onClose} activeOpacity={0.8}>
            <Check size={18} color="#FFFFFF" />
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36, maxHeight: '85%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E8EBE8', alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#2D372E' },
  closeBtn: { padding: 6 },
  statsRow: { flexDirection: 'row', backgroundColor: '#F9F9F6', borderRadius: 16, padding: 16, marginBottom: 16 },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '700', color: '#2D372E' },
  statLabel: { fontSize: 12, color: '#5C6A5D', marginTop: 2 },
  divider: { width: 1, backgroundColor: '#E8EBE8', marginHorizontal: 8 },
  interp: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#E3EAE4', borderRadius: 12, padding: 12, marginBottom: 16, gap: 8 },
  interpText: { flex: 1, fontSize: 13, color: '#2D372E', lineHeight: 18 },
  list: { maxHeight: 300 },

  // Update items
  updateItem: { backgroundColor: '#DDF0E6', borderRadius: 14, padding: 16, marginBottom: 10 },
  updateHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  updateTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: '#2D372E' },
  updateChanges: { gap: 6, marginLeft: 28 },
  changeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  changeGreen: { fontSize: 13, color: '#3E7D5F', fontWeight: '600' },
  changeOrange: { fontSize: 13, color: '#C7823B', fontWeight: '600' },
  updateReason: { fontSize: 12, color: '#5C6A5D', marginTop: 6, marginLeft: 28, fontStyle: 'italic' },

  // Task items
  taskItem: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#E8EBE8' },
  taskHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  num: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#4A6B53', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  numText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  taskTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: '#2D372E' },
  taskDesc: { fontSize: 13, color: '#5C6A5D', marginBottom: 10, marginLeft: 34 },
  taskMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginLeft: 34 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  tagBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F5F4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, gap: 4 },
  tagText: { fontSize: 11, color: '#5C6A5D' },
  editRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 10, gap: 4 },
  editHint: { fontSize: 11, color: '#B8C4B9' },
  footer: { backgroundColor: '#F9EDDF', borderRadius: 12, padding: 12, marginTop: 8 },
  footerText: { fontSize: 12, color: '#C7823B', textAlign: 'center', fontWeight: '500' },
  doneBtn: { flexDirection: 'row', backgroundColor: '#3E7D5F', borderRadius: 24, padding: 16, alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 8 },
  doneBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
