
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Project, Exam, Priority, FileData, Task, CalendarSubscription, CalendarEvent, Folder, Module } from './types';
import { Badge, ProgressBar } from './components/Shared';
import { generateProjectBreakdown, generateStudyPlan } from './services/geminiService';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './components/LoginPage';
import AIChat from './components/AIChat';

const PRIORITY_WEIGHTS: Record<Priority, number> = {
  High: 3,
  Medium: 2,
  Low: 1,
};

const calculateWeightedProgress = (tasks: Task[]): number => {
  if (tasks.length === 0) return 0;
  const totalWeight = tasks.reduce((sum, t) => sum + PRIORITY_WEIGHTS[t.priority], 0);
  const completedWeight = tasks.reduce((sum, t) => sum + (t.completed ? PRIORITY_WEIGHTS[t.priority] : 0), 0);
  return Math.round((completedWeight / totalWeight) * 100);
};

// Basic iCal Parser
const parseICal = (data: string): CalendarEvent[] => {
  const events: CalendarEvent[] = [];
  const lines = data.split(/\r?\n/);
  let currentEvent: any = null;

  const parseDate = (str: string) => {
    const match = str.match(/(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2})Z?)?/);
    if (!match) return new Date();
    const [_, y, m, d, __, hh, mm, ss] = match;
    if (hh) {
      return new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(hh), parseInt(mm), parseInt(ss)));
    }
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  };

  for (let line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = {};
    } else if (line.startsWith('END:VEVENT')) {
      if (currentEvent.summary && currentEvent.start) {
        events.push({
          id: Math.random().toString(36).substr(2, 9),
          summary: currentEvent.summary,
          start: currentEvent.start,
          end: currentEvent.end || currentEvent.start,
          location: currentEvent.location,
          description: currentEvent.description,
          type: currentEvent.summary.toLowerCase().includes('klausur') || currentEvent.summary.toLowerCase().includes('exam') ? 'exam' : 'lesson'
        });
      }
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith('SUMMARY:')) currentEvent.summary = line.replace('SUMMARY:', '').trim();
      if (line.startsWith('DTSTART')) currentEvent.start = parseDate(line.split(':')[1]);
      if (line.startsWith('DTEND')) currentEvent.end = parseDate(line.split(':')[1]);
      if (line.startsWith('LOCATION:')) currentEvent.location = line.replace('LOCATION:', '').trim();
      if (line.startsWith('DESCRIPTION:')) currentEvent.description = line.replace('DESCRIPTION:', '').trim();
    }
  }
  return events;
};

const INITIAL_MODULES: Module[] = [
  { id: 'm1', name: 'Computer Science Core', credits: 30, description: 'Foundational CS subjects covering algorithms, data structures, and computer architecture.' },
  { id: 'm2', name: 'Mathematics for Engineers', credits: 15, description: 'Applied math including calculus, linear algebra, and discrete structures.' }
];

const INITIAL_PROJECTS: Project[] = [
  {
    id: '1',
    title: 'Operating Systems Kernel Design',
    course: 'CS301',
    description: 'Implement a basic multitasking kernel with memory management.',
    dueDate: '2025-06-15',
    progress: 40,
    priority: 'High',
    moduleId: 'm1',
    tasks: [
      { id: 't1', title: 'Setup cross-compiler environment', completed: true, priority: 'Medium' },
      { id: 't2', title: 'Implement GDT and IDT', completed: true, priority: 'High' },
      { id: 't3', title: 'Physical memory allocator', completed: false, priority: 'High' },
    ],
    files: [{ id: 'f1', name: 'design_spec.pdf', type: 'application/pdf', size: '2.4MB', uploadDate: '2024-04-10', folderId: null, source: 'local' }],
    sharedWith: ['alice@uni.edu'],
    notebook: 'Memory management is the biggest challenge. Need to research paging vs segmentation. Start with a flat memory model and then implement page tables.',
    vaultFolderId: 'fol-os'
  }
];

const INITIAL_EXAMS: Exam[] = [
  {
    id: 'e1',
    course: 'Calculus III',
    date: '2025-05-22',
    time: '09:00 AM',
    location: 'Main Hall A',
    priority: 'High',
    moduleId: 'm2',
    notes: 'Focus on triple integrals and vector fields. Green\'s Theorem and Stokes\' Theorem are critical.',
    grade: '1.3',
    tasks: [
      { id: 'et1', title: 'Review Triple Integrals', completed: true, priority: 'High' },
      { id: 'et2', title: 'Practice Vector Fields', completed: true, priority: 'High' }
    ],
    files: [],
    progress: 100,
    notebook: 'Key formulas to memorize: divergence theorem and curl. Don\'t forget the Jacobian for polar coordinates.',
    vaultFolderId: 'fol-calc'
  }
];

