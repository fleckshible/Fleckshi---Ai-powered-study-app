/**
 * Compute target dimensions preserving aspect ratio so the longest edge <= maxEdge.
 * Pure function suitable for unit testing without DOM canvas.
 * @param {number} width
 * @param {number} height
 * @param {number} [maxEdge=1600]
 * @returns {{ width: number, height: number, scale: number }}
 */
export function computeDownscaleDimensions(width, height, maxEdge = 1600) {
  const w = Math.max(1, Number(width) || 1);
  const h = Math.max(1, Number(height) || 1);
  const limit = Math.max(1, Number(maxEdge) || 1600);
  const longest = Math.max(w, h);
  if (longest <= limit) {
    return { width: Math.round(w), height: Math.round(h), scale: 1 };
  }
  const scale = limit / longest;
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
    scale
  };
}

function loadImageElement(srcUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Unreadable or unsupported image file.'));
    img.src = srcUrl;
  });
}

function renderToJpegDataUrl(sourceEl, srcW, srcH, maxEdge, quality) {
  const { width, height } = computeDownscaleDimensions(srcW, srcH, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.width = 0;
    canvas.height = 0;
    throw new Error('Canvas 2D context unavailable.');
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(sourceEl, 0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  // Release canvas backing memory immediately
  canvas.width = 0;
  canvas.height = 0;
  return dataUrl;
}

/**
 * Downscale a File/Blob image in browser (<= 1600px long edge, JPEG 0.85)
 * plus a compact thumbnail (<= 180px, JPEG 0.65) for IndexedDB storage.
 * @param {File|Blob} file
 * @param {number} [maxEdge=1600]
 * @param {number} [quality=0.85]
 * @returns {Promise<{ base64Data: string, mimeType: string, thumbnail: string, width: number, height: number }>}
 */
export async function downscaleImageFile(file, maxEdge = 1600, quality = 0.85) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(objectUrl);
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    const { width, height } = computeDownscaleDimensions(srcW, srcH, maxEdge);
    const fullDataUrl = renderToJpegDataUrl(img, srcW, srcH, maxEdge, quality);
    const thumbnail = renderToJpegDataUrl(img, srcW, srcH, 180, 0.65);
    const base64Data = fullDataUrl.split(',')[1] || '';
    return {
      base64Data,
      mimeType: 'image/jpeg',
      thumbnail,
      width,
      height
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
