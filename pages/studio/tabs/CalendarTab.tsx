import React, { useState, useEffect, useRef, useCallback } from 'react';

// Types
interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  allDay?: boolean;
  type: 'exam' | 'project' | 'assignment' | 'personal' | 'imported' | 'subscription';
  color?: string;
  courseId?: string;
  courseName?: string;
  location?: string;
  subscriptionUrl?: string;
}

interface CalendarSubscription {
  id: string;
  name: string;
  url: string;
  color: string;
  lastSync?: Date;
  enabled: boolean;
}

interface CalendarViewState {
  type: 'day' | 'week' | 'month';
  date: Date;
}

type EventFormData = Omit<CalendarEvent, 'id'>;

// Storage keys
const STORAGE_KEY = 'unifyer_calendar_events';
const SUBSCRIPTIONS_KEY = 'unifyer_calendar_subscriptions';
const EXAMS_STORAGE_KEY = 'unifyer_exams';

// Storage functions
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

// Subscription storage functions
const getSubscriptions = (): CalendarSubscription[] => {
  try {
    const stored = localStorage.getItem(SUBSCRIPTIONS_KEY);
    if (!stored) return [];
    return JSON.parse(stored).map((sub: any) => ({
      ...sub,
      lastSync: sub.lastSync ? new Date(sub.lastSync) : undefined,
    }));
  } catch {
    return [];
  }
};

const saveSubscriptions = (subscriptions: CalendarSubscription[]): void => {
  localStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(subscriptions));
};

const addSubscription = (name: string, url: string, color: string): CalendarSubscription => {
  const subscriptions = getSubscriptions();
  const newSub: CalendarSubscription = {
    id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    url,
    color,
    enabled: true,
  };
  subscriptions.push(newSub);
  saveSubscriptions(subscriptions);
  return newSub;
};

const deleteSubscription = (id: string): void => {
  const subscriptions = getSubscriptions();
  saveSubscriptions(subscriptions.filter(s => s.id !== id));
  // Also delete events from this subscription
  const events = getEvents();
  saveEvents(events.filter(e => e.subscriptionUrl !== id));
};

// Get exams from storage and convert to calendar events
const getExamsAsEvents = (): CalendarEvent[] => {
  try {
    const stored = localStorage.getItem(EXAMS_STORAGE_KEY);
    if (!stored) return [];
    const exams = JSON.parse(stored);
    return exams.map((exam: any) => ({
      id: `exam_${exam.id}`,
      title: `📝 ${exam.name || exam.title}`,
      description: exam.description || `Exam for ${exam.courseName || 'Course'}`,
      startDate: new Date(exam.date || exam.startDate),
      endDate: exam.endDate ? new Date(exam.endDate) : undefined,
      allDay: exam.allDay !== false,
      type: 'exam' as const,
      color: '#ef4444',
      courseId: exam.courseId,
      courseName: exam.courseName,
      location: exam.location || exam.room,
    }));
  } catch {
    return [];
  }
};

// iCal parsing
const parseICalContent = (content: string, subscriptionId?: string, color?: string): EventFormData[] => {
  const events: EventFormData[] = [];
  const lines = content.split(/\r\n|\n|\r/);
  
  let currentEvent: Partial<EventFormData> | null = null;
  let inEvent = false;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Handle line folding
    while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
      i++;
      line += lines[i].substring(1);
    }
    
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = { 
        type: subscriptionId ? 'subscription' : 'imported', 
        color: color || '#6366f1',
        subscriptionUrl: subscriptionId,
      };
    } else if (line === 'END:VEVENT' && currentEvent) {
      inEvent = false;
      if (currentEvent.title && currentEvent.startDate) {
        events.push(currentEvent as EventFormData);
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
        const second = parseInt(val.substring(13, 15)) || 0;
        
        if (val.endsWith('Z')) {
          return new Date(Date.UTC(year, month, day, hour, minute, second));
        }
        return new Date(year, month, day, hour, minute, second);
      };
      
      const unescapeValue = (val: string): string => {
        return val
          .replace(/\\n/g, '\n')
          .replace(/\\,/g, ',')
          .replace(/\\;/g, ';')
          .replace(/\\\\/g, '\\');
      };
      
      switch (mainKey) {
        case 'SUMMARY':
          currentEvent.title = unescapeValue(value);
          break;
        case 'DESCRIPTION':
          currentEvent.description = unescapeValue(value);
          break;
        case 'DTSTART':
          currentEvent.startDate = parseDate(value, keyParts);
          currentEvent.allDay = keyParts.some(p => p === 'VALUE=DATE');
          break;
        case 'DTEND':
          currentEvent.endDate = parseDate(value, keyParts);
          break;
        case 'LOCATION':
          currentEvent.location = unescapeValue(value);
          break;
      }
    }
  }
  
  return events;
};

