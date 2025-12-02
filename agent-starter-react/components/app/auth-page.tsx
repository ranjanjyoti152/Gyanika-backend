'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/livekit/button';

interface AuthPageProps {
  onAuthSuccess: () => void;
}

export function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [classLevel, setClassLevel] = useState('');
  const [school, setSchool] = useState('');

  const { login, signup } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isLogin) {
        // Login
        const result = await login(email, password);
        if (result.success) {
          onAuthSuccess();
        } else {
          setError(result.error || 'Login failed');
        }
      } else {
        // Signup validation
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setIsLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          setIsLoading(false);
          return;
        }
        if (!name.trim()) {
          setError('Please enter your name');
          setIsLoading(false);
          return;
        }

        const result = await signup(name, email, password, classLevel, school);
        if (result.success) {
          onAuthSuccess();
        } else {
          setError(result.error || 'Signup failed');
        }
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated blur overlay */}
      <div className="fixed inset-0 backdrop-blur-sm z-0" />
      
      <div className="w-full max-w-md animate-fade-in-up relative z-10">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="relative inline-block animate-float">
            <div className="text-6xl mb-4">🎓</div>
            <div className="absolute inset-0 flex items-center justify-center -z-10">
              <div className="w-20 h-20 rounded-full bg-cyan-500/20 blur-xl animate-pulse" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-cyan-100 glow-text">Gyanika</h1>
          <p className="text-cyan-300/80 mt-2">Your AI Learning Assistant</p>
        </div>

        {/* Auth Card with glass effect */}
        <div className="glass-panel rounded-2xl shadow-2xl p-6 relative">
          {/* Tabs */}
          <div className="flex mb-6 bg-cyan-900/30 rounded-lg p-1 backdrop-blur-sm relative">
            <button
              className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all duration-300 ${
                isLogin 
                  ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-100 shadow-lg' 
                  : 'text-cyan-400/70 hover:text-cyan-300'
              }`}
              onClick={() => { setIsLogin(true); setError(null); }}
            >
              Login
            </button>
            <button
              className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all duration-300 ${
                !isLogin 
                  ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-100 shadow-lg' 
                  : 'text-cyan-400/70 hover:text-cyan-300'
              }`}
              onClick={() => { setIsLogin(false); setError(null); }}
            >
              Sign Up
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm backdrop-blur-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-cyan-200 mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-2.5 bg-cyan-900/30 border border-cyan-500/30 rounded-lg text-cyan-100 placeholder:text-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent transition-all backdrop-blur-sm"
                  required={!isLogin}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-cyan-200 mb-1.5">
                Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-4 py-2.5 bg-cyan-900/30 border border-cyan-500/30 rounded-lg text-cyan-100 placeholder:text-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent transition-all backdrop-blur-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-cyan-200 mb-1.5">
                Password *
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 bg-cyan-900/30 border border-cyan-500/30 rounded-lg text-cyan-100 placeholder:text-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent transition-all backdrop-blur-sm"
                required
              />
            </div>

            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-medium text-cyan-200 mb-1.5">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 bg-cyan-900/30 border border-cyan-500/30 rounded-lg text-cyan-100 placeholder:text-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent transition-all backdrop-blur-sm"
                    required={!isLogin}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-cyan-200 mb-1.5">
                      Class
                    </label>
                    <select
                      value={classLevel}
                      onChange={(e) => setClassLevel(e.target.value)}
                      className="w-full px-4 py-2.5 bg-cyan-900/30 border border-cyan-500/30 rounded-lg text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent transition-all backdrop-blur-sm"
                    >
                      <option value="" className="bg-slate-900">Select</option>
                      <option value="9" className="bg-slate-900">Class 9</option>
                      <option value="10" className="bg-slate-900">Class 10</option>
                      <option value="11" className="bg-slate-900">Class 11</option>
                      <option value="12" className="bg-slate-900">Class 12</option>
                      <option value="other" className="bg-slate-900">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-cyan-200 mb-1.5">
                      School
                    </label>
                    <input
                      type="text"
                      value={school}
                      onChange={(e) => setSchool(e.target.value)}
                      placeholder="School name"
                      className="w-full px-4 py-2.5 bg-cyan-900/30 border border-cyan-500/30 rounded-lg text-cyan-100 placeholder:text-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent transition-all backdrop-blur-sm"
                    />
                  </div>
                </div>
              </>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-cyan-500/30"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {isLogin ? 'Logging in...' : 'Creating account...'}
                </span>
              ) : (
                isLogin ? 'Login' : 'Create Account'
              )}
            </Button>
          </form>

          {/* Footer */}
          <p className="text-center text-cyan-400/70 text-sm mt-6">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(null); }}
              className="text-cyan-300 hover:text-cyan-100 hover:underline font-medium transition-colors"
            >
              {isLogin ? 'Sign up' : 'Login'}
            </button>
          </p>
        </div>

        {/* Features with glass effect */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="glass-panel rounded-xl p-3 transition-transform hover:scale-105 duration-300">
            <div className="text-2xl mb-1">🧠</div>
            <p className="text-xs text-cyan-300/80">Remembers You</p>
          </div>
          <div className="glass-panel rounded-xl p-3 transition-transform hover:scale-105 duration-300">
            <div className="text-2xl mb-1">📚</div>
            <p className="text-xs text-cyan-300/80">NCERT Syllabus</p>
          </div>
          <div className="glass-panel rounded-xl p-3 transition-transform hover:scale-105 duration-300">
            <div className="text-2xl mb-1">🎯</div>
            <p className="text-xs text-cyan-300/80">Personalized</p>
          </div>
        </div>
      </div>
    </div>
  );
}