const Footer: React.FC = () => (
  <footer className="mt-20 py-20 px-12 border-t border-slate-100 bg-white/50">
    <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
           <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-5 h-5 text-white" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M50 10L10 30L50 50L90 30L50 10Z" fill="currentColor" /></svg>
           </div>
           <span className="text-xl font-bold tracking-tighter text-slate-900">Unifyer</span>
        </div>
        <p className="text-sm text-slate-400 font-medium leading-relaxed">
          The all-in-one academic companion for modern university students. Master your projects, track your exams, and stay ahead with AI.
        </p>
      </div>
      <div>
        <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest mb-6">Academic Tooling</h4>
        <ul className="space-y-4 text-sm font-semibold text-slate-400">
          <li className="hover:text-indigo-600 cursor-pointer transition-colors">Study Planner</li>
          <li className="hover:text-indigo-600 cursor-pointer transition-colors">Project Roadmaps</li>
          <li className="hover:text-indigo-600 cursor-pointer transition-colors">Grade Analytics</li>
          <li className="hover:text-indigo-600 cursor-pointer transition-colors">Calendar Sync</li>
        </ul>
      </div>
      <div>
        <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest mb-6">Support & Help</h4>
        <ul className="space-y-4 text-sm font-semibold text-slate-400">
          <li className="hover:text-indigo-600 cursor-pointer transition-colors">Help Center</li>
          <li className="hover:text-indigo-600 cursor-pointer transition-colors">Tutorials</li>
          <li className="hover:text-indigo-600 cursor-pointer transition-colors">AI Best Practices</li>
          <li className="hover:text-indigo-600 cursor-pointer transition-colors">API Docs</li>
        </ul>
      </div>
      <div>
        <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest mb-6">Stay Connected</h4>
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center hover:bg-indigo-50 hover:border-indigo-100 transition-all cursor-pointer">
            <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.84 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" /></svg>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center hover:bg-indigo-50 hover:border-indigo-100 transition-all cursor-pointer">
            <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 1.983-.399 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" /></svg>
          </div>
        </div>
      </div>
    </div>
    <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-6">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">© 2025 Unifyer Academic Manager. Crafted for Excellence.</p>
      <div className="flex gap-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        <span className="cursor-pointer hover:text-indigo-600">Privacy Policy</span>
        <span className="cursor-pointer hover:text-indigo-600">Terms of Service</span>
        <span className="cursor-pointer hover:text-indigo-600">Cookie Settings</span>
      </div>
    </div>
  </footer>
);

