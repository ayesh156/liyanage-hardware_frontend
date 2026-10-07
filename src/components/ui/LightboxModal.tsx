import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { 
  X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, 
  ExternalLink, FileText, RotateCcw, Sparkles, Move, Loader2
} from 'lucide-react';
import { GRNImageItem } from '../../types';
import { 
  resolveAttachmentViewUrl, 
  resolveAttachmentDownloadUrl, 
  extractGoogleDriveFileId, 
  isPdfUrl,
  isRasterImage,
  isPdfDocument
} from '../../utils/imageUtils';
import { cn } from '../../lib/utils';
import { toast } from 'react-toastify';

export interface LightboxModalProps {
  /** Array of attachment items to preview (images or PDFs) */
  items: (GRNImageItem | string)[];
  /** Currently active index */
  initialIndex: number;
  /** Callback fired when the lightbox is closed */
  onClose: () => void;
}

/**
 * True Fullscreen Viewport Immersion Lightbox & Document Viewer for LHD.
 * 
 * Architectural Highlights:
 * - Decoupled Portal Layer: Renders into `document.body` with max z-index (`z-[999999]`) and explicit `pointer-events: auto`
 *   to bypass parent modal focus traps (e.g. Radix UI Dialog / FocusScope).
 * - Capturing-Phase Keyboard Interception: Intercepts `Escape` at the capturing phase to prevent bubbling to parent dialogs.
 * - Edge-to-Edge Viewport Canvas: 100% viewport fill below the slim toolbar.
 * - Direct Binary Download Pipeline: Direct blob streams for Google Drive images & PDFs.
 * - Pan & Zoom Gestures: Supports 0.5x–3.0x magnification with boundary-clamped drag-to-pan.
 * - Strict Single-Language Localization: Fully internationalized with `useTranslation()`.
 */
