import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Check
} from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  addDays,
  isWithinInterval,
  parseISO,
  isValid,
  isAfter,
  isBefore,
  startOfDay
} from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';

export interface DateRangeValue {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface DateRangePickerProps {
  startDate?: string;
  endDate?: string;
  onChange: (range: DateRangeValue) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  align?: 'left' | 'right' | 'auto';
  isDark?: boolean;
  disabled?: boolean;
  /** Restrict date selection starting from minDate (disables prior dates) */
  minDate?: Date;
  /** Restrict date selection up to maxDate (defaults to today) */
  maxDate?: Date;
  /** Custom trigger renderer if used as an inline button */
  customTrigger?: (props: {
    isOpen: boolean;
    displayLabel: string;
    hasActiveRange: boolean;
    onClick: () => void;
    onClear: (e: React.MouseEvent) => void;
  }) => React.ReactNode;
}

/**
 * Modern Shadcn-style absolute single-calendar date range selector popover.
 * - Positioned cleanly right below the trigger button without overflowing viewport edges.
 * - Automatically restricts selection up to maxDate (disables future dates).
 * - Full Sinhala & English localization for day headers, buttons, and range indicators.
 */
export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
  onClear,
  placeholder,
  className = '',
  align = 'auto',
  isDark: isDarkProp,
  disabled = false,
  minDate,
  maxDate = new Date(),
  customTrigger,
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const isDark = isDarkProp !== undefined ? isDarkProp : theme === 'dark';
  const effectiveMaxDate = maxDate || new Date();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverAlign, setPopoverAlign] = useState<'left' | 'right'>('left');

  // Active range dates
  const parsedStart = startDate && isValid(parseISO(startDate)) ? parseISO(startDate) : null;
  const parsedEnd = endDate && isValid(parseISO(endDate)) ? parseISO(endDate) : null;

  const [tempStart, setTempStart] = useState<Date | null>(parsedStart);
  const [tempEnd, setTempEnd] = useState<Date | null>(parsedEnd);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  // Displayed month
  const [currentMonth, setCurrentMonth] = useState<Date>(
    parsedStart || parsedEnd || new Date()
  );

  // Sync external props when popover opens
  useEffect(() => {
    if (isOpen) {
      const s = startDate && isValid(parseISO(startDate)) ? parseISO(startDate) : null;
      const e = endDate && isValid(parseISO(endDate)) ? parseISO(endDate) : null;
      setTempStart(s);
      setTempEnd(e);
      if (s) setCurrentMonth(s);
    }
  }, [isOpen, startDate, endDate]);

  // Viewport collision detection: compute alignment so popover never overflows screen
  const calculateAlignment = useCallback(() => {
    if (align === 'left') {
      setPopoverAlign('left');
      return;
    }
    if (align === 'right') {
      setPopoverAlign('right');
      return;
    }

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const popoverWidth = 310;
      const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
      
      // If expanding to the right would overflow right edge, align to right of trigger
      if (rect.left + popoverWidth > windowWidth - 16) {
        setPopoverAlign('right');
      } else {
        setPopoverAlign('left');
      }
    }
  }, [align]);

  useEffect(() => {
    if (isOpen) {
      calculateAlignment();
      window.addEventListener('resize', calculateAlignment);
      return () => window.removeEventListener('resize', calculateAlignment);
    }
  }, [isOpen, calculateAlignment]);

  // Outside click listener to dismiss without backdrop
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleDateClick = (day: Date) => {
    // Restrict date selection strictly within [minDate, effectiveMaxDate]
    if (isAfter(startOfDay(day), startOfDay(effectiveMaxDate))) {
      return;
    }
    if (minDate && isBefore(startOfDay(day), startOfDay(minDate))) {
      return;
    }

    if (!tempStart || (tempStart && tempEnd)) {
      // First click: start new range
      setTempStart(day);
      setTempEnd(null);
    } else if (tempStart && !tempEnd) {
      // Second click
      if (day < tempStart) {
        // Reset start if earlier date clicked
        setTempStart(day);
        setTempEnd(null);
      } else {
        // Complete range
        setTempEnd(day);
      }
    }
  };

  const handleApply = () => {
    if (tempStart) {
      const s = format(tempStart, 'yyyy-MM-dd');
      const e = tempEnd ? format(tempEnd, 'yyyy-MM-dd') : s;
      onChange({ startDate: s, endDate: e });
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    setTempStart(null);
    setTempEnd(null);
    if (onClear) {
      onClear();
    } else {
      onChange({ startDate: '', endDate: '' });
    }
    setIsOpen(false);
  };

  // Generate days grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDayOfWeek = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
  const endDayOfWeek = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  let d = startDayOfWeek;
  while (d <= endDayOfWeek) {
    days.push(d);
    d = addDays(d, 1);
  }

  const weekDays = [
    { key: 'su', label: t('calendar.days.su', 'Su') },
    { key: 'mo', label: t('calendar.days.mo', 'Mo') },
    { key: 'tu', label: t('calendar.days.tu', 'Tu') },
    { key: 'we', label: t('calendar.days.we', 'We') },
    { key: 'th', label: t('calendar.days.th', 'Th') },
    { key: 'fr', label: t('calendar.days.fr', 'Fr') },
    { key: 'sa', label: t('calendar.days.sa', 'Sa') },
  ];

  const defaultPlaceholder = placeholder || t('financial.customRange', 'Date Range');

  // Formatted trigger label
  const displayLabel = parsedStart && parsedEnd
    ? `${format(parsedStart, 'yyyy-MM-dd')} ~ ${format(parsedEnd, 'yyyy-MM-dd')}`
    : parsedStart
    ? `${format(parsedStart, 'yyyy-MM-dd')} ~ ...`
    : defaultPlaceholder;

  const isNextMonthDisabled = isAfter(startOfMonth(addMonths(currentMonth, 1)), startOfDay(effectiveMaxDate));
  const isPrevMonthDisabled = minDate ? isBefore(endOfMonth(subMonths(currentMonth, 1)), startOfDay(minDate)) : false;

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      {/* Trigger Button */}
      {customTrigger ? (
        customTrigger({
          isOpen,
          displayLabel,
          hasActiveRange: Boolean(parsedStart),
          onClick: () => setIsOpen(!isOpen),
          onClear: (e) => {
            e.stopPropagation();
            handleClear();
          },
        })
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
            parsedStart
              ? 'bg-orange-500/10 border-orange-500/40 text-orange-400 font-semibold shadow-sm'
              : isDark
              ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600 hover:bg-slate-700/50'
              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 shadow-sm'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        >
          <CalendarIcon className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
          <span className="truncate max-w-[200px] sm:max-w-none">{displayLabel}</span>

          {parsedStart && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="p-0.5 rounded hover:bg-orange-500/20 text-orange-400 ml-1 cursor-pointer"
              title={t('calendar.clear', 'Clear')}
            >
              <X className="w-3 h-3" />
            </span>
          )}
        </button>
      )}

      {/* Popover Window: Positioned directly below trigger with collision protection */}
      {isOpen && (
        <div
          ref={popoverRef}
          className={`absolute top-full mt-2 z-50 w-[290px] sm:w-[310px] p-3 rounded-2xl border shadow-2xl transition-all duration-150 animate-in fade-in zoom-in-95 ${
            popoverAlign === 'right' ? 'right-0' : 'left-0'
          } ${
            isDark
              ? 'bg-slate-900 border-slate-700 text-white shadow-black/80'
              : 'bg-white border-slate-200 text-slate-900 shadow-slate-300'
          }`}
          style={{ maxWidth: 'calc(100vw - 24px)' }}
        >
          {/* Month Navigation & Title */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700/30">
            <button
              type="button"
              disabled={isPrevMonthDisabled}
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className={`p-1 rounded-lg border transition-colors ${
                isPrevMonthDisabled
                  ? 'opacity-20 cursor-not-allowed border-transparent text-slate-500'
                  : isDark
                  ? 'border-slate-700 hover:bg-slate-800 text-slate-300 cursor-pointer'
                  : 'border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer'
              }`}
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-bold tracking-tight">
              {format(currentMonth, 'MMMM yyyy')}
            </span>

            <button
              type="button"
              disabled={isNextMonthDisabled}
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className={`p-1 rounded-lg border transition-colors ${
                isNextMonthDisabled
                  ? 'opacity-20 cursor-not-allowed border-transparent text-slate-500'
                  : isDark
                  ? 'border-slate-700 hover:bg-slate-800 text-slate-300 cursor-pointer'
                  : 'border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer'
              }`}
              title="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Active Range Preview Info */}
          <div
            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg mb-2 text-[11px] font-mono ${
              isDark ? 'bg-slate-800/70 text-slate-300' : 'bg-slate-100 text-slate-700'
            }`}
          >
            <span className={tempStart ? 'text-orange-400 font-semibold' : 'text-slate-400'}>
              {tempStart ? format(tempStart, 'yyyy-MM-dd') : t('calendar.startDate', 'Start date')}
            </span>
            <span className="text-slate-400">→</span>
            <span className={tempEnd ? 'text-orange-400 font-semibold' : 'text-slate-400'}>
              {tempEnd
                ? format(tempEnd, 'yyyy-MM-dd')
                : tempStart
                ? t('calendar.clickEndDate', 'Click end date')
                : t('calendar.endDate', 'End date')}
            </span>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {weekDays.map((wd) => (
              <span key={wd.key} className="text-[10px] font-semibold text-slate-400 py-0.5">
                {wd.label}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {days.map((day, idx) => {
              const isCurrentMonthDay = isSameMonth(day, currentMonth);
              const isStart = tempStart && isSameDay(day, tempStart);
              const isEnd = tempEnd && isSameDay(day, tempEnd);
              const isFuture = isAfter(startOfDay(day), startOfDay(effectiveMaxDate));
              const isBeforeMin = minDate ? isBefore(startOfDay(day), startOfDay(minDate)) : false;
              const isDisabledDay = isFuture || isBeforeMin;

              // Check if in range (either finalized or hover preview)
              const effectiveEnd = tempEnd || (tempStart && hoverDate && hoverDate >= tempStart ? hoverDate : null);
              const isInRange =
                tempStart &&
                effectiveEnd &&
                isWithinInterval(day, { start: tempStart, end: effectiveEnd });

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isDisabledDay}
                  onClick={() => handleDateClick(day)}
                  onMouseEnter={() => {
                    if (!isDisabledDay && tempStart && !tempEnd) {
                      setHoverDate(day);
                    }
                  }}
                  className={`h-8 w-8 text-xs font-medium transition-all flex items-center justify-center relative mx-auto ${
                    isDisabledDay
                      ? 'opacity-20 cursor-not-allowed pointer-events-none text-slate-500'
                      : !isCurrentMonthDay
                      ? 'text-slate-500 opacity-25'
                      : ''
                  } ${
                    !isDisabledDay && (isStart || isEnd)
                      ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white font-bold rounded-lg shadow-md shadow-orange-500/30 z-10'
                      : !isDisabledDay && isInRange
                      ? isDark
                        ? 'bg-orange-500/20 text-orange-300 rounded-none'
                        : 'bg-orange-100 text-orange-800 rounded-none'
                      : !isDisabledDay && isDark
                      ? 'hover:bg-slate-800 text-slate-200 rounded-lg cursor-pointer'
                      : !isDisabledDay
                      ? 'hover:bg-slate-100 text-slate-700 rounded-lg cursor-pointer'
                      : ''
                  }`}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-700/30">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-rose-400 hover:text-rose-300 transition-colors font-medium cursor-pointer"
            >
              {t('calendar.clear', 'Clear')}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={`px-2.5 py-1 text-xs rounded-lg border transition-colors cursor-pointer ${
                  isDark
                    ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t('calendar.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!tempStart}
                className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer ${
                  tempStart
                    ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20'
                    : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
                }`}
              >
                <Check className="w-3 h-3" />
                {t('calendar.apply', 'Apply')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
