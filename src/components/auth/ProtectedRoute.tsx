import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  console.log('[ProtectedRoute] user:', user ? user.email : 'null', 'loading:', loading, 'path:', location.pathname)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-strong rounded-xl p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    console.log('[ProtectedRoute] No user, redirecting to /login')
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
