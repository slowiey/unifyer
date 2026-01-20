import React, { useState, useEffect, useRef } from 'react';

// Types
interface CalendarEvent {
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
}

interface CalendarViewState {
  type: 'day' | 'week' | 'month';
  date: Date;
}

type EventFormData = Omit<CalendarEvent, 'id'>;

// Storage functions
const STORAGE_KEY = 'unifyer_calendar_events';

const getEvents = (): CalendarEvent[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const events = JSON.parse(stored);
    return events.map((event: any) => ({
      ...event,
      startDate: new Date(event.startDate),
      endDate: event.endDate ? new Date(event.endDate) : undefined,
    }));
  } catch {
    return [];
  }
};

const saveEvents = (events: CalendarEvent[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
};

const addEvent = (eventData: EventFormData): CalendarEvent => {
  const events = getEvents();
  const newEvent: CalendarEvent = {
    ...eventData,
    id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  };
  events.push(newEvent);
  saveEvents(events);
  return newEvent;
};

const updateEventInStorage = (id: string, eventData: Partial<EventFormData>): void => {
  const events = getEvents();
  const index = events.findIndex(e => e.id === id);
  if (index !== -1) {
    events[index] = { ...events[index], ...eventData };
    saveEvents(events);
  }
};

const deleteEventFromStorage = (id: string): void => {
  const events = getEvents();
  saveEvents(events.filter(e => e.id !== id));
};

const importICalEvents = (content: string): CalendarEvent[] => {
  const parsedEvents: EventFormData[] = [];
  const lines = content.split(/\r\n|\n|\r/);
  
  let currentEvent: Partial<EventFormData> | null = null;
  let inEvent = false;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
      i++;
      line += lines[i].substring(1);
    }
    
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = { type: 'imported', color: '#6366f1' };
    } else if (line === 'END:VEVENT' && currentEvent) {
      inEvent = false;
      if (currentEvent.title && currentEvent.startDate) {
        parsedEvents.push(currentEvent as EventFormData);
      }
      currentEvent = null;
    } else if (inEvent && currentEvent) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;
      
      const key = line.substring(0, colonIndex);
      const value = line.substring(colonIndex + 1);
      const keyParts = key.split(';');
      const mainKey = keyParts[0];
      
      const parseDate = (val: string, parts: string[]): Date => {
        const isDateOnly = parts.some(p => p === 'VALUE=DATE');
        const year = parseInt(val.substring(0, 4));
        const month = parseInt(val.substring(4, 6)) - 1;
        const day = parseInt(val.substring(6, 8));
        
        if (isDateOnly) return new Date(year, month, day);
        
        const hour = parseInt(val.substring(9, 11)) || 0;
        const minute = parseInt(val.substring(11, 13)) || 0;
        return new Date(year, month, day, hour, minute);
      };
      
      switch (mainKey) {
        case 'SUMMARY':
          currentEvent.title = value.replace(/\\[,;n]/g, m => m === '\\n' ? '\n' : m[1]);
          break;
        case 'DESCRIPTION':
          currentEvent.description = value.replace(/\\[,;n]/g, m => m === '\\n' ? '\n' : m[1]);
          break;
        case 'DTSTART':
          currentEvent.startDate = parseDate(value, keyParts);
          currentEvent.allDay = keyParts.some(p => p === 'VALUE=DATE');
          break;
        case 'DTEND':
          currentEvent.endDate = parseDate(value, keyParts);
          break;
        case 'LOCATION':
          currentEvent.location = value;
          break;
      }
    }
  }
  
  return parsedEvents.map(e => addEvent(e));
};

// Helper functions
const getEventColor = (event: CalendarEvent): string => {
  if (event.color) return event.color;
  const colors: Record<string, string> = {
    exam: '#ef4444',
    project: '#f59e0b',
    assignment: '#3b82f6',
    imported: '#6366f1',
    personal: '#10b981',
  };
  return colors[event.type] || '#10b981';
};

const formatDateTimeLocal = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatDateLocal = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

