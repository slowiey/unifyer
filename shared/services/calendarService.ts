import { CalendarEvent, EventFormData } from '../types/calendar';

const STORAGE_KEY = 'unifyer_calendar_events';

export const getEvents = (): CalendarEvent[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const events = JSON.parse(stored);
    return events.map((event: any) => ({
      ...event,
      startDate: new Date(event.startDate),
      endDate: event.endDate ? new Date(event.endDate) : undefined,
    }));
  } catch (error) {
    console.error('Error loading events:', error);
    return [];
  }
};

export const saveEvents = (events: CalendarEvent[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch (error) {
    console.error('Error saving events:', error);
  }
};

export const addEvent = (eventData: EventFormData): CalendarEvent => {
  const events = getEvents();
  const newEvent: CalendarEvent = {
    ...eventData,
    id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  };
  events.push(newEvent);
  saveEvents(events);
  return newEvent;
};

export const updateEvent = (id: string, eventData: Partial<EventFormData>): CalendarEvent | null => {
  const events = getEvents();
  const index = events.findIndex(e => e.id === id);
  if (index === -1) return null;
  
  events[index] = { ...events[index], ...eventData };
  saveEvents(events);
  return events[index];
};

export const deleteEvent = (id: string): boolean => {
  const events = getEvents();
  const filtered = events.filter(e => e.id !== id);
  if (filtered.length === events.length) return false;
  
  saveEvents(filtered);
  return true;
};

export const importICalEvents = (content: string): CalendarEvent[] => {
  const events: EventFormData[] = [];
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
      currentEvent = {
        type: 'imported',
        color: '#6366f1',
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
      
      switch (mainKey) {
        case 'SUMMARY':
          currentEvent.title = value.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n');
          break;
        case 'DESCRIPTION':
          currentEvent.description = value.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n');
          break;
        case 'DTSTART':
          currentEvent.startDate = parseICalDate(value, keyParts);
          currentEvent.allDay = keyParts.some(p => p === 'VALUE=DATE');
          break;
        case 'DTEND':
          currentEvent.endDate = parseICalDate(value, keyParts);
          break;
        case 'LOCATION':
          currentEvent.location = value.replace(/\\,/g, ',').replace(/\\;/g, ';');
          break;
      }
    }
  }
  
  const importedEvents: CalendarEvent[] = [];
  for (const eventData of events) {
    const newEvent = addEvent(eventData);
    importedEvents.push(newEvent);
  }
  
  return importedEvents;
};

const parseICalDate = (value: string, keyParts: string[]): Date => {
  const isDateOnly = keyParts.some(p => p === 'VALUE=DATE');
  
  if (isDateOnly) {
    const year = parseInt(value.substring(0, 4));
    const month = parseInt(value.substring(4, 6)) - 1;
    const day = parseInt(value.substring(6, 8));
    return new Date(year, month, day);
  } else {
    const year = parseInt(value.substring(0, 4));
    const month = parseInt(value.substring(4, 6)) - 1;
    const day = parseInt(value.substring(6, 8));
    const hour = parseInt(value.substring(9, 11)) || 0;
    const minute = parseInt(value.substring(11, 13)) || 0;
    const second = parseInt(value.substring(13, 15)) || 0;
    
    if (value.endsWith('Z')) {
      return new Date(Date.UTC(year, month, day, hour, minute, second));
    }
    return new Date(year, month, day, hour, minute, second);
  }
};