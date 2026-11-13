import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../services/firebase';
import type { UserProfile } from '../types/reelist';

interface AuthViewProps {
  onLocalSignIn: (user: UserProfile) => void;
}

function formatAuthError(err: unknown, fallback: string): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';
  const message = err instanceof Error ? err.message : fallback;

  if (code === 'auth/unauthorized-domain' || message.includes('auth/unauthorized-domain')) {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
    return `Domain "${host}" is not authorized in Firebase Auth. Add "${host}" under Firebase Console → Authentication → Settings → Authorized domains.`;
  }
  if (code === 'auth/popup-blocked') {
    return 'Sign-in popup was blocked by your browser. Allow popups for this site and try again.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Sign-in popup was closed before completing.';
  }
  return message;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLocalSignIn }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setError(null);
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      onLocalSignIn({
        uid: 'local-default',
        displayName: 'Ritesh',
        email: 'ritesh@reelist.app',
        photoURL: null,
        isLocal: true,
      });
      return;
    }

    setSubmitting(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(formatAuthError(err, 'Google sign-in failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuestMode = () => {
    onLocalSignIn({
      uid: 'local-default',
      displayName: 'Ritesh',
      email: 'ritesh@reelist.app',
      photoURL: null,
      isLocal: true,
    });
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Enter both your email and password.');
      return;
    }

    if (!isFirebaseConfigured || !auth) {
      const displayName =
        name.trim() ||
        trimmedEmail.split('@')[0].replace(/^\w/, (c) => c.toUpperCase()) ||
        'MyWatchList Member';
      onLocalSignIn({
        uid: 'local-default',
        displayName,
        email: trimmedEmail,
        photoURL: null,
        isLocal: true,
      });
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        if (name.trim()) {
          await updateProfile(cred.user, { displayName: name.trim() });
        }
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--bg)] px-4 py-12 text-[var(--ink)]">
      <div className="w-full max-w-sm rounded-[26px] border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)]/15 font-display text-lg font-bold text-[var(--accent)]">
          M
        </div>
        <h1 className="mt-4 font-display text-[30px] font-bold tracking-[-0.02em]">
          Sign in to MyWatchList
        </h1>
        <p className="mt-1.5 text-[14px] text-[var(--muted)]">
          Sync your watchlist and episode progress across devices with Google &amp; Cloud Firestore.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-[14px] border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3.5 py-2.5 text-[13px] font-medium text-[var(--accent)]"
          >
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={submitting}
          onClick={() => void handleGoogle()}
          className="tap-press mt-6 flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-full bg-[var(--inverse-bg)] px-5 text-[14px] font-semibold text-[var(--inverse-ink)] disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81"
            />
          </svg>
          <span>{submitting ? 'Signing in...' : 'Sign in with Google'}</span>
        </button>

        <button
          type="button"
          onClick={handleGuestMode}
          className="tap-press mt-3 flex min-h-[46px] w-full items-center justify-center rounded-full border border-[var(--border)] bg-transparent px-5 text-[14px] font-semibold text-[var(--ink)] hover:bg-[var(--surface-subtle)]"
        >
          Continue as Guest
        </button>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-[var(--border)]" />
          <button
            type="button"
            onClick={() => setShowEmailForm((v) => !v)}
            className="text-[12px] font-medium text-[var(--muted)] hover:text-[var(--ink)]"
          >
            {showEmailForm ? 'Hide email sign-in' : 'Or use email & password'}
          </button>
          <div className="h-px flex-1 bg-[var(--border)]" />
        </div>

        {showEmailForm && (
          <form onSubmit={(e) => void handleEmailSubmit(e)} className="space-y-3.5">
            {mode === 'signup' && (
              <label className="block">
                <span className="text-[13px] font-medium text-[var(--muted)]">Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ritesh"
                  className="mt-1 min-h-[44px] w-full rounded-[14px] border border-[var(--border)] bg-transparent px-3.5 text-[14px] text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
                />
              </label>
            )}

            <label className="block">
              <span className="text-[13px] font-medium text-[var(--muted)]">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 min-h-[44px] w-full rounded-[14px] border border-[var(--border)] bg-transparent px-3.5 text-[14px] text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-[13px] font-medium text-[var(--muted)]">Password</span>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 min-h-[44px] w-full rounded-[14px] border border-[var(--border)] bg-transparent px-3.5 text-[14px] text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="tap-press min-h-[48px] w-full rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] text-[14px] font-semibold text-[var(--ink)] hover:bg-[var(--border)] disabled:opacity-60"
            >
              {mode === 'signin' ? 'Sign in with email' : 'Create account'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
                  setError(null);
                }}
                className="min-h-[44px] text-[13px] font-medium text-[var(--muted)] hover:text-[var(--ink)]"
              >
                {mode === 'signin'
                  ? 'New to MyWatchList? Create an account'
                  : 'Already have an account? Sign in'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
