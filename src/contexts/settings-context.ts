import { createContext } from 'react'

export interface DetectionSettings {
  processingSpeed: 'fast' | 'balanced' | 'accurate'
  sensitivity: number
  showBoundingBoxes: boolean
  showHeatmap: boolean
  showConfidenceBadge: boolean
  // Research-grade features
  enableCalibration: boolean
  enableAdversarialDetection: boolean
  enablePartialDetection: boolean
  // Defensive transformations
  enableDefensiveTransforms: boolean
  jpegQuality: number
  gaussianBlur: number
  enableRandomCrop: boolean
  enableResize: boolean
}

export interface SettingsContextType {
  settings: DetectionSettings
  updateSettings: (settings: Partial<DetectionSettings>) => void
  resetSettings: () => void
}

export const defaultSettings: DetectionSettings = {
  processingSpeed: 'balanced',
  sensitivity: 0.7,
  showBoundingBoxes: true,
  showHeatmap: true,
  showConfidenceBadge: true,
  // Research-grade features enabled by default
  enableCalibration: true,
  enableAdversarialDetection: true,
  enablePartialDetection: true,
  // Defensive transformations disabled by default
  enableDefensiveTransforms: false,
  jpegQuality: 90,
  gaussianBlur: 1.0,
  enableRandomCrop: false,
  enableResize: true,
}

export const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  updateSettings: () => {},
  resetSettings: () => {},
})
