# Authentication Implementation Plan

## 🎯 Overview

This document outlines the comprehensive authentication system implementation for the Deepfake Detection application. The implementation will be done on a **separate branch** to keep it isolated from the main codebase.

---

## 🏗️ Architecture Decision

### **Recommended Approach: Supabase Authentication**

**Why Supabase?**
- ✅ Easy to set up and integrate
- ✅ Built-in authentication with multiple providers
- ✅ Real-time subscriptions
- ✅ PostgreSQL database included
- ✅ Row-level security (RLS)
- ✅ Free tier available (perfect for thesis project)
- ✅ No backend code needed initially
- ✅ Can store video analysis history per user

**Alternative Options:**
1. **Firebase Auth** - Similar to Supabase, Google ecosystem
2. **Auth0** - Enterprise-grade, might be overkill
3. **Custom Backend** - More work, but full control (Node.js + JWT)

---

## 📋 Features to Implement

### **Phase 1: Basic Authentication** (Week 1)
- [x] Email/Password signup
- [x] Email/Password login
- [x] Logout functionality
- [x] Session persistence
- [x] Protected routes
- [x] Auth context/provider
- [x] Login/Signup UI pages

### **Phase 2: Enhanced Features** (Week 2)
- [ ] Email verification
- [ ] Password reset/forgot password
- [ ] Social OAuth (Google, GitHub)
- [ ] User profile page
- [ ] Update profile (name, avatar)
- [ ] Delete account

### **Phase 3: User Features** (Week 3)
- [ ] Save video analysis history
- [ ] View past detections
- [ ] Export detection reports
- [ ] Usage statistics dashboard
- [ ] Analysis quota/limits

### **Phase 4: Polish** (Week 4)
- [ ] Loading states
- [ ] Error handling
- [ ] Form validation
- [ ] Password strength indicator
- [ ] Remember me functionality
- [ ] Auto-logout on token expiry

---

## 🌿 Branch Strategy

```bash
# Create auth implementation branch
git checkout design-markup
git checkout -b feat/authentication

# Sub-branches (optional for organized development)
feat/authentication
├── feat/auth-setup          # Supabase setup & config
├── feat/auth-context        # Auth context and hooks
├── feat/auth-ui             # Login/Signup pages
├── feat/protected-routes    # Route protection
└── feat/user-features       # Profile, history, etc.
```

---

## 📦 Dependencies to Install

```bash
# Supabase client
npm install @supabase/supabase-js

# Form validation (already installed)
# - react-hook-form ✅
# - zod ✅

# Optional: JWT decoding (if needed)
npm install jwt-decode

# Optional: Password strength checker
npm install zxcvbn
npm install @types/zxcvbn --save-dev
```

---

## 🗂️ File Structure

```
src/
├── lib/
│   ├── supabase.ts           # Supabase client setup
│   └── auth.ts               # Auth helper functions
├── contexts/
│   └── AuthContext.tsx       # Auth context provider
├── hooks/
│   ├── useAuth.ts            # Auth hook
│   └── useRequireAuth.ts     # Protected route hook
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── SignupForm.tsx
│   │   ├── ForgotPasswordForm.tsx
│   │   ├── ResetPasswordForm.tsx
│   │   └── ProtectedRoute.tsx
│   └── profile/
│       ├── UserProfile.tsx
│       ├── ProfileEditor.tsx
│       └── AnalysisHistory.tsx
├── pages/
│   ├── Login.tsx
│   ├── Signup.tsx
│   ├── ForgotPassword.tsx
│   ├── ResetPassword.tsx
│   ├── Profile.tsx
│   └── Dashboard.tsx         # User dashboard with history
└── types/
    └── auth.ts               # Auth-related types
```

---

## 🚀 Implementation Steps

### **Step 1: Setup Supabase** (30 minutes)

