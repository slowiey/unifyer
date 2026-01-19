
export type Priority = 'Low' | 'Medium' | 'High';

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: Priority;
}

export interface FileData {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadDate: string;
  folderId: string | null; // null means root
  source: 'local' | 'google-drive';
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  source: 'local' | 'google-drive';
}

export interface Module {
  id: string;
  name: string;
  credits: number;
  description?: string;
}

export interface Project {
  id: string;
  title: string;
  course: string;
  description: string;
  dueDate: string;
  progress: number;
  priority: Priority;
  tasks: Task[];
  files: FileData[];
  sharedWith: string[];
  notebook?: string;
  vaultFolderId?: string;
  moduleId?: string; // Associated module
}

export interface Exam {
  id: string;
  course: string;
  date: string;
  time: string;
  location: string;
  priority: Priority;
  notes: string;
  grade?: string;
  tasks: Task[]; // Study tasks
  files: FileData[];
  notebook?: string;
  vaultFolderId?: string;
  progress: number;
  moduleId?: string; // Associated module
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: Date;
  end: Date;
  location?: string;
  description?: string;
  type: 'lesson' | 'exam' | 'other';
}

export interface CalendarSubscription {
  id: string;
  name: string;
  url: string;
  events: CalendarEvent[];
  color: string;
}