const importICalEvents = (content: string): CalendarEvent[] => {
  const parsedEvents = parseICalContent(content);
  return parsedEvents.map(e => addEvent(e));
};

// Fetch and sync subscription
const syncSubscription = async (subscription: CalendarSubscription): Promise<CalendarEvent[]> => {
  try {
    // Use a CORS proxy for external URLs
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(subscription.url)}`;
    
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/calendar, text/plain, */*',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch calendar: ${response.status}`);
    }
    
    const content = await response.text();
    
    if (!content.includes('BEGIN:VCALENDAR')) {
      throw new Error('Invalid iCal format');
    }
    
    // Remove old events from this subscription
    const events = getEvents();
    const otherEvents = events.filter(e => e.subscriptionUrl !== subscription.id);
    saveEvents(otherEvents);
    
    // Parse and add new events
    const parsedEvents = parseICalContent(content, subscription.id, subscription.color);
    const newEvents = parsedEvents.map(e => addEvent(e));
    
    // Update subscription last sync time
    const subscriptions = getSubscriptions();
    const subIndex = subscriptions.findIndex(s => s.id === subscription.id);
    if (subIndex !== -1) {
      subscriptions[subIndex].lastSync = new Date();
      saveSubscriptions(subscriptions);
    }
    
    return newEvents;
  } catch (error) {
    console.error('Error syncing subscription:', error);
    throw error;
  }
};

