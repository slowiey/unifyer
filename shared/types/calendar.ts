export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  allDay?: boolean;
  type: 'exam' | 'project' | 'assignment' | 'personal' | 'imported';
  color?: string;
  courseId?: string;
  courseName?: string;
  location?: string;
  reminder?: number;
}

export interface CalendarView {
  type: 'day' | 'week' | 'month';
  date: Date;
}

export type EventFormData = Omit<CalendarEvent, 'id'>;