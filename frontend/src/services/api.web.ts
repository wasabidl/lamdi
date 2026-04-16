/**
 * Local (localStorage) implementation of the API for web preview.
 * Used automatically on web when no backend is available.
 */
import { Task, TaskCreate, TaskUpdate, TaskExtractionResponse, Stats } from '../types';

const KEY = 'lamdi_tasks';

const load = (): Task[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
};

const save = (tasks: Task[]) =>
  localStorage.setItem(KEY, JSON.stringify(tasks));

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const now = () => new Date().toISOString();

// ─── Helpers for simple text parsing ─────────────────────────────────────────

const PRIORITY_MAP: Record<string, Task['priority']> = {
  urgent: 'urgent', asap: 'urgent', emergency: 'urgent',
  important: 'high', high: 'high', critical: 'high',
  medium: 'medium', normal: 'medium', moderate: 'medium',
  low: 'low', minor: 'low', whenever: 'low',
};

const parsePriority = (text: string): Task['priority'] => {
  const lower = text.toLowerCase();
  for (const [word, priority] of Object.entries(PRIORITY_MAP)) {
    if (lower.includes(word)) return priority;
  }
  return 'medium';
};

const parseDueDate = (text: string): string | undefined => {
  const lower = text.toLowerCase();
  const d = new Date();
  if (lower.includes('today')) return d.toISOString().split('T')[0];
  if (lower.includes('tomorrow')) {
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }
  if (lower.includes('next week')) {
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  }
  // Match "on Monday", "on Friday" etc.
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  for (let i = 0; i < days.length; i++) {
    if (lower.includes(days[i])) {
      const diff = (i - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + diff);
      return d.toISOString().split('T')[0];
    }
  }
  return undefined;
};

const cleanTitle = (text: string): string => {
  // Strip filler phrases
  return text
    .replace(/\b(i need to|i have to|i should|remind me to|don't forget to|please|make sure to)\b/gi, '')
    .replace(/\b(urgent|asap|emergency|important|high priority|low priority|medium priority)\b/gi, '')
    .replace(/\b(today|tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// ─── API surface ─────────────────────────────────────────────────────────────

export const getTasks = async (filters?: { status?: string; priority?: string }): Promise<Task[]> => {
  let tasks = load();
  if (filters?.status) tasks = tasks.filter(t => t.status === filters.status);
  if (filters?.priority) tasks = tasks.filter(t => t.priority === filters.priority);
  return tasks;
};

export const getTask = async (taskId: string): Promise<Task> => {
  const task = load().find(t => t.id === taskId);
  if (!task) throw new Error('Task not found');
  return task;
};

export const createTask = async (data: TaskCreate): Promise<Task> => {
  const task: Task = {
    id: makeId(),
    title: data.title,
    description: data.description,
    priority: (data.priority as Task['priority']) || 'medium',
    status: 'pending',
    due_date: data.due_date,
    category: data.category,
    tags: data.tags || [],
    reminder_enabled: data.reminder_enabled || false,
    reminder_times: [],
    created_at: now(),
    updated_at: now(),
  };
  const tasks = load();
  tasks.unshift(task);
  save(tasks);
  return task;
};

export const updateTask = async (taskId: string, update: TaskUpdate): Promise<Task> => {
  const tasks = load();
  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx < 0) throw new Error('Task not found');
  tasks[idx] = {
    ...tasks[idx],
    ...update,
    priority: (update.priority as Task['priority']) ?? tasks[idx].priority,
    status: (update.status as Task['status']) ?? tasks[idx].status,
    updated_at: now(),
    completed_at: update.status === 'completed' ? now() : tasks[idx].completed_at,
  };
  save(tasks);
  return tasks[idx];
};

export const deleteTask = async (taskId: string): Promise<void> => {
  save(load().filter(t => t.id !== taskId));
};

export const processInput = async (input: { text?: string }): Promise<TaskExtractionResponse> => {
  const text = input.text?.trim() || '';
  if (!text) throw new Error('No input text');

  // Detect "mark X as done" / "finished X" / "completed X"
  const completedMatch = text.match(
    /(?:finished|completed|done with|mark(?:ed)?)\s+(.+)/i
  );
  if (completedMatch) {
    const tasks = load();
    const keyword = completedMatch[1].toLowerCase();
    const matched = tasks.filter(
      t => t.status !== 'completed' && t.title.toLowerCase().includes(keyword)
    );
    const updated: Task[] = [];
    for (const t of matched) {
      const u = await updateTask(t.id, { status: 'completed' });
      updated.push(u);
    }
    return {
      tasks: [],
      created_tasks: [],
      updated_tasks: updated.map(t => ({ task_id: t.id, changes: { status: 'completed' } })),
      raw_interpretation: matched.length
        ? `Marked ${matched.length} task(s) as completed.`
        : 'No matching pending tasks found.',
      language_detected: 'en',
      confidence: 0.8,
    } as any;
  }

  // Default: create a new task
  const title = cleanTitle(text) || text;
  const task = await createTask({
    title,
    priority: parsePriority(text),
    due_date: parseDueDate(text),
    original_input: text,
  } as any);

  return {
    tasks: [task],
    created_tasks: [task],
    updated_tasks: [],
    raw_interpretation: `Created task: "${task.title}"`,
    language_detected: 'en',
    confidence: 0.9,
  } as any;
};

export const getStats = async (): Promise<Stats> => {
  const tasks = load();
  const pending = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  return {
    total_tasks: tasks.length,
    pending,
    completed,
    completion_rate: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
    urgent_tasks: tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed').length,
    high_priority_tasks: tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length,
    learned_patterns: 0,
    corrections_made: 0,
  };
};

// Stubs for unused features on web
export const getLearningPatterns = async () => [];
export const deleteLearningPattern = async () => {};
export const submitCorrection = async () => {};
export const configureReminder = async () => {};
export const getPendingReminders = async () => ({ pending_reminders: [], count: 0 });
export const acknowledgeReminder = async () => {};
export const disableReminder = async () => {};
export const transcribeAudio = async () => ({ text: '', success: false });
