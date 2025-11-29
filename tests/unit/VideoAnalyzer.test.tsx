import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import VideoAnalyzer from '@/components/detection/VideoAnalyzer'
import { createMockFile } from '../setup/mocks'

// Mock dependencies
vi.mock('@/utils/videoUtils', () => ({
  validateVideoFile: vi.fn((file: File) => file.type.startsWith('video/')),
  loadVideo: vi.fn(() =>
    Promise.resolve({
      duration: 10.5,
      videoWidth: 1920,
      videoHeight: 1080,
    } as HTMLVideoElement)
  ),
  extractFrames: vi.fn(() =>
    Promise.resolve([
      { timestamp: 0, imageData: new Image() },
      { timestamp: 0.5, imageData: new Image() },
    ])
  ),
  formatFileSize: vi.fn((bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`),
  formatDuration: vi.fn((seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }),
}))

vi.mock('@/lib/tensorflow', () => ({
  getDeepfakeDetector: vi.fn(() => ({
    waitForInitialization: vi.fn(() => Promise.resolve()),
    detectFromImage: vi.fn(() =>
      Promise.resolve({
        isDeepfake: false,
        confidence: 0.92,
        scores: { temporal: 0.88 },
        anomalies: [],
      })
    ),
  })),
  canvasToTensor: vi.fn(() => ({
    dispose: vi.fn(),
  })),
}))

vi.mock('@/hooks/useAuditLog', () => ({
  useAuditLog: vi.fn(() => ({
    logDetection: vi.fn(() => Promise.resolve()),
    getTimingHelper: vi.fn(() => ({
      getElapsedMs: vi.fn(() => 1500),
    })),
  })),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const renderVideoAnalyzer = () => {
  return render(
    <BrowserRouter>
      <VideoAnalyzer />
    </BrowserRouter>
  )
}

describe('VideoAnalyzer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('File Upload', () => {
    test('renders upload area correctly', () => {
      renderVideoAnalyzer()

      expect(screen.getByText(/drop your video here/i)).toBeInTheDocument()
      expect(screen.getByText(/supports mp4, webm, ogg/i)).toBeInTheDocument()
    })

    test('accepts valid video file', async () => {
      const user = userEvent.setup()
      renderVideoAnalyzer()

      const file = createMockFile('test-video.mp4', 5 * 1024 * 1024, 'video/mp4')
      const input = screen.getByRole('input', { hidden: true }) as HTMLInputElement

      await user.upload(input, file)

      await waitFor(() => {
        expect(screen.getByText('test-video.mp4')).toBeInTheDocument()
      })
    })

    test('rejects invalid file type', async () => {
      const user = userEvent.setup()
      const { toast } = await import('sonner')

      renderVideoAnalyzer()

      const file = createMockFile('test.txt', 1024, 'text/plain')
      const input = screen.getByRole('input', { hidden: true }) as HTMLInputElement

      await user.upload(input, file)

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid file type')
      )
    })

    test('rejects file larger than 100MB', async () => {
      const user = userEvent.setup()
      const { toast } = await import('sonner')

      renderVideoAnalyzer()

      const file = createMockFile('large.mp4', 150 * 1024 * 1024, 'video/mp4')
      const input = screen.getByRole('input', { hidden: true }) as HTMLInputElement

      await user.upload(input, file)

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('File too large')
      )
    })
  })

  describe('Video Analysis', () => {
    test('analyzes video when button is clicked', async () => {
      const user = userEvent.setup()
      const { logDetection } = (await import('@/hooks/useAuditLog')).useAuditLog()

      renderVideoAnalyzer()

      // Upload file
      const file = createMockFile('test-video.mp4', 5 * 1024 * 1024, 'video/mp4')
      const input = screen.getByRole('input', { hidden: true }) as HTMLInputElement
      await user.upload(input, file)

      // Click analyze
      const analyzeButton = await screen.findByText(/analyze video/i)
      await user.click(analyzeButton)

      // Wait for analysis to complete
      await waitFor(
        () => {
          expect(logDetection).toHaveBeenCalled()
        },
        { timeout: 5000 }
      )
    })

    test('displays progress during analysis', async () => {
      const user = userEvent.setup()
      renderVideoAnalyzer()

      const file = createMockFile('test-video.mp4', 5 * 1024 * 1024, 'video/mp4')
      const input = screen.getByRole('input', { hidden: true }) as HTMLInputElement
      await user.upload(input, file)

      const analyzeButton = await screen.findByText(/analyze video/i)
      await user.click(analyzeButton)

      // Should show analyzing state
      expect(screen.getByText(/analyzing\.\.\./i)).toBeInTheDocument()
      expect(screen.getByText(/analysis progress/i)).toBeInTheDocument()
    })

    test('displays results after analysis', async () => {
      const user = userEvent.setup()
      renderVideoAnalyzer()

      const file = createMockFile('test-video.mp4', 5 * 1024 * 1024, 'video/mp4')
      const input = screen.getByRole('input', { hidden: true }) as HTMLInputElement
      await user.upload(input, file)

      const analyzeButton = await screen.findByText(/analyze video/i)
      await user.click(analyzeButton)

      await waitFor(
        () => {
          expect(screen.getByText(/authentic|deepfake/i)).toBeInTheDocument()
        },
        { timeout: 5000 }
      )
    })
  })

  describe('Video Playback Controls', () => {
    test('plays and pauses video', async () => {
      const user = userEvent.setup()
      renderVideoAnalyzer()

      const file = createMockFile('test-video.mp4', 5 * 1024 * 1024, 'video/mp4')
      const input = screen.getByRole('input', { hidden: true }) as HTMLInputElement
      await user.upload(input, file)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
      })

      const playButton = screen.getByRole('button', { name: /play/i })
      await user.click(playButton)

      // After playing, should show pause button
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
      })
    })
  })

  describe('Report Export', () => {
    test('exports report with correct data', async () => {
      const user = userEvent.setup()
      const createObjectURL = vi.fn(() => 'mock-blob-url')
      global.URL.createObjectURL = createObjectURL

      renderVideoAnalyzer()

      // Upload and analyze
      const file = createMockFile('test-video.mp4', 5 * 1024 * 1024, 'video/mp4')
      const input = screen.getByRole('input', { hidden: true }) as HTMLInputElement
      await user.upload(input, file)

      const analyzeButton = await screen.findByText(/analyze video/i)
      await user.click(analyzeButton)

      // Wait for results
      await waitFor(
        () => {
          expect(screen.getByText(/authentic|deepfake/i)).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      // Click export
      const exportButton = screen.getByText(/export/i)
      await user.click(exportButton)

      expect(createObjectURL).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    test('handles video load error gracefully', async () => {
      const user = userEvent.setup()
      const { toast } = await import('sonner')
      const videoUtils = await import('@/utils/videoUtils')

      // Mock loadVideo to reject
      vi.mocked(videoUtils.loadVideo).mockRejectedValueOnce(new Error('Load failed'))

      renderVideoAnalyzer()

      const file = createMockFile('corrupted.mp4', 5 * 1024 * 1024, 'video/mp4')
      const input = screen.getByRole('input', { hidden: true }) as HTMLInputElement
      await user.upload(input, file)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to load video')
      })
    })
  })

  describe('Reset Functionality', () => {
    test('clears video and results when reset', async () => {
      const user = userEvent.setup()
      renderVideoAnalyzer()

      // Upload file
      const file = createMockFile('test-video.mp4', 5 * 1024 * 1024, 'video/mp4')
      const input = screen.getByRole('input', { hidden: true }) as HTMLInputElement
      await user.upload(input, file)

      await waitFor(() => {
        expect(screen.getByText('test-video.mp4')).toBeInTheDocument()
      })

      // Click clear
      const clearButton = screen.getByText(/clear/i)
      await user.click(clearButton)

      // File should be removed
      expect(screen.queryByText('test-video.mp4')).not.toBeInTheDocument()
    })
  })
})
