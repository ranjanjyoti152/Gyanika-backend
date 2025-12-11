'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/livekit/button';
import { useAuth } from '@/hooks/useAuth';

interface AuthPageProps {
  onAuthSuccess: () => void;
}

export function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // OTP verification state
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [classLevel, setClassLevel] = useState('');
  const [school, setSchool] = useState('');

  const { login, signup, verifyOtp, resendOtp } = useAuth();

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Handle OTP input
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Only take the last character
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  // Handle OTP paste
  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 6) {
      setOtp(pastedData.split(''));
      otpInputRefs.current[5]?.focus();
    }
  };

  // Handle OTP backspace
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      if (isLogin) {
        // Login
        const result = await login(email, password);
        if (result.success) {
          onAuthSuccess();
        } else if (result.requiresOtp) {
          // User needs to verify email
          setOtpEmail(result.email || email);
          setShowOtpInput(true);
          setSuccess('Please verify your email to continue.');
          setResendCooldown(60);
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
          if (result.requiresOtp) {
            // Show OTP input
            setOtpEmail(result.email || email);
            setShowOtpInput(true);
            setSuccess('Verification code sent! Check your email.');
            setResendCooldown(60);
          } else {
            onAuthSuccess();
          }
        } else {
          setError(result.error || 'Signup failed');
        }
      }
    } catch (_err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const result = await verifyOtp(otpEmail, otpCode);
      if (result.success) {
        onAuthSuccess();
      } else {
        setError(result.error || 'Invalid verification code');
        setOtp(['', '', '', '', '', '']);
        otpInputRefs.current[0]?.focus();
      }
    } catch (_err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;

    setError(null);
    setIsLoading(true);

    try {
      const result = await resendOtp(otpEmail);
      if (result.success) {
        setSuccess('New verification code sent!');
        setResendCooldown(60);
        setOtp(['', '', '', '', '', '']);
        otpInputRefs.current[0]?.focus();
      } else {
        setError(result.error || 'Failed to resend code');
      }
    } catch (_err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToForm = () => {
    setShowOtpInput(false);
    setOtp(['', '', '', '', '', '']);
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Animated blur overlay */}
      <div className="fixed inset-0 z-0 backdrop-blur-sm" />

      <div className="animate-fade-in-up relative z-10 w-full max-w-md">
        {/* Logo & Title */}
        <div className="mb-8 text-center">
          <div className="animate-float relative inline-block">
            <div className="mb-4 text-6xl">🎓</div>
            <div className="absolute inset-0 -z-10 flex items-center justify-center">
              <div className="h-20 w-20 animate-pulse rounded-full bg-cyan-500/20 blur-xl" />
            </div>
          </div>
          <h1 className="glow-text text-4xl font-bold text-cyan-100">Gyanika</h1>
          <p className="mt-2 text-cyan-300/80">Your AI Learning Assistant</p>
        </div>

        {/* Auth Card with glass effect */}
        <div className="glass-panel relative rounded-2xl p-6 shadow-2xl">
          {showOtpInput ? (
            /* OTP Verification View */
            <>
              <div className="mb-6 text-center">
                <div className="mb-3 text-4xl">📧</div>
                <h2 className="text-xl font-semibold text-cyan-100">Verify Your Email</h2>
                <p className="mt-2 text-sm text-cyan-400/70">
                  Enter the 6-digit code sent to
                </p>
                <p className="font-medium text-cyan-300">{otpEmail}</p>
              </div>

              {/* Success Message */}
              {success && (
                <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/20 p-3 text-sm text-green-300 backdrop-blur-sm">
                  {success}
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/20 p-3 text-sm text-red-300 backdrop-blur-sm">
                  {error}
                </div>
              )}

              {/* OTP Input */}
              <div className="mb-6 flex justify-center gap-2">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { otpInputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={handleOtpPaste}
                    className="h-12 w-12 rounded-lg border border-cyan-500/30 bg-cyan-900/30 text-center text-xl font-bold text-cyan-100 backdrop-blur-sm transition-all focus:border-transparent focus:ring-2 focus:ring-cyan-400/50 focus:outline-none"
                    disabled={isLoading}
                  />
                ))}
              </div>

              {/* Verify Button */}
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="w-full transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-cyan-500/30"
                onClick={handleVerifyOtp}
                disabled={isLoading || otp.join('').length !== 6}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Verifying...
                  </span>
                ) : (
                  'Verify Email'
                )}
              </Button>

              {/* Resend & Back */}
              <div className="mt-4 flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleBackToForm}
                  className="text-cyan-400/70 transition-colors hover:text-cyan-300"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || isLoading}
                  className={`transition-colors ${resendCooldown > 0
                      ? 'cursor-not-allowed text-cyan-500/50'
                      : 'text-cyan-300 hover:text-cyan-100'
                    }`}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>
            </>
          ) : (
            /* Login/Signup Form */
            <>
              {/* Tabs */}
              <div className="relative mb-6 flex rounded-lg bg-cyan-900/30 p-1 backdrop-blur-sm">
                <button
                  className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-all duration-300 ${isLogin
                      ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-100 shadow-lg'
                      : 'text-cyan-400/70 hover:text-cyan-300'
                    }`}
                  onClick={() => {
                    setIsLogin(true);
                    setError(null);
                  }}
                >
                  Login
                </button>
                <button
                  className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-all duration-300 ${!isLogin
                      ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-100 shadow-lg'
                      : 'text-cyan-400/70 hover:text-cyan-300'
                    }`}
                  onClick={() => {
                    setIsLogin(false);
                    setError(null);
                  }}
                >
                  Sign Up
                </button>
              </div>

              {/* Success Message */}
              {success && (
                <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/20 p-3 text-sm text-green-300 backdrop-blur-sm">
                  {success}
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/20 p-3 text-sm text-red-300 backdrop-blur-sm">
                  {error}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-cyan-200">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full rounded-lg border border-cyan-500/30 bg-cyan-900/30 px-4 py-2.5 text-cyan-100 backdrop-blur-sm transition-all placeholder:text-cyan-500/50 focus:border-transparent focus:ring-2 focus:ring-cyan-400/50 focus:outline-none"
                      required={!isLogin}
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-cyan-200">Email *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="w-full rounded-lg border border-cyan-500/30 bg-cyan-900/30 px-4 py-2.5 text-cyan-100 backdrop-blur-sm transition-all placeholder:text-cyan-500/50 focus:border-transparent focus:ring-2 focus:ring-cyan-400/50 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-cyan-200">Password *</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-cyan-500/30 bg-cyan-900/30 px-4 py-2.5 text-cyan-100 backdrop-blur-sm transition-all placeholder:text-cyan-500/50 focus:border-transparent focus:ring-2 focus:ring-cyan-400/50 focus:outline-none"
                    required
                  />
                </div>

                {!isLogin && (
                  <>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-cyan-200">
                        Confirm Password *
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-lg border border-cyan-500/30 bg-cyan-900/30 px-4 py-2.5 text-cyan-100 backdrop-blur-sm transition-all placeholder:text-cyan-500/50 focus:border-transparent focus:ring-2 focus:ring-cyan-400/50 focus:outline-none"
                        required={!isLogin}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-cyan-200">Class</label>
                        <select
                          value={classLevel}
                          onChange={(e) => setClassLevel(e.target.value)}
                          className="w-full rounded-lg border border-cyan-500/30 bg-cyan-900/30 px-4 py-2.5 text-cyan-100 backdrop-blur-sm transition-all focus:border-transparent focus:ring-2 focus:ring-cyan-400/50 focus:outline-none"
                        >
                          <option value="" className="bg-slate-900">
                            Select
                          </option>
                          <option value="9" className="bg-slate-900">
                            Class 9
                          </option>
                          <option value="10" className="bg-slate-900">
                            Class 10
                          </option>
                          <option value="11" className="bg-slate-900">
                            Class 11
                          </option>
                          <option value="12" className="bg-slate-900">
                            Class 12
                          </option>
                          <option value="other" className="bg-slate-900">
                            Other
                          </option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-cyan-200">School</label>
                        <input
                          type="text"
                          value={school}
                          onChange={(e) => setSchool(e.target.value)}
                          placeholder="School name"
                          className="w-full rounded-lg border border-cyan-500/30 bg-cyan-900/30 px-4 py-2.5 text-cyan-100 backdrop-blur-sm transition-all placeholder:text-cyan-500/50 focus:border-transparent focus:ring-2 focus:ring-cyan-400/50 focus:outline-none"
                        />
                      </div>
                    </div>
                  </>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="mt-6 w-full transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-cyan-500/30"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      {isLogin ? 'Logging in...' : 'Creating account...'}
                    </span>
                  ) : isLogin ? (
                    'Login'
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </form>

              {/* Footer */}
              <p className="mt-6 text-center text-sm text-cyan-400/70">
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError(null);
                  }}
                  className="font-medium text-cyan-300 transition-colors hover:text-cyan-100 hover:underline"
                >
                  {isLogin ? 'Sign up' : 'Login'}
                </button>
              </p>
            </>
          )}
        </div>

        {/* Features with glass effect */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="glass-panel rounded-xl p-3 transition-transform duration-300 hover:scale-105">
            <div className="mb-1 text-2xl">🧠</div>
            <p className="text-xs text-cyan-300/80">Remembers You</p>
          </div>
          <div className="glass-panel rounded-xl p-3 transition-transform duration-300 hover:scale-105">
            <div className="mb-1 text-2xl">📚</div>
            <p className="text-xs text-cyan-300/80">NCERT Syllabus</p>
          </div>
          <div className="glass-panel rounded-xl p-3 transition-transform duration-300 hover:scale-105">
            <div className="mb-1 text-2xl">🎯</div>
            <p className="text-xs text-cyan-300/80">Personalized</p>
          </div>
        </div>
      </div>
    </div>
  );
}
