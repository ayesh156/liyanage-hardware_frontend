import imageCompression from 'browser-image-compression';
import { API_BASE } from '../lib/api';

export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp', '.avif', '.ico'] as const;

/**
 * Checks whether a filename, path, or URL string ends with a standard image extension (ignoring query parameters and hashes).
 */
export function hasImageExtension(urlOrPath: string | undefined | null): boolean {
  if (!urlOrPath || typeof urlOrPath !== 'string') return false;
  const clean = urlOrPath.split('?')[0].split('#')[0].toLowerCase().trim();
  return IMAGE_EXTENSIONS.some((ext) => clean.endsWith(ext));
}

/**
 * Checks whether a filename, path, or URL string ends with `.pdf` (ignoring query parameters and hashes).
 */
export function hasPdfExtension(urlOrPath: string | undefined | null): boolean {
  if (!urlOrPath || typeof urlOrPath !== 'string') return false;
  const clean = urlOrPath.split('?')[0].split('#')[0].toLowerCase().trim();
  return clean.endsWith('.pdf');
}

/**
 * Checks if a given file URL, MIME type, filename, or attachment item object corresponds to an image file.
 * Prioritizes standard image MIME types (image/*), image extensions (.jpg, .jpeg, .png, .webp, .gif, .svg), and data:image/ URIs.
 * 
 * @param item - File path, URL string, MIME string, filename, or attachment object
 * @returns boolean indicating whether the resource is an image
 */
export function isImageUrl(
  item: string | { url?: string; name?: string; title?: string; mimeType?: string; fileType?: string; isPdf?: boolean; [key: string]: any } | undefined | null
): boolean {
  if (!item) return false;

  if (typeof item === 'object') {
    // If explicitly marked as PDF or has .pdf extension, it is strictly NOT an image
    if (
      item.isPdf === true ||
      item.fileType === 'pdf' ||
      item.mimeType === 'application/pdf' ||
      item.mimeType?.toLowerCase() === 'application/pdf'
    ) {
      return false;
    }

    const nameStr = (item.name || item.title || '').trim().toLowerCase();
    if (nameStr.endsWith('.pdf') || hasPdfExtension(nameStr)) {
      return false;
    }

    if (item.mimeType?.toLowerCase().startsWith('image/')) return true;
    if (item.fileType === 'image') return true;
    if (hasImageExtension(nameStr)) return true;

    if (item.url && isImageUrl(item.url)) return true;

    return false;
  }

  if (typeof item !== 'string') return false;
  const str = item.trim();
  if (!str) return false;

  const lowerStr = str.toLowerCase();
  if (
    lowerStr.startsWith('data:application/pdf') ||
    lowerStr === 'application/pdf' ||
    lowerStr === 'pdf' ||
    hasPdfExtension(lowerStr) ||
    lowerStr.endsWith('.pdf')
  ) {
    return false;
  }

  if (lowerStr.startsWith('image/') || lowerStr.startsWith('data:image/')) return true;
  if (hasImageExtension(str)) return true;

  return false;
}

/**
 * Checks if a given file URL, MIME type, filename, or attachment item object corresponds to a PDF document.
 * 
 * Strict PDF Evaluation Rules:
 * 1. If item.isPdf === true OR item.mimeType === 'application/pdf' OR item.fileType === 'pdf' OR item.name?.toLowerCase().endsWith('.pdf'): strictly returns true.
 * 2. If item.url contains Google Drive identifiers (drive.google.com or lh3.googleusercontent.com) AND item.name genuinely ends with '.pdf': returns true.
 * 3. Fallbacks for data:application/pdf URIs, format=pdf query parameters, and .pdf URL paths.
 * NOTE: Never classifies an item as PDF solely because its name contains "document" or "doc" — those are unreliable heuristics.
 * 
 * @param item - File path, URL string, MIME string, filename, or attachment object
 * @returns boolean indicating whether the resource is a PDF document
 */
