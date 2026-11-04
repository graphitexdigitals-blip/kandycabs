import { NextRequest, NextResponse } from 'next/server';
import { setCorsHeaders, handleOptions } from '@/lib/cors';
import { createWorker } from 'tesseract.js';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

/**
 * Locate the exact tesseract worker script path in Next.js monorepo
 */
function findTesseractWorkerPath(): string | undefined {
  const candidates = [
    path.resolve(process.cwd(), '../../node_modules/tesseract.js/src/worker-script/node/index.js'),
    path.resolve(process.cwd(), '../node_modules/tesseract.js/src/worker-script/node/index.js'),
    path.resolve(process.cwd(), 'node_modules/tesseract.js/src/worker-script/node/index.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return undefined;
}

/**
 * Heuristic parser to extract the most accurate odometer reading
 * from OCR recognized text on vehicle dashboards.
 */
function extractOdometerReading(rawText: string): { reading: number | null; confidence: number; detectedString?: string } {
  if (!rawText || typeof rawText !== 'string') {
    return { reading: null, confidence: 0 };
  }

  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const candidates: { num: number; score: number; str: string; line: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Extract all numeric clusters (with optional single decimal point)
    const matches = line.match(/\b\d{3,7}(?:\.\d)?\b/g);
    if (matches) {
      for (const m of matches) {
        const val = parseFloat(m);
        if (isNaN(val) || val < 10) continue; // Filter out single digits / tiny numbers

        let score = 50;

        // Line-level checks
        if (/rpm|x1000/i.test(line)) score -= 70;
        if (/km\/h|kmh|mph/i.test(line)) score -= 50;
        if (/°c|°f|\b\d{2,3}\s*c\b/i.test(line)) score -= 50;
        if (/:|\b(am|pm)\b/i.test(line)) score -= 50; // Clock time

        // Context checks
        if (/odo|total\s*odo|odometer/i.test(rawText)) score += 40;
        if (/\bkm\b|\.km\b/i.test(line)) score += 30;

        // Cumulative mileage is typically 4 to 6 digits and higher than trip counters
        if (val >= 1000 && val <= 999999) {
          score += 30;
          score += Math.min(Math.floor(Math.log10(val) * 10), 50);
        }

        candidates.push({ num: val, score, str: m, line });
      }
    }
  }

  if (candidates.length === 0) {
    const allMatches = rawText.match(/\b\d{4,7}(?:\.\d)?\b/g);
    if (allMatches && allMatches.length > 0) {
      const val = parseFloat(allMatches[0]);
      return { reading: val, confidence: 60, detectedString: allMatches[0] };
    }
    return { reading: null, confidence: 0 };
  }

  // Sort by score first, then value
  candidates.sort((a, b) => b.score - a.score || b.num - a.num);
  const best = candidates[0];

  return {
    reading: best.num,
    confidence: Math.min(best.score, 99),
    detectedString: best.str,
  };
}

export async function POST(req: NextRequest) {
  let worker: any = null;
  try {
    const body = await req.json();
    const { imageBase64, imageUri } = body;

    const sourceImage = imageBase64 || imageUri;
    if (!sourceImage) {
      const res = NextResponse.json(
        { success: false, message: 'Image data (imageBase64 or imageUri) is required' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    let imageBuffer: Buffer;
    if (sourceImage.startsWith('data:')) {
      const base64Data = sourceImage.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else if (sourceImage.startsWith('http://') || sourceImage.startsWith('https://')) {
      const fetchRes = await fetch(sourceImage);
      const arrayBuffer = await fetchRes.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    } else {
      imageBuffer = Buffer.from(sourceImage, 'base64');
    }

    // Initialize Tesseract Worker with explicit workerPath
    const workerPath = findTesseractWorkerPath();
    const workerOptions: any = {};
    if (workerPath) {
      workerOptions.workerPath = workerPath;
    }

    worker = await createWorker('eng', 1, workerOptions);

    const ocrResult = await worker.recognize(imageBuffer);
    const rawText = ocrResult?.data?.text || '';
    const ocrConfidence = ocrResult?.data?.confidence || 0;

    const { reading, confidence, detectedString } = extractOdometerReading(rawText);

    const response = NextResponse.json(
      {
        success: true,
        reading: reading,
        detectedString: detectedString || (reading != null ? String(reading) : null),
        confidence: Math.round(confidence),
        ocrEngineConfidence: Math.round(ocrConfidence),
        rawText: rawText.trim(),
      },
      { status: 200 }
    );
    return setCorsHeaders(response);
  } catch (error: any) {
    console.error('Error in POST /api/driver/odometer/ocr:', error);
    const res = NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to process odometer OCR',
        reading: null,
      },
      { status: 500 }
    );
    return setCorsHeaders(res);
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch (err) {
        // ignore terminate error
      }
    }
  }
}
