
import React from 'react';
import { Priority } from '../types';

export const Badge: React.FC<{ priority: Priority }> = ({ priority }) => {
  const colors = {
    High: 'bg-red-100 text-red-700 border-red-200',
    Medium: 'bg-amber-100 text-amber-700 border-amber-200',
    Low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colors[priority]}`}>
      {priority}
    </span>
  );
};

export const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
  <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
    <div 
      className="bg-indigo-600 h-2 rounded-full transition-all duration-500 ease-out"
      style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
    />
  </div>
);