// Event Modal Component
const EventModal: React.FC<{
  event?: CalendarEvent | null;
  initialDate?: Date;
  onSave: (data: EventFormData) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}> = ({ event, initialDate, onSave, onDelete, onClose }) => {
  const [formData, setFormData] = useState<EventFormData>(() => {
    if (event) {
      return {
        title: event.title,
        description: event.description || '',
        startDate: new Date(event.startDate),
        endDate: event.endDate ? new Date(event.endDate) : undefined,
        allDay: event.allDay || false,
        type: event.type,
        color: event.color || '#6366f1',
        location: event.location || '',
      };
    }
    const start = initialDate || new Date();
    const end = new Date(start);
    end.setHours(end.getHours() + 1);
    return {
      title: '',
      description: '',
      startDate: start,
      endDate: end,
      allDay: false,
      type: 'personal',
      color: '#10b981',
      location: '',
    };
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    onSave(formData);
  };

  const eventTypes = [
    { value: 'personal', label: 'Personal', color: '#10b981' },
    { value: 'exam', label: 'Exam', color: '#ef4444' },
    { value: 'project', label: 'Project', color: '#f59e0b' },
    { value: 'assignment', label: 'Assignment', color: '#3b82f6' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">
            {event ? 'Edit Event' : 'New Event'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Event title"
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Type</label>
            <div className="flex flex-wrap gap-2">
              {eventTypes.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, type: type.value as any, color: type.color })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    formData.type === type.value ? 'ring-2 ring-offset-2' : ''
                  }`}
                  style={{
                    backgroundColor: `${type.color}20`,
                    color: type.color,
                  }}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="allDay"
              checked={formData.allDay}
              onChange={(e) => setFormData({ ...formData, allDay: e.target.checked })}
              className="w-5 h-5 rounded border-slate-300 text-indigo-600"
            />
            <label htmlFor="allDay" className="text-sm font-medium text-slate-700">All day event</label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Start</label>
              <input
                type={formData.allDay ? 'date' : 'datetime-local'}
                value={formData.allDay ? formatDateLocal(formData.startDate) : formatDateTimeLocal(formData.startDate)}
                onChange={(e) => setFormData({ ...formData, startDate: new Date(e.target.value) })}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">End</label>
              <input
                type={formData.allDay ? 'date' : 'datetime-local'}
                value={formData.endDate ? (formData.allDay ? formatDateLocal(formData.endDate) : formatDateTimeLocal(formData.endDate)) : ''}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value ? new Date(e.target.value) : undefined })}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Add location"
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add description"
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            {event && onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(event.id)}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg"
              >
                Delete
              </button>
            ) : <div />}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg">
                Cancel
              </button>
              <button type="submit" className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">
                {event ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// Import Modal Component
const ImportModal: React.FC<{
  onImport: (content: string) => void;
  onClose: () => void;
}> = ({ onImport, onClose }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setError(null);
    if (!file.name.endsWith('.ics') && !file.name.endsWith('.ical')) {
      setError('Please upload a valid iCal file (.ics or .ical)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content.includes('BEGIN:VCALENDAR')) {
        onImport(content);
      } else {
        setError('Invalid iCal file format');
      }
    };
    reader.onerror = () => setError('Error reading file');
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Import Calendar</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          <div
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
              isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".ics,.ical"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="hidden"
            />
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-900">Drop your iCal file here</p>
            <p className="text-xs text-slate-500 mt-1">or click to browse (.ics, .ical)</p>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// Month View Component
const MonthView: React.FC<{
  date: Date;
  events: CalendarEvent[];
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}> = ({ date, events, onDateClick, onEventClick }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const days: Array<{ date: Date; isCurrentMonth: boolean }> = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month - 1, daysInPrevMonth - i), isCurrentMonth: false });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true });
  }
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
  }

  const getEventsForDay = (day: Date) => events.filter(e => {
    const ed = new Date(e.startDate);
    return ed.getDate() === day.getDate() && ed.getMonth() === day.getMonth() && ed.getFullYear() === day.getFullYear();
  });

  const isToday = (day: Date) => day.getDate() === today.getDate() && day.getMonth() === today.getMonth() && day.getFullYear() === today.getFullYear();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-slate-200">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="py-3 text-center text-sm font-medium text-slate-600 bg-slate-50">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const dayEvents = getEventsForDay(day.date);
          return (
            <div
              key={i}
              onClick={() => onDateClick(day.date)}
              className={`min-h-[100px] p-2 border-b border-r border-slate-100 cursor-pointer hover:bg-slate-50 ${!day.isCurrentMonth ? 'bg-slate-50/50' : ''}`}
            >
              <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
                isToday(day.date) ? 'bg-indigo-600 text-white' : day.isCurrentMonth ? 'text-slate-900' : 'text-slate-400'
              }`}>
                {day.date.getDate()}
              </span>
              <div className="mt-1 space-y-1">
                {dayEvents.slice(0, 3).map(event => (
                  <div
                    key={event.id}
                    onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                    className="text-xs px-2 py-1 rounded truncate cursor-pointer hover:opacity-80"
                    style={{
                      backgroundColor: `${getEventColor(event)}20`,
                      color: getEventColor(event),
                      borderLeft: `3px solid ${getEventColor(event)}`,
                    }}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && <div className="text-xs text-slate-500 px-2">+{dayEvents.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Week View Component
const WeekView: React.FC<{
  date: Date;
  events: CalendarEvent[];
  onTimeSlotClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}> = ({ date, events, onTimeSlotClick, onEventClick }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekStart = new Date(date);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getEventsForDay = (day: Date) => events.filter(e => {
    const ed = new Date(e.startDate);
    return ed.getDate() === day.getDate() && ed.getMonth() === day.getMonth() && ed.getFullYear() === day.getFullYear();
  });

  const isToday = (day: Date) => day.toDateString() === today.toDateString();

  const formatHour = (h: number) => `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="grid grid-cols-8 border-b border-slate-200 sticky top-0 bg-white z-10">
        <div className="py-3 px-2 border-r border-slate-200" />
        {weekDays.map((day, i) => (
          <div key={i} className={`py-3 px-2 text-center border-r border-slate-200 ${isToday(day) ? 'bg-indigo-50' : ''}`}>
            <div className="text-xs text-slate-500">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
            <div className={`text-lg font-semibold mt-1 w-8 h-8 mx-auto flex items-center justify-center rounded-full ${
              isToday(day) ? 'bg-indigo-600 text-white' : 'text-slate-900'
            }`}>
              {day.getDate()}
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-y-auto max-h-[500px]">
        <div className="grid grid-cols-8">
          <div className="border-r border-slate-200">
            {hours.map(h => (
              <div key={h} className="h-12 border-b border-slate-100 px-2 flex items-start justify-end">
                <span className="text-xs text-slate-400 -mt-2">{formatHour(h)}</span>
              </div>
            ))}
          </div>
          {weekDays.map((day, dayIndex) => {
            const dayEvents = getEventsForDay(day).filter(e => !e.allDay);
            return (
              <div key={dayIndex} className="relative border-r border-slate-200">
                {hours.map(h => (
                  <div
                    key={h}
                    onClick={() => {
                      const d = new Date(day);
                      d.setHours(h);
                      onTimeSlotClick(d);
                    }}
                    className={`h-12 border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${isToday(day) ? 'bg-indigo-50/30' : ''}`}
                  />
                ))}
                {dayEvents.map(event => {
                  const startH = new Date(event.startDate).getHours();
                  const startM = new Date(event.startDate).getMinutes();
                  const top = (startH * 60 + startM) * (48 / 60);
                  const duration = event.endDate ? (new Date(event.endDate).getTime() - new Date(event.startDate).getTime()) / 60000 : 60;
                  const height = Math.max(duration * (48 / 60), 24);
                  
                  return (
                    <div
                      key={event.id}
                      onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                      className="absolute left-1 right-1 px-2 py-1 rounded text-xs cursor-pointer hover:opacity-80 overflow-hidden"
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        backgroundColor: `${getEventColor(event)}20`,
                        color: getEventColor(event),
                        borderLeft: `3px solid ${getEventColor(event)}`,
                      }}
                    >
                      <div className="font-medium truncate">{event.title}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Day View Component
const DayView: React.FC<{
  date: Date;
  events: CalendarEvent[];
  onTimeSlotClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}> = ({ date, events, onTimeSlotClick, onEventClick }) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  const dayEvents = events.filter(e => {
    const ed = new Date(e.startDate);
    return ed.getDate() === date.getDate() && ed.getMonth() === date.getMonth() && ed.getFullYear() === date.getFullYear();
  });

  const allDayEvents = dayEvents.filter(e => e.allDay);
  const timedEvents = dayEvents.filter(e => !e.allDay);
  const formatHour = (h: number) => `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {allDayEvents.length > 0 && (
        <div className="border-b border-slate-200 p-4">
          <div className="text-xs text-slate-500 mb-2 font-medium">ALL DAY</div>
          <div className="space-y-2">
            {allDayEvents.map(event => (
              <div
                key={event.id}
                onClick={() => onEventClick(event)}
                className="px-4 py-3 rounded-lg cursor-pointer hover:opacity-80"
                style={{
                  backgroundColor: `${getEventColor(event)}15`,
                  borderLeft: `4px solid ${getEventColor(event)}`,
                }}
              >
                <div className="font-medium text-slate-900">{event.title}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-y-auto max-h-[500px]">
        {hours.map(h => (
          <div key={h} className="flex border-b border-slate-100">
            <div className="w-20 py-4 px-3 text-right flex-shrink-0">
              <span className="text-xs text-slate-400">{formatHour(h)}</span>
            </div>
            <div
              onClick={() => {
                const d = new Date(date);
                d.setHours(h, 0);
                onTimeSlotClick(d);
              }}
              className="flex-1 h-[60px] border-l border-slate-200 cursor-pointer hover:bg-slate-50 relative"
            >
              {timedEvents
                .filter(e => new Date(e.startDate).getHours() === h)
                .map(event => {
                  const startM = new Date(event.startDate).getMinutes();
                  const duration = event.endDate ? (new Date(event.endDate).getTime() - new Date(event.startDate).getTime()) / 60000 : 60;
                  
                  return (
                    <div
                      key={event.id}
                      onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                      className="absolute left-2 right-2 px-3 py-2 rounded-lg cursor-pointer hover:opacity-80 overflow-hidden"
                      style={{
                        top: `${startM}px`,
                        height: `${Math.max(duration, 30)}px`,
                        backgroundColor: `${getEventColor(event)}20`,
                        borderLeft: `4px solid ${getEventColor(event)}`,
                      }}
                    >
                      <div className="font-medium text-slate-900 text-sm truncate">{event.title}</div>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Main Calendar Tab Component
const CalendarTab: React.FC = () => {
  const [view, setView] = useState<CalendarViewState>({ type: 'month', date: new Date() });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    setEvents(getEvents());
  }, []);

  const loadEvents = () => setEvents(getEvents());

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(view.date);
    const delta = direction === 'next' ? 1 : -1;
    if (view.type === 'day') newDate.setDate(newDate.getDate() + delta);
    else if (view.type === 'week') newDate.setDate(newDate.getDate() + delta * 7);
    else newDate.setMonth(newDate.getMonth() + delta);
    setView({ ...view, date: newDate });
  };

  const formatHeaderDate = (): string => {
    if (view.type === 'day') {
      return view.date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
    if (view.type === 'week') {
      const ws = new Date(view.date);
      ws.setDate(ws.getDate() - ws.getDay());
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      return `${ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${we.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return view.date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const handleSaveEvent = (data: EventFormData) => {
    if (selectedEvent) {
      updateEventInStorage(selectedEvent.id, data);
    } else {
      addEvent(data);
    }
    loadEvents();
    setShowEventModal(false);
    setSelectedEvent(null);
    setSelectedDate(null);
  };

  const handleDeleteEvent = (id: string) => {
    deleteEventFromStorage(id);
    loadEvents();
    setShowEventModal(false);
    setSelectedEvent(null);
  };

  const handleImport = (content: string) => {
    const imported = importICalEvents(content);
    loadEvents();
    setShowImportModal(false);
    alert(`Imported ${imported.length} events!`);
  };

  const handleDateClick = (date: Date) => {
    if (view.type === 'month') {
      setView({ type: 'day', date });
    } else {
      setSelectedDate(date);
      setSelectedEvent(null);
      setShowEventModal(true);
    }
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setSelectedDate(null);
    setShowEventModal(true);
  };

  const upcomingEvents = events
    .filter(e => new Date(e.startDate) >= new Date())
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 5);

  return (
    <div className="flex gap-6 h-full">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-slate-900">{formatHeaderDate()}</h2>
            <div className="flex items-center gap-1">
              <button onClick={() => navigateDate('prev')} className="p-2 hover:bg-slate-100 rounded-lg">
                <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button onClick={() => setView({ ...view, date: new Date() })} className="px-3 py-1 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg">
                Today
              </button>
              <button onClick={() => navigateDate('next')} className="p-2 hover:bg-slate-100 rounded-lg">
                <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 rounded-lg p-1">
              {(['day', 'week', 'month'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setView({ ...view, type: t })}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition ${
                    view.type === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import
            </button>

            <button
              onClick={() => { setSelectedEvent(null); setSelectedDate(new Date()); setShowEventModal(true); }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Event
            </button>
          </div>
        </div>

        {/* Calendar View */}
        <div className="flex-1 overflow-hidden">
          {view.type === 'month' && (
            <MonthView date={view.date} events={events} onDateClick={handleDateClick} onEventClick={handleEventClick} />
          )}
          {view.type === 'week' && (
            <WeekView date={view.date} events={events} onTimeSlotClick={handleDateClick} onEventClick={handleEventClick} />
          )}
          {view.type === 'day' && (
            <DayView date={view.date} events={events} onTimeSlotClick={handleDateClick} onEventClick={handleEventClick} />
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-72 flex-shrink-0">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Upcoming Events</h3>
          {upcomingEvents.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm text-slate-500">No upcoming events</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map(event => (
                <div
                  key={event.id}
                  onClick={() => handleEventClick(event)}
                  className="p-3 rounded-xl cursor-pointer hover:bg-slate-50"
                  style={{ borderLeft: `4px solid ${getEventColor(event)}` }}
                >
                  <h4 className="text-sm font-medium text-slate-900 truncate">{event.title}</h4>
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{new Date(event.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showEventModal && (
        <EventModal
          event={selectedEvent}
          initialDate={selectedDate || undefined}
          onSave={handleSaveEvent}
          onDelete={selectedEvent ? handleDeleteEvent : undefined}
          onClose={() => { setShowEventModal(false); setSelectedEvent(null); setSelectedDate(null); }}
        />
      )}

      {showImportModal && (
        <ImportModal
          onImport={handleImport}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  );
};

export default CalendarTab;