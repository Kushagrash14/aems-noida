import React from 'react';

export default function DashboardLoading() {
  return (
    <div className="w-full py-12 flex items-center justify-center animate-in fade-in duration-150">
      <div className="flex items-center gap-2.5 px-4 py-2 bg-white/90 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200 text-xs font-bold text-slate-700">
        <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin shrink-0" />
        <span>Loading...</span>
      </div>
    </div>
  );
}
