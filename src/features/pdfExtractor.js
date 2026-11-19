import { computeDownscaleDimensions } from './imageProcessor.js';

let pdfjsConfigured = false;

async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist');
  if (!pdfjsConfigured && pdfjs.GlobalWorkerOptions) {
    // Configure local module worker URL compatible with Vite bundling
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
    pdfjsConfigured = true;
  }
  return pdfjs;
}

/**
 * Extract text from a PDF file using lazy-loaded pdfjs-dist.
 * If extracted text is sparse (< 15 words/page), falls back to rendering pages
 * as downscaled JPEG images (<= 1600px) for the Gemini Image OCR Review pipeline.
 * @param {File} file
 * @param {number} [maxScanPages=8]
 */
export async function extractPdfContent(file, maxScanPages = 8) {
  const pdfjs = await loadPdfJs();
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;

  try {
    const numPages = pdf.numPages || 0;
    const pageTexts = [];
    let totalWords = 0;

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageStr = (textContent.items || [])
        .map((item) => item.str || '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (pageStr) {
        pageTexts.push(pageStr);
        totalWords += pageStr.split(/\s+/).length;
      }
      page.cleanup?.();
    }

    const avgWordsPerPage = numPages ? totalWords / numPages : 0;
    if (avgWordsPerPage >= 15 && pageTexts.length) {
      return {
        isScanned: false,
        text: pageTexts.join('\n\n'),
        pageCount: numPages,
        pageImages: []
      };
    }

    // Scanned PDF fallback: render pages to downscaled JPEG images for OCR
    const pagesToRender = Math.min(numPages, maxScanPages);
    const pageImages = [];
    for (let i = 1; i <= pagesToRender; i++) {
      const page = await pdf.getPage(i);
      const baseViewport = page.getViewport({ scale: 1 });
      const { width } = computeDownscaleDimensions(baseViewport.width, baseViewport.height, 1600);
      const renderScale = width / Math.max(1, baseViewport.width);
      const viewport = page.getViewport({ scale: renderScale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        const fullDataUrl = canvas.toDataURL('image/jpeg', 0.85);

        const thumbDims = computeDownscaleDimensions(canvas.width, canvas.height, 180);
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = thumbDims.width;
        thumbCanvas.height = thumbDims.height;
        const tCtx = thumbCanvas.getContext('2d');
        tCtx?.drawImage(canvas, 0, 0, thumbDims.width, thumbDims.height);
        const thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.65);

        thumbCanvas.width = 0;
        thumbCanvas.height = 0;
        canvas.width = 0;
        canvas.height = 0;

        pageImages.push({
          title: `${file.name} (Page ${i})`,
          base64Data: fullDataUrl.split(',')[1] || '',
          mimeType: 'image/jpeg',
          thumbnail
        });
      }
      page.cleanup?.();
    }

    return {
      isScanned: true,
      text: pageTexts.join('\n\n'),
      pageCount: numPages,
      pageImages
    };
  } finally {
    await pdf.destroy?.();
  }
}
