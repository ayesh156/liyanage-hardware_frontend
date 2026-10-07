import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight 
} from 'lucide-react';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, parseISO, isValid 
} from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

export interface DatePickerProps {
  /** Selected date in 'YYYY-MM-DD' format */
  value?: string;
  /** Callback fired when a date is picked or cleared */
  onChange: (dateStr: string) => void;
  /** Optional placeholder text when no date is selected */
  placeholder?: string;
  /** Custom trigger styling class name */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Theme override (defaults to theme from context) */
  theme?: 'light' | 'dark';
}

/**
 * Modern themed popover Date Picker matching the unified dark/light design tokens.
 * Replaces native unthemed browser date inputs with sleek calendar selection and quick presets.
 */
export const ThemedDatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select date...',
  className,
  disabled = false,
  theme: themeOverride,
}) => {
  const { theme: contextTheme } = useTheme();
  const theme = themeOverride || contextTheme || 'dark';
  const isDark = theme === 'dark';

  const [isOpen, setIsOpen] = useState(false);

  // Parse current value or default to today for calendar view
  const parsedDate = value ? parseISO(value) : null;
  const validSelectedDate = parsedDate && isValid(parsedDate) ? parsedDate : null;

  const [viewMonth, setViewMonth] = useState<Date>(
    validSelectedDate || new Date()
  );

  const handleSelectDate = (date: Date) => {
    const formatted = format(date, 'yyyy-MM-dd');
    onChange(formatted);
    setIsOpen(false);
  };

  const handleQuickSelect = (type: 'today' | 'yesterday') => {
    const today = new Date();
    if (type === 'today') {
      handleSelectDate(today);
    } else if (type === 'yesterday') {
      handleSelectDate(addDays(today, -1));
    }
  };

  // Generate calendar grid days
  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = [];
  let currentDay = startDate;
  while (currentDay <= endDate) {
    days.push(currentDay);
    currentDay = addDays(currentDay, 1);
  }

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'w-full h-9 px-3 rounded-xl border text-xs font-medium transition-all flex items-center justify-between text-left focus:outline-none focus:ring-1',
            isDark
              ? 'border-slate-700/60 bg-slate-900/60 text-white placeholder-slate-500 hover:border-slate-600 focus:border-orange-500/80 focus:ring-orange-500/30'
              : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50 focus:border-orange-500/80 focus:ring-orange-500/30 shadow-sm',
            !value && 'text-slate-400',
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <CalendarIcon className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <span className="truncate">
              {validSelectedDate ? format(validSelectedDate, 'yyyy-MM-dd') : placeholder}
            </span>
          </div>
          {validSelectedDate && (
            <span className="text-[10px] font-mono text-slate-400">
              {format(validSelectedDate, 'EEE')}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className={cn(
          'w-[280px] p-3 rounded-2xl border shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150',
          isDark
            ? 'bg-slate-900 border-slate-700/80 text-white shadow-black/60'
            : 'bg-white border-slate-200 text-slate-900 shadow-slate-200'
        )}
      >
        {/* Quick Presets */}
        <div className="flex items-center gap-1.5 pb-2.5 mb-2.5 border-b border-slate-700/40">
          <button
            type="button"
            onClick={() => handleQuickSelect('today')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors flex-1 text-center',
              isDark
                ? 'bg-slate-800 text-orange-400 hover:bg-slate-700'
                : 'bg-slate-100 text-orange-600 hover:bg-slate-200'
            )}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => handleQuickSelect('yesterday')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors flex-1 text-center',
              isDark
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            )}
          >
            Yesterday
          </button>
        </div>

        {/* Month Header */}
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-bold tracking-tight">
            {format(viewMonth, 'MMMM yyyy')}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMonth(subMonths(viewMonth, 1))}
              className={cn(
                'p-1 rounded-lg transition-colors',
                isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
              )}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMonth(addMonths(viewMonth, 1))}
              className={cn(
                'p-1 rounded-lg transition-colors',
                isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
              )}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days of Week */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {weekDays.map((d) => (
            <span key={d} className="text-[10px] font-semibold text-slate-400 py-0.5">
              {d}
            </span>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {days.map((day, idx) => {
            const isSelected = validSelectedDate && isSameDay(day, validSelectedDate);
            const isCurrentMonth = isSameMonth(day, viewMonth);
            const isToday = isSameDay(day, new Date());

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectDate(day)}
                className={cn(
                  'h-7 w-7 text-xs font-medium rounded-lg transition-all flex items-center justify-center relative mx-auto',
                  !isCurrentMonth && 'text-slate-600 opacity-30',
                  isSelected
                    ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white font-bold shadow-md shadow-orange-500/30'
                    : isToday
                    ? isDark
                      ? 'border border-orange-500/60 text-orange-400 hover:bg-slate-800'
                      : 'border border-orange-500/60 text-orange-600 hover:bg-slate-100'
                    : isDark
                    ? 'hover:bg-slate-800 text-slate-200'
                    : 'hover:bg-slate-100 text-slate-700'
                )}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};
