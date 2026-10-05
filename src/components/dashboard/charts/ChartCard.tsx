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
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.06)] px-4 pt-3.5 pb-3 flex flex-col gap-3 h-full animate-fade-up">
      <header className={`flex flex-wrap justify-between gap-x-3 gap-y-2 ${subtitle ? 'items-start' : 'items-center'}`}>
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          {emoji ? (
            <span className="text-lg leading-none shrink-0" aria-hidden>
              {emoji}
            </span>
          ) : (
            Icon && (
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconClassName}`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
            )
          )}
          <div className="min-w-0">
            <h2 className={`text-slate-900 leading-tight whitespace-nowrap ${subtitle ? 'text-sm font-bold' : 'text-[15px] font-extrabold tracking-tight'}`}>{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
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
    <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-8 text-xs text-slate-400">
      {message}
    </div>
  );
}
