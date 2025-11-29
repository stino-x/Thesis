import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAuth } from '@/hooks/useAuth'
import { mockSupabase } from '../setup/mocks'

// Mock the supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
}))

describe('useAuth Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    test('returns null user when not authenticated', async () => {
      mockSupabase.auth.getSession.mockResolvedValueOnce({
        data: { session: null },
        error: null,
      })

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.user).toBeNull()
      })
    })

    test('returns user when authenticated', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: { full_name: 'Test User' },
      }

      mockSupabase.auth.getSession.mockResolvedValueOnce({
        data: {
          session: {
            user: mockUser,
            access_token: 'token-123',
          },
        },
        error: null,
      })

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser)
      })
    })
  })

  describe('Sign In', () => {
    test('signs in user with valid credentials', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      }

      mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: mockUser, session: {} },
        error: null,
      })

      const { result } = renderHook(() => useAuth())

      const response = await result.current.signIn(
        'test@example.com',
        'password123'
      )

      expect(response.user).toEqual(mockUser)
      expect(response.error).toBeNull()
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      })
    })

    test('returns error for invalid credentials', async () => {
      const mockError = { message: 'Invalid credentials' }

      mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: mockError,
      })

      const { result } = renderHook(() => useAuth())

      const response = await result.current.signIn(
        'test@example.com',
        'wrongpassword'
      )

      expect(response.user).toBeNull()
      expect(response.error).toEqual(mockError)
    })
  })

  describe('Sign Up', () => {
    test('creates new user account', async () => {
      const mockUser = {
        id: 'user-456',
        email: 'newuser@example.com',
      }

      mockSupabase.auth.signUp.mockResolvedValueOnce({
        data: { user: mockUser, session: null },
        error: null,
      })

      const { result } = renderHook(() => useAuth())

      const response = await result.current.signUp(
        'newuser@example.com',
        'password123',
        { full_name: 'New User' }
      )

      expect(response.user).toEqual(mockUser)
      expect(response.error).toBeNull()
      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        password: 'password123',
        options: {
          data: { full_name: 'New User' },
        },
      })
    })

    test('returns error for duplicate email', async () => {
      const mockError = { message: 'User already exists' }

      mockSupabase.auth.signUp.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: mockError,
      })

      const { result } = renderHook(() => useAuth())

      const response = await result.current.signUp(
        'existing@example.com',
        'password123'
      )

      expect(response.error).toEqual(mockError)
    })
  })

  describe('Sign Out', () => {
    test('signs out user successfully', async () => {
      mockSupabase.auth.signOut.mockResolvedValueOnce({
        error: null,
      })

      const { result } = renderHook(() => useAuth())

      await result.current.signOut()

      expect(mockSupabase.auth.signOut).toHaveBeenCalled()
    })

    test('handles sign out error', async () => {
      const mockError = { message: 'Sign out failed' }

      mockSupabase.auth.signOut.mockResolvedValueOnce({
        error: mockError,
      })

      const { result } = renderHook(() => useAuth())

      await expect(result.current.signOut()).rejects.toThrow('Sign out failed')
    })
  })

  describe('Password Reset', () => {
    test('sends password reset email', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValueOnce({
        data: {},
        error: null,
      })

      const { result } = renderHook(() => useAuth())

      const response = await result.current.resetPassword('test@example.com')

      expect(response.error).toBeNull()
      expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com'
      )
    })

    test('handles invalid email', async () => {
      const mockError = { message: 'Invalid email' }

      mockSupabase.auth.resetPasswordForEmail.mockResolvedValueOnce({
        data: null,
        error: mockError,
      })

      const { result } = renderHook(() => useAuth())

      const response = await result.current.resetPassword('invalid-email')

      expect(response.error).toEqual(mockError)
    })
  })

  describe('Session Management', () => {
    test('updates user on auth state change', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      }

      let authCallback: any

      mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
        authCallback = callback
        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        }
      })

      renderHook(() => useAuth())

      // Simulate auth state change
      authCallback('SIGNED_IN', { user: mockUser })

      await waitFor(() => {
        // User should be updated
        expect(authCallback).toHaveBeenCalled()
      })
    })
  })
})
