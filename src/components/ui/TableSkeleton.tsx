import React from 'react';
import { cn } from '@/lib/utils';

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showSummaryCards?: boolean;
  showSearchFilter?: boolean;
  theme?: 'light' | 'dark';
  className?: string;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 8,
  columns = 6,
  showSummaryCards = false,
  showSearchFilter = false,
  theme = 'dark',
  className,
}) => {
  const columnWidths = [
    'w-24 sm:w-32', // Code / ID
    'w-32 sm:w-48', // Primary Title / Name
    'w-20 sm:w-28', // Date / Category
    'w-16 sm:w-24', // Status pill badge
    'w-24 sm:w-36', // Numeric Amount / Balance
    'w-12 sm:w-20', // Action buttons
    'w-28 sm:w-40', // Extra column if >6
    'w-20 sm:w-32',
  ];

  const isDark = theme === 'dark';

  return (
    <div className={cn("w-full space-y-6 animate-pulse", className)}>
      {/* Optional Top Summary Cards Skeleton (4 Cards) */}
      {showSummaryCards && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className={cn(
                "p-4 rounded-2xl border flex flex-col justify-between h-28 space-y-3",
                isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-100 border-slate-200"
              )}
            >
              <div className="flex items-center justify-between">
                <div className={cn("h-4 rounded-full w-24", isDark ? "bg-slate-800" : "bg-slate-300")} />
                <div className={cn("h-7 w-7 rounded-xl", isDark ? "bg-slate-800" : "bg-slate-300")} />
              </div>
              <div className="space-y-2">
                <div className={cn("h-6 rounded-full w-32", isDark ? "bg-slate-700/80" : "bg-slate-400/80")} />
                <div className={cn("h-2 rounded-full w-full", isDark ? "bg-slate-800" : "bg-slate-300")} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Optional Search & Filter Bar Skeleton */}
      {showSearchFilter && (
        <div className={cn(
          "p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4",
          isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-100 border-slate-200"
        )}>
          <div className={cn("h-10 rounded-xl w-full sm:w-72", isDark ? "bg-slate-800" : "bg-slate-300")} />
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <div className={cn("h-10 rounded-xl w-28", isDark ? "bg-slate-800" : "bg-slate-300")} />
            <div className={cn("h-10 rounded-xl w-28", isDark ? "bg-slate-800" : "bg-slate-300")} />
            <div className={cn("h-10 rounded-xl w-24", isDark ? "bg-slate-800" : "bg-slate-300")} />
          </div>
        </div>
      )}

      {/* Main Table Structure Skeleton */}
      <div className={cn(
        "rounded-2xl border overflow-hidden shadow-sm",
        isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200"
      )}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse">
            {/* Table Header Skeleton */}
            <thead>
              <tr className={cn(
                "border-b",
                isDark ? "border-slate-800 bg-slate-950/60" : "border-slate-200 bg-slate-50"
              )}>
                {Array.from({ length: columns }).map((_, cIdx) => (
                  <th key={cIdx} className="py-4 px-4 text-left">
                    <div
                      className={cn(
                        "h-4 rounded-md",
                        columnWidths[cIdx % columnWidths.length],
                        isDark ? "bg-slate-800" : "bg-slate-300"
                      )}
                    />
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body Skeleton Rows */}
            <tbody className={cn("divide-y", isDark ? "divide-slate-800/60" : "divide-slate-100")}>
              {Array.from({ length: rows }).map((_, rIdx) => (
                <tr
                  key={rIdx}
                  className={cn(
                    "transition-colors",
                    isDark
                      ? rIdx % 2 === 0
                        ? "bg-slate-900/40"
                        : "bg-slate-900/20"
                      : rIdx % 2 === 0
                      ? "bg-white"
                      : "bg-slate-50/50"
                  )}
                >
                  {Array.from({ length: columns }).map((_, cIdx) => (
                    <td key={cIdx} className="py-4 px-4 align-middle">
                      {cIdx === 3 ? (
                        /* Badge-style column simulation */
                        <div className={cn("h-6 rounded-full w-20", isDark ? "bg-slate-800/80" : "bg-slate-200")} />
                      ) : cIdx === columns - 1 ? (
                        /* Action buttons simulation */
                        <div className="flex items-center gap-2 justify-end">
                          <div className={cn("h-8 w-8 rounded-lg", isDark ? "bg-slate-800/80" : "bg-slate-200")} />
                          <div className={cn("h-8 w-8 rounded-lg", isDark ? "bg-slate-800/80" : "bg-slate-200")} />
                        </div>
                      ) : (
                        /* Standard cell simulation with pills */
                        <div
                          className={cn(
                            "h-4 rounded-full",
                            columnWidths[(cIdx + rIdx) % columnWidths.length],
                            isDark ? "bg-slate-800/80" : "bg-slate-200"
                          )}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TableSkeleton;
