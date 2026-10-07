import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { GRNImageItem } from '../../types';
import api from '../../lib/api';
import { 
  compressImageFile, 
  resolveAttachmentViewUrl, 
  isPdfUrl, 
  isPdfDocument,
  isRasterImage,
  isGoogleDriveUrl 
} from '../../utils/imageUtils';
import { toast } from 'react-toastify';
import { 
  Plus, Eye, Trash2, Link2, FileText, 
  Loader2, Layers, Image as ImageIcon
} from 'lucide-react';
import { LightboxModal } from '../ui/LightboxModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '../../lib/utils';

export interface GRNAttachmentDropzoneProps {
  /** Array of attached invoice images and documents */
  images: GRNImageItem[];
  /** Change listener called when files are added or removed */
  onChange: (images: GRNImageItem[]) => void;
  /** Maximum number of inline preview tiles before overflowing into +N more tile (default: 4) */
  maxInlineVisible?: number;
  /** Container custom class name */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
}

export type LHDAttachmentDropzoneProps = GRNAttachmentDropzoneProps;
export type RelianceAttachmentDropzoneProps = GRNAttachmentDropzoneProps;

/**
 * Modern Compact Multi-File Attachment Dropzone strictly branded for Liyanage Hardware (LHD).
 * 
 * Features:
 * - Square dashed dropzone tile (w-24 h-24 / w-28 h-28) positioned inline next to bill thumbnails.
 * - Multi-format support: auto-compressed images (WebP via browser-image-compression) & PDF documents.
 * - Global & local Ctrl+V clipboard paste listener for screenshots and Google Drive share links.
 * - +N More overflow indicator tile that launches the "LHD Attachments Gallery" management modal.
 * - Seamless integration with full-screen hover-zoom LightboxModal and direct binary download.
 * - Strict Single-Language Localization via `useTranslation()`.
 */