1. **Create Supabase Project:**
   - Go to [supabase.com](https://supabase.com)
   - Sign up / Login
   - Create new project: "deepfake-detector"
   - Note down: API URL and anon key

2. **Create environment file:**
   ```bash
   # .env.local
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

3. **Create Supabase client:**
   ```typescript
   // src/lib/supabase.ts
   import { createClient } from '@supabase/supabase-js'
   
   const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
   const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
   
   export const supabase = createClient(supabaseUrl, supabaseAnonKey)
   ```

---

### **Step 2: Create Auth Context** (1 hour)

```typescript
// src/contexts/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  signUp: (email: string, password: string) => Promise<any>
  signIn: (email: string, password: string) => Promise<any>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<any>
  updatePassword: (newPassword: string) => Promise<any>
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    return { data, error }
  }

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const resetPassword = async (email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { data, error }
  }

  const updatePassword = async (newPassword: string) => {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    })
    return { data, error }
  }

  const value = {
    user,
    session,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    loading,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
```

---

### **Step 3: Create Auth Hook** (30 minutes)

```typescript
// src/hooks/useRequireAuth.ts
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function useRequireAuth() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true })
    }
  }, [user, loading, navigate])

  return { user, loading }
}
```

---

### **Step 4: Create Login Page** (1.5 hours)

```typescript
// src/pages/Login.tsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { motion } from 'framer-motion'
import { Mail, Lock, Loader2 } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await signIn(email, password)

    if (error) {
      toast({
        title: 'Login Failed',
        description: error.message,
        variant: 'destructive',
      })
      setLoading(false)
    } else {
      toast({
        title: 'Welcome back!',
        description: 'You have successfully logged in.',
      })
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="w-full max-w-md glass-strong">
          <CardHeader className="space-y-1">
            <CardTitle className="text-3xl font-bold text-center">
              Welcome Back
            </CardTitle>
            <CardDescription className="text-center">
              Sign in to access your deepfake detection dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    to="/forgot-password"
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full gradient-hero"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="text-sm text-center text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/signup" className="text-primary hover:underline">
                Sign up
              </Link>
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  )
}
```

---

### **Step 5: Create Signup Page** (1 hour)

Similar structure to Login page, but with additional fields (name, confirm password, terms acceptance).

---

### **Step 6: Protect Routes** (30 minutes)

```typescript
// src/components/auth/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
```

---

### **Step 7: Update App.tsx with Routes** (15 minutes)

```typescript
// src/App.tsx
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const App = () => (
  <AuthProvider>
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      
      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Index />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  </AuthProvider>
);

export default App;
```

---

### **Step 8: Update Header with User Menu** (1 hour)

```typescript
// Add to Header.tsx
import { useAuth } from '@/contexts/AuthContext'
import { Avatar, AvatarFallback } from './ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { User, LogOut, Settings } from 'lucide-react'

// Inside Header component:
const { user, signOut } = useAuth()

// Add user menu:
{user ? (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="rounded-full">
        <Avatar>
          <AvatarFallback>
            {user.email?.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-56 glass-strong">
      <DropdownMenuLabel>
        <div className="flex flex-col space-y-1">
          <p className="text-sm font-medium">{user.email}</p>
          <p className="text-xs text-muted-foreground">
            {user.email}
          </p>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => navigate('/profile')}>
        <User className="mr-2 h-4 w-4" />
        Profile
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onSettingsClick}>
        <Settings className="mr-2 h-4 w-4" />
        Settings
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={signOut}>
        <LogOut className="mr-2 h-4 w-4" />
        Sign Out
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
) : (
  <Button asChild>
    <Link to="/login">Sign In</Link>
  </Button>
)}
```

---

## 🗄️ Database Schema (Supabase)

### **User Profiles Table**
```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);
```

### **Video Analysis History Table**
```sql
CREATE TABLE video_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  video_name TEXT NOT NULL,
  video_size INTEGER,
  analysis_result TEXT NOT NULL, -- 'authentic', 'deepfake', 'uncertain'
  confidence_score DECIMAL(5, 2),
  frames_analyzed INTEGER,
  detection_time DECIMAL(10, 2),
  segments JSONB, -- Store timeline segments
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE video_analyses ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own analyses"
  ON video_analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own analyses"
  ON video_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own analyses"
  ON video_analyses FOR DELETE
  USING (auth.uid() = user_id);
