'use client';

import { useActionState, useEffect } from 'react';
import { useTransitionRouter } from 'next-transition-router';
import { loginAction, type LoginState } from '@/app/admin/actions';

const INITIAL: LoginState = { ok: false };

/** Email + password. On success the register-cell transition carries the admin into the workspace. */
export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, INITIAL);
  const router = useTransitionRouter();

  useEffect(() => {
    if (state.ok) router.push('/admin');
  }, [state.ok, router]);

  return (
    <form action={action} className="login-form" noValidate>
      <div className="field">
        <label htmlFor="email">Work email</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <p role="alert" className="form-error">
        {state.error ?? ''}
      </p>
      <button type="submit" className="btn-primary" disabled={pending || state.ok}>
        {pending || state.ok ? 'Opening your workspace' : 'Sign in to the console'}
      </button>
    </form>
  );
}