export const GRNAttachmentDropzone: React.FC<GRNAttachmentDropzoneProps> = ({
  images,
  onChange,
  maxInlineVisible = 4,
  className = '',
  disabled = false,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showUrlDialog, setShowUrlDialog] = useState<boolean>(false);
  const [urlInputValue, setUrlInputValue] = useState<string>('');
  // Explicit document type selector in the URL dialog: 'image' | 'pdf'
  const [docTypeSelection, setDocTypeSelection] = useState<'image' | 'pdf'>('image');
  
  // All Attachments Modal
  const [isAllAttachmentsOpen, setIsAllAttachmentsOpen] = useState<boolean>(false);

  // Lightbox Modal state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);

  // ── Upload & Compression Pipeline ──
  const processAndUploadFiles = useCallback(
    async (rawFiles: FileList | File[]) => {
      const fileArray = Array.from(rawFiles);
      if (fileArray.length === 0) return;

      setIsCompressing(true);
      try {
        const processedFiles: File[] = [];

        for (const file of fileArray) {
          if (file.type.startsWith('image/')) {
            // Compress image using browser-image-compression
            const compressed = await compressImageFile(file, 1800, 1800, 0.82);
            processedFiles.push(compressed);
          } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            // PDFs uploaded directly without alteration
            processedFiles.push(file);
          } else {
            toast.warning(t('attachments.skippedUnsupported', { name: file.name, defaultValue: `Skipped unsupported file: ${file.name}` }));
          }
        }

        if (processedFiles.length === 0) {
          toast.warning(t('attachments.selectValid', 'Please select valid images (JPG, PNG, WebP) or PDF documents'));
          return;
        }

        const formData = new FormData();
        processedFiles.forEach((f) => {
          formData.append('images', f);
        });

        const uploadedResults = await api.upload<GRNImageItem[]>('/grns/upload', formData);

        if (Array.isArray(uploadedResults)) {
          const formattedResults: GRNImageItem[] = uploadedResults.map((item) => {
            const isItemPdf = item.isPdf === true || item.mimeType === 'application/pdf' || item.fileType === 'pdf' || isPdfUrl(item);
            return {
              ...item,
              name: item.name,
              fileType: isItemPdf ? 'pdf' : (item.fileType || 'image'),
              isPdf: isItemPdf,
              mimeType: isItemPdf ? 'application/pdf' : item.mimeType,
            };
          });

          onChange([...images, ...formattedResults]);
          toast.success(t('attachments.attachedSuccess', { count: formattedResults.length, defaultValue: `Attached ${formattedResults.length} file(s) to record!` }));
        }
      } catch (err: any) {
        console.error('File upload failed:', err);
        toast.error(err?.message || 'Failed to upload attachments');
      } finally {
        setIsCompressing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [images, onChange, t]
  );

  /**
   * Links a user-supplied external web URL or Google Drive share link.
   * Ensures Google Drive and external PDF links strictly evaluate PDF status without misidentifying images.
   */
  /**
   * Auto-detects PDF from a pasted URL and syncs the docTypeSelection toggle.
   * Called whenever the URL input changes.
   */
  const handleUrlInputChange = useCallback((rawUrl: string) => {
    setUrlInputValue(rawUrl);
    // Auto-flip toggle if pasted URL clearly has a .pdf extension
    const trimmed = rawUrl.trim();
    if (trimmed) {
      const urlLower = trimmed.toLowerCase();
      const cleanPath = urlLower.split('?')[0].split('#')[0];
      const looksLikePdf =
        cleanPath.endsWith('.pdf') ||
        urlLower.includes('format=pdf') ||
        urlLower.includes('mimetype=application%2fpdf') ||
        urlLower.includes('.pdf');
      if (looksLikePdf) {
        setDocTypeSelection('pdf');
      } else if (isRasterImage(trimmed)) {
        setDocTypeSelection('image');
      }
    }
  }, []);

  const handleAddUrlLink = useCallback(
    (customUrl?: string) => {
      const urlToProcess = (customUrl || urlInputValue).trim();
      if (!urlToProcess) return;

      const isDrive = isGoogleDriveUrl(urlToProcess);

      // The user's explicit toggle is the source of truth.
      // Auto-detection is only a fallback when docTypeSelection hasn't been set.
      const urlLower = urlToProcess.toLowerCase();
      const cleanPath = urlLower.split('?')[0].split('#')[0];
      const autoDetectPdf =
        cleanPath.endsWith('.pdf') ||
        urlLower.includes('format=pdf') ||
        urlLower.includes('application%2fpdf');
      const autoDetectImage = isRasterImage(urlToProcess);

      // Resolve whether this is a PDF — explicit toggle wins
      const isPdf =
        docTypeSelection === 'pdf' ||
        (!autoDetectImage && autoDetectPdf);

      // Build display name
      let defaultName: string;
      if (isDrive) {
        defaultName = isPdf ? 'Google Drive PDF Document' : 'Google Drive Image';
      } else if (isPdf) {
        defaultName = 'Web PDF Document';
      } else {
        defaultName = 'External Bill Image';
      }

      const newAttachment: GRNImageItem = {
        url: urlToProcess,
        name: defaultName,
        source: isDrive ? 'gdrive' : 'url',
        fileType: isPdf ? 'pdf' : 'image',
        isPdf: isPdf,
        mimeType: isPdf ? 'application/pdf' : 'image/jpeg',
      };

      onChange([...images, newAttachment]);
      setUrlInputValue('');
      setDocTypeSelection('image');
      setShowUrlDialog(false);
      toast.success(
        isDrive
          ? t('attachments.gdriveLinked', 'Google Drive link added to record!')
          : t('attachments.linkAttached', 'Link attached successfully!')
      );
    },
    [images, onChange, urlInputValue, docTypeSelection, t]
  );

  // ── Clipboard Paste (Ctrl+V) Global & Local Listener ──
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      // Do not intercept if user is typing in standard text inputs
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') &&
        activeEl !== dropzoneRef.current
      ) {
        return;
      }

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      // 1. Check for clipboard binary files (e.g. Snipping tool, copied PDF)
      const items = clipboardData.items;
      const filesFromClipboard: File[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/') || item.type === 'application/pdf') {
          const file = item.getAsFile();
          if (file) filesFromClipboard.push(file);
        }
      }

      if (filesFromClipboard.length > 0) {
        e.preventDefault();
        processAndUploadFiles(filesFromClipboard);
        return;
      }

      // 2. Check for pasted URL text
      const pastedText = clipboardData.getData('text');
      if (
        pastedText &&
        (pastedText.startsWith('http://') ||
          pastedText.startsWith('https://') ||
          pastedText.includes('drive.google.com'))
      ) {
        e.preventDefault();
        handleAddUrlLink(pastedText.trim());
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processAndUploadFiles, handleAddUrlLink]);

  // ── Drag and Drop handlers ──
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isCompressing) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled || isCompressing) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processAndUploadFiles(e.dataTransfer.files);
      return;
    }

    const textData = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');
    if (textData && (textData.startsWith('http://') || textData.startsWith('https://'))) {
      handleAddUrlLink(textData.trim());
    }
  };

  const removeAttachment = (indexToRemove: number) => {
    onChange(images.filter((_, idx) => idx !== indexToRemove));
  };

  // Compute inline thumbnails vs overflow count
  const visibleInlineImages = images.slice(0, maxInlineVisible);
  const overflowCount = images.length - maxInlineVisible;

  return (
    <div className={cn('space-y-2', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        disabled={disabled || isCompressing}
        onChange={(e) => {
          if (e.target.files) processAndUploadFiles(e.target.files);
        }}
      />

      {/* Header bar */}
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-orange-500" />
          {t('attachments.attachedBills', { count: images.length, defaultValue: `Attached Bills & Receipts (${images.length})` })}
        </label>
        <button
          type="button"
          onClick={() => setShowUrlDialog(true)}
          className={cn(
            'text-[11px] font-medium flex items-center gap-1 text-orange-400 hover:text-orange-300 transition-colors',
            disabled && 'opacity-50 pointer-events-none'
          )}
        >
          <Link2 className="w-3 h-3" />
          {t('attachments.addDriveOrWeb', 'Add Drive / Web Link')}
        </button>
      </div>

      {/* Inline Layout: Dropzone Tile alongside Thumbnails */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* ── Compact Square Dropzone Tile ── */}
        <div
          ref={dropzoneRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => {
            if (!isCompressing && !disabled) fileInputRef.current?.click();
          }}
          className={cn(
            'w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 select-none shrink-0 group relative overflow-hidden',
            isDragging
              ? 'border-orange-500 bg-orange-500/15 scale-105 shadow-lg shadow-orange-500/20'
              : isDark
              ? 'border-slate-700/80 bg-slate-950/60 hover:border-orange-500/70 hover:bg-slate-900/80'
              : 'border-slate-300 bg-slate-50 hover:border-orange-500/70 hover:bg-orange-50/40 shadow-sm',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          title={t('attachments.uploadFile', 'Upload File')}
        >
          {isCompressing ? (
            <div className="flex flex-col items-center gap-1 p-1">
              <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
              <span className="text-[10px] font-bold text-orange-400">{t('attachments.uploading', 'Uploading...')}</span>
            </div>
          ) : (
            <>
              <div
                className={cn(
                  'w-8 h-8 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 mb-1',
                  isDark ? 'bg-slate-800 text-orange-400' : 'bg-orange-100 text-orange-600'
                )}
              >
                <Plus className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold text-slate-200 leading-tight">
                {t('attachments.uploadFile', 'Upload File')}
              </span>
              <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                {t('attachments.orPaste', 'or Ctrl+V')}
              </span>
            </>
          )}
        </div>

        {/* ── Inline Thumbnails ── */}
        {visibleInlineImages.map((img, idx) => {
          const isPdf = !isRasterImage(img) && (img.isPdf === true || img.mimeType === 'application/pdf' || isPdfDocument(img));
          const resolvedUrl = resolveAttachmentViewUrl(img.url, isPdf);
          const isDrive = img.source === 'gdrive' || isGoogleDriveUrl(img.url);

          return (
            <div
              key={idx}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border border-slate-700/70 bg-slate-900 relative overflow-hidden group shadow-sm transition-all hover:border-orange-500/80 shrink-0"
            >
              {isPdf ? (
                <div 
                  onClick={() => setLightboxIndex(idx)}
                  className="w-full h-full bg-slate-950 flex flex-col items-center justify-center p-2 cursor-pointer text-center"
                >
                  <FileText className="w-8 h-8 text-rose-400 mb-1" />
                  <span className="text-[9px] font-bold text-slate-300 truncate max-w-full px-1">
                    {img.name || 'Invoice PDF'}
                  </span>
                  <span className="text-[8px] font-mono font-semibold text-rose-400 bg-rose-500/10 px-1.5 py-0.2 rounded mt-0.5">
                    PDF DOC
                  </span>
                </div>
              ) : (
                <img
                  src={resolvedUrl}
                  alt={img.name || `Invoice ${idx + 1}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 cursor-pointer"
                  onClick={() => setLightboxIndex(idx)}
                />
              )}

              {/* Badges */}
              {isDrive && (
                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-500/90 text-slate-950 font-mono pointer-events-none shadow">
                  Drive
                </span>
              )}

              {/* Hover action overlay */}
              <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1">
                <button
                  type="button"
                  onClick={() => setLightboxIndex(idx)}
                  className="p-1.5 rounded-lg bg-slate-800/90 text-white hover:bg-orange-500 transition-colors shadow"
                  title={t('attachments.inspectFullscreen', 'Inspect Fullscreen')}
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="p-1.5 rounded-lg bg-slate-800/90 text-rose-400 hover:bg-rose-500 hover:text-white transition-colors shadow"
                    title={t('attachments.removeAttachment', 'Remove attachment')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* ── +N More Collapse Indicator Tile ── */}
        {overflowCount > 0 && (
          <button
            type="button"
            onClick={() => setIsAllAttachmentsOpen(true)}
            className={cn(
              'w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 shrink-0 group relative overflow-hidden',
              isDark
                ? 'bg-slate-900/90 border-slate-700 hover:border-orange-500 hover:bg-slate-800'
                : 'bg-slate-100 border-slate-300 hover:border-orange-500 hover:bg-slate-200 shadow-sm'
            )}
          >
            <span className="text-lg font-black text-orange-400 group-hover:scale-110 transition-transform">
              +{overflowCount}
            </span>
            <span className="text-[10px] font-bold text-slate-300 mt-0.5">
              {t('attachments.moreFiles', 'More Files')}
            </span>
            <span className="text-[9px] text-slate-400">
              {t('attachments.viewAll', { count: images.length, defaultValue: `View All (${images.length})` })}
            </span>
          </button>
        )}
      </div>

      {/* ── ALL ATTACHMENTS OVERFLOW MODAL ── */}
      <Dialog open={isAllAttachmentsOpen} onOpenChange={setIsAllAttachmentsOpen}>
        <DialogContent
          className={cn(
            'sm:max-w-2xl max-h-[85vh] overflow-y-auto p-0 gap-0 rounded-2xl border shadow-2xl',
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          )}
        >
          <DialogHeader
            className={cn(
              'px-5 py-3.5 border-b flex flex-row items-center justify-between',
              isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50'
            )}
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold tracking-tight">
                  {t('attachments.galleryTitle', { count: images.length, defaultValue: `Attached Receipts & Invoices (${images.length})` })}
                </DialogTitle>
                <DialogDescription className="text-[11px] text-slate-400 mt-0.5">
                  {t('attachments.galleryDesc', 'Manage, preview, and download attached invoice documents')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {images.map((img, idx) => {
                const isPdf = !isRasterImage(img) && (img.isPdf === true || img.mimeType === 'application/pdf' || isPdfDocument(img));
                const resolvedUrl = resolveAttachmentViewUrl(img.url, isPdf);

                return (
                  <div
                    key={idx}
                    className="relative rounded-2xl border border-slate-700/70 bg-slate-950 aspect-square overflow-hidden group shadow transition-all hover:border-orange-500"
                  >
                    {isPdf ? (
                      <div 
                        onClick={() => {
                          setIsAllAttachmentsOpen(false);
                          setLightboxIndex(idx);
                        }}
                        className="w-full h-full flex flex-col items-center justify-center p-3 cursor-pointer text-center"
                      >
                        <FileText className="w-8 h-8 text-rose-400 mb-1" />
                        <span className="text-[10px] font-bold text-slate-200 truncate max-w-full px-1">
                          {img.name || `Document #${idx + 1}`}
                        </span>
                        <span className="text-[9px] font-mono text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded mt-1">
                          PDF FILE
                        </span>
                      </div>
                    ) : (
                      <img
                        src={resolvedUrl}
                        alt={img.name || `Attachment ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform"
                        onClick={() => {
                          setIsAllAttachmentsOpen(false);
                          setLightboxIndex(idx);
                        }}
                      />
                    )}

                    <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAllAttachmentsOpen(false);
                          setLightboxIndex(idx);
                        }}
                        className="p-2 rounded-xl bg-slate-800 text-white hover:bg-orange-500 transition-colors shadow"
                        title={t('attachments.inspectFullscreen', 'Inspect Fullscreen')}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {!disabled && (
                        <button
                          type="button"
                          onClick={() => removeAttachment(idx)}
                          className="p-2 rounded-xl bg-slate-800 text-rose-400 hover:bg-rose-500 hover:text-white transition-colors shadow"
                          title={t('attachments.removeAttachment', 'Remove attachment')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── GOOGLE DRIVE / URL INPUT DIALOG ── */}
      <Dialog
        open={showUrlDialog}
        onOpenChange={(open) => {
          setShowUrlDialog(open);
          if (!open) {
            setUrlInputValue('');
            setDocTypeSelection('image');
          }
        }}
      >
        <DialogContent
          className={cn(
            'sm:max-w-md p-0 gap-0 rounded-2xl border shadow-2xl',
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          )}
        >
          <DialogHeader
            className={cn(
              'px-5 py-3.5 border-b flex flex-row items-center justify-between',
              isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50'
            )}
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
                <Link2 className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold tracking-tight">
                  {t('attachments.addLinkTitle', 'Attach Document URL or Drive Link')}
                </DialogTitle>
                <DialogDescription className="text-[11px] text-slate-400 mt-0.5">
                  {t('attachments.addLinkDesc', 'Paste a public Google Drive sharing link, direct image URL, or PDF link')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-5 space-y-4">
            {/* ── Document Type Toggle ── */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                {t('grn.documentType', 'DOCUMENT TYPE')}
              </label>
              <div
                className={cn(
                  'flex items-center rounded-xl p-1 gap-1 border',
                  isDark ? 'bg-slate-950 border-slate-700' : 'bg-slate-100 border-slate-200'
                )}
              >
                <button
                  type="button"
                  onClick={() => setDocTypeSelection('image')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150',
                    docTypeSelection === 'image'
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                      : isDark
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-white'
                  )}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  {t('grn.imageType', 'Image')}
                </button>
                <button
                  type="button"
                  onClick={() => setDocTypeSelection('pdf')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150',
                    docTypeSelection === 'pdf'
                      ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30'
                      : isDark
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-white'
                  )}
                >
                  <FileText className="w-3.5 h-3.5" />
                  {t('grn.pdfDocumentType', 'PDF Document')}
                </button>
              </div>
              {/* Context hint under toggle */}
              <p className={cn('text-[10px] mt-1.5 font-medium', docTypeSelection === 'pdf' ? 'text-rose-400' : 'text-slate-500')}>
                {docTypeSelection === 'pdf'
                  ? t('grn.pdfViewerNotice', 'Will be opened as an interactive multi-page PDF viewer')
                  : t('grn.imageViewerNotice', 'Will be opened as a zoomable image')}
              </p>
            </div>

            {/* ── URL Input ── */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                {t('grn.documentOrImageUrl', 'DOCUMENT / IMAGE URL')}
              </label>
              <input
                type="url"
                autoFocus
                placeholder={t('attachments.urlPlaceholder', 'Paste Google Drive, Dropbox, or public file URL...')}
                value={urlInputValue}
                onChange={(e) => handleUrlInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddUrlLink();
                  }
                }}
                className={cn(
                  'w-full h-9 px-3 rounded-xl border text-xs font-medium focus:outline-none focus:ring-1 transition-all',
                  isDark
                    ? 'border-slate-700 bg-slate-950 text-white focus:border-orange-500 focus:ring-orange-500/30'
                    : 'border-slate-300 bg-white text-slate-900 focus:border-orange-500 focus:ring-orange-500/20'
                )}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowUrlDialog(false)}
                className={cn(
                  'px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors',
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                )}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => handleAddUrlLink()}
                disabled={!urlInputValue.trim()}
                className={cn(
                  'px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50 transition-all shadow-md text-white',
                  docTypeSelection === 'pdf'
                    ? 'bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700'
                    : 'bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600'
                )}
              >
                {docTypeSelection === 'pdf'
                  ? t('grn.attachPdf', 'Attach PDF')
                  : t('grn.attachImage', 'Attach Image')}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── FULL-SCREEN HOVER-ZOOM LIGHTBOX MODAL ── */}
      {lightboxIndex !== null && (
        <LightboxModal
          items={images.map((img) => {
            // Honor explicit isPdf flag and mimeType first; fall back to URL heuristics
            const isPdf = !isRasterImage(img) && (img.isPdf === true || img.mimeType === 'application/pdf' || isPdfDocument(img));
            // Strip any accidental "(PDF)" text from image item names
            const cleanName = !isPdf && img.name
              ? img.name.replace(/\s*\(PDF\)\s*/gi, '').trim()
              : img.name;
            return {
              ...img,
              name: cleanName,
              mimeType: isPdf ? 'application/pdf' : (img.mimeType || 'image/jpeg'),
              fileType: isPdf ? 'pdf' : (img.fileType || 'image'),
              isPdf: isPdf,
            };
          })}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
};

export const LHDAttachmentDropzone = GRNAttachmentDropzone;
export const RelianceAttachmentDropzone = GRNAttachmentDropzone;

export default GRNAttachmentDropzone;

