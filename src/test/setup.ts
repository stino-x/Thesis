import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock canvas
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn(() => ({
    data: new Uint8ClampedArray(4),
    width: 1,
    height: 1,
  })),
  putImageData: vi.fn(),
  createImageData: vi.fn(() => ({
    data: new Uint8ClampedArray(4),
    width: 1,
    height: 1,
  })),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  transform: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
})) as any

// Mock MediaStream
global.MediaStream = class MediaStream {
  getTracks() {
    return []
  }
} as any

// Mock ImageData
global.ImageData = class ImageData {
  data: Uint8ClampedArray
  width: number
  height: number
  
  constructor(data: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
    if (typeof data === 'number') {
      this.width = data
      this.height = widthOrHeight
      this.data = new Uint8ClampedArray(data * widthOrHeight * 4)
    } else {
      this.data = data
      this.width = widthOrHeight
      this.height = height || widthOrHeight
    }
  }
} as any

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'mock-url')
global.URL.revokeObjectURL = vi.fn()
