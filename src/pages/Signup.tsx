import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { Mail, Lock, Loader2, Eye, EyeOff, User } from 'lucide-react'
import { AnimatedBackground } from '@/components/AnimatedBackground'
import { OAuthButton } from '@/components/auth/OAuthButton'

export default function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null)
  const [isEmailSent, setIsEmailSent] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const { signUp, signInWithOAuth } = useAuth()
  const navigate = useNavigate()

  const validatePassword = (password: string) => {
    return password.length >= 6
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!acceptTerms) {
      toast.error('Please accept the terms and conditions.')
      return
    }

    if (!validatePassword(password)) {
      toast.error('Password must be at least 6 characters long.')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Please make sure your passwords match.')
      return
    }

    setLoading(true)

    const { data, error } = await signUp(email, password, name)

    if (error) {
      toast.error(error.message)
      setLoading(false)
    } else {
      setUserEmail(email)
      setLoading(false)
      
      // Always show email confirmation screen for new signups
      if (data.user && !data.user.email_confirmed_at) {
        setIsEmailSent(true)
      } else {
        // If email is already confirmed (rare case), go to login
        toast.success('Account created! You can now sign in.')
        navigate('/login')
      }
    }
  }

  const handleOAuthSignIn = async (provider: 'google' | 'github') => {
    setOauthLoading(provider)
    const { error } = await signInWithOAuth(provider)
    
    if (error) {
      toast.error(error.message)
      setOauthLoading(null)
    }
    // Note: On success, user will be redirected to OAuth provider
    // and then back to the app, so we don't need to handle success here
  }

  // Email confirmation success screen
  if (isEmailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <AnimatedBackground />
        
        <motion.div
          className="w-full max-w-md relative z-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="glass-strong border-border/50">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Mail className="h-16 w-16 text-green-500" />
              </div>
              <CardTitle className="text-2xl">Check Your Email</CardTitle>
              <CardDescription>
                We've sent you a confirmation link
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  We've sent a confirmation link to <strong className="text-foreground">{userEmail}</strong>
                </p>
                <p className="text-sm text-muted-foreground">
                  Please click the link in the email to verify your account before signing in.
                </p>
                <p className="text-sm text-muted-foreground">
                  Didn't receive the email? Check your spam folder or contact support.
                </p>
              </div>
              
              <div className="space-y-4">
                <Button 
                  onClick={() => {
                    setIsEmailSent(false)
                    setEmail('')
                    setPassword('')
                    setConfirmPassword('')
                    setName('')
                  }}
                  variant="outline" 
                  className="w-full"
                >
                  Sign Up with Different Email
                </Button>
                
                <Link to="/login">
                  <Button className="w-full gradient-hero">
                    Go to Login
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative">
      <AnimatedBackground />
      
      <motion.div
        className="w-full max-w-md relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="glass-strong border-border/50">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg gradient-hero">
                <span className="text-2xl font-bold">🔍</span>
              </div>
            </div>
            <CardTitle className="text-3xl font-bold">
              Create Account
            </CardTitle>
            <CardDescription>
              Join us to start detecting deepfakes with AI
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Must be at least 6 characters
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="terms"
                  checked={acceptTerms}
                  onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                />
                <Label htmlFor="terms" className="text-sm font-normal cursor-pointer">
                  I agree to the{' '}
                  <a href="#" onClick={(e) => { e.preventDefault(); toast.info('Terms of Service: This is a BSc thesis research project. Your data is processed locally in-browser. Detection results are logged to your Supabase account for audit purposes.') }} className="text-primary hover:underline">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="#" onClick={(e) => { e.preventDefault(); toast.info('Privacy Policy: Media files are analyzed client-side and never uploaded to any server. Audit logs are stored in your personal Supabase database.') }} className="text-primary hover:underline">
                    Privacy Policy
                  </a>
                </Label>
              </div>
              <Button
                type="submit"
                className="w-full gradient-hero"
                disabled={loading || oauthLoading !== null}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <OAuthButton
                  provider="google"
                  onClick={() => handleOAuthSignIn('google')}
                  loading={oauthLoading === 'google'}
                  disabled={loading || oauthLoading !== null}
                />
                <OAuthButton
                  provider="github"
                  onClick={() => handleOAuthSignIn('github')}
                  loading={oauthLoading === 'github'}
                  disabled={loading || oauthLoading !== null}
                />
              </div>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="text-sm text-center text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  )
}
