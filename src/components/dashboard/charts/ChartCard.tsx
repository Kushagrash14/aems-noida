import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface ChartCardProps {
  icon?: LucideIcon;
  iconClassName?: string;
  emoji?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}

export default function ChartCard({ icon: Icon, iconClassName = '', emoji, title, subtitle, action, children }: ChartCardProps) {
  return (
    <section className="bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-3.5 pt-3 pb-2.5 flex flex-col gap-2.5 h-full animate-fade-up">
      <header className={`flex flex-wrap justify-between gap-x-3 gap-y-1.5 ${subtitle ? 'items-start' : 'items-center'}`}>
        <div className="flex items-center gap-2.5 min-w-0 shrink-0">
          {Icon ? (
            <div className={`w-7.5 h-7.5 rounded-lg flex items-center justify-center shrink-0 ${iconClassName}`}>
              <Icon className="w-4 h-4" />
            </div>
          ) : emoji ? (
            <span className="text-base leading-none shrink-0" aria-hidden>
              {emoji}
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className={`text-slate-900 leading-tight whitespace-nowrap ${subtitle ? 'text-xs sm:text-[13px] font-bold' : 'text-sm font-bold tracking-tight'}`}>{title}</h2>
            {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex-1 flex items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 py-6 text-xs text-slate-400">
      {message}
    </div>
  );
}
