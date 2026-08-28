'use client';

import React, { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);

  // If already logged in, navigate straight to dashboard
  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard/scheduled');
    }
  }, [status, router]);

  // Option 1: Direct Google Login (No email or password asked)
  const handleGoogleLogin = async () => {
    setLoadingGoogle(true);
    try {
      await signIn('google', { callbackUrl: '/dashboard/scheduled' });
    } catch {
      toast.error('Google Sign In failed. Please try again.');
      setLoadingGoogle(false);
    }
  };

  // Option 2: Direct Email ID & Password Login (No Google credentials needed)
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your Email ID');
      return;
    }
    if (!password) {
      toast.error('Please enter your Password');
      return;
    }

    setLoadingEmail(true);
    try {
      const res = await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false,
        callbackUrl: '/dashboard/scheduled',
      });

      if (res?.error) {
        toast.error(res.error || 'Invalid email or password');
        setLoadingEmail(false);
      } else if (res?.ok) {
        toast.success('Signed in successfully');
        router.push('/dashboard/scheduled');
      }
    } catch (err: any) {
      toast.error(err.message || 'Login failed. Please try again.');
      setLoadingEmail(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      {/* Centered Login Card matching exact Figma Screenshot */}
      <div className="w-full max-w-[400px] bg-white border border-slate-100 rounded-2xl p-10 shadow-sm">
        <h1 className="text-2xl font-bold text-center text-slate-900 mb-6">
          Login
        </h1>

        {/* ── OPTION 1: Google Login (One Click) ── */}
        <button
          onClick={handleGoogleLogin}
          disabled={loadingGoogle || loadingEmail || status === 'loading'}
          className="w-full flex items-center justify-center gap-2.5 bg-[#EAF7EE] hover:bg-[#DFF1E4] active:scale-[0.99] transition-colors text-slate-700 font-medium text-xs py-3 px-4 rounded-xl mb-6 shadow-none cursor-pointer disabled:opacity-60"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          <span>{loadingGoogle ? 'Redirecting to Google...' : 'Login with Google'}</span>
        </button>

        {/* Divider with text */}
        <div className="relative flex items-center justify-center mb-6">
          <div className="border-t border-slate-100 w-full" />
          <span className="bg-white px-3 text-[11px] text-slate-300 absolute whitespace-nowrap">
            or sign up through email
          </span>
        </div>

        {/* ── OPTION 2: Email & Password Login ── */}
        <form onSubmit={handleEmailLogin} className="space-y-3.5">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email ID"
              required
              className="w-full bg-[#F6F7F9] text-xs text-slate-800 placeholder:text-slate-400 px-4 py-3 rounded-xl border border-transparent focus:border-slate-300 focus:bg-white focus:outline-none transition-colors"
            />
          </div>

          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full bg-[#F6F7F9] text-xs text-slate-800 placeholder:text-slate-400 px-4 py-3 rounded-xl border border-transparent focus:border-slate-300 focus:bg-white focus:outline-none transition-colors"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loadingEmail || loadingGoogle}
              className="w-full bg-[#00A854] hover:bg-[#00964B] active:scale-[0.99] text-white text-xs font-semibold py-3 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {loadingEmail ? 'Logging in...' : 'Login'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
