import { create } from 'zustand';
import { Task, TaskCreate, TaskUpdate, TaskExtractionResponse, Stats } from '../types';
import * as api from '../services/api';

interface TaskState {
  tasks: Task[];
  stats: Stats | null;
  isLoading: boolean;
  error: string | null;
  lastExtraction: TaskExtractionResponse | null;
  
  // Actions
  fetchTasks: (filters?: { status?: string; priority?: string }) => Promise<void>;
  fetchStats: () => Promise<void>;
  addTask: (task: TaskCreate) => Promise<Task>;
  updateTask: (taskId: string, update: TaskUpdate) => Promise<void>;
  removeTask: (taskId: string) => Promise<void>;
  processVoiceInput: (text: string, languageHint?: string) => Promise<TaskExtractionResponse>;
  completeTask: (taskId: string) => Promise<void>;
  clearError: () => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  stats: null,
  isLoading: false,
  error: null,
  lastExtraction: null,

  fetchTasks: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const tasks = await api.getTasks(filters);
      set({ tasks, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch tasks', isLoading: false });
    }
  },

  fetchStats: async () => {
    try {
      const stats = await api.getStats();
      set({ stats });
    } catch (error: any) {
      console.error('Failed to fetch stats:', error);
    }
  },

  addTask: async (taskData) => {
    set({ isLoading: true, error: null });
    try {
      const task = await api.createTask(taskData);
      set((state) => ({ 
        tasks: [task, ...state.tasks], 
        isLoading: false 
      }));
      return task;
    } catch (error: any) {
      set({ error: error.message || 'Failed to create task', isLoading: false });
      throw error;
    }
  },

  updateTask: async (taskId, update) => {
    set({ isLoading: true, error: null });
    try {
      const updatedTask = await api.updateTask(taskId, update);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === taskId ? updatedTask : t)),
        isLoading: false,
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to update task', isLoading: false });
      throw error;
    }
  },

  removeTask: async (taskId) => {
    set({ isLoading: true, error: null });
    try {
      await api.deleteTask(taskId);
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== taskId),
        isLoading: false,
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to delete task', isLoading: false });
      throw error;
    }
  },

  processVoiceInput: async (text, languageHint) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.processInput({ text, language_hint: languageHint });
      set((state) => ({
        tasks: [...result.tasks, ...state.tasks],
        lastExtraction: result,
        isLoading: false,
      }));
      return result;
    } catch (error: any) {
      set({ error: error.message || 'Failed to process input', isLoading: false });
      throw error;
    }
  },

  completeTask: async (taskId) => {
    await get().updateTask(taskId, { status: 'completed' });
  },

  clearError: () => set({ error: null }),
}));
