import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

export interface SmartNumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  /** Value as string or number */
  value: string | number;
  /** Callback fired on change with string */
  onChange: (value: string) => void;
  /** Fallback default restored when input is left empty on blur (default: '0') */
  defaultValueOnEmpty?: string;
  /** Currency / Unit prefix e.g. 'Rs.' */
  prefix?: string;
  /** Additional container / wrapper class */
  containerClassName?: string;
}

/**
 * Smart Numeric Input with Auto-Clear on Focus and Default Restoration on Blur.
 * 
 * Features:
 * - `onFocus`: If current value is `0`, `'0'`, or `'0.00'`, clears the value automatically for instant typing without manual backspacing.
 * - `onBlur`: If left completely blank, restores `defaultValueOnEmpty` (e.g. `'0'` or `'1'`).
 * - Supports clean prefix (e.g. `Rs.`) and theme styling.
 */
export const SmartNumberInput: React.FC<SmartNumberInputProps> = ({
  value,
  onChange,
  defaultValueOnEmpty = '0',
  prefix,
  containerClassName,
  className,
  onFocus,
  onBlur,
  ...props
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [internalVal, setInternalVal] = useState<string>(String(value ?? ''));

  useEffect(() => {
    setInternalVal(String(value ?? ''));
  }, [value]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const v = internalVal.trim();
    if (v === '0' || v === '0.00' || v === '0.0') {
      setInternalVal('');
      onChange('');
    } else {
      e.target.select();
    }
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (internalVal.trim() === '') {
      setInternalVal(defaultValueOnEmpty);
      onChange(defaultValueOnEmpty);
    }
    if (onBlur) onBlur(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInternalVal(e.target.value);
    onChange(e.target.value);
  };

  if (prefix) {
    return (
      <div className={cn('relative flex items-center w-full', containerClassName)}>
        <span className="absolute left-3.5 text-xs font-bold text-slate-400 select-none pointer-events-none z-10">
          {prefix}
        </span>
        <input
          {...props}
          type="number"
          value={internalVal}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          className={cn('w-full pr-4', className, '!pl-12')}
        />
      </div>
    );
  }

  return (
    <input
      {...props}
      type="number"
      value={internalVal}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      className={className}
    />
  );
};

export default SmartNumberInput;
