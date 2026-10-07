import imageCompression from 'browser-image-compression';
import { API_BASE } from '../lib/api';

/**
 * Unconditionally checks if a given file URL, MIME type, filename, or attachment item object corresponds to a PDF document.
 * Handles clean extensions, query params, MIME strings, data URIs, and attachment objects with explicit mimeType, isPdf, or fileType.
 * 
 * @param item - File path, URL string, MIME string, filename, or attachment object
 * @returns boolean indicating whether the resource is a PDF document
 */
export function isPdfUrl(
  item: string | { url?: string; name?: string; title?: string; mimeType?: string; fileType?: string; isPdf?: boolean; [key: string]: any } | undefined | null
): boolean {
  if (!item) return false;

  // Handle object inputs (GRNImageItem or upload payloads)
  if (typeof item === 'object') {
    if (item.isPdf === true) return true;
    if (item.mimeType === 'application/pdf' || item.mimeType?.toLowerCase().includes('pdf')) return true;
    if (item.fileType === 'pdf') return true;

    // Check title / name for keywords: "Document", "Invoice", "Report", or ".pdf"
    const nameStr = (item.name || item.title || '').toLowerCase();
    if (
      nameStr.includes('.pdf') ||
      nameStr.includes('document') ||
      nameStr.includes('invoice') ||
      nameStr.includes('report')
    ) {
      return true;
    }

    if (item.url && isPdfUrl(item.url)) return true;
    return false;
  }

  if (typeof item !== 'string') return false;
  const str = item.trim();
  if (!str) return false;

  // Exact type strings
  if (str === 'pdf' || str === 'application/pdf') return true;

  const clean = str.split('?')[0].toLowerCase().trim();
  const lowerStr = str.toLowerCase();

  return (
    clean.endsWith('.pdf') ||
    clean.includes('.pdf/') ||
    clean.includes('application/pdf') ||
    clean.includes('application%2fpdf') ||
    clean.startsWith('data:application/pdf') ||
    lowerStr.includes('.pdf?') ||
    lowerStr.includes('format=pdf') ||
    lowerStr.includes('mimetype=application/pdf') ||
    lowerStr.includes('mime=application/pdf') ||
    lowerStr.includes('type=pdf') ||
    lowerStr.includes('document') ||
    lowerStr.includes('invoice') ||
    lowerStr.includes('report')
  );
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
