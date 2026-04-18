/**
 * UnivFD Backend Client
 *
 * Sends images to the local FastAPI backend for CLIP-based detection.
 * Covers diffusion-model content (Stable Diffusion, DALL-E, Midjourney, SORA)
 * that in-browser CNN models miss.
 *
 * Falls back gracefully when the backend is not running.
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787';
const BACKEND_SECRET = import.meta.env.VITE_BACKEND_SECRET || '';

export interface UnivFDResult {
  isDeepfake: boolean;
  confidence: number;
  score: number;
  method: 'univfd' | 'clip_zeroshot';
  anomalies: string[];
  modelLoaded: boolean;
  available: boolean; // false when backend is offline
}

let _backendAvailable: boolean | null = null; // cached after first check

/**
 * Get headers with optional authentication
 */
function getHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (BACKEND_SECRET) {
    headers['X-API-Key'] = BACKEND_SECRET;
  }
  return headers;
}

/**
 * Check if the backend is reachable. Cached after first call.
 */
export async function isBackendAvailable(): Promise<boolean> {
  if (_backendAvailable !== null) return _backendAvailable;
  try {
    const res = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(2000) });
    _backendAvailable = res.ok;
  } catch {
    _backendAvailable = false;
  }
  return _backendAvailable;
}

/** Reset the cached availability (call if you want to retry after a failure). */
export function resetBackendCache(): void {
  _backendAvailable = null;
}

/**
 * Convert a canvas to a base64 data URL and send to the backend.
 * Returns null if the backend is unavailable.
 */
export async function detectWithUnivFD(
  canvas: HTMLCanvasElement,
  filename = 'image.jpg'
): Promise<UnivFDResult | null> {
  const available = await isBackendAvailable();
  if (!available) return null;

  try {
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.92);

    const res = await fetch(`${BACKEND_URL}/detect`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ image: imageDataUrl, filename }),
      signal: AbortSignal.timeout(15000), // 15s timeout for CLIP inference
    });

    if (!res.ok) {
      console.warn(`UnivFD backend error: ${res.status}`);
      if (res.status === 401) {
        console.error('Backend authentication failed — check VITE_BACKEND_SECRET in .env');
      }
      return null;
    }

    const data = await res.json();
    return { ...data, available: true };
  } catch (e) {
    console.warn('UnivFD request failed:', e);
    _backendAvailable = false; // mark offline so we stop trying
    return null;
  }
}

/**
 * Convert a File/Blob to base64 and send to the backend.
 */
export async function detectFileWithUnivFD(file: File): Promise<UnivFDResult | null> {
  const available = await isBackendAvailable();
  if (!available) return null;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    bytes.forEach(b => (binary += String.fromCharCode(b)));
    const base64 = btoa(binary);
    const dataUrl = `data:${file.type};base64,${base64}`;

    const res = await fetch(`${BACKEND_URL}/detect`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ image: dataUrl, filename: file.name }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      if (res.status === 401) {
        console.error('Backend authentication failed — check VITE_BACKEND_SECRET in .env');
      }
      return null;
    }
    const data = await res.json();
    return { ...data, available: true };
  } catch (e) {
    console.warn('UnivFD file request failed:', e);
    _backendAvailable = false;
    return null;
  }
}
