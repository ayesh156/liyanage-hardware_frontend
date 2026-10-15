import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, 
  isWithinInterval, isAfter, startOfDay 
} from 'date-fns';
import { DateRange } from 'react-day-picker';
import { useTranslation } from 'react-i18next';

export interface CalendarProps {
  selected?: DateRange;
  onSelect?: (range: DateRange | undefined) => void;
  onClose?: () => void;
  isDark?: boolean;
  /** Restrict date selection up to maxDate (defaults to today) */
  maxDate?: Date;
}

// 🌟 Modern Single-Calendar Date Range Selector
export const Calendar: React.FC<CalendarProps> = ({
  selected,
  onSelect,
  onClose,
  isDark = true,
  maxDate = new Date(),
}) => {
  const { t } = useTranslation();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [range, setRange] = useState<DateRange | undefined>(selected);
  const [hoverDay, setHoverDay] = useState<Date | null>(null);

  const effectiveMaxDate = maxDate || new Date();

  const handleDateClick = (day: Date) => {
    // Restrict date selection up to maxDate
    if (isAfter(startOfDay(day), startOfDay(effectiveMaxDate))) {
      return;
    }

    let newRange: DateRange | undefined;

    if (!range || (range.from && range.to)) {
      newRange = { from: day, to: undefined };
    } else if (range.from && !range.to) {
      if (day < range.from) {
        newRange = { from: day, to: undefined };
      } else {
        newRange = { from: range.from, to: day };
      }
    }

    setRange(newRange);
    if (onSelect) onSelect(newRange);
  };

  const renderMonth = (monthDate: Date) => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = [];
    let day = startDate;

    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
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

    return (
      <div className="w-[280px] p-2">
        {/* Days Header */}
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {weekDays.map((d) => (
            <span key={d.key} className={`text-[10px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {d.label}
            </span>
          ))}
        </div>

        {/* Grid Days */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {days.map((d, idx) => {
            const isSelectedFrom = range?.from && isSameDay(d, range.from);
            const isSelectedTo = range?.to && isSameDay(d, range.to);
            const effectiveTo = range?.to || (range?.from && hoverDay && hoverDay >= range.from ? hoverDay : null);
            const isInRange =
              range?.from && effectiveTo && isWithinInterval(d, { start: range.from, end: effectiveTo });
            const isCurrentMonth = isSameMonth(d, monthDate);
            const isFuture = isAfter(startOfDay(d), startOfDay(effectiveMaxDate));

            return (
              <button
                key={idx}
                type="button"
                disabled={isFuture}
                onClick={() => handleDateClick(d)}
                onMouseEnter={() => {
                  if (!isFuture && range?.from && !range?.to) {
                    setHoverDay(d);
                  }
                }}
                className={`h-8 w-8 text-xs font-medium rounded-lg transition-all flex items-center justify-center ${
                  isFuture
                    ? 'opacity-20 cursor-not-allowed pointer-events-none text-slate-500'
                    : !isCurrentMonth
                    ? isDark ? 'text-slate-600 opacity-30' : 'text-slate-300'
                    : ''
                } ${
                  !isFuture && (isSelectedFrom || isSelectedTo)
                    ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white font-bold shadow-md shadow-orange-500/30'
                    : !isFuture && isInRange
                    ? isDark
                      ? 'bg-orange-500/20 text-orange-300 rounded-none'
                      : 'bg-orange-100 text-orange-700 rounded-none'
                    : !isFuture && isDark
                    ? 'hover:bg-slate-800 text-slate-200'
                    : !isFuture
                    ? 'hover:bg-slate-100 text-slate-700'
                    : ''
                }`}
              >
                {format(d, 'd')}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const isNextMonthDisabled = isAfter(startOfMonth(addMonths(currentMonth, 1)), startOfDay(effectiveMaxDate));

  return (
    <div className={`p-3 rounded-2xl select-none border transition-all ${
      isDark 
        ? 'bg-slate-900 text-white border-slate-800 shadow-2xl shadow-black/60' 
        : 'bg-white text-slate-900 border-slate-200 shadow-xl shadow-slate-200'
    }`}>
      {/* Top Controls */}
      <div className={`flex items-center justify-between mb-2 pb-2 border-b ${
        isDark ? 'border-slate-800 text-slate-300' : 'border-slate-100 text-slate-700'
      }`}>
        <button
          type="button"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className={`p-1 rounded-lg border transition-colors ${
            isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-600'
          }`}
          title="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex flex-col items-center">
          <span className="text-xs font-bold">{format(currentMonth, 'MMMM yyyy')}</span>
          <span className="text-[10px] font-mono text-orange-500 font-semibold">
            {range?.from ? format(range.from, 'MMM dd') : t('calendar.startDate', 'Start')} 
            {' ~ '} 
            {range?.to ? format(range.to, 'MMM dd') : t('calendar.endDate', 'End')}
          </span>
        </div>
        <button
          type="button"
          disabled={isNextMonthDisabled}
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className={`p-1 rounded-lg border transition-colors ${
            isNextMonthDisabled
              ? 'opacity-20 cursor-not-allowed border-transparent text-slate-500'
              : isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-600'
          }`}
          title="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Calendar Month Display */}
      <div className="flex flex-col sm:flex-row gap-2 justify-center items-center">
        {renderMonth(currentMonth)}
      </div>

      {/* Footer Controls */}
      <div className={`flex items-center justify-between pt-3 mt-2 border-t ${
        isDark ? 'border-slate-800' : 'border-slate-100'
      }`}>
        <button
          type="button"
          onClick={() => {
            setRange(undefined);
            if (onSelect) onSelect(undefined);
          }}
          className="px-2 py-1 text-xs text-rose-500 hover:underline font-medium cursor-pointer"
        >
          {t('calendar.clear', 'Clear')}
        </button>

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                isDark 
                  ? 'border-slate-700 text-slate-300 hover:bg-slate-800' 
                  : 'border-slate-300 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t('calendar.cancel', 'Cancel')}
            </button>
          )}
          
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            {t('calendar.done', 'Done')}
          </button>
        </div>
      </div>
    </div>
  );
};

export { DateRangePicker } from './date-range-picker';
