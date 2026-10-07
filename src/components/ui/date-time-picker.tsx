import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, 
  RotateCcw, Sparkles 
} from 'lucide-react';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, parseISO, isValid, setHours, setMinutes 
} from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

export interface DatePickerProps {
  /** Selected date as ISO string or 'YYYY-MM-DD' */
  value?: string;
  /** Callback fired when date changes, returns ISO string */
  onChange: (isoString: string) => void;
  /** Optional placeholder */
  placeholder?: string;
  /** Custom trigger styling */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Theme override */
  theme?: 'light' | 'dark';
}

export interface TimePickerProps {
  /** Selected time or ISO string */
  value?: string;
  /** Callback fired when time changes, returns ISO string */
  onChange: (isoString: string) => void;
  /** Custom container styling */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Theme override */
  theme?: 'light' | 'dark';
}

export interface DateTimePickerProps {
  /** Selected date-time as ISO string or 'YYYY-MM-DDTHH:mm' or 'YYYY-MM-DD' */
  value?: string;
  /** Callback fired when date or time changes, returns ISO string */
  onChange: (isoString: string) => void;
  /** Optional placeholder */
  placeholder?: string;
  /** Custom trigger styling */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Theme override */
  theme?: 'light' | 'dark';
  /** Show time picker controls (default: true) */
  showTime?: boolean;
}

/**
 * Parses any ISO or date string safely, returning a valid Date object.
 */
function parseSafeDate(val?: string): Date {
  if (!val) return new Date();
  try {
    const parsed = parseISO(val);
    if (isValid(parsed)) return parsed;
    const d = new Date(val);
    if (isValid(d)) return d;
  } catch {
    // fallback
  }
  return new Date();
}

