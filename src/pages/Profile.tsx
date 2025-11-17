import { useAuth } from '@/hooks/useAuth'
import { AnimatedBackground } from '@/components/AnimatedBackground'
import { Header } from '@/components/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { User, Mail, Calendar } from 'lucide-react'
import { motion } from 'framer-motion'

export default function Profile() {
  const { user } = useAuth()

  if (!user) return null

  const createdAt = new Date(user.created_at).toLocaleDateString()

  return (
    <div className="min-h-screen flex flex-col relative">
      <AnimatedBackground />
      
      <Header
        onSettingsClick={() => {}}
        onAboutClick={() => {}}
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
                <Button className="flex-1" variant="outline">
                  Edit Profile
                </Button>
                <Button className="flex-1" variant="outline">
                  Change Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  )
}