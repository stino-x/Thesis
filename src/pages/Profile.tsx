import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { AnimatedBackground } from '@/components/AnimatedBackground'
import { Header } from '@/components/Header'
import { SettingsModal } from '@/components/SettingsModal'
import { AboutModal } from '@/components/AboutModal'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { User, Mail, Calendar } from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function Profile() {
  const { user } = useAuth()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  if (!user) return null

  const createdAt = new Date(user.created_at).toLocaleDateString()

  const handleUpdateProfile = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName },
      })
      if (error) throw error
      toast.success('Profile updated successfully')
      setEditOpen(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (error) throw error
      toast.success('Password changed successfully')
      setPasswordOpen(false)
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      toast.error(error.message || 'Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative">
      <AnimatedBackground />
      
      <Header
        onSettingsClick={() => setSettingsOpen(true)}
        onAboutClick={() => setAboutOpen(true)}
      />

      <main className="flex-1 container mx-auto px-4 py-8 relative z-10">
        <motion.div
          className="max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="glass-strong">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="text-2xl">
                    {user.email?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
              <CardTitle className="text-2xl">
                {user.user_metadata?.full_name || 'User Profile'}
              </CardTitle>
              <CardDescription>
                Manage your account settings and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg glass">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Full Name</p>
                    <p className="text-sm text-muted-foreground">
                      {user.user_metadata?.full_name || 'Not provided'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 rounded-lg glass">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 rounded-lg glass">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Member Since</p>
                    <p className="text-sm text-muted-foreground">{createdAt}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1" variant="outline" onClick={() => {
                  setFullName(user.user_metadata?.full_name || '')
                  setEditOpen(true)
                }}>
                  Edit Profile
                </Button>
                <Button className="flex-1" variant="outline" onClick={() => {
                  setNewPassword('')
                  setConfirmPassword('')
                  setPasswordOpen(true)
                }}>
                  Change Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>

      {/* Edit Profile Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="glass-strong">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>Update your profile information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user.email || ''} disabled className="opacity-60" />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleUpdateProfile} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="glass-strong">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Enter your new password</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setPasswordOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleChangePassword} disabled={saving}>
                {saving ? 'Changing...' : 'Change Password'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      <AboutModal open={aboutOpen} onOpenChange={setAboutOpen} />
    </div>
  )
}