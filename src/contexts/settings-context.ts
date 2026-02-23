import { createContext } from 'react'

export interface DetectionSettings {
  processingSpeed: 'fast' | 'balanced' | 'accurate'
  sensitivity: number
  showBoundingBoxes: boolean
  showHeatmap: boolean
  showConfidenceBadge: boolean
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
}

export const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  updateSettings: () => {},
  resetSettings: () => {},
})