```

---

## 🧪 Testing Checklist

- [ ] User can sign up with email/password
- [ ] Email validation works
- [ ] Password strength requirements enforced
- [ ] User can log in
- [ ] Session persists on page refresh
- [ ] User can log out
- [ ] Protected routes redirect to login
- [ ] After login, user redirects to home
- [ ] User menu shows correct email
- [ ] Password reset email sends
- [ ] Password reset link works
- [ ] Profile updates save correctly
- [ ] Analysis history saves per user
- [ ] Only user's own data visible

---

## 📝 Git Workflow

```bash
# 1. Create feature branch
git checkout design-markup
git checkout -b feat/authentication

# 2. Install dependencies
npm install @supabase/supabase-js

# 3. Make commits as you implement
git add .
git commit -m "feat(auth): setup Supabase client and environment"

git add src/contexts/AuthContext.tsx
git commit -m "feat(auth): add auth context with sign in/up/out"

git add src/pages/Login.tsx
git commit -m "feat(auth): add login page with form validation"

git add src/pages/Signup.tsx
git commit -m "feat(auth): add signup page"

git add src/components/auth/ProtectedRoute.tsx
git commit -m "feat(auth): add protected route wrapper"

git add src/App.tsx
git commit -m "feat(auth): integrate auth provider and protected routes"

# 4. Test thoroughly

# 5. When ready, merge to design-markup
git checkout design-markup
git merge feat/authentication

# 6. Or create PR for review
git push origin feat/authentication
```

---

## 🎨 UI Considerations

- Use existing design system (glass morphism, gradients)
- Match color scheme (primary, accent colors)
- Use Framer Motion for animations
- Mobile responsive forms
- Loading states for async operations
- Clear error messages
- Success toasts for actions

---

## 🔒 Security Best Practices

1. **Never store passwords in plain text** (Supabase handles this)
2. **Use HTTPS in production** (Supabase provides SSL)
3. **Implement rate limiting** (Supabase has built-in protection)
4. **Validate on both client and server**
5. **Use Row Level Security (RLS)** in database
6. **Store API keys in environment variables**
7. **Never commit .env files to git**

---

## 📚 Resources

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [React Router Protected Routes](https://reactrouter.com/en/main/start/tutorial)
- [React Hook Form](https://react-hook-form.com/)
- [Zod Validation](https://zod.dev/)

---

## ⏱️ Time Estimates

| Phase | Task | Time |
|-------|------|------|
| Setup | Create Supabase project | 30 min |
| Setup | Install dependencies | 10 min |
| Setup | Environment configuration | 15 min |
| Core | Auth context | 1 hour |
| Core | Auth hooks | 30 min |
| UI | Login page | 1.5 hours |
| UI | Signup page | 1 hour |
| UI | Forgot password page | 45 min |
| UI | Protected routes | 30 min |
| Integration | Update App routing | 15 min |
| Integration | Update Header with user menu | 1 hour |
| Features | User profile page | 2 hours |
| Features | Analysis history | 2 hours |
| Testing | Manual testing | 2 hours |
| **Total** | | **~13 hours** |

---

## ✅ Success Criteria

Authentication is complete when:
1. ✅ Users can sign up and receive confirmation email
2. ✅ Users can log in and stay logged in (session persistence)
3. ✅ Protected routes are inaccessible without authentication
4. ✅ Users can reset forgotten passwords
5. ✅ User menu shows current user info
6. ✅ Users can update their profile
7. ✅ Video analyses are saved per user
8. ✅ Users can view their analysis history
9. ✅ Logout works correctly
10. ✅ All forms have proper validation and error handling

---

## 🚀 Next Steps After Auth

Once authentication is complete, you can:
1. Add usage quotas (e.g., 10 analyses per day for free users)
2. Implement premium tier with more features
3. Add collaborative features (share analysis results)
4. Build admin dashboard
5. Add analytics and usage tracking
6. Implement email notifications