/**
 * Standalone Date Picker Box.
 * 
 * Features:
 * - Dedicated input button displaying formatted date (YYYY-MM-DD) and weekday.
 * - Standalone Calendar popover rendered strictly downward (side="bottom" align="start")
 *   via Radix Popover so it is never clipped by modal boundaries.
 * - Quick selection presets: "Today", "Yesterday", "+30d Cheque".
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
  const selectedDate = value ? parseSafeDate(value) : null;
  const [viewMonth, setViewMonth] = useState<Date>(selectedDate || new Date());

  useEffect(() => {
    if (value) {
      setViewMonth(parseSafeDate(value));
    }
  }, [value]);

  const handleSelectDate = (day: Date) => {
    const base = selectedDate || new Date();
    const updated = new Date(day);
    updated.setHours(base.getHours(), base.getMinutes(), base.getSeconds(), 0);
    onChange(updated.toISOString());
    setIsOpen(false);
  };

  const handleQuickSelect = (type: 'today' | 'yesterday' | 'cheque30') => {
    const today = new Date();
    if (type === 'today') {
      handleSelectDate(today);
    } else if (type === 'yesterday') {
      handleSelectDate(addDays(today, -1));
    } else if (type === 'cheque30') {
      handleSelectDate(addDays(today, 30));
    }
  };

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  let currDay = startDate;
  while (currDay <= endDate) {
    days.push(currDay);
    currDay = addDays(currDay, 1);
  }

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'w-[170px] min-w-[170px] h-9 px-2.5 rounded-xl border text-xs font-medium transition-all flex items-center justify-between text-left focus:outline-none focus:ring-1 shrink-0',
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
            <span className="truncate font-mono font-semibold">
              {selectedDate ? format(selectedDate, 'yyyy-MM-dd') : placeholder}
            </span>
          </div>
          {selectedDate && (
            <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60 shrink-0 ml-1">
              {format(selectedDate, 'EEE')}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        avoidCollisions={true}
        className={cn(
          'w-[290px] p-3 rounded-2xl border shadow-2xl z-[9999] animate-in fade-in zoom-in-95 duration-150 select-none',
          isDark
            ? 'bg-slate-900 border-slate-700/80 text-white shadow-black/60'
            : 'bg-white border-slate-200 text-slate-900 shadow-slate-200'
        )}
      >
        {/* Quick Date Presets */}
        <div className="flex items-center gap-1.5 pb-2.5 mb-2.5 border-b border-slate-700/40">
          <button
            type="button"
            onClick={() => handleQuickSelect('today')}
            className={cn(
              'px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors flex-1 text-center',
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
              'px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors flex-1 text-center',
              isDark
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            )}
          >
            Yesterday
          </button>
          <button
            type="button"
            onClick={() => handleQuickSelect('cheque30')}
            className={cn(
              'px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors flex-1 text-center',
              isDark
                ? 'bg-purple-950/60 text-purple-300 hover:bg-purple-900/60 border border-purple-500/20'
                : 'bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200'
            )}
            title="Forward-dated Cheque (+30 Days)"
          >
            +30d Cheque
          </button>
        </div>

        {/* Month / Year Header Navigation */}
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

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {days.map((day, idx) => {
            const isSelected = selectedDate && isSameDay(day, selectedDate);
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

/**
 * Standalone Inline Time Picker Box (Exact Reliance Pattern).
 * 
 * Features:
 * - Segmented inputs for [ HH ] : [ MM ] [ AM / PM ].
 * - Clicking a segment auto-selects and clears for swift typing.
 * - Auto-pads to 2 digits on blur (e.g. "08", "18").
 * - Standalone "Now" button for instant current time stamping.
 */
export const ThemedTimePicker: React.FC<TimePickerProps> = ({
  value,
  onChange,
  className,
  disabled = false,
  theme: themeOverride,
}) => {
  const { theme: contextTheme } = useTheme();
  const theme = themeOverride || contextTheme || 'dark';
  const isDark = theme === 'dark';

  const selectedDate = value ? parseSafeDate(value) : new Date();
  const initialH24 = selectedDate.getHours();
  const initialM = selectedDate.getMinutes();

  const [hour12Str, setHour12Str] = useState<string>(
    String(initialH24 % 12 === 0 ? 12 : initialH24 % 12).padStart(2, '0')
  );
  const [minStr, setMinStr] = useState<string>(String(initialM).padStart(2, '0'));
  const [period, setPeriod] = useState<'AM' | 'PM'>(initialH24 >= 12 ? 'PM' : 'AM');

  useEffect(() => {
    if (value) {
      const d = parseSafeDate(value);
      const h24 = d.getHours();
      const m = d.getMinutes();
      setHour12Str(String(h24 % 12 === 0 ? 12 : h24 % 12).padStart(2, '0'));
      setMinStr(String(m).padStart(2, '0'));
      setPeriod(h24 >= 12 ? 'PM' : 'AM');
    }
  }, [value]);

  const emitDateTime = useCallback((h12: number, m: number, p: 'AM' | 'PM') => {
    let h24 = h12 % 12;
    if (p === 'PM') h24 += 12;
    const base = value ? parseSafeDate(value) : new Date();
    const combined = setMinutes(setHours(base, h24), m);
    onChange(combined.toISOString());
  }, [value, onChange]);

  const handleHourFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    if (val.length <= 2) {
      setHour12Str(val);
      const num = parseInt(val, 10);
      if (val.length === 2 && !isNaN(num) && num >= 1 && num <= 12) {
        emitDateTime(num, parseInt(minStr, 10) || 0, period);
      }
    }
  };

  const handleHourBlur = () => {
    let num = parseInt(hour12Str, 10);
    if (isNaN(num) || num < 1 || num > 12) {
      num = 12;
    }
    const padded = String(num).padStart(2, '0');
    setHour12Str(padded);
    emitDateTime(num, parseInt(minStr, 10) || 0, period);
  };

  const handleMinFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    if (val.length <= 2) {
      setMinStr(val);
      const num = parseInt(val, 10);
      if (val.length === 2 && !isNaN(num) && num >= 0 && num <= 59) {
        emitDateTime(parseInt(hour12Str, 10) || 12, num, period);
      }
    }
  };

  const handleMinBlur = () => {
    let num = parseInt(minStr, 10);
    if (isNaN(num) || num < 0 || num > 59) {
      num = 0;
    }
    const padded = String(num).padStart(2, '0');
    setMinStr(padded);
    emitDateTime(parseInt(hour12Str, 10) || 12, num, period);
  };

  const togglePeriod = (newPeriod: 'AM' | 'PM') => {
    setPeriod(newPeriod);
    emitDateTime(parseInt(hour12Str, 10) || 12, parseInt(minStr, 10) || 0, newPeriod);
  };

  const handleSetCurrentTime = () => {
    const now = new Date();
    const h24 = now.getHours();
    const m = now.getMinutes();
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const p = h24 >= 12 ? 'PM' : 'AM';
    setHour12Str(String(h12).padStart(2, '0'));
    setMinStr(String(m).padStart(2, '0'));
    setPeriod(p);
    emitDateTime(h12, m, p);
  };

  return (
    <div
      className={cn(
        'w-auto shrink-0 h-9 px-2.5 rounded-xl border inline-flex items-center gap-1.5 transition-all select-none',
        isDark
          ? 'border-slate-700/60 bg-slate-900/60 text-white'
          : 'border-slate-300 bg-white text-slate-900 shadow-sm',
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        className
      )}
    >
      <div className="flex items-center gap-1 shrink-0">
        <Clock className="w-3.5 h-3.5 text-orange-500 shrink-0" />
        
        {/* Hour Input [ HH ] */}
        <input
          type="text"
          inputMode="numeric"
          maxLength={2}
          disabled={disabled}
          value={hour12Str}
          onFocus={handleHourFocus}
          onChange={handleHourChange}
          onBlur={handleHourBlur}
          placeholder="12"
          className={cn(
            'w-7 sm:w-8 h-7 text-xs font-bold text-center rounded-lg border font-mono transition-all focus:outline-none focus:ring-1 shrink-0',
            isDark
              ? 'bg-slate-800 border-slate-700 text-orange-400 focus:border-orange-500 focus:ring-orange-500/30'
              : 'bg-slate-100 border-slate-300 text-orange-600 focus:border-orange-500 focus:ring-orange-500/30'
          )}
          title="Hour (01-12)"
        />

        <span className="text-xs font-bold px-0.5 text-slate-400 font-mono select-none">:</span>

        {/* Minute Input [ MM ] */}
        <input
          type="text"
          inputMode="numeric"
          maxLength={2}
          disabled={disabled}
          value={minStr}
          onFocus={handleMinFocus}
          onChange={handleMinChange}
          onBlur={handleMinBlur}
          placeholder="00"
          className={cn(
            'w-7 sm:w-8 h-7 text-xs font-bold text-center rounded-lg border font-mono transition-all focus:outline-none focus:ring-1 shrink-0',
            isDark
              ? 'bg-slate-800 border-slate-700 text-orange-400 focus:border-orange-500 focus:ring-orange-500/30'
              : 'bg-slate-100 border-slate-300 text-orange-600 focus:border-orange-500 focus:ring-orange-500/30'
          )}
          title="Minute (00-59)"
        />
      </div>

      {/* AM / PM Segment Toggle & Now Button */}
      <div className="flex items-center gap-1.5 shrink-0 ml-0.5">
        <div className={cn(
          'flex items-center rounded-lg p-0.5 border h-7',
          isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-300'
        )}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => togglePeriod('AM')}
            className={cn(
              'h-6 px-2 rounded text-[11px] font-bold font-mono transition-all',
              period === 'AM'
                ? 'bg-orange-500 text-white shadow'
                : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
            )}
          >
            AM
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => togglePeriod('PM')}
            className={cn(
              'h-6 px-2 rounded text-[11px] font-bold font-mono transition-all',
              period === 'PM'
                ? 'bg-orange-500 text-white shadow'
                : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
            )}
          >
            PM
          </button>
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={handleSetCurrentTime}
          className={cn(
            'h-7 px-2.5 text-xs font-semibold rounded-lg transition-colors border shrink-0',
            isDark
              ? 'bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30'
              : 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100'
          )}
          title="Set to Current Time"
        >
          Now
        </button>
      </div>
    </div>
  );
};

/**
 * Decoupled Themed Date & Time Picker for LHD.
 * Composes tightly aligned inline Date Picker and Time Picker components into a compact inline cluster.
 */
export const ThemedDateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select date...',
  className,
  disabled = false,
  theme,
  showTime = true,
}) => {
  if (!showTime) {
    return (
      <ThemedDatePicker
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        theme={theme}
      />
    );
  }

  return (
    <div className={cn('inline-flex flex-wrap items-center gap-2.5 sm:gap-3 w-fit', className)}>
      <ThemedDatePicker
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        theme={theme}
      />
      <ThemedTimePicker
        value={value}
        onChange={onChange}
        disabled={disabled}
        theme={theme}
      />
    </div>
  );
};

export default ThemedDateTimePicker;