// Helper functions
const getEventColor = (event: CalendarEvent): string => {
  if (event.color) return event.color;
  const colors: Record<string, string> = {
    exam: '#ef4444',
    project: '#f59e0b',
    assignment: '#3b82f6',
    imported: '#6366f1',
    subscription: '#8b5cf6',
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

const isSameDay = (date1: Date, date2: Date): boolean => {
  return date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear();
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
    start.setMinutes(0, 0, 0);
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

  const isReadOnly = event?.type === 'subscription' || event?.type === 'exam';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">
            {event ? (isReadOnly ? 'Event Details' : 'Edit Event') : 'New Event'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isReadOnly ? (
          <div className="p-6 space-y-4">
            <div>
              <div className="text-sm text-slate-500 mb-1">Title</div>
              <div className="text-lg font-medium text-slate-900">{formData.title}</div>
            </div>
            {formData.description && (
              <div>
                <div className="text-sm text-slate-500 mb-1">Description</div>
                <div className="text-slate-700 whitespace-pre-wrap">{formData.description}</div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-slate-500 mb-1">Start</div>
                <div className="text-slate-900">
                  {formData.allDay 
                    ? formData.startDate.toLocaleDateString()
                    : formData.startDate.toLocaleString()
                  }
                </div>
              </div>
              {formData.endDate && (
                <div>
                  <div className="text-sm text-slate-500 mb-1">End</div>
                  <div className="text-slate-900">
                    {formData.allDay 
                      ? formData.endDate.toLocaleDateString()
                      : formData.endDate.toLocaleString()
                    }
                  </div>
                </div>
              )}
            </div>
            {formData.location && (
              <div>
                <div className="text-sm text-slate-500 mb-1">Location</div>
                <div className="text-slate-900">{formData.location}</div>
              </div>
            )}
            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Event title"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
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
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      formData.type === type.value ? 'ring-2 ring-offset-2' : 'hover:opacity-80'
                    }`}
                    style={{
                      backgroundColor: `${type.color}20`,
                      color: type.color,
                      '--tw-ring-color': type.color,
                    } as React.CSSProperties}
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
                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="allDay" className="text-sm font-medium text-slate-700">All day event</label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Start</label>
                <input
                  type={formData.allDay ? 'date' : 'datetime-local'}
                  value={formData.allDay ? formatDateLocal(formData.startDate) : formatDateTimeLocal(formData.startDate)}
                  onChange={(e) => {
                    const newDate = new Date(e.target.value);
                    if (!isNaN(newDate.getTime())) {
                      setFormData({ ...formData, startDate: newDate });
                    }
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">End</label>
                <input
                  type={formData.allDay ? 'date' : 'datetime-local'}
                  value={formData.endDate ? (formData.allDay ? formatDateLocal(formData.endDate) : formatDateTimeLocal(formData.endDate)) : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      const newDate = new Date(e.target.value);
                      if (!isNaN(newDate.getTime())) {
                        setFormData({ ...formData, endDate: newDate });
                      }
                    } else {
                      setFormData({ ...formData, endDate: undefined });
                    }
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 outline-none transition-all"
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
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Add description"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 outline-none resize-none transition-all"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              {event && onDelete ? (
                <button
                  type="button"
                  onClick={() => onDelete(event.id)}
                  className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Delete
                </button>
              ) : <div />}
              <div className="flex gap-3">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm">
                  {event ? 'Save' : 'Create'}
                </button>
              </div>
            </div>
          </form>
        )}
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Import Calendar</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          <div
            onDrop={(e) => { 
              e.preventDefault(); 
              setIsDragging(false); 
              if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); 
            }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
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
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// Subscription Modal Component
const SubscriptionModal: React.FC<{
  subscriptions: CalendarSubscription[];
  onAddSubscription: (name: string, url: string, color: string) => void;
  onDeleteSubscription: (id: string) => void;
  onSyncSubscription: (subscription: CalendarSubscription) => void;
  onClose: () => void;
}> = ({ subscriptions, onAddSubscription, onDeleteSubscription, onSyncSubscription, onClose }) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [color, setColor] = useState('#8b5cf6');
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  const colors = ['#8b5cf6', '#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

  const handleAdd = () => {
    setError(null);
    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }
    
    // Basic URL validation
    try {
      new URL(url);
    } catch {
      setError('Please enter a valid URL');
      return;
    }
    
    onAddSubscription(name.trim(), url.trim(), color);
    setName('');
    setUrl('');
  };

  const handleSync = async (sub: CalendarSubscription) => {
    setSyncing(sub.id);
    setError(null);
    try {
      await onSyncSubscription(sub);
    } catch (err: any) {
      setError(`Failed to sync "${sub.name}": ${err.message}`);
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Calendar Subscriptions</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Add new subscription */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-700">Add New Subscription</h3>
            <div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Calendar name"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              />
            </div>
            <div>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Calendar URL (webcal:// or https://)"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-2">Color</label>
              <div className="flex gap-2">
                {colors.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={handleAdd}
              className="w-full px-4 py-3 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm"
            >
              Add Subscription
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Existing subscriptions */}
          {subscriptions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-700">Your Subscriptions</h3>
              {subscriptions.map(sub => (
                <div key={sub.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{sub.name}</div>
                    <div className="text-xs text-slate-500 truncate">{sub.url}</div>
                    {sub.lastSync && (
                      <div className="text-xs text-slate-400 mt-1">
                        Last synced: {sub.lastSync.toLocaleString()}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleSync(sub)}
                    disabled={syncing === sub.id}
                    className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50"
                    title="Sync"
                  >
                    <svg className={`w-4 h-4 ${syncing === sub.id ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onDeleteSubscription(sub.id)}
                    className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="p-4 bg-blue-50 rounded-xl">
            <h4 className="text-sm font-medium text-blue-900 mb-1">💡 Tip</h4>
            <p className="text-xs text-blue-700">
              You can subscribe to calendars from Google Calendar, Outlook, Apple Calendar, or any service that provides an iCal URL. 
              Look for "Subscribe" or "Get public URL" options in your calendar app.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            Close
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

  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month - 1, daysInPrevMonth - i), isCurrentMonth: false });
  }
  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true });
  }
  // Next month days
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
  }

  const getEventsForDay = (day: Date) => events.filter(e => isSameDay(new Date(e.startDate), day));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="grid grid-cols-7 border-b border-slate-200">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="py-3 text-center text-sm font-medium text-slate-600 bg-slate-50">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const dayEvents = getEventsForDay(day.date);
          const isToday = isSameDay(day.date, today);
          
          return (
            <div
              key={i}
              onClick={() => onDateClick(day.date)}
              className={`min-h-[100px] p-2 border-b border-r border-slate-100 cursor-pointer transition-colors hover:bg-slate-50 ${
                !day.isCurrentMonth ? 'bg-slate-50/50' : ''
              }`}
            >
              <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
                isToday ? 'bg-indigo-600 text-white' : day.isCurrentMonth ? 'text-slate-900' : 'text-slate-400'
              }`}>
                {day.date.getDate()}
              </span>
              <div className="mt-1 space-y-1">
                {dayEvents.slice(0, 3).map(event => (
                  <div
                    key={event.id}
                    onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                    className="text-xs px-2 py-1 rounded truncate cursor-pointer transition-opacity hover:opacity-80"
                    style={{
                      backgroundColor: `${getEventColor(event)}20`,
                      color: getEventColor(event),
                      borderLeft: `3px solid ${getEventColor(event)}`,
                    }}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-slate-500 px-2 font-medium">+{dayEvents.length - 3} more</div>
                )}
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
  const scrollRef = useRef<HTMLDivElement>(null);

  const weekStart = new Date(date);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getEventsForDay = (day: Date) => events.filter(e => isSameDay(new Date(e.startDate), day));

  const formatHour = (h: number) => h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;

  // Scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const scrollPosition = (now.getHours() - 1) * 48;
      scrollRef.current.scrollTop = Math.max(0, scrollPosition);
    }
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="grid grid-cols-8 border-b border-slate-200 sticky top-0 bg-white z-10">
        <div className="py-3 px-2 border-r border-slate-200" />
        {weekDays.map((day, i) => {
          const isToday = isSameDay(day, today);
          return (
            <div key={i} className={`py-3 px-2 text-center border-r border-slate-200 ${isToday ? 'bg-indigo-50' : ''}`}>
              <div className="text-xs text-slate-500 uppercase">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
              <div className={`text-lg font-semibold mt-1 w-8 h-8 mx-auto flex items-center justify-center rounded-full ${
                isToday ? 'bg-indigo-600 text-white' : 'text-slate-900'
              }`}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day events row */}
      {weekDays.some(day => getEventsForDay(day).some(e => e.allDay)) && (
        <div className="grid grid-cols-8 border-b border-slate-200">
          <div className="py-2 px-2 border-r border-slate-200 text-xs text-slate-400 text-right">All day</div>
          {weekDays.map((day, i) => {
            const allDayEvents = getEventsForDay(day).filter(e => e.allDay);
            return (
              <div key={i} className="py-1 px-1 border-r border-slate-200 min-h-[32px]">
                {allDayEvents.slice(0, 2).map(event => (
                  <div
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    className="text-xs px-2 py-0.5 rounded truncate cursor-pointer mb-0.5 hover:opacity-80"
                    style={{
                      backgroundColor: `${getEventColor(event)}20`,
                      color: getEventColor(event),
                    }}
                  >
                    {event.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Time grid */}
      <div ref={scrollRef} className="overflow-y-auto max-h-[600px]">
        <div className="grid grid-cols-8">
          {/* Time labels */}
          <div className="border-r border-slate-200">
            {hours.map(h => (
              <div key={h} className="h-12 border-b border-slate-100 px-2 flex items-start justify-end">
                <span className="text-xs text-slate-400 -mt-2">{formatHour(h)}</span>
              </div>
            ))}
          </div>
          
          {/* Day columns */}
          {weekDays.map((day, dayIndex) => {
            const dayEvents = getEventsForDay(day).filter(e => !e.allDay);
            const isToday = isSameDay(day, today);
            
            return (
              <div key={dayIndex} className="relative border-r border-slate-200">
                {hours.map(h => (
                  <div
                    key={h}
                    onClick={() => {
                      const d = new Date(day);
                      d.setHours(h, 0, 0, 0);
                      onTimeSlotClick(d);
                    }}
                    className={`h-12 border-b border-slate-100 cursor-pointer transition-colors hover:bg-slate-50 ${
                      isToday ? 'bg-indigo-50/30' : ''
                    }`}
                  />
                ))}
                
                {/* Events */}
                {dayEvents.map(event => {
                  const startH = new Date(event.startDate).getHours();
                  const startM = new Date(event.startDate).getMinutes();
                  const top = (startH * 60 + startM) * (48 / 60);
                  const duration = event.endDate 
                    ? (new Date(event.endDate).getTime() - new Date(event.startDate).getTime()) / 60000 
                    : 60;
                  const height = Math.max(duration * (48 / 60), 20);
                  
                  return (
                    <div
                      key={event.id}
                      onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                      className="absolute left-1 right-1 px-2 py-1 rounded text-xs cursor-pointer transition-opacity hover:opacity-80 overflow-hidden shadow-sm"
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        backgroundColor: `${getEventColor(event)}20`,
                        color: getEventColor(event),
                        borderLeft: `3px solid ${getEventColor(event)}`,
                      }}
                    >
                      <div className="font-medium truncate">{event.title}</div>
                      {height > 30 && (
                        <div className="text-[10px] opacity-75">
                          {new Date(event.startDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Current time indicator */}
                {isToday && (() => {
                  const now = new Date();
                  const currentTop = (now.getHours() * 60 + now.getMinutes()) * (48 / 60);
                  return (
                    <div 
                      className="absolute left-0 right-0 h-0.5 bg-red-500 z-10" 
                      style={{ top: `${currentTop}px` }}
                    >
                      <div className="absolute -left-1 -top-1.5 w-3 h-3 bg-red-500 rounded-full" />
                    </div>
                  );
                })()}
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  const dayEvents = events.filter(e => isSameDay(new Date(e.startDate), date));
  const allDayEvents = dayEvents.filter(e => e.allDay);
  const timedEvents = dayEvents.filter(e => !e.allDay);
  const isToday = isSameDay(date, today);
  
  const formatHour = (h: number) => h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;

  // Scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const scrollPosition = (now.getHours() - 1) * 60;
      scrollRef.current.scrollTop = Math.max(0, scrollPosition);
    }
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="border-b border-slate-200 p-4">
          <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">All Day</div>
          <div className="space-y-2">
            {allDayEvents.map(event => (
              <div
                key={event.id}
                onClick={() => onEventClick(event)}
                className="px-4 py-3 rounded-lg cursor-pointer transition-opacity hover:opacity-80"
                style={{
                  backgroundColor: `${getEventColor(event)}15`,
                  borderLeft: `4px solid ${getEventColor(event)}`,
                }}
              >
                <div className="font-medium text-slate-900">{event.title}</div>
                {event.location && (
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {event.location}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div ref={scrollRef} className="overflow-y-auto max-h-[600px]">
        {hours.map(h => (
          <div key={h} className="flex border-b border-slate-100">
            <div className="w-20 py-4 px-3 text-right flex-shrink-0">
              <span className="text-xs text-slate-400">{formatHour(h)}</span>
            </div>
            <div
              onClick={() => {
                const d = new Date(date);
                d.setHours(h, 0, 0, 0);
                onTimeSlotClick(d);
              }}
              className={`flex-1 h-[60px] border-l border-slate-200 cursor-pointer transition-colors hover:bg-slate-50 relative ${
                isToday ? 'bg-indigo-50/20' : ''
              }`}
            >
              {timedEvents
                .filter(e => new Date(e.startDate).getHours() === h)
                .map(event => {
                  const startM = new Date(event.startDate).getMinutes();
                  const duration = event.endDate 
                    ? (new Date(event.endDate).getTime() - new Date(event.startDate).getTime()) / 60000 
                    : 60;
                  
                  return (
                    <div
                      key={event.id}
                      onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                      className="absolute left-2 right-2 px-3 py-2 rounded-lg cursor-pointer transition-opacity hover:opacity-80 overflow-hidden shadow-sm"
                      style={{
                        top: `${startM}px`,
                        height: `${Math.max(duration, 30)}px`,
                        backgroundColor: `${getEventColor(event)}20`,
                        borderLeft: `4px solid ${getEventColor(event)}`,
                      }}
                    >
                      <div className="font-medium text-slate-900 text-sm truncate">{event.title}</div>
                      {duration > 45 && event.location && (
                        <div className="text-xs text-slate-500 mt-1 truncate">{event.location}</div>
                      )}
                    </div>
                  );
                })}

              {/* Current time indicator */}
              {isToday && new Date().getHours() === h && (
                <div 
                  className="absolute left-0 right-0 h-0.5 bg-red-500 z-10" 
                  style={{ top: `${new Date().getMinutes()}px` }}
                >
                  <div className="absolute -left-1 -top-1.5 w-3 h-3 bg-red-500 rounded-full" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Mini Calendar Component
const MiniCalendar: React.FC<{
  date: Date;
  onDateSelect: (date: Date) => void;
}> = ({ date, onDateSelect }) => {
  const [viewDate, setViewDate] = useState(date);
  const today = new Date();

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const days: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="p-1 hover:bg-slate-100 rounded transition-colors"
        >
          <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-medium text-slate-900">
          {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="p-1 hover:bg-slate-100 rounded transition-colors"
        >
          <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      
      <div className="grid grid-cols-7 gap-1 text-center">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-xs text-slate-400 py-1">{d}</div>
        ))}
        {days.map((day, i) => {
          if (!day) return <div key={i} />;
          const isToday = isSameDay(day, today);
          const isSelected = isSameDay(day, date);
          
          return (
            <button
              key={i}
              onClick={() => onDateSelect(day)}
              className={`text-xs py-1.5 rounded transition-colors ${
                isSelected
                  ? 'bg-indigo-600 text-white'
                  : isToday
                  ? 'bg-indigo-100 text-indigo-600 font-medium'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Main Calendar Tab Component
const CalendarTab: React.FC = () => {
  const [view, setView] = useState<CalendarViewState>({ type: 'month', date: new Date() });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [subscriptions, setSubscriptions] = useState<CalendarSubscription[]>([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Load events and subscriptions
  const loadEvents = useCallback(() => {
    const storedEvents = getEvents();
    const examEvents = getExamsAsEvents();
    
    // Merge events, avoiding duplicate exam IDs
    const examIds = new Set(examEvents.map(e => e.id));
    const filteredStored = storedEvents.filter(e => !examIds.has(e.id));
    
    setEvents([...filteredStored, ...examEvents]);
  }, []);

  const loadSubscriptions = useCallback(() => {
    setSubscriptions(getSubscriptions());
  }, []);

  useEffect(() => {
    loadEvents();
    loadSubscriptions();
    
    // Listen for storage changes (e.g., exams added from another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === EXAMS_STORAGE_KEY) {
        loadEvents();
      }
      if (e.key === SUBSCRIPTIONS_KEY) {
        loadSubscriptions();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadEvents, loadSubscriptions]);

  // Auto-sync subscriptions on mount
  useEffect(() => {
    const syncAll = async () => {
      for (const sub of subscriptions) {
        if (sub.enabled) {
          try {
            await syncSubscription(sub);
          } catch (err) {
            console.error(`Failed to sync ${sub.name}:`, err);
          }
        }
      }
      loadEvents();
    };
    
    if (subscriptions.length > 0) {
      syncAll();
    }
  }, [subscriptions.length]); // Only run when subscriptions count changes

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(view.date);
    const delta = direction === 'next' ? 1 : -1;
    
    if (view.type === 'day') {
      newDate.setDate(newDate.getDate() + delta);
    } else if (view.type === 'week') {
      newDate.setDate(newDate.getDate() + delta * 7);
    } else {
      newDate.setMonth(newDate.getMonth() + delta);
    }
    
    setView({ ...view, date: newDate });
  };

  const goToToday = () => {
    setView({ ...view, date: new Date() });
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
      if (ws.getMonth() === we.getMonth()) {
        return `${ws.toLocaleDateString('en-US', { month: 'long' })} ${ws.getDate()} - ${we.getDate()}, ${we.getFullYear()}`;
      }
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
    if (confirm('Are you sure you want to delete this event?')) {
      deleteEventFromStorage(id);
      loadEvents();
      setShowEventModal(false);
      setSelectedEvent(null);
    }
  };

  const handleImport = (content: string) => {
    const imported = importICalEvents(content);
    loadEvents();
    setShowImportModal(false);
    alert(`Successfully imported ${imported.length} event${imported.length !== 1 ? 's' : ''}!`);
  };

  const handleAddSubscription = async (name: string, url: string, color: string) => {
    const sub = addSubscription(name, url, color);
    loadSubscriptions();
    
    try {
      await syncSubscription(sub);
      loadEvents();
    } catch (err) {
      console.error('Failed to sync new subscription:', err);
    }
  };

  const handleDeleteSubscription = (id: string) => {
    if (confirm('Are you sure you want to remove this subscription? All events from this calendar will be deleted.')) {
      deleteSubscription(id);
      loadSubscriptions();
      loadEvents();
    }
  };

  const handleSyncSubscription = async (sub: CalendarSubscription) => {
    await syncSubscription(sub);
    loadSubscriptions();
    loadEvents();
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

  const handleMiniCalendarSelect = (date: Date) => {
    setView({ ...view, date });
  };

  // Get upcoming events
  const upcomingEvents = events
    .filter(e => new Date(e.startDate) >= new Date())
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 5);

  return (
    <div className="flex gap-6 h-full">
      {/* Main Calendar Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-slate-900">{formatHeaderDate()}</h2>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => navigateDate('prev')} 
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Previous"
              >
                <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button 
                onClick={goToToday} 
                className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                Today
              </button>
              <button 
                onClick={() => navigateDate('next')} 
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Next"
              >
                <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* View toggle */}
            <div className="flex bg-slate-100 rounded-lg p-1">
              {(['day', 'week', 'month'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setView({ ...view, type: t })}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    view.type === t 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {/* Subscription button */}
            <button
              onClick={() => setShowSubscriptionModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Subscribe
            </button>

            {/* Import button */}
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import
            </button>

            {/* Add event button */}
            <button
              onClick={() => { 
                setSelectedEvent(null); 
                setSelectedDate(new Date()); 
                setShowEventModal(true); 
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
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
            <MonthView 
              date={view.date} 
              events={events} 
              onDateClick={handleDateClick} 
              onEventClick={handleEventClick} 
            />
          )}
          {view.type === 'week' && (
            <WeekView 
              date={view.date} 
              events={events} 
              onTimeSlotClick={handleDateClick} 
              onEventClick={handleEventClick} 
            />
          )}
          {view.type === 'day' && (
            <DayView 
              date={view.date} 
              events={events} 
              onTimeSlotClick={handleDateClick} 
              onEventClick={handleEventClick} 
            />
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-72 flex-shrink-0 space-y-4">
        {/* Mini Calendar */}
        <MiniCalendar date={view.date} onDateSelect={handleMiniCalendarSelect} />

        {/* Upcoming Events */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Upcoming Events</h3>
          {upcomingEvents.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm text-slate-500">No upcoming events</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map(event => (
                <div
                  key={event.id}
                  onClick={() => handleEventClick(event)}
                  className="p-3 rounded-lg cursor-pointer transition-colors hover:bg-slate-50"
                  style={{ borderLeft: `4px solid ${getEventColor(event)}` }}
                >
                  <h4 className="text-sm font-medium text-slate-900 truncate">{event.title}</h4>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>
                      {new Date(event.startDate).toLocaleDateString('en-US', { 
                        weekday: 'short',
                        month: 'short', 
                        day: 'numeric',
                        ...(event.allDay ? {} : { hour: 'numeric', minute: '2-digit' })
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Event Types</h3>
          <div className="space-y-2">
            {[
              { type: 'personal', label: 'Personal', color: '#10b981' },
              { type: 'exam', label: 'Exam', color: '#ef4444' },
              { type: 'project', label: 'Project', color: '#f59e0b' },
              { type: 'assignment', label: 'Assignment', color: '#3b82f6' },
              { type: 'imported', label: 'Imported', color: '#6366f1' },
              { type: 'subscription', label: 'Subscription', color: '#8b5cf6' },
            ].map(item => (
              <div key={item.type} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-slate-600">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showEventModal && (
        <EventModal
          event={selectedEvent}
          initialDate={selectedDate || undefined}
          onSave={handleSaveEvent}
          onDelete={selectedEvent && selectedEvent.type !== 'subscription' && selectedEvent.type !== 'exam' 
            ? handleDeleteEvent 
            : undefined
          }
          onClose={() => { 
            setShowEventModal(false); 
            setSelectedEvent(null); 
            setSelectedDate(null); 
          }}
        />
      )}

      {showImportModal && (
        <ImportModal
          onImport={handleImport}
          onClose={() => setShowImportModal(false)}
        />
      )}

      {showSubscriptionModal && (
        <SubscriptionModal
          subscriptions={subscriptions}
          onAddSubscription={handleAddSubscription}
          onDeleteSubscription={handleDeleteSubscription}
          onSyncSubscription={handleSyncSubscription}
          onClose={() => setShowSubscriptionModal(false)}
        />
      )}
    </div>
  );
};

export default CalendarTab;