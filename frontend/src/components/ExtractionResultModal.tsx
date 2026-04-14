import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { X, Sparkles, Check, Pencil, Lightbulb, Folder, Calendar } from 'lucide-react-native';
import { TaskExtractionResponse } from '../types';

interface ExtractionResultModalProps {
  visible: boolean;
  result: TaskExtractionResponse | null;
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

  const pct = Math.round(result.confidence * 100);
  const confColor = pct >= 80 ? '#3E7D5F' : pct >= 60 ? '#C7823B' : '#D35F5F';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Sparkles size={22} color="#D48C70" />
              <Text style={styles.title}>Tasks Created</Text>
            </View>
            <TouchableOpacity testID="close-extraction-modal" onPress={onClose} style={styles.closeBtn}>
              <X size={22} color="#5C6A5D" />
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{result.tasks.length}</Text>
              <Text style={styles.statLabel}>Tasks</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: confColor }]}>{pct}%</Text>
              <Text style={styles.statLabel}>Confidence</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{result.language_detected.toUpperCase()}</Text>
              <Text style={styles.statLabel}>Language</Text>
            </View>
          </View>

          <View style={styles.interp}>
            <Lightbulb size={14} color="#4A6B53" />
            <Text style={styles.interpText}>{result.raw_interpretation}</Text>
          </View>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {result.tasks.map((task, i) => {
              const pc = priorityColors[task.priority] || priorityColors.medium;
              return (
                <TouchableOpacity key={task.id} testID={`extraction-task-${i}`} style={styles.taskItem} onPress={() => onEditTask(task.id)} activeOpacity={0.7}>
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
            <Text style={styles.footerText}>Corrections help Lamdi learn your preferences!</Text>
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
  list: { maxHeight: 280 },
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
