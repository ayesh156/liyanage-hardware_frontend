/**
 * Utility for client-side image compression and optimization.
 * Resizes images to compact thumbnails (default max 250x250) and converts
 * to WebP (with fallback to JPEG) base64 data URLs for fast POS rendering
 * and low database storage footprint.
 */

/**
 * Resizes and compresses an image File or Blob to a base64 Data URL.
 *
 * @param file - The input image File or Blob
 * @param maxWidth - Maximum allowed width in pixels (default: 250)
 * @param maxHeight - Maximum allowed height in pixels (default: 250)
 * @param quality - Compression quality between 0.1 and 1.0 (default: 0.8)
 * @returns Promise resolving to the compressed base64 data URL string
 */
export async function compressImageToBase64(
  file: File | Blob,
  maxWidth = 250,
  maxHeight = 250,
  quality = 0.8,
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Validate that the input is a valid Blob or File
    if (!file || !(file instanceof Blob)) {
      return reject(new Error('Invalid image input: expected File or Blob'));
    }

    // Read the file as a Data URL
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Failed to read image file'));
    };

    reader.onload = (readerEvent) => {
      const img = new Image();

      img.onerror = () => {
        reject(new Error('Failed to load image for processing'));
      };

      img.onload = () => {
        try {
          const originalWidth = img.naturalWidth || img.width;
          const originalHeight = img.naturalHeight || img.height;

          if (originalWidth === 0 || originalHeight === 0) {
            return reject(new Error('Image has zero dimensions'));
          }

          // Calculate proportional dimensions
          let targetWidth = originalWidth;
          let targetHeight = originalHeight;

          if (targetWidth > maxWidth || targetHeight > maxHeight) {
            const widthRatio = maxWidth / targetWidth;
            const heightRatio = maxHeight / targetHeight;
            const scale = Math.min(widthRatio, heightRatio);

            targetWidth = Math.round(targetWidth * scale);
            targetHeight = Math.round(targetHeight * scale);
          }

          // Create canvas for resizing
          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;

          const ctx = canvas.getContext('2d', { alpha: true });
          if (!ctx) {
            return reject(new Error('Failed to get 2D canvas context'));
          }

          // Enable high-quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Clear & draw image onto canvas
          ctx.clearRect(0, 0, targetWidth, targetHeight);
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          // Try exporting as WebP first
          let dataUrl = canvas.toDataURL('image/webp', quality);

          // Fallback if browser doesn't support WebP export (data:image/png returned or empty)
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          resolve(dataUrl);
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Image compression failed'));
        }
      };

      const result = readerEvent.target?.result;
      if (typeof result === 'string') {
        img.src = result;
      } else {
        reject(new Error('Failed to read image buffer'));
      }
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Standard wrapper for Category image optimization.
 */
export async function optimizeCategoryImage(input: File | Blob): Promise<string> {
  return compressImageToBase64(input, 250, 250, 0.8);
}
