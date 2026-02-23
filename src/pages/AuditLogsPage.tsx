import { useState } from 'react'
import { Header } from '@/components/Header'
import { AnimatedBackground } from '@/components/AnimatedBackground'
import { SettingsModal } from '@/components/SettingsModal'
import { AboutModal } from '@/components/AboutModal'
import AuditLogs from '@/components/AuditLogs'

export default function AuditLogsPage() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col relative">
      <AnimatedBackground />
      <Header
        onSettingsClick={() => setSettingsOpen(true)}
        onAboutClick={() => setAboutOpen(true)}
      />
      <main className="flex-1 container mx-auto px-4 py-8 relative z-10">
        <AuditLogs />
      </main>
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      <AboutModal open={aboutOpen} onOpenChange={setAboutOpen} />
    </div>
  )
}
