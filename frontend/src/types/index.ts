export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_date?: string;
  category?: string;
  tags: string[];
  original_input?: string;
  language_detected?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  reminder_enabled: boolean;
  reminder_times: string[];
}

export interface TaskCreate {
  title: string;
  description?: string;
  priority?: string;
  due_date?: string;
  category?: string;
  tags?: string[];
  reminder_enabled?: boolean;
}

export interface TaskUpdate {
  title?: string;
  description?: string;
  priority?: string;
  status?: string;
  due_date?: string;
  category?: string;
  tags?: string[];
  reminder_enabled?: boolean;
}

export interface VoiceInputRequest {
  text?: string;
  audio_base64?: string;
  language_hint?: string;
}

export interface TaskExtractionResponse {
  tasks: Task[];
  raw_interpretation: string;
  language_detected: string;
  confidence: number;
}

export interface LearningPattern {
  id: string;
  pattern_type: string;
  trigger_phrase: string;
  extracted_value: string;
  confidence: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface Stats {
  total_tasks: number;
  pending: number;
  completed: number;
  completion_rate: number;
  urgent_tasks: number;
  high_priority_tasks: number;
  learned_patterns: number;
  corrections_made: number;
}
