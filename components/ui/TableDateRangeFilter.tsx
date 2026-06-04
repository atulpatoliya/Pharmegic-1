'use client';

import { Calendar, X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface DateRangeValue {
  from: string;
  to: string;
}

interface TableDateRangeFilterProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  className?: string;
}

export function TableDateRangeFilter({ value, onChange, className }: TableDateRangeFilterProps) {
  const isActive = Boolean(value.from.trim() || value.to.trim());

  const inputClass = twMerge(
    'w-full h-7 rounded-md border text-[10px] font-medium px-1.5',
    'bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-primary/30 focus:border-primary',
    isActive ? 'border-primary/60 bg-primary/5' : 'border-slate-200'
  );

  const clear = () => onChange({ from: '', to: '' });

  return (
    <div className={twMerge('relative mt-1.5 space-y-1', className)}>
      <div className="flex items-center gap-1">
        {!isActive && (
          <Calendar className="h-3 w-3 text-slate-400 shrink-0 absolute left-1 top-[18px] pointer-events-none z-10" />
        )}
        <input
          type="date"
          value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          className={clsx(inputClass, !isActive && 'pl-6')}
          aria-label="From date"
          title="From date"
        />
      </div>
      <input
        type="date"
        value={value.to}
        onChange={(e) => onChange({ ...value, to: e.target.value })}
        className={inputClass}
        aria-label="To date"
        title="To date"
        min={value.from || undefined}
      />
      {isActive && (
        <button
          type="button"
          onClick={clear}
          className="absolute -right-0.5 top-0 p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          title="Clear date range"
          aria-label="Clear date range"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
