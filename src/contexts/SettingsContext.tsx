import { useState, useCallback } from 'react'
import { SettingsContext, defaultSettings, DetectionSettings } from './settings-context'

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<DetectionSettings>(() => {
    // Load from localStorage if available
    try {
      const saved = localStorage.getItem('detection-settings')
      if (saved) return { ...defaultSettings, ...JSON.parse(saved) }
    } catch { /* ignore */ }
    return defaultSettings
  })

  const updateSettings = useCallback((partial: Partial<DetectionSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial }
      try { localStorage.setItem('detection-settings', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings)
    try { localStorage.removeItem('detection-settings') } catch { /* ignore */ }
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}