export function isPdfUrl(
  item: string | { url?: string; name?: string; title?: string; mimeType?: string; fileType?: string; isPdf?: boolean; [key: string]: any } | undefined | null
): boolean {
  if (!item) return false;

  // 1. Object Handling
  if (typeof item === 'object') {
    // Explicit image indicators take absolute priority — never misclassify images as PDFs
    if (item.mimeType?.toLowerCase().startsWith('image/')) return false;
    if (item.fileType === 'image') return false;
    const nameStr = (item.name || item.title || '').trim().toLowerCase();
    if (hasImageExtension(nameStr)) return false;

    // Explicit PDF indicators
    if (item.isPdf === true) return true;
    if (item.mimeType === 'application/pdf' || item.mimeType?.toLowerCase() === 'application/pdf') return true;
    if (item.fileType === 'pdf') return true;
    if (nameStr.endsWith('.pdf') || hasPdfExtension(nameStr)) return true;

    // Google Drive URL check — only trust .pdf extension in name, not generic words like "document"
    const urlStr = (item.url || '').trim().toLowerCase();
    const isDrive = urlStr.includes('drive.google.com') || urlStr.includes('lh3.googleusercontent.com');
    if (isDrive && (nameStr.endsWith('.pdf') || nameStr.includes('.pdf'))) {
      return true;
    }

    // Check url string fallback
    if (item.url && isPdfUrl(item.url)) return true;

    return false;
  }

  // 2. String Handling
  if (typeof item !== 'string') return false;
  const str = item.trim();
  if (!str) return false;

  const lowerStr = str.toLowerCase();
  if (lowerStr.startsWith('image/') || lowerStr.startsWith('data:image/')) return false;
  if (hasImageExtension(lowerStr)) return false;

  if (lowerStr === 'application/pdf' || lowerStr === 'pdf') return true;
  if (lowerStr.startsWith('data:application/pdf')) return true;
  if (hasPdfExtension(lowerStr) || lowerStr.endsWith('.pdf')) return true;

  // Explicit URL query params or format identifiers
  if (
    lowerStr.includes('format=pdf') ||
    lowerStr.includes('mimetype=application/pdf') ||
    lowerStr.includes('mime=application/pdf') ||
    lowerStr.includes('application%2fpdf')
  ) {
    return true;
  }

  // Google Drive URL string — only trust .pdf extension in URL path, not generic "document" keyword
  const isDrive = lowerStr.includes('drive.google.com') || lowerStr.includes('lh3.googleusercontent.com');
  if (isDrive && lowerStr.includes('.pdf')) {
    return true;
  }

  return false;
}

/**
 * Strictly checks whether an attachment item is a raster image.
 * Image detection is given strict PRIORITY before any PDF check.
 * Returns true if:
 * - MIME type starts with `image/`
 * - URL or name ends with a raster image extension (.jpg, .jpeg, .png, .webp, .gif)
 * - Data URL starts with `data:image/`
 * 
 * @param item - Attachment object, URL string, or MIME type string
 * @returns boolean — true only for confirmed raster image resources
 */
export function isRasterImage(
  item: string | { url?: string; name?: string; title?: string; mimeType?: string; fileType?: string; isPdf?: boolean; [key: string]: any } | undefined | null
): boolean {
  if (!item) return false;

  if (typeof item === 'object') {
    // MIME type is the most reliable signal
    if (item.mimeType?.toLowerCase().startsWith('image/')) return true;
    if (item.fileType === 'image') return true;

    const nameStr = (item.name || item.title || '').trim();
    const RASTER_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const nameLower = nameStr.toLowerCase();
    if (RASTER_EXTS.some((ext) => nameLower.endsWith(ext))) return true;

    // Check URL
    if (item.url) {
      const urlClean = item.url.split('?')[0].split('#')[0].toLowerCase();
      if (urlClean.startsWith('data:image/')) return true;
      if (RASTER_EXTS.some((ext) => urlClean.endsWith(ext))) return true;
    }

    return false;
  }

  if (typeof item !== 'string') return false;
  const str = item.trim();
  if (!str) return false;

  const lowerStr = str.toLowerCase();
  const RASTER_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

  if (lowerStr.startsWith('image/') || lowerStr.startsWith('data:image/')) return true;
  const cleanPath = lowerStr.split('?')[0].split('#')[0];
  if (RASTER_EXTS.some((ext) => cleanPath.endsWith(ext))) return true;

  return false;
}

