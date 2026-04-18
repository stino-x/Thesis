import { useState, useCallback, useEffect } from 'react'
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

  // Update detector threshold when sensitivity changes
  useEffect(() => {
    const updateDetectorThreshold = async () => {
      try {
        const { getDeepfakeDetector } = await import('@/lib/tensorflow');
        const detector = getDeepfakeDetector();
        await detector.waitForInitialization();
        detector.setThreshold(1 - settings.sensitivity);
        console.log(`🎚️  Updated detector threshold to ${(1 - settings.sensitivity).toFixed(2)} (sensitivity: ${settings.sensitivity.toFixed(2)})`);
      } catch (error) {
        console.warn('Failed to update detector threshold:', error);
      }
    };

    updateDetectorThreshold();
  }, [settings.sensitivity]);

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
