import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, MailCheck } from 'lucide-react';
import { apiRequest, setAuthToken } from '../../lib/api';
import { auth, googleAuthProvider } from '../../lib/firebase';
import type { UserProfile } from '../../types/app';
import { BuildVisionLogo, Button, InputField } from '../ui/Primitives';
import { AuthHouse3D } from './AuthHouse3D';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset' | 'verify';

export function AuthScreens({
  initialMode = 'login',
  pendingVerificationUser,
  onAuthenticated,
  onSkipVerification,
}: {
  initialMode?: AuthMode;
  pendingVerificationUser?: UserProfile | null;
  onAuthenticated: (user: UserProfile) => void;
  onSkipVerification?: () => void;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(pendingVerificationUser?.email || '');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [resetCode, setResetCode] = useState('');
  const [issuedCodeHint, setIssuedCodeHint] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      setAuthToken(idToken);
      const data = await apiRequest<{ user: UserProfile }>('/api/auth/firebase-sync', {
        method: 'POST',
      });
      onAuthenticated(data.user);
    } catch (err: any) {
      setError(err?.message || 'Google sign-in could not be completed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAuthToken(data.token);
      onAuthenticated(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Password and Confirm Password do not match.');
      return;
    }
    if (!acceptedTerms) {
      setError('Please accept the Terms and Conditions to create your account.');
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          email,
          password,
          phone: phone || undefined,
          acceptedTerms,
        }),
      });
      setAuthToken(data.token);
      onAuthenticated(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const data = await apiRequest<{ message: string; verificationCode?: string }>(
        '/api/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ email }),
        }
      );
      setInfo(data.message);
      if (data.verificationCode) {
        setIssuedCodeHint(data.verificationCode);
      }
      setMode('reset');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiRequest<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, code: resetCode, newPassword }),
      });
      setInfo(data.message);
      setIssuedCodeHint(null);
      setMode('login');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await apiRequest<{ user: UserProfile }>('/api/auth/verify-email', {
        method: 'POST',
      });
      onAuthenticated(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-white grid grid-cols-1 sm:grid-cols-12">
      {/* LEFT SECTION: White Form Area */}
      <div className="sm:col-span-6 lg:col-span-5 flex flex-col justify-between bg-white px-6 py-7 sm:px-8 lg:px-16 border-b sm:border-b-0 sm:border-r border-[#E5E6EB]">
        <div>
          <BuildVisionLogo />
        </div>

        <div className="w-full max-w-[380px] mx-auto my-8 lg:my-10">
          {error && (
            <div
              role="alert"
              className="mb-5 px-3.5 py-2.5 text-xs text-[#D94A50] bg-[#FEF2F2] border border-[#FECACA] rounded-lg"
            >
              {error}
            </div>
          )}
          {info && (
            <div className="mb-5 px-3.5 py-2.5 text-xs text-[#249B67] bg-[#ECFDF5] border border-[#A7F3D0] rounded-lg">
              {info}
            </div>
          )}

          {mode === 'login' && (
            <>
              <h1 className="font-display text-2xl font-semibold text-[#171923] tracking-tight">
                Sign In
              </h1>
              <p className="text-sm text-[#777B87] mt-1.5 mb-7">
                Sign in with any email address and password to access your architectural workspace.
              </p>

              <form onSubmit={handleLogin} className="space-y-4">
                <InputField
                  label="Email Address"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter any email address"
                />

                <div>
                  <InputField
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    rightSlot={
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="text-[#777B87] hover:text-[#3049F5] p-1 cursor-pointer"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
                  />
                  <div className="flex justify-end mt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setInfo(null);
                        setMode('forgot');
                      }}
                      className="text-xs font-medium text-[#3049F5] hover:text-[#172D9B] cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full h-11">
                  {loading ? 'Signing In...' : 'Sign In'}
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#E5E6EB]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-[#777B87]">or continue with</span>
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                disabled={loading}
                onClick={handleGoogleSignIn}
                className="w-full h-10"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                  />
                </svg>
                <span>Continue with Google</span>
              </Button>

              <p className="text-center text-sm text-[#777B87] mt-6">
                New to BUILDVISION AI?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setInfo(null);
                    setMode('register');
                  }}
                  className="font-medium text-[#3049F5] hover:text-[#172D9B] cursor-pointer"
                >
                  Create Account
                </button>
              </p>
            </>
          )}

          {mode === 'register' && (
            <>
              <h1 className="font-display text-2xl font-semibold text-[#171923] tracking-tight">
                Create Account
              </h1>
              <p className="text-sm text-[#777B87] mt-1.5 mb-6">
                Start planning houses with AI blueprint analysis and 3D modeling.
              </p>

              <form onSubmit={handleRegister} className="space-y-3.5">
                <InputField
                  label="Full Name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Elena Vance"
                />
                <InputField
                  label="Email Address"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="elena@architecture.co"
                />
                <InputField
                  label="Phone Number (Optional)"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 234-5678"
                />
                <InputField
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  rightSlot={
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="text-[#777B87] hover:text-[#3049F5] p-1 cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                />
                <InputField
                  label="Confirm Password"
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  rightSlot={
                    <button
                      type="button"
                      onClick={() => setShowConfirm((s) => !s)}
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                      className="text-[#777B87] hover:text-[#3049F5] p-1 cursor-pointer"
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                />

                <label className="flex items-start gap-2.5 pt-1 text-xs text-[#777B87] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-[#E5E6EB] text-[#3049F5] focus:ring-[#3049F5]"
                  />
                  <span>
                    I accept the BUILDVISION AI Terms and Conditions and acknowledge that AI blueprint measurements and cost estimates require licensed professional review.
                  </span>
                </label>

                <Button type="submit" disabled={loading} className="w-full h-11">
                  {loading ? 'Creating Account...' : 'Create Account'}
                </Button>
              </form>

              <p className="text-center text-sm text-[#777B87] mt-5">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode('login');
                  }}
                  className="font-medium text-[#3049F5] hover:text-[#172D9B] cursor-pointer"
                >
                  Sign In
                </button>
              </p>
            </>
          )}

          {mode === 'forgot' && (
            <>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#777B87] hover:text-[#171923] mb-5 cursor-pointer"
              >
                <ArrowLeft size={14} /> Back to Sign In
              </button>
              <h1 className="font-display text-2xl font-semibold text-[#171923] tracking-tight">
                Forgot Password
              </h1>
              <p className="text-sm text-[#777B87] mt-1.5 mb-6">
                Enter your registered email address to receive a password reset verification code.
              </p>

              <form onSubmit={handleForgot} className="space-y-4">
                <InputField
                  label="Email Address"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="architect@studio.com"
                />
                <Button type="submit" disabled={loading} className="w-full h-11">
                  {loading ? 'Preparing Reset...' : 'Send Reset Code'}
                </Button>
              </form>
            </>
          )}

          {mode === 'reset' && (
            <>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#777B87] hover:text-[#171923] mb-5 cursor-pointer"
              >
                <ArrowLeft size={14} /> Back to Sign In
              </button>
              <h1 className="font-display text-2xl font-semibold text-[#171923] tracking-tight">
                Reset Password
              </h1>
              <p className="text-sm text-[#777B87] mt-1.5 mb-5">
                Enter the 6-digit verification code and choose a new password.
              </p>
              {issuedCodeHint && (
                <div className="mb-4 px-3.5 py-2.5 text-xs bg-[#EEF1FF] text-[#172D9B] border border-[#D4DCFF] rounded-lg">
                  Verification code: <span className="font-mono-num font-semibold">{issuedCodeHint}</span>
                </div>
              )}

              <form onSubmit={handleReset} className="space-y-4">
                <InputField
                  label="Email Address"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <InputField
                  label="Verification Code"
                  required
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  placeholder="6-digit code"
                />
                <InputField
                  label="New Password"
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                />
                <Button type="submit" disabled={loading} className="w-full h-11">
                  {loading ? 'Updating Password...' : 'Update Password'}
                </Button>
              </form>
            </>
          )}

          {mode === 'verify' && (
            <div className="space-y-5">
              <div className="w-11 h-11 rounded-lg bg-[#EEF1FF] text-[#3049F5] flex items-center justify-center">
                <MailCheck size={20} />
              </div>
              <div>
                <h1 className="font-display text-2xl font-semibold text-[#171923] tracking-tight">
                  Verify Your Email
                </h1>
                <p className="text-sm text-[#777B87] mt-1.5">
                  Confirm ownership of <span className="text-[#171923] font-medium">{email}</span> to enable full project sharing and report exports.
                </p>
              </div>
              <Button
                type="button"
                disabled={loading}
                onClick={handleVerifyEmail}
                className="w-full h-11"
              >
                <CheckCircle2 size={16} />
                <span>{loading ? 'Verifying...' : 'Confirm Email Verification'}</span>
              </Button>
              {onSkipVerification && (
                <button
                  type="button"
                  onClick={onSkipVerification}
                  className="w-full text-center text-xs text-[#777B87] hover:text-[#171923] py-2 cursor-pointer"
                >
                  Continue to Workspace
                </button>
              )}
            </div>
          )}
        </div>

        <p className="text-xs text-[#777B87]">
          BUILDVISION AI Architectural Planning Platform
        </p>
      </div>

      {/* RIGHT SECTION: Interactive 3D Cutaway House */}
      <div className="sm:col-span-6 lg:col-span-7 min-h-[300px] sm:min-h-screen bg-[#F1F0EC]">
        <AuthHouse3D />
      </div>
    </div>
  );
}