/**
 * Strictly checks whether an attachment item is a PDF document.
 * Image detection is given absolute priority — if `isRasterImage(item)` is true, returns false immediately.
 * Returns true ONLY if:
 * - MIME type is exactly `application/pdf`
 * - URL or name genuinely ends with `.pdf` (ignoring query parameters)
 * - Data URI starts with `data:application/pdf`
 * 
 * NEVER classifies an item as PDF because its display name contains "(PDF)", "Document", or similar strings.
 * 
 * @param item - Attachment object, URL string, or MIME type string
 * @returns boolean — true only for confirmed PDF documents
 */
export function isPdfDocument(
  item: string | { url?: string; name?: string; title?: string; mimeType?: string; fileType?: string; isPdf?: boolean; [key: string]: any } | undefined | null
): boolean {
  if (!item) return false;

  // Images always win — never classify a raster image as PDF
  if (isRasterImage(item)) return false;

  if (typeof item === 'object') {
    if (item.isPdf === true) return true;
    if (item.mimeType === 'application/pdf' || item.mimeType?.toLowerCase() === 'application/pdf') return true;
    if (item.fileType === 'pdf') return true;

    const nameStr = (item.name || item.title || '').trim().toLowerCase();
    if (hasPdfExtension(nameStr)) return true;

    // For Google Drive URLs, only trust .pdf in the file name — not in generic display labels
    const urlStr = (item.url || '').trim();
    if (urlStr && isPdfDocument(urlStr)) return true;

    return false;
  }

  if (typeof item !== 'string') return false;
  const str = item.trim();
  if (!str) return false;

  const lowerStr = str.toLowerCase();

  if (lowerStr === 'application/pdf') return true;
  if (lowerStr.startsWith('data:application/pdf')) return true;

  // Strip query params/hash before checking extension
  const cleanPath = lowerStr.split('?')[0].split('#')[0];
  if (cleanPath.endsWith('.pdf')) return true;

  // Explicit URL query params
  if (
    lowerStr.includes('format=pdf') ||
    lowerStr.includes('mimetype=application/pdf') ||
    lowerStr.includes('mime=application/pdf') ||
    lowerStr.includes('application%2fpdf')
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if a given URL is a Google Drive share/view/thumbnail/content link.
 * 
 * @param url - URL string to inspect
 * @returns boolean indicating whether the URL belongs to Google Drive
 */
export function isGoogleDriveUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.includes('drive.google.com') || url.includes('lh3.googleusercontent.com');
}

/**
 * Extracts the pure Google Drive file ID from various Drive URL formats:
 * - /file/d/{FILE_ID}/view, /file/d/{FILE_ID}/preview
 * - /open?id={FILE_ID}
 * - /uc?id={FILE_ID} or /uc?export=download&id={FILE_ID}
 * - /thumbnail?id={FILE_ID}
 * - lh3.googleusercontent.com/d/{FILE_ID}
 * - lh3.googleusercontent.com/drive-viewer/{FILE_ID}
 * 
 * @param url - Raw Google Drive URL
 * @returns Extracted file ID string or null if not found
 */
export function extractGoogleDriveFileId(url: string | undefined | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const drivePatterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/open\?(?:[^&]+&)*id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/uc\?(?:[^&]+&)*id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/thumbnail\?(?:[^&]+&)*id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/,
    /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/,
    /lh3\.googleusercontent\.com\/drive-viewer\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of drivePatterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Resolves the proper direct preview URL for an attachment.
 * - Google Drive PDFs: `https://drive.google.com/file/d/{driveId}/preview` for native multi-page scrolling inside an iframe.
 * - Google Drive Images: `https://drive.google.com/thumbnail?id={driveId}&sz=w1000` for high-res raster rendering.
 * - Local uploads: Prepends backend host if needed.
 * 
 * @param url - Raw document or image URL
 * @param isPdf - Whether the file is a PDF document
 * @returns Direct viewable or embeddable URL
 */
export function resolveAttachmentViewUrl(url: string | undefined | null, isPdf = false): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  const driveId = extractGoogleDriveFileId(trimmed);
  if (driveId) {
    if (isPdf) {
      return `https://drive.google.com/file/d/${driveId}/preview`;
    }
    return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1000`;
  }

  // Relative backend uploads
  if (trimmed.startsWith('/public/')) {
    const backendOrigin = API_BASE.replace(/\/api\/?$/, '');
    return `${backendOrigin}${trimmed}`;
  }

  return trimmed;
}

/**
 * Resolves the direct binary download URL for an attachment.
 * Specifically converts Google Drive preview links into binary download streams:
 * `https://drive.google.com/uc?export=download&id=${fileId}`
 * 
 * @param url - Raw document/image URL
 * @returns Direct download binary URL
 */
export function resolveAttachmentDownloadUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  const driveId = extractGoogleDriveFileId(trimmed);
  if (driveId) {
    return `https://drive.google.com/uc?export=download&id=${driveId}`;
  }

  // Relative backend uploads
  if (trimmed.startsWith('/public/')) {
    const backendOrigin = API_BASE.replace(/\/api\/?$/, '');
    return `${backendOrigin}${trimmed}`;
  }

  return trimmed;
}

/**
 * Normalizes any Google Drive link or web URL into a high-performance direct CDN thumbnail link.
 *
 * Supported formats:
 * - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/uc?id=FILE_ID
 * - https://drive.google.com/thumbnail?id=FILE_ID
 * - Standard web URLs and local backend /public paths
 *
 * @param url - Raw user-supplied or stored URL.
 * @returns Direct viewable image link.
 */
export function normalizeImageUrl(url: string | undefined | null): string {
  return resolveAttachmentViewUrl(url, false);
}

/**
 * Client-side image compressor powered by `browser-image-compression` with Canvas WebP fallback.
 * Compresses and scales down high-resolution camera / smartphone pictures to lightweight WebP/JPEG files.
 * If file is a PDF or other document, returns the original file untouched.
 *
 * @param file - Original file from input or drop.
 * @param maxWidth - Maximum width boundary (default: 1600px).
 * @param maxHeight - Maximum height boundary (default: 1600px).
 * @param quality - Output compression quality (0.1 to 1.0, default: 0.82).
 * @returns Compressed File object or original file.
 */
export async function compressImageFile(
  file: File,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.82
): Promise<File> {
  // If not an image (e.g. PDF), return file as is
  if (!file.type.startsWith('image/')) {
    return file;
  }

  try {
    const options = {
      maxSizeMB: 1.5,
      maxWidthOrHeight: Math.max(maxWidth, maxHeight),
      useWebWorker: true,
      initialQuality: quality,
      fileType: 'image/webp',
    };

    const compressedBlob = await imageCompression(file, options);
    const originalNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    return new File([compressedBlob], `${originalNameWithoutExt}.webp`, {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  } catch (error) {
    console.warn('browser-image-compression fallback to canvas compression:', error);
    return fallbackCanvasCompress(file, maxWidth, maxHeight, quality);
  }
}

/**
 * Fallback Canvas-based WebP compression for environments where web worker compression is unavailable.
 */
async function fallbackCanvasCompress(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Calculate constrained dimensions preserving aspect ratio
      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return resolve(file);
      }

      // Smooth resizing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Determine output MIME type
      const outputType = 'image/webp';
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return resolve(file);
          }

          const originalNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          const compressedFile = new File([blob], `${originalNameWithoutExt}.webp`, {
            type: outputType,
            lastModified: Date.now(),
          });

          // If compression resulted in smaller file, use compressed; otherwise retain original
          if (compressedFile.size < file.size) {
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        },
        outputType,
        quality
      );
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };

    img.src = objectUrl;
  });
}