export const LightboxModal: React.FC<LightboxModalProps> = ({
  items,
  initialIndex,
  onClose,
}) => {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize list to standard GRNImageItem objects with strict document type detection
  const normalizedItems: GRNImageItem[] = React.useMemo(() => {
    return items.map((it) => {
      if (typeof it === 'string') {
        const isImg = isRasterImage(it);
        const isPdf = !isImg && isPdfDocument(it);
        return {
          url: it,
          name: isPdf ? 'Invoice Document' : 'Receipt Image',
          fileType: isPdf ? 'pdf' : 'image',
          isPdf: isPdf,
          mimeType: isPdf ? 'application/pdf' : undefined,
        };
      }
      // Strict detection: images take absolute priority
      const isImg = isRasterImage(it);
      const isDocPdf = !isImg && (it.isPdf === true || it.mimeType === 'application/pdf' || it.fileType === 'pdf' || isPdfDocument(it));
      // Strip any stray "(PDF)" from image display names
      const cleanName = !isDocPdf && it.name
        ? it.name.replace(/\s*\(PDF\)\s*/gi, '').trim()
        : it.name;
      return {
        ...it,
        name: cleanName,
        fileType: isDocPdf ? 'pdf' : (it.fileType || 'image'),
        isPdf: isDocPdf,
        mimeType: isDocPdf ? 'application/pdf' : it.mimeType,
      };
    });
  }, [items]);

  const activeItem = normalizedItems[currentIndex] || normalizedItems[0];
  const rawUrl = activeItem?.url || '';
  // Images take absolute priority: only mark as PDF if it's NOT a raster image
  // Also trust the normalizedItem's already-resolved isPdf flag (set from explicit metadata)
  const isPdf = !isRasterImage(activeItem) && (activeItem?.isPdf === true || activeItem?.mimeType === 'application/pdf' || isPdfDocument(activeItem));
  const fileId = extractGoogleDriveFileId(rawUrl);

  // Direct URLs: Preview vs Download
  const previewUrl = resolveAttachmentViewUrl(rawUrl, isPdf);
  const downloadUrl = resolveAttachmentDownloadUrl(rawUrl);

  // Focus container on mount to establish focus priority outside parent dialog trap
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // Reset zoom & pan on slide change
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
  }, [currentIndex]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(3.0, +(prev + 0.25).toFixed(2)));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => {
      const next = Math.max(0.5, +(prev - 0.25).toFixed(2));
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  /**
   * Capturing-Phase Keyboard Event Interceptor.
   * 
   * Captures the `Escape` key at the capture phase (`useCapture: true`) and terminates
   * propagation via `stopPropagation()` and `stopImmediatePropagation()` so parent modals
   * (e.g. GRNFormModal, Radix Dialog) do NOT receive the event or inadvertently close.
   */
  useEffect(() => {
    const handleKeyDownCapture = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : normalizedItems.length - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        setCurrentIndex((prev) => (prev < normalizedItems.length - 1 ? prev + 1 : 0));
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        e.stopPropagation();
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        e.stopPropagation();
        handleZoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        e.stopPropagation();
        handleResetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDownCapture, true);
    return () => window.removeEventListener('keydown', handleKeyDownCapture, true);
  }, [normalizedItems.length, onClose, handleZoomIn, handleZoomOut, handleResetZoom]);

  /**
   * Programmatic client-side binary Blob download handler.
   * For Google Drive and local documents, streams binary blob via `https://drive.google.com/uc?export=download&id=${fileId}`
   * while showing an active loading spinner, then triggers immediate programmatic file saving.
   */
  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!downloadUrl) return;
    setIsDownloading(true);

    const defaultExt = isPdf ? '.pdf' : '.webp';
    const fallbackName = `liyanage-document-${currentIndex + 1}${defaultExt}`;
    let filename = activeItem.name || fallbackName;
    if (!filename.toLowerCase().endsWith('.pdf') && !filename.toLowerCase().endsWith('.webp') && !filename.toLowerCase().endsWith('.png') && !filename.toLowerCase().endsWith('.jpg') && !filename.toLowerCase().endsWith('.jpeg')) {
      filename += defaultExt;
    }

    try {
      const res = await fetch(downloadUrl, { referrerPolicy: 'no-referrer' });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast.success(t('lightbox.downloadStarted', 'Download started'));
    } catch {
      // Direct stream fallback for cross-origin restricted downloads
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsDownloading(false);
    }
  };

  // Drag-to-pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1 || isPdf) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoom <= 1 || isPdf) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    const maxOffset = 500 * (zoom - 1);
    setPan({
      x: Math.max(-maxOffset, Math.min(maxOffset, newX)),
      y: Math.max(-maxOffset, Math.min(maxOffset, newY)),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!activeItem) return null;

  const lightboxContent = (
    <div 
      id="lhd-lightbox-root"
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      className="fixed inset-0 w-screen h-screen z-[999999] pointer-events-auto m-0 p-0 flex flex-col bg-black/95 overflow-hidden select-none animate-in fade-in duration-200 outline-none"
      style={{ pointerEvents: 'auto', isolation: 'isolate' }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      {/* ── Slim Top Toolbar ── */}
      <div 
        className="w-full h-12 sm:h-14 px-4 sm:px-6 flex items-center justify-between border-b border-white/10 bg-black/80 backdrop-blur-xl z-20 shrink-0 pointer-events-auto"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
            {isPdf ? <FileText className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
              {(() => {
                if (activeItem.name && activeItem.name !== 'Google Drive Document') {
                  return activeItem.name;
                }
                if (isPdf) {
                  return t('lightbox.lhdInvoicePdf', 'Invoice Document (PDF)');
                }
                return t('lightbox.lhdReceiptImage', 'Receipt Image');
              })()}
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">
              {t('lightbox.itemOf', { current: currentIndex + 1, total: normalizedItems.length })} {isPdf ? `• ${t('lightbox.pdfDocument', 'PDF Document')}` : `• ${t('lightbox.imagePreview', 'Image Preview')}`}
            </p>
          </div>
        </div>

        {/* ── Stabilized Static Zoom Controls & Action Toolbar ── */}
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
          {!isPdf && (
            <div className="flex items-center bg-slate-900/90 rounded-xl p-0.5 sm:p-1 border border-white/10 shadow-lg pointer-events-auto">
              {/* 1. Reset (1:1) Button on far left */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleResetZoom();
                }}
                disabled={zoom === 1}
                className="p-1 sm:p-1.5 rounded-lg text-slate-300 hover:text-orange-400 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors pointer-events-auto"
                title={t('lightbox.resetZoom', 'Reset to 1:1')}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {/* 2. Zoom Out Button (-) */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleZoomOut();
                }}
                disabled={zoom <= 0.5}
                className="p-1 sm:p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors pointer-events-auto"
                title={t('lightbox.zoomOut', 'Zoom Out')}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              
              {/* 3. Static min-w percentage display */}
              <div 
                className="min-w-[44px] text-center px-1 py-0.5 text-xs font-mono font-bold text-orange-400 select-none cursor-default"
                title={t('lightbox.currentZoom', 'Current Zoom Level')}
              >
                {Math.round(zoom * 100)}%
              </div>

              {/* 4. Zoom In Button (+) */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleZoomIn();
                }}
                disabled={zoom >= 3.0}
                className="p-1 sm:p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors pointer-events-auto"
                title={t('lightbox.zoomIn', 'Zoom In')}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Download Button */}
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-900/80 border border-white/10 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-60 disabled:cursor-not-allowed transition-colors pointer-events-auto"
            title={isDownloading ? t('lightbox.downloading', 'Downloading file...') : t('lightbox.downloadDoc', 'Download Document directly to disk')}
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>

          {/* Open original file in new browser tab */}
          <a
            href={previewUrl || rawUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-900/80 border border-white/10 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors pointer-events-auto"
            title={t('lightbox.openNewTab', 'Open original file in new browser tab')}
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Close button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="p-1.5 sm:p-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500 hover:text-white transition-all shadow-md pointer-events-auto"
            title={t('lightbox.close', 'Close Lightbox (ESC)')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Main Viewport Area (100% Height Fill Without Outer Gutters) ── */}
      <div 
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={cn(
          "flex-1 relative w-full h-full flex items-center justify-center p-0 m-0 overflow-hidden select-none pointer-events-auto",
          zoom > 1 && !isPdf ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
        )}
      >
        {/* Previous Navigation Button */}
        {normalizedItems.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setCurrentIndex((prev) => (prev > 0 ? prev - 1 : normalizedItems.length - 1));
            }}
            className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-30 p-2.5 sm:p-3 rounded-2xl bg-black/70 hover:bg-orange-500 border border-white/10 text-white transition-all hover:scale-110 shadow-2xl backdrop-blur-md pointer-events-auto"
            title={t('lightbox.prev', 'Previous')}
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )}

        {/* Content Viewer (Image vs PDF) */}
        {isPdf ? (
          <div 
            className="w-full h-full flex flex-col p-1 sm:p-3 bg-black pointer-events-auto"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {fileId ? (
              <iframe
                src={`https://drive.google.com/file/d/${fileId}/preview`}
                className="w-full h-full border-0 rounded-xl bg-slate-900"
                title={activeItem.name || 'PDF Document'}
                allow="autoplay"
              />
            ) : (
              <iframe
                src={`${previewUrl || rawUrl}#toolbar=1`}
                className="w-full h-full border-0 rounded-xl bg-slate-900"
                title={activeItem.name || 'PDF Document'}
              />
            )}
          </div>
        ) : (
          <div 
            className="w-full h-full flex items-center justify-center p-0 m-0 overflow-hidden pointer-events-auto"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (zoom === 1) {
                handleZoomIn();
              } else {
                handleResetZoom();
              }
            }}
          >
            <img
              src={previewUrl}
              alt={activeItem.name || 'Attachment Document'}
              referrerPolicy="no-referrer"
              draggable={false}
              className="max-w-full max-h-full object-contain pointer-events-none transition-transform duration-75 ease-out"
              style={{
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              }}
            />

            {/* Hint pill when zoomed */}
            {zoom > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/80 border border-white/20 text-[11px] font-medium text-slate-300 backdrop-blur-md pointer-events-none flex items-center gap-1.5 shadow-xl">
                <Move className="w-3.5 h-3.5 text-orange-400" />
                {t('lightbox.panHint', 'Click & drag to pan • Double click to reset')}
              </div>
            )}
          </div>
        )}

        {/* Next Navigation Button */}
        {normalizedItems.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setCurrentIndex((prev) => (prev < normalizedItems.length - 1 ? prev + 1 : 0));
            }}
            className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-30 p-2.5 sm:p-3 rounded-2xl bg-black/70 hover:bg-orange-500 border border-white/10 text-white transition-all hover:scale-110 shadow-2xl backdrop-blur-md pointer-events-auto"
            title={t('lightbox.next', 'Next')}
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )}
      </div>

      {/* ── Bottom Filmstrip Thumbnail Strip ── */}
      {normalizedItems.length > 1 && (
        <div 
          className="w-full h-16 px-4 py-1.5 border-t border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-center gap-2 overflow-x-auto z-20 shrink-0 pointer-events-auto"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {normalizedItems.map((item, idx) => {
            const isItemPdf = !isRasterImage(item) && (item.isPdf === true || item.mimeType === 'application/pdf' || isPdfDocument(item));
            const thumbUrl = resolveAttachmentViewUrl(item.url, isItemPdf);
            const isSelected = idx === currentIndex;

            return (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={cn(
                  'relative w-12 h-12 rounded-xl overflow-hidden border-2 transition-all shrink-0 group pointer-events-auto',
                  isSelected
                    ? 'border-orange-500 scale-105 shadow-lg shadow-orange-500/25 ring-2 ring-orange-500/30'
                    : 'border-white/10 opacity-60 hover:opacity-100 hover:border-white/30'
                )}
              >
                {isItemPdf ? (
                  <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center text-rose-400 p-0.5">
                    <FileText className="w-4 h-4 mb-0.5" />
                    <span className="text-[7px] font-bold font-mono uppercase">PDF</span>
                  </div>
                ) : (
                  <img
                    src={thumbUrl}
                    alt={`Thumbnail ${idx + 1}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                )}
                <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-black/80 font-mono text-[7px] text-white">
                  {idx + 1}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  /**
   * Decoupled Portal Mount Wrapper.
   * Renders the Lightbox root directly into document.body to break free
   * from any parent modal stacking context, overflow clipping, or FocusScope.
   */
  return typeof document !== 'undefined' ? createPortal(lightboxContent, document.body) : lightboxContent;
};

export default LightboxModal;


