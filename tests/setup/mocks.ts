import { vi } from 'vitest'

// Mock Supabase client
export const mockSupabase = {
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    getSession: vi.fn(),
    getUser: vi.fn(),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn(),
  })),
}

// Mock TensorFlow detector
export const mockDetector = {
  waitForInitialization: vi.fn(() => Promise.resolve()),
  detectFromImage: vi.fn(() =>
    Promise.resolve({
      isDeepfake: false,
      confidence: 0.95,
      scores: {},
      anomalies: [],
    })
  ),
  dispose: vi.fn(),
}

// Mock MediaPipe face detection
export const mockFaceDetection = {
  initialize: vi.fn(() => Promise.resolve()),
  detectFaces: vi.fn(() =>
    Promise.resolve([
      {
        boundingBox: { x: 0, y: 0, width: 100, height: 100 },
        landmarks: [],
        score: 0.98,
      },
    ])
  ),
}

// Mock video utilities
export const mockVideoUtils = {
  loadVideo: vi.fn((file: File) =>
    Promise.resolve({
      duration: 10,
      videoWidth: 1920,
      videoHeight: 1080,
    } as HTMLVideoElement)
  ),
  extractFrames: vi.fn(() =>
    Promise.resolve([
      {
        timestamp: 0,
        imageData: new Image(),
      },
      {
        timestamp: 0.5,
        imageData: new Image(),
      },
    ])
  ),
  validateVideoFile: vi.fn((file: File) => file.type.startsWith('video/')),
  formatFileSize: vi.fn((bytes: number) => `${Math.round(bytes / 1024)} KB`),
  formatDuration: vi.fn((seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }),
}

// Mock toast
export const mockToast = vi.fn()

// Mock File with createObjectURL
export const createMockFile = (
  name: string,
  size: number,
  type: string
): File => {
  const file = new File([''], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

// Mock video element
export const createMockVideo = (duration = 10): HTMLVideoElement => {
  const video = document.createElement('video')
  Object.defineProperty(video, 'duration', { value: duration, writable: true })
  Object.defineProperty(video, 'currentTime', { value: 0, writable: true })
  return video
}

// Mock canvas element
export const createMockCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = 224
  canvas.height = 224
  return canvas
}
