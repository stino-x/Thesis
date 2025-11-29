import { describe, test, expect, vi } from 'vitest'
import {
  validateVideoFile,
  formatFileSize,
  formatDuration,
} from '@/utils/videoUtils'

describe('videoUtils', () => {
  describe('validateVideoFile', () => {
    test('returns true for valid MP4 video', () => {
      const file = new File([''], 'test.mp4', { type: 'video/mp4' })
      expect(validateVideoFile(file)).toBe(true)
    })

    test('returns true for valid WebM video', () => {
      const file = new File([''], 'test.webm', { type: 'video/webm' })
      expect(validateVideoFile(file)).toBe(true)
    })

    test('returns true for valid OGG video', () => {
      const file = new File([''], 'test.ogg', { type: 'video/ogg' })
      expect(validateVideoFile(file)).toBe(true)
    })

    test('returns false for invalid file type', () => {
      const file = new File([''], 'test.txt', { type: 'text/plain' })
      expect(validateVideoFile(file)).toBe(false)
    })

    test('returns false for image file', () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' })
      expect(validateVideoFile(file)).toBe(false)
    })

    test('returns false for audio file', () => {
      const file = new File([''], 'test.mp3', { type: 'audio/mpeg' })
      expect(validateVideoFile(file)).toBe(false)
    })
  })

  describe('formatFileSize', () => {
    test('formats bytes correctly', () => {
      expect(formatFileSize(500)).toBe('500 B')
    })

    test('formats kilobytes correctly', () => {
      expect(formatFileSize(1024)).toBe('1.00 KB')
      expect(formatFileSize(1536)).toBe('1.50 KB')
    })

    test('formats megabytes correctly', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.00 MB')
      expect(formatFileSize(5.5 * 1024 * 1024)).toBe('5.50 MB')
    })

    test('formats gigabytes correctly', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.00 GB')
      expect(formatFileSize(2.75 * 1024 * 1024 * 1024)).toBe('2.75 GB')
    })

    test('handles zero bytes', () => {
      expect(formatFileSize(0)).toBe('0 B')
    })

    test('handles large file sizes', () => {
      const largeSize = 100 * 1024 * 1024 * 1024 // 100 GB
      const result = formatFileSize(largeSize)
      expect(result).toContain('GB')
    })
  })

  describe('formatDuration', () => {
    test('formats seconds correctly', () => {
      expect(formatDuration(30)).toBe('0:30')
    })

    test('formats minutes and seconds correctly', () => {
      expect(formatDuration(90)).toBe('1:30')
      expect(formatDuration(125)).toBe('2:05')
    })

    test('formats hours, minutes and seconds correctly', () => {
      expect(formatDuration(3661)).toBe('1:01:01')
      expect(formatDuration(7384)).toBe('2:03:04')
    })

    test('handles zero duration', () => {
      expect(formatDuration(0)).toBe('0:00')
    })

    test('pads single digit seconds', () => {
      expect(formatDuration(5)).toBe('0:05')
      expect(formatDuration(65)).toBe('1:05')
    })

    test('pads single digit minutes', () => {
      expect(formatDuration(3605)).toBe('1:00:05')
    })

    test('handles fractional seconds', () => {
      expect(formatDuration(90.7)).toBe('1:30')
      expect(formatDuration(125.9)).toBe('2:05')
    })

    test('handles very long durations', () => {
      const hours = 10
      const minutes = 45
      const seconds = 30
      const totalSeconds = hours * 3600 + minutes * 60 + seconds
      expect(formatDuration(totalSeconds)).toBe('10:45:30')
    })
  })
})