const App: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();

  // If not authenticated, show login page
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const [activeTab, setActiveTab] = useState<'dashboard' | 'projects' | 'exams' | 'calendar' | 'files' | 'course'>('dashboard');
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [exams, setExams] = useState<Exam[]>(INITIAL_EXAMS);
  const [modules, setModules] = useState<Module[]>(INITIAL_MODULES);
  const [subscriptions, setSubscriptions] = useState<CalendarSubscription[]>([]);
  
  // Selection State
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

  // Modal State
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showExamModal, setShowExamModal] = useState(false);
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // UI State
  const [aiLoading, setAiLoading] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // File State
  const [globalFiles, setGlobalFiles] = useState<FileData[]>([
    { id: 'f1', name: 'lecture_notes_ch1.pdf', type: 'application/pdf', size: '1.2MB', uploadDate: '2025-01-15', folderId: 'fol1', source: 'local' },
    { id: 'f2', name: 'assignment_brief.docx', type: 'application/msword', size: '450KB', uploadDate: '2025-02-01', folderId: null, source: 'local' }
  ]);
  const [folders, setFolders] = useState<Folder[]>([
    { id: 'fol1', name: 'Calculus III', parentId: null, source: 'local' },
    { id: 'fol-os', name: 'Operating Systems Kernel Design', parentId: null, source: 'local' },
    { id: 'fol-calc', name: 'Calculus III Prep', parentId: null, source: 'local' }
  ]);
  const [isDriveConnected, setIsDriveConnected] = useState(false);

  // Memoized Stats
  const stats = useMemo(() => {
    const gradedExams = exams.filter(e => e.grade);
    const grades = gradedExams.map(e => parseFloat(e.grade!)).filter(g => !isNaN(g));
    const avgGrade = grades.length > 0 ? (grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(1) : 'N/A';
    
    const moduleProgress = modules.map(m => {
      const associatedExams = exams.filter(e => e.moduleId === m.id);
      const isFinished = associatedExams.length > 0 && associatedExams.every(e => e.progress === 100 && e.grade);
      const avg = associatedExams.length > 0 ? associatedExams.reduce((sum, e) => sum + (parseFloat(e.grade!) || 0), 0) / associatedExams.length : 0;
      const isPassed = isFinished && avg <= 4.0;
      const isFailed = isFinished && avg > 4.0;
      return { id: m.id, isPassed, isFailed, avg, credits: m.credits };
    });

    const earnedCredits = moduleProgress.reduce((sum, m) => m.isPassed ? sum + m.credits : sum, 0);
    const totalCreditsGoal = modules.reduce((sum, m) => sum + m.credits, 0);

    return { avgGrade, earnedCredits, totalCreditsGoal, moduleProgress };
  }, [exams, modules]);

  const timelineItems = useMemo(() => {
    const pItems = projects.map(p => ({ ...p, type: 'project' as const, sortDate: p.dueDate }));
    const eItems = exams.map(e => ({ ...e, type: 'exam' as const, sortDate: e.date, title: e.course }));
    return [...pItems, ...eItems].sort((a, b) => new Date(a.sortDate).getTime() - new Date(b.sortDate).getTime());
  }, [projects, exams]);

  // Click outside detection for user menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handlers
  const handleUpsertProject = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Partial<Project> = {
      title: formData.get('title') as string,
      course: formData.get('course') as string,
      dueDate: formData.get('dueDate') as string,
      priority: formData.get('priority') as Priority,
      description: formData.get('description') as string,
      moduleId: formData.get('moduleId') as string || undefined,
    };

    if (editingItem && editingItem.tasks !== undefined) {
      setProjects(prev => prev.map(p => p.id === editingItem.id ? { ...p, ...data } : p));
    } else {
      const newProject: Project = {
        id: Math.random().toString(36).substr(2, 9),
        title: data.title!,
        course: data.course!,
        description: data.description || '',
        dueDate: data.dueDate!,
        progress: 0,
        priority: data.priority!,
        moduleId: data.moduleId,
        tasks: [],
        files: [],
        sharedWith: [],
        notebook: '',
        vaultFolderId: 'fol-' + Math.random().toString(36).substr(2, 9)
      };
      setProjects(prev => [newProject, ...prev]);
    }
    setShowProjectModal(false);
    setEditingItem(null);
  };

  const handleUpsertExam = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Partial<Exam> = {
      course: formData.get('course') as string,
      date: formData.get('date') as string,
      time: formData.get('time') as string,
      location: formData.get('location') as string,
      priority: formData.get('priority') as Priority,
      notes: formData.get('notes') as string,
      grade: formData.get('grade') as string,
      moduleId: formData.get('moduleId') as string || undefined,
    };

    if (editingItem && editingItem.date !== undefined) {
      setExams(prev => prev.map(ex => ex.id === editingItem.id ? { ...ex, ...data } : ex));
    } else {
      const newExam: Exam = {
        id: Math.random().toString(36).substr(2, 9),
        course: data.course!,
        date: data.date!,
        time: data.time!,
        location: data.location!,
        priority: data.priority!,
        notes: data.notes!,
        grade: data.grade,
        moduleId: data.moduleId,
        tasks: [],
        files: [],
        progress: 0,
        notebook: '',
        vaultFolderId: 'fol-' + Math.random().toString(36).substr(2, 9)
      };
      setExams(prev => [newExam, ...prev]);
    }
    setShowExamModal(false);
    setEditingItem(null);
  };

  const handleUpsertModule = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Partial<Module> = {
      name: formData.get('name') as string,
      credits: parseInt(formData.get('credits') as string) || 0,
      description: formData.get('description') as string,
    };

    if (editingItem && editingItem.credits !== undefined) {
      setModules(prev => prev.map(m => m.id === editingItem.id ? { ...m, ...data as Module } : m));
    } else {
      const newModule: Module = {
        id: Math.random().toString(36).substr(2, 9),
        name: data.name!,
        credits: data.credits!,
        description: data.description,
      };
      setModules(prev => [...prev, newModule]);
    }
    setShowModuleModal(false);
    setEditingItem(null);
  };

  const handleToggleTask = (itemId: string, taskId: string, type: 'project' | 'exam') => {
    if (type === 'project') {
      setProjects(prev => prev.map(p => {
        if (p.id !== itemId) return p;
        const newTasks = p.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
        return { ...p, tasks: newTasks, progress: calculateWeightedProgress(newTasks) };
      }));
    } else {
      setExams(prev => prev.map(ex => {
        if (ex.id !== itemId) return ex;
        const newTasks = ex.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
        return { ...ex, tasks: newTasks, progress: calculateWeightedProgress(newTasks) };
      }));
    }
  };

  const addTask = (itemId: string, type: 'project' | 'exam') => {
    const title = prompt('Task title:');
    if (!title) return;
    const newTask: Task = { id: Math.random().toString(36).substr(2, 9), title, completed: false, priority: 'Medium' };
    if (type === 'project') {
      setProjects(prev => prev.map(p => p.id === itemId ? { ...p, tasks: [...p.tasks, newTask], progress: calculateWeightedProgress([...p.tasks, newTask]) } : p));
    } else {
      setExams(prev => prev.map(e => e.id === itemId ? { ...e, tasks: [...e.tasks, newTask], progress: calculateWeightedProgress([...e.tasks, newTask]) } : e));
    }
  };

  const runProjectAI = async (project: Project) => {
    setAiLoading(true);
    try {
      const tasksData = await generateProjectBreakdown(project.title, project.description || 'University project');
      if (tasksData && Array.isArray(tasksData)) {
        const newTasks: Task[] = tasksData.map((t: any) => ({
          id: Math.random().toString(36).substr(2, 9),
          title: t.title,
          completed: false,
          priority: (t.priority as Priority) || 'Medium',
        }));
        setProjects(prev => prev.map(p => 
          p.id === project.id 
            ? { ...p, tasks: [...p.tasks, ...newTasks], progress: calculateWeightedProgress([...p.tasks, ...newTasks]) } 
            : p
        ));
      }
    } catch (error) { console.error("AI Generation failed", error); }
    finally { setAiLoading(false); }
  };

  const runStudyPlanAI = async (exam: Exam) => {
    setAiLoading(true);
    try {
      const plan = await generateStudyPlan(exam.course, exam.date, exam.notes);
      const newTasks: Task[] = plan.map((p: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        title: `${p.day}: ${p.focus} - ${p.action}${p.hours ? ` (${p.hours}h)` : ''}${p.exercises ? ` | ${p.exercises}` : ''}`,
        completed: false,
        priority: 'Medium'
      }));
      setExams(prev => prev.map(ex => 
        ex.id === exam.id 
          ? { ...ex, tasks: [...ex.tasks, ...newTasks], progress: calculateWeightedProgress([...ex.tasks, ...newTasks]) } 
          : ex
      ));
    } catch (error) { console.error("Study plan generation failed", error); }
    finally { setAiLoading(false); }
  };

  const updateNotebook = (id: string, type: 'project' | 'exam', content: string) => {
    if (type === 'project') {
      setProjects(prev => prev.map(p => p.id === id ? { ...p, notebook: content } : p));
    } else {
      setExams(prev => prev.map(e => e.id === id ? { ...e, notebook: content } : e));
    }
  };

  const addFileToItem = (id: string, type: 'project' | 'exam') => {
    const name = prompt('File Name (simulated upload):');
    if (!name) return;
    const newFile: FileData = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      type: 'application/octet-stream',
      size: '1.2MB',
      uploadDate: new Date().toISOString().split('T')[0],
      folderId: null,
      source: 'local'
    };
    if (type === 'project') {
      setProjects(prev => prev.map(p => p.id === id ? { ...p, files: [...p.files, newFile] } : p));
    } else {
      setExams(prev => prev.map(e => e.id === id ? { ...e, files: [...e.files, newFile] } : e));
    }
  };

  // Views
  const renderProjectDetail = (project: Project) => (
    <div className="space-y-12 animate-fadeIn">
      <header className="flex items-center justify-between">
        <button onClick={() => setSelectedProjectId(null)} className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-bold text-sm transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          Back to Projects
        </button>
        <div className="flex gap-2">
           <button onClick={() => { setEditingItem(project); setShowProjectModal(true); }} className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50">Edit Project</button>
        </div>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-12">
          <section>
            <div className="flex items-center gap-4 mb-3">
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg uppercase tracking-widest">{project.course}</span>
              <Badge priority={project.priority} />
              <span className="text-xs font-bold text-slate-400">Due: {project.dueDate}</span>
            </div>
            <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight">{project.title}</h1>
            <p className="text-slate-500 mt-6 text-xl font-medium leading-relaxed">{project.description}</p>
          </section>

          <section className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-10">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Task Breakdown</h2>
                <p className="text-sm text-slate-400 font-medium mt-1">Weighted progress based on priority.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => runProjectAI(project)} disabled={aiLoading} className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-5 py-2.5 rounded-xl transition-all flex items-center gap-2">
                  {aiLoading ? <div className="animate-spin h-3 w-3 border-2 border-indigo-600 border-t-transparent rounded-full" /> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                  AI Roadmap
                </button>
                <button onClick={() => addTask(project.id, 'project')} className="text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 px-5 py-2.5 rounded-xl transition-all">+ Task</button>
              </div>
            </div>
            <ProgressBar progress={project.progress} />
            <div className="space-y-3">
              {project.tasks.map(task => (
                <div key={task.id} className="flex items-center gap-4 p-5 rounded-2xl bg-slate-50/50 border border-slate-100 group hover:border-indigo-200 transition-all">
                  <input 
                    type="checkbox" 
                    checked={task.completed} 
                    onChange={() => handleToggleTask(project.id, task.id, 'project')}
                    className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                  />
                  <span className={`flex-1 text-sm font-semibold transition-all ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{task.title}</span>
                  <Badge priority={task.priority} />
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
            <h2 className="text-2xl font-bold text-slate-900">Project Notes</h2>
            <textarea 
              value={project.notebook}
              onChange={(e) => updateNotebook(project.id, 'project', e.target.value)}
              placeholder="Start drafting thoughts, research links, or meeting notes..."
              className="w-full h-64 bg-slate-50 border border-slate-200 p-8 rounded-[2rem] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
            />
          </section>
        </div>

        <div className="space-y-12">
          <section className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-6">Vault Assets</h3>
            <div className="space-y-4">
              {project.files.map(file => (
                <div key={file.id} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{file.name}</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{file.size}</p>
                  </div>
                </div>
              ))}
              <button onClick={() => addFileToItem(project.id, 'project')} className="w-full py-4 rounded-2xl border-2 border-dashed border-white/10 text-xs font-bold text-slate-500 hover:text-white hover:border-white/30 transition-all">
                + Attach Asset
              </button>
            </div>
          </section>

          <section className="bg-white p-8 rounded-[3rem] border border-slate-200">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-6">Course Link</h3>
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
               <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                 <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
               </div>
               <div>
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Module</p>
                  <p className="text-sm font-bold text-slate-800">{modules.find(m => m.id === project.moduleId)?.name || 'General Studies'}</p>
               </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );

  const renderExamDetail = (exam: Exam) => (
    <div className="space-y-12 animate-fadeIn">
      <header className="flex items-center justify-between">
        <button onClick={() => setSelectedExamId(null)} className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-bold text-sm transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          Back to Results
        </button>
        <div className="flex gap-2">
           <button onClick={() => { setEditingItem(exam); setShowExamModal(true); }} className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50">Edit Record</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-12">
          <section>
            <div className="flex items-center gap-4 mb-3">
              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg uppercase tracking-widest">EXAM PREP</span>
              <Badge priority={exam.priority} />
              <span className="text-xs font-bold text-slate-400">{exam.date} • {exam.time}</span>
            </div>
            <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight">{exam.course}</h1>
            <p className="text-slate-500 mt-6 text-xl font-medium leading-relaxed">{exam.notes}</p>
          </section>

          <section className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-10">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Study Strategy</h2>
                <p className="text-sm text-slate-400 font-medium mt-1">Daily goals for effective preparation.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => runStudyPlanAI(exam)} disabled={aiLoading} className="text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-5 py-2.5 rounded-xl transition-all flex items-center gap-2">
                  {aiLoading ? <div className="animate-spin h-3 w-3 border-2 border-rose-600 border-t-transparent rounded-full" /> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                  AI Study Plan
                </button>
                <button onClick={() => addTask(exam.id, 'exam')} className="text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 px-5 py-2.5 rounded-xl transition-all">+ Study Task</button>
              </div>
            </div>
            <ProgressBar progress={exam.progress} />
            <div className="space-y-3">
              {exam.tasks.map(task => (
                <div key={task.id} className="flex items-center gap-4 p-5 rounded-2xl bg-slate-50/50 border border-slate-100 group hover:border-rose-200 transition-all">
                  <input 
                    type="checkbox" 
                    checked={task.completed} 
                    onChange={() => handleToggleTask(exam.id, task.id, 'exam')}
                    className="w-5 h-5 rounded-lg border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer" 
                  />
                  <span className={`flex-1 text-sm font-semibold transition-all ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{task.title}</span>
                  <Badge priority={task.priority} />
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
            <h2 className="text-2xl font-bold text-slate-900">Study Notebook</h2>
            <textarea 
              value={exam.notebook}
              onChange={(e) => updateNotebook(exam.id, 'exam', e.target.value)}
              placeholder="Jot down formulas, concepts to review, or exam location details..."
              className="w-full h-64 bg-slate-50 border border-slate-200 p-8 rounded-[2rem] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all resize-none"
            />
          </section>
        </div>

        <div className="space-y-12">
           <section className="bg-rose-500 p-10 rounded-[3.5rem] text-white shadow-2xl shadow-rose-200">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-100 mb-2">Academic Result</h3>
              <p className="text-6xl font-black">{exam.grade || 'TBD'}</p>
              <p className="text-xs font-bold text-rose-100 mt-4 opacity-70 uppercase tracking-widest">Calculated GPA Weight: {exam.grade ? (parseFloat(exam.grade) <= 4.0 ? 'PASSED' : 'FAILED') : 'PENDING'}</p>
           </section>

           <section className="bg-white p-10 rounded-[3rem] border border-slate-200 space-y-6">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Materials Vault</h3>
              <div className="space-y-4">
                {exam.files.map(file => (
                  <div key={file.id} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-rose-300 transition-all cursor-pointer">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                       <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{file.name}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">{file.size}</p>
                    </div>
                  </div>
                ))}
                <button onClick={() => addFileToItem(exam.id, 'exam')} className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-100 text-xs font-bold text-slate-400 hover:text-rose-600 hover:border-rose-200 transition-all">
                  + Add Study Material
                </button>
              </div>
           </section>
        </div>
      </div>
    </div>
  );

  const renderModuleDetail = (module: Module) => {
    const associatedProjects = projects.filter(p => p.moduleId === module.id);
    const associatedExams = exams.filter(e => e.moduleId === module.id);
    const modStat = stats.moduleProgress.find(ms => ms.id === module.id);

    return (
      <div className="space-y-12 animate-fadeIn">
        <header className="flex items-center justify-between">
          <button onClick={() => setSelectedModuleId(null)} className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-bold text-sm transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            Back to Curriculum
          </button>
          <button onClick={() => { setEditingItem(module); setShowModuleModal(true); }} className="bg-white border border-slate-200 px-5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50">Edit Module Info</button>
        </header>

        <section className="bg-white p-12 rounded-[4rem] border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12">
             <div className="w-24 h-24 bg-indigo-50 rounded-full flex flex-col items-center justify-center text-indigo-600">
                <p className="text-[10px] font-black uppercase tracking-widest">Credits</p>
                <p className="text-3xl font-black">{module.credits}</p>
             </div>
          </div>
          <span className={`text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-[0.2em] ${modStat?.isPassed ? 'bg-emerald-100 text-emerald-700' : modStat?.isFailed ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'}`}>
            {modStat?.isPassed ? 'Completed' : modStat?.isFailed ? 'Action Required' : 'Active Term'}
          </span>
          <h1 className="text-5xl font-black text-slate-900 tracking-tight mt-6 mb-8">{module.name}</h1>
          <p className="text-slate-500 text-xl font-medium max-w-2xl leading-relaxed">{module.description}</p>
          
          <div className="flex gap-12 mt-12 pt-12 border-t border-slate-100">
             <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Average Grade</p>
                <p className="text-2xl font-black text-slate-900">{modStat?.avg ? modStat.avg.toFixed(1) : '—'}</p>
             </div>
             <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Associated Content</p>
                <p className="text-2xl font-black text-slate-900">{associatedProjects.length + associatedExams.length} Items</p>
             </div>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
           <section className="space-y-6">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em]">Module Projects</h2>
              <div className="space-y-4">
                 {associatedProjects.map(p => (
                   <div key={p.id} onClick={() => { setActiveTab('projects'); setSelectedProjectId(p.id); }} className="bg-white p-6 rounded-3xl border border-slate-200 group hover:border-indigo-400 transition-all cursor-pointer">
                      <div className="flex justify-between items-center mb-4">
                         <h3 className="font-bold text-slate-800">{p.title}</h3>
                         <Badge priority={p.priority} />
                      </div>
                      <ProgressBar progress={p.progress} />
                   </div>
                 ))}
                 {associatedProjects.length === 0 && <p className="text-sm font-bold text-slate-300 uppercase italic">No projects assigned</p>}
              </div>
           </section>

           <section className="space-y-6">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em]">Module Exams</h2>
              <div className="space-y-4">
                 {associatedExams.map(e => (
                   <div key={e.id} onClick={() => { setActiveTab('exams'); setSelectedExamId(e.id); }} className="bg-white p-6 rounded-3xl border border-slate-200 group hover:border-rose-400 transition-all cursor-pointer">
                      <div className="flex justify-between items-center">
                         <div>
                            <h3 className="font-bold text-slate-800">{e.course}</h3>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{e.date}</p>
                         </div>
                         <div className="text-right">
                            <p className="text-xs font-bold text-rose-600">{e.grade || 'TBD'}</p>
                            <Badge priority={e.priority} />
                         </div>
                      </div>
                   </div>
                 ))}
                 {associatedExams.length === 0 && <p className="text-sm font-bold text-slate-300 uppercase italic">No exams assigned</p>}
              </div>
           </section>
        </div>
      </div>
    );
  };

  const renderCourseOverview = () => {
    if (selectedModuleId) return renderModuleDetail(modules.find(m => m.id === selectedModuleId)!);

    return (
      <div className="space-y-12 animate-fadeIn">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Curriculum</h1>
            <p className="text-slate-500 mt-1 font-medium">Global credit tracking and module management.</p>
          </div>
          <button 
            onClick={() => { setEditingItem(null); setShowModuleModal(true); }}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg flex items-center gap-2 hover:bg-indigo-700 transition-all"
          >
            + Add Module
          </button>
        </header>

        <div className="bg-indigo-600 p-12 rounded-[3.5rem] text-white relative overflow-hidden shadow-2xl shadow-indigo-100">
          <div className="absolute top-0 right-0 p-12">
             <div className="w-24 h-24 bg-white/10 rounded-full flex flex-col items-center justify-center text-white backdrop-blur-md border border-white/20">
                <p className="text-[10px] font-black uppercase tracking-widest">Total CP</p>
                <p className="text-3xl font-black">{stats.earnedCredits}</p>
             </div>
          </div>
          <h2 className="text-2xl font-bold mb-4">Degree Progress</h2>
          <p className="text-indigo-100 text-lg mb-8">You are {Math.round((stats.earnedCredits / (stats.totalCreditsGoal || 1)) * 100)}% through your targeted credits.</p>
          <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden border border-white/10">
             <div className="bg-white h-full transition-all duration-1000" style={{ width: `${(stats.earnedCredits / (stats.totalCreditsGoal || 1)) * 100}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {modules.map(m => {
            const modStat = stats.moduleProgress.find(ms => ms.id === m.id);
            return (
              <div 
                key={m.id} 
                onClick={() => setSelectedModuleId(m.id)}
                className={`bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm hover:shadow-2xl hover:border-indigo-400 transition-all cursor-pointer group relative`}
              >
                <div className="flex items-center gap-3 mb-6">
                   <span className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider ${modStat?.isPassed ? 'bg-emerald-100 text-emerald-700' : modStat?.isFailed ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                     {modStat?.isPassed ? 'Passed' : modStat?.isFailed ? 'Failed' : 'Active'}
                   </span>
                   <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg uppercase tracking-wider">{m.credits} CP</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2 leading-tight group-hover:text-indigo-600 transition-colors">{m.name}</h3>
                <p className="text-sm text-slate-500 font-medium line-clamp-2 mb-8">{m.description || 'No description provided.'}</p>
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                   <span>Avg: {modStat?.avg ? modStat.avg.toFixed(1) : '—'}</span>
                   <span className="text-indigo-500 group-hover:translate-x-1 transition-transform">Details →</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-[#fcfcfd] text-slate-900 font-sans">
      <aside className="hidden md:flex flex-col w-72 bg-white border-r border-slate-200 fixed h-full z-50">
        <div className="p-10 cursor-pointer" onClick={() => { setActiveTab('dashboard'); setSelectedProjectId(null); setSelectedExamId(null); setSelectedModuleId(null); }}>
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-200">
                <svg className="w-6 h-6 text-white" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M50 10L10 30L50 50L90 30L50 10Z" fill="currentColor" /></svg>
             </div>
             <span className="text-2xl font-bold tracking-tighter text-slate-900">Unifyer</span>
          </div>
        </div>
        <nav className="flex-1 px-6 space-y-1">
          {[
            { id: 'dashboard', label: 'Overview', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
            { id: 'course', label: 'Curriculum', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
            { id: 'projects', label: 'Projects', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
            { id: 'exams', label: 'Exams & Grades', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
            { id: 'calendar', label: 'Calendar', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 00-2 2z' },
          ].map(item => (
            <button 
              key={item.id}
              onClick={() => { setActiveTab(item.id as any); setSelectedProjectId(null); setSelectedExamId(null); setSelectedModuleId(null); }}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all font-bold text-sm ${activeTab === item.id ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={item.icon} /></svg>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 md:ml-72 min-h-screen flex flex-col">
        <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-xl px-12 py-6 flex justify-between items-center border-b border-slate-100">
           <div className="flex-1" />
           <div className="flex items-center gap-6 relative" ref={userMenuRef}>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Semester</p>
                <p className="text-xs font-bold text-slate-900 leading-tight">Spring 2025</p>
              </div>
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="group flex items-center gap-3 p-1.5 pr-4 rounded-full hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100"
              >
                <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white font-bold text-xs">
                  {user?.name.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                </div>
                <div className="text-left hidden lg:block">
                   <p className="text-xs font-bold text-slate-800 leading-none">{user?.name || 'User'}</p>
                   <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider mt-1">Student</p>
                </div>
                <svg className={`w-3 h-3 text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
              </button>
              
              {/* User Menu Dropdown */}
              {showUserMenu && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-bold text-slate-900">{user?.name}</p>
                    <p className="text-xs text-slate-500">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      setShowUserMenu(false);
                    }}
                    className="w-full px-4 py-3 text-left text-sm font-medium text-red-600 hover:bg-red-50 transition flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Log Out
                  </button>
                </div>
              )}
           </div>
        </header>

        <div className="flex-1 p-12 max-w-7xl mx-auto w-full">
          {activeTab === 'dashboard' && (
             <div className="space-y-12 animate-fadeIn">
                <header className="bg-indigo-600 p-12 rounded-[3.5rem] text-white flex flex-col md:flex-row items-end justify-between gap-12 relative overflow-hidden shadow-2xl shadow-indigo-100">
                   <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
                   <div className="relative z-10">
                      <span className="text-xs font-bold uppercase tracking-[0.3em] text-indigo-200 block mb-4">Academic Status</span>
                      <h1 className="text-5xl font-extrabold tracking-tight mb-4">Focus, {user?.name.split(' ')[0]}.</h1>
                      <p className="text-indigo-100 text-xl font-medium max-w-lg">Current credit target: {stats.totalCreditsGoal} CP. You've earned {stats.earnedCredits} so far.</p>
                   </div>
                   <div className="flex gap-4 relative z-10">
                      <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-3xl text-center min-w-[120px]">
                         <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mb-1">Avg Grade</p>
                         <p className="text-2xl font-black">{stats.avgGrade}</p>
                      </div>
                      <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-3xl text-center min-w-[120px]">
                         <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mb-1">Earned CP</p>
                         <p className="text-2xl font-black">{stats.earnedCredits}</p>
                      </div>
                   </div>
                </header>

                <section className="space-y-8">
                   <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Upcoming Deadlines</h2>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {timelineItems.slice(0, 4).map(item => (
                        <div key={item.id} onClick={() => { if(item.type === 'project') { setActiveTab('projects'); setSelectedProjectId(item.id); } else { setActiveTab('exams'); setSelectedExamId(item.id); } }} className="bg-white p-8 rounded-[3rem] border border-slate-200 flex items-center justify-between hover:shadow-xl transition-all cursor-pointer group">
                           <div className="flex items-center gap-6">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${item.type === 'project' ? 'bg-indigo-600' : 'bg-rose-500'}`}>
                                 {item.type === 'project' ? <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> : <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
                              </div>
                              <div>
                                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.course}</p>
                                 <h3 className="text-xl font-bold text-slate-800">{item.title}</h3>
                              </div>
                           </div>
                           <div className="text-right">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Due</p>
                              <p className="text-sm font-bold text-slate-900">{item.sortDate}</p>
                           </div>
                        </div>
                      ))}
                   </div>
                </section>
             </div>
          )}

          {activeTab === 'projects' && !selectedProjectId && (
             <div className="space-y-12 animate-fadeIn">
                <header className="flex justify-between items-center">
                   <h1 className="text-3xl font-bold tracking-tight">Active Projects</h1>
                   <button onClick={() => { setEditingItem(null); setShowProjectModal(true); }} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg hover:bg-indigo-700 transition-all">+ New Project</button>
                </header>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   {projects.map(p => (
                     <div key={p.id} onClick={() => setSelectedProjectId(p.id)} className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm hover:shadow-2xl transition-all cursor-pointer group">
                        <div className="flex justify-between items-start mb-6">
                           <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg uppercase tracking-widest">{p.course}</span>
                           <Badge priority={p.priority} />
                        </div>
                        <h3 className="text-3xl font-bold text-slate-800 mb-8">{p.title}</h3>
                        <ProgressBar progress={p.progress} />
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-6">Due: {p.dueDate}</p>
                     </div>
                   ))}
                </div>
             </div>
          )}

          {activeTab === 'exams' && !selectedExamId && (
             <div className="space-y-12 animate-fadeIn">
                <header className="flex justify-between items-center">
                   <h1 className="text-3xl font-bold tracking-tight">Exam Records</h1>
                   <button onClick={() => { setEditingItem(null); setShowExamModal(true); }} className="bg-rose-500 text-white px-6 py-3 rounded-2xl font-bold shadow-lg hover:bg-rose-600 transition-all">+ Add Exam</button>
                </header>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                   {exams.map(e => (
                     <div key={e.id} onClick={() => setSelectedExamId(e.id)} className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm hover:shadow-2xl transition-all cursor-pointer group flex flex-col justify-between">
                        <div>
                           <div className="flex justify-between items-center mb-6">
                              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg uppercase tracking-widest">Exam</span>
                              <Badge priority={e.priority} />
                           </div>
                           <h3 className="text-2xl font-bold text-slate-800 mb-2">{e.course}</h3>
                           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{e.date} @ {e.time}</p>
                        </div>
                        <div className="mt-8 pt-8 border-t border-slate-50 flex items-center justify-between">
                           <p className="text-4xl font-black text-slate-900">{e.grade || '—'}</p>
                           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">View Prep →</span>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          )}

          {activeTab === 'course' && renderCourseOverview()}

          {activeTab === 'projects' && selectedProjectId && renderProjectDetail(projects.find(p => p.id === selectedProjectId)!)}
          {activeTab === 'exams' && selectedExamId && renderExamDetail(exams.find(e => e.id === selectedExamId)!)}
        </div>
        
        <Footer />
      </main>

      {/* Modals */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xl z-[100] flex items-center justify-center p-8 animate-fadeIn">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl animate-slideIn">
             <div className="p-10 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-3xl font-bold">Project Details</h2>
                <button onClick={() => setShowProjectModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button>
             </div>
             <form onSubmit={handleUpsertProject} className="p-10 space-y-6">
                <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Project Title</label>
                   <input name="title" required defaultValue={editingItem?.title} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Course Code</label>
                      <input name="course" required defaultValue={editingItem?.course} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold outline-none" />
                   </div>
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Due Date</label>
                      <input name="dueDate" type="date" required defaultValue={editingItem?.dueDate} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold outline-none" />
                   </div>
                   <div className="col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Associated Module</label>
                      <select name="moduleId" defaultValue={editingItem?.moduleId} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold outline-none">
                         <option value="">None / General</option>
                         {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                   </div>
                </div>
                <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-bold shadow-2xl hover:bg-indigo-700 transition-all">Save Project</button>
             </form>
          </div>
        </div>
      )}

      {showExamModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xl z-[100] flex items-center justify-center p-8 animate-fadeIn">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl animate-slideIn">
             <div className="p-10 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-3xl font-bold">Exam Entry</h2>
                <button onClick={() => setShowExamModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button>
             </div>
             <form onSubmit={handleUpsertExam} className="p-10 space-y-6">
                <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Course Name</label>
                   <input name="course" required defaultValue={editingItem?.course} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Exam Date</label>
                      <input name="date" type="date" required defaultValue={editingItem?.date} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold outline-none" />
                   </div>
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Grade (1.0-5.0)</label>
                      <input name="grade" placeholder="e.g. 1.3" defaultValue={editingItem?.grade} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold outline-none" />
                   </div>
                   <div className="col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Module</label>
                      <select name="moduleId" defaultValue={editingItem?.moduleId} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold outline-none">
                         <option value="">General Study</option>
                         {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                   </div>
                </div>
                <button type="submit" className="w-full bg-rose-500 text-white py-5 rounded-2xl font-bold shadow-2xl hover:bg-rose-600 transition-all">Save Milestone</button>
             </form>
          </div>
        </div>
      )}

      {showModuleModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xl z-[100] flex items-center justify-center p-8 animate-fadeIn">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl animate-slideIn">
             <div className="p-10 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-3xl font-bold">Curriculum Module</h2>
                <button onClick={() => setShowModuleModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button>
             </div>
             <form onSubmit={handleUpsertModule} className="p-10 space-y-6">
                <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Module Name</label>
                   <input name="name" required defaultValue={editingItem?.name} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold outline-none" />
                </div>
                <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Credit Points (CP)</label>
                   <input name="credits" type="number" required defaultValue={editingItem?.credits || 5} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold outline-none" />
                </div>
                <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Short Description</label>
                   <textarea name="description" defaultValue={editingItem?.description} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold outline-none h-32 resize-none" />
                </div>
                <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-bold shadow-2xl hover:bg-indigo-700 transition-all">Save Module</button>
             </form>
          </div>
        </div>
      )}

      {/* AI Chat Floating Button */}
      <button
        onClick={() => setShowAIChat(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-full shadow-2xl hover:shadow-3xl transition-all flex items-center justify-center z-40 group"
        title="Chat with AI Assistant"
      >
        <svg className="w-7 h-7 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </button>

      {/* AI Chat Modal */}
      {showAIChat && <AIChat onClose={() => setShowAIChat(false)} />}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-fadeIn { animation: fadeIn 0.4s cubic-bezier(0.2, 0, 0, 1) forwards; }
        .animate-slideIn { animation: slideIn 0.3s cubic-bezier(0.2, 0, 0, 1) forwards; }
      `}</style>
    </div>
  );
};

export default App;
