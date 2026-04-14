import axios from 'axios';
import { Task, TaskCreate, TaskUpdate, VoiceInputRequest, TaskExtractionResponse, LearningPattern, Stats } from '../types';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Tasks
export const getTasks = async (filters?: { status?: string; priority?: string; category?: string }): Promise<Task[]> => {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.priority) params.append('priority', filters.priority);
  if (filters?.category) params.append('category', filters.category);
  const response = await api.get(`/tasks?${params.toString()}`);
  return response.data;
};

export const getTask = async (taskId: string): Promise<Task> => {
  const response = await api.get(`/tasks/${taskId}`);
  return response.data;
};

export const createTask = async (task: TaskCreate): Promise<Task> => {
  const response = await api.post('/tasks', task);
  return response.data;
};

export const updateTask = async (taskId: string, update: TaskUpdate): Promise<Task> => {
  const response = await api.put(`/tasks/${taskId}`, update);
  return response.data;
};

export const deleteTask = async (taskId: string): Promise<void> => {
  await api.delete(`/tasks/${taskId}`);
};

// Voice/Text Processing
export const processInput = async (input: VoiceInputRequest): Promise<TaskExtractionResponse> => {
  const response = await api.post('/process-input', input);
  return response.data;
};

// Corrections
export const submitCorrection = async (
  taskId: string,
  correctionType: string,
  originalValue: string,
  correctedValue: string,
  originalInput: string
): Promise<void> => {
  const formData = new FormData();
  formData.append('task_id', taskId);
  formData.append('correction_type', correctionType);
  formData.append('original_value', originalValue);
  formData.append('corrected_value', correctedValue);
  formData.append('original_input', originalInput);
  
  await api.post('/corrections', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// Learning Patterns
export const getLearningPatterns = async (): Promise<LearningPattern[]> => {
  const response = await api.get('/learning-patterns');
  return response.data;
};

export const deleteLearningPattern = async (patternId: string): Promise<void> => {
  await api.delete(`/learning-patterns/${patternId}`);
};

// Stats
export const getStats = async (): Promise<Stats> => {
  const response = await api.get('/stats');
  return response.data;
};

export default api;
