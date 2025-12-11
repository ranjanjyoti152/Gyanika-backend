'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// User interface
export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  exam_target?: string;
  preferred_language?: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; requiresOtp?: boolean; email?: string }>;
  signup: (
    name: string,
    email: string,
    password: string,
    classLevel?: string,
    school?: string
  ) => Promise<{ success: boolean; error?: string; requiresOtp?: boolean; email?: string }>;
  verifyOtp: (email: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  resendOtp: (email: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  token: null,
  login: async () => ({ success: false }),
  signup: async () => ({ success: false }),
  verifyOtp: async () => ({ success: false }),
  resendOtp: async () => ({ success: false }),
  logout: () => { },
});

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user on mount - check localStorage first, then verify with server
  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('gyanika_token');
      const savedUser = localStorage.getItem('gyanika_user');

      if (savedToken && savedUser) {
        try {
          // Verify token with server
          const response = await fetch('/api/auth/me', {
            headers: {
              Authorization: `Bearer ${savedToken}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            setUser(data.user);
            setToken(savedToken);
          } else {
            // Token invalid, clear storage
            localStorage.removeItem('gyanika_token');
            localStorage.removeItem('gyanika_user');
          }
        } catch (error) {
          // Server not available, use cached user
          console.log('Server not available, using cached user');
          setUser(JSON.parse(savedUser));
          setToken(savedToken);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('gyanika_token', data.token);
        localStorage.setItem('gyanika_user', JSON.stringify(data.user));
        return { success: true };
      } else {
        // Check if user needs OTP verification
        if (data.requiresOtp) {
          return { success: false, error: data.error, requiresOtp: true, email: data.email };
        }
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, []);

  const signup = useCallback(
    async (name: string, email: string, password: string, classLevel?: string, school?: string) => {
      try {
        // Create username from email
        const username = email
          .split('@')[0]
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');

        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            username,
            password,
            full_name: name,
            exam_target: classLevel ? `Class ${classLevel}` : 'General',
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // Check if OTP verification is required
          if (data.requiresOtp) {
            return { success: true, requiresOtp: true, email: data.email };
          }
          // Direct login (for backwards compatibility if OTP is disabled)
          setUser(data.user);
          setToken(data.token);
          localStorage.setItem('gyanika_token', data.token);
          localStorage.setItem('gyanika_user', JSON.stringify(data.user));
          return { success: true };
        } else {
          return { success: false, error: data.error || 'Registration failed' };
        }
      } catch (error) {
        console.error('Signup error:', error);
        return { success: false, error: 'Network error. Please try again.' };
      }
    },
    []
  );

  const verifyOtp = useCallback(async (email: string, otp: string) => {
    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('gyanika_token', data.token);
        localStorage.setItem('gyanika_user', JSON.stringify(data.user));
        return { success: true };
      } else {
        return { success: false, error: data.error || 'OTP verification failed' };
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, []);

  const resendOtp = useCallback(async (email: string) => {
    try {
      const response = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Failed to resend OTP' };
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('gyanika_token');
      localStorage.removeItem('gyanika_user');
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, isLoading, token, login, signup, verifyOtp, resendOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
