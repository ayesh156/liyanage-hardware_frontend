import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { optimizeCategoryImage } from '../../utils/imageOptimizer';
import { 
  UploadCloud, X, Image as ImageIcon, Loader2, AlertCircle, Check, Link2, RefreshCw
} from 'lucide-react';

interface CategoryImageUploaderProps {
  value?: string | null;
  onChange: (imageUrl: string | null) => void;
  className?: string;
}

export const CategoryImageUploader: React.FC<CategoryImageUploaderProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const isDark = theme === 'dark';

  const [isCompressing, setIsCompressing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [imgLoadError, setImgLoadError] = useState(false);
  const [showSuccessBadge, setShowSuccessBadge] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setImgLoadError(false);
    setErrorMessage(null);
  }, [value]);

  // Process a File or Blob through the image optimizer
  const processImageFile = useCallback(async (file: File | Blob) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (PNG, JPG, WebP, etc.)');
      return;
    }

    try {
      setIsCompressing(true);
      setErrorMessage(null);
      setImgLoadError(false);

      const base64 = await optimizeCategoryImage(file);
      onChange(base64);
      setShowSuccessBadge(true);
      setTimeout(() => setShowSuccessBadge(false), 2200);
    } catch (err: any) {
      console.error('Failed to compress image:', err);
      setErrorMessage(err?.message || 'Failed to compress image');
    } finally {
      setIsCompressing(false);
    }
  }, [onChange]);

  // Handle native file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
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

    // 1. Native File drop (Explorer / Finder / Desktop)
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
      return;
    }

    // 2. URI List drop
    const uriData = e.dataTransfer.getData('text/uri-list');
    if (uriData && (uriData.startsWith('http://') || uriData.startsWith('https://'))) {
      onChange(uriData.trim());
      setShowSuccessBadge(true);
      setTimeout(() => setShowSuccessBadge(false), 2200);
      return;
    }

    // 3. HTML image drag from another web page
    const htmlData = e.dataTransfer.getData('text/html');
    if (htmlData) {
      const match = htmlData.match(/<img[^>]+src=["'](https?:\/\/[^"']+|data:image\/[^"']+)["']/i);
      if (match && match[1]) {
        onChange(match[1]);
        setShowSuccessBadge(true);
        setTimeout(() => setShowSuccessBadge(false), 2200);
        return;
      }
    }

    // 4. Plain text URL drop
    const textData = e.dataTransfer.getData('text/plain');
    if (textData) {
      const trimmed = textData.trim();
      if (
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('data:image/') ||
        trimmed.startsWith('/public/category-img/')
      ) {
        onChange(trimmed);
        setShowSuccessBadge(true);
        setTimeout(() => setShowSuccessBadge(false), 2200);
      }
    }
  };

  // Global & Dropzone Paste Handler (Ctrl+V)
  const handlePaste = useCallback((e: React.ClipboardEvent | ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    // 1. Check for raw image blob in clipboard (Snipping Tool, Google image copy)
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const blob = item.getAsFile();
        if (blob) {
          e.preventDefault();
          processImageFile(blob);
          return;
        }
      }
    }

    // 2. Check for pasted text URL
    const pastedText = e.clipboardData?.getData('text');
    if (pastedText) {
      const trimmed = pastedText.trim();
      if (
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('data:image/') ||
        trimmed.startsWith('/public/category-img/')
      ) {
        e.preventDefault();
        setErrorMessage(null);
        setImgLoadError(false);
        onChange(trimmed);
        setShowSuccessBadge(true);
        setTimeout(() => setShowSuccessBadge(false), 2200);
      }
    }
  }, [onChange, processImageFile]);

  // Window-level paste listener for modal convenience
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Don't intercept paste inside text inputs unless focused in the dropzone
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && target !== dropzoneRef.current) {
        return;
      }
      handlePaste(e);
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [handlePaste]);

  const handleApplyUrl = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('data:image/')) {
      setErrorMessage('Please enter a valid URL starting with http:// or https://');
      return;
    }

    setErrorMessage(null);
    setImgLoadError(false);
    onChange(trimmed);
    setUrlInput('');
    setShowUrlInput(false);
    setShowSuccessBadge(true);
    setTimeout(() => setShowSuccessBadge(false), 2200);
  };

  const handleClearImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setUrlInput('');
    setErrorMessage(null);
    setImgLoadError(false);
  };

  const hasImage = Boolean(value && value.trim() !== '');

  return (
    <div 
      ref={dropzoneRef}
      onPaste={handlePaste}
      tabIndex={0}
      className={`relative focus:outline-none w-full ${className}`}
    >
      {/* ── Section Header ── */}
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-[11px] font-semibold flex items-center gap-1.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
          <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
          {t('categories.categoryImage', 'Category Image')}
        </span>

        {hasImage && (
          <span className="text-[10px] text-emerald-500 font-medium flex items-center gap-1">
            <Check className="w-3 h-3" /> {t('categories.imageActive', 'Image Active')}
          </span>
        )}
      </div>

      {/* ── Hidden Native File Input ── */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* ── State 1: Active Image Preview Card (No Horizontal Scroll) ── */}
      {hasImage && !isCompressing ? (
        <div className={`relative rounded-2xl border overflow-hidden transition-all group ${
          isDark 
            ? 'bg-zinc-950/80 border-slate-700/80 shadow-lg' 
            : 'bg-white border-slate-200 shadow-sm'
        }`}>
          {/* Main Visual Preview Area */}
          <div className={`relative w-full h-44 sm:h-48 overflow-hidden flex items-center justify-center ${
            isDark ? 'bg-black/40' : 'bg-slate-100/80'
          }`}>
            {/* Background Blur Effect */}
            {!imgLoadError && (
              <div 
                className="absolute inset-0 bg-cover bg-center filter blur-lg opacity-25 scale-110"
                style={{ backgroundImage: `url(${value})` }}
              />
            )}

            {/* Foreground Scaled Image */}
            {imgLoadError ? (
              <div className="relative z-10 flex flex-col items-center justify-center p-4 text-center">
                <AlertCircle className="w-8 h-8 text-amber-500 mb-1" />
                <span className={`text-xs font-semibold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                  {t('categories.unableToLoadUrl', 'Unable to load image URL')}
                </span>
                <span className={`text-[10px] mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                  {t('categories.brokenLink', 'The external link may be broken or restricted')}
                </span>
              </div>
            ) : (
              <img
                src={value!}
                alt="Category Preview"
                onError={() => setImgLoadError(true)}
                className="relative z-10 max-h-full max-w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
              />
            )}

            {/* Floating Top-Right Remove Button */}
            <button
              type="button"
              onClick={handleClearImage}
              title="Remove Image"
              className="absolute top-2.5 right-2.5 z-20 p-1.5 rounded-full bg-black/70 hover:bg-rose-600 text-white backdrop-blur-md transition-all shadow-md hover:scale-110 active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Bottom Gradient Overlay */}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10 pointer-events-none" />

            {/* Bottom Overlay Info & Action Bar */}
            <div className="absolute bottom-2 inset-x-2 z-20 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-medium text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <Check className="w-2.5 h-2.5" />
                  {value!.startsWith('data:image') 
                    ? `WebP (${Math.round(value!.length / 1024)} KB)` 
                    : 'Web Image Link'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition-colors flex items-center gap-1 shadow-sm"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  {t('categories.replace', 'Replace')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── State 2: Single Unified Smart Dropzone ── */
        <div className="space-y-2">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isCompressing && fileInputRef.current?.click()}
            className={`relative min-h-[150px] rounded-2xl border-2 border-dashed p-4 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center ${
              isDragging
                ? 'border-emerald-500 bg-emerald-500/10 scale-[0.99]'
                : isDark
                ? 'border-slate-700/80 hover:border-emerald-500/60 bg-zinc-950/60 hover:bg-zinc-900/60 shadow-inner'
                : 'border-slate-300 hover:border-emerald-500/60 bg-slate-50/90 hover:bg-slate-100/90 shadow-xs'
            }`}
          >
            {isCompressing ? (
              <div className="flex flex-col items-center justify-center py-4">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-2" />
                <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {t('categories.compressingImage', 'Compressing category image...')}
                </span>
                <span className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {t('categories.autoResizing', 'Auto-resizing to compact 250px WebP')}
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-2 space-y-1.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-md group-hover:scale-105 transition-transform duration-200">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <p className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {t('categories.uploadPrompt', 'Click to upload, drag & drop, or Ctrl+V paste')}
                  </p>
                  <p className={`text-[11px] mt-0.5 font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {t('categories.uploadHelp', 'Supports screenshots, copied files, and direct image links')}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className={`text-[9px] font-mono font-medium px-2 py-0.5 rounded-full border ${
                    isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-white border-slate-200 text-slate-600 shadow-xs'
                  }`}>
                    PNG • JPG • WEBP • SVG
                  </span>
                  <span className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                    isDark ? 'bg-zinc-900 border-zinc-800 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-xs'
                  }`}>
                    Auto-Optimized
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Direct URL Input Toggle / Form */}
          {!showUrlInput ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowUrlInput(true)}
                className={`text-[11px] font-semibold transition-colors flex items-center gap-1 py-0.5 ${
                  isDark ? 'text-slate-400 hover:text-emerald-400' : 'text-slate-600 hover:text-emerald-700'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                {t('categories.orEnterUrl', 'Or enter image URL manually')}
              </button>
            </div>
          ) : (
            <div className={`p-2 rounded-xl border space-y-1.5 transition-all ${
              isDark ? 'bg-zinc-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
            }`}>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Link2 className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApplyUrl(); } }}
                    placeholder="https://example.com/image.png"
                    className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all ${
                      isDark
                        ? 'bg-zinc-950 border-slate-700 text-white placeholder:text-slate-500'
                        : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleApplyUrl()}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-xs"
                >
                  {t('common.apply', 'Apply')}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowUrlInput(false); setUrlInput(''); }}
                  className={`p-1.5 rounded-lg text-slate-400 transition-colors ${
                    isDark ? 'hover:bg-zinc-800 hover:text-white' : 'hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Error Notification ── */}
      {errorMessage && (
        <div className={`flex items-center gap-1.5 mt-2 p-2 rounded-lg border text-[11px] font-medium ${
          isDark
            ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            : 'bg-rose-50 border-rose-200 text-rose-700'
        }`}>
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{errorMessage}</span>
        </div>
      )}

      {/* ── Success Flash ── */}
      {showSuccessBadge && (
        <div className={`flex items-center gap-1.5 mt-2 p-1.5 rounded-lg border text-[11px] font-medium animate-in fade-in-0 duration-200 ${
          isDark
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        }`}>
          <Check className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{t('categories.imageReady', 'Category image ready and compressed!')}</span>
        </div>
      )}
    </div>
  );
};

export default CategoryImageUploader;
