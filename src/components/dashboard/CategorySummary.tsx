'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Layers, ChevronDown, ChevronUp, Box, Laptop, Cpu, Wrench } from 'lucide-react';

export interface CategoryStatItem {
  id: string;
  name: string;
  code?: string;
  description?: string | null;
  count: number;
}

interface CategorySummaryProps {
  stats: CategoryStatItem[];
}

export default function CategorySummary({ stats }: CategorySummaryProps) {
  const [isOpen, setIsOpen] = useState(true);

  const getCategoryIcon = (code?: string) => {
    switch (code?.toLowerCase()) {
      case 'it':
      case 'laptop':
        return Laptop;
      case 'mch':
      case 'machinery':
        return Wrench;
      case 'mold':
      case 'tool':
        return Cpu;
      default:
        return Box;
    }
  };

  return (
    <div className="space-y-3">
      {/* Category Summary Header matching Image 2 */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
          <Layers className="w-4 h-4 text-slate-400" />
          <span>CATEGORY SUMMARY</span>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 shadow-xs hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <span>{isOpen ? 'Hide Summary' : 'Show Summary'}</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
        </button>
      </div>

      {/* Expandable Category Cards */}
      {isOpen && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 transition-all">
          {stats.slice(0, 5).map((cat) => {
            const Icon = getCategoryIcon(cat.code);
            return (
              <Link
                key={cat.id}
                href="/categories"
                className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs hover:border-blue-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-slate-50 group-hover:bg-blue-50 text-slate-600 group-hover:text-blue-600 transition-colors">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span
                    suppressHydrationWarning
                    className="text-lg font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors"
                  >
                    {cat.count}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-700 truncate">{cat.name}</h4>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{cat.description || 'Industrial equipment'}</p>
                <div className="mt-2.5 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(15, (cat.count / 30) * 100))}%` }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
