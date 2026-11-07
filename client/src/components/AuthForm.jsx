import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, Layers3, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuth from '../hooks/useAuth.js';
import { dashboardPath } from '../utils/auth.js';
import { errorMessage } from '../api/axios.js';
import Loader from './Loader.jsx';

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});
const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2, 'Enter at least 2 characters').max(80),
  password: z
    .string()
    .min(8, 'Use at least 8 characters')
    .max(72, 'Use no more than 72 characters'),
});

export default function AuthForm({ mode }) {
  const isRegister = mode === 'register';
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(isRegister ? registerSchema : loginSchema) });
  const submit = async (values) => {
    try {
      const user = await auth[mode](values);
      toast.success(isRegister ? 'Your workspace is ready' : 'Welcome back');
      navigate(dashboardPath(user), { replace: true });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  if (auth.loading) return <Loader />;
  if (auth.user) return <Navigate to={dashboardPath(auth.user)} replace />;
  return (
    <main className="auth-shell">
      <aside className="auth-story">
        <span className="eyebrow">A place for everything</span>
        <h1>
          Good things
          <br />
          start with
          <br />
          <em>structure.</em>
        </h1>
        <p>
          Your people, your categories, your next big idea.
          <br />
          Bring it all together in one thoughtful workspace.
        </p>
        <div className="auth-art">
          <Layers3 size={90} strokeWidth={0.6} />
        </div>
        <small>
          <ShieldCheck size={16} /> Secure by design. Simple by nature.
        </small>
      </aside>
      <section className="auth-panel">
        <div className="auth-content">
          <span className="eyebrow">
            {isRegister ? 'Make room for what’s next' : 'Your workspace awaits'}
          </span>
          <h2>{isRegister ? 'Create your account' : 'Welcome back.'}</h2>
          {!isRegister && location.state?.accountNotice === 'password-reset' && (
            <p className="recovery-notice" role="status">
              Password reset successfully. Sign in with your new password.
            </p>
          )}
          {!isRegister && location.state?.accountNotice === 'email-changed' && (
            <p className="recovery-notice" role="status">
              Email updated. Sign in with your new email address.
            </p>
          )}
          <p className="muted">
            {isRegister
              ? 'A fresh start, with everything in its place.'
              : 'Sign in to pick up where you left off.'}
          </p>
          <form onSubmit={handleSubmit(submit)} noValidate>
            {[...(isRegister ? ['name'] : []), 'email', 'password'].map((field) => (
              <div className="field" key={field}>
                <label htmlFor={field}>
                  {field === 'name'
                    ? 'Full name'
                    : field === 'email'
                      ? 'Email address'
                      : 'Password'}
                </label>
                <input
                  id={field}
                  type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                  autoComplete={
                    field === 'password'
                      ? isRegister
                        ? 'new-password'
                        : 'current-password'
                      : field
                  }
                  aria-invalid={!!errors[field]}
                  aria-describedby={errors[field] ? `${field}-error` : undefined}
                  {...register(field)}
                />
                {errors[field] && (
                  <span className="field-error" id={`${field}-error`} role="alert">
                    {errors[field].message}
                  </span>
                )}
              </div>
            ))}
            <button className="button w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
              <ArrowRight size={16} />
            </button>
          </form>
          {!isRegister && (
            <p>
              <Link to="/forgot-password">Forgot password?</Link>
            </p>
          )}
          <p className="auth-switch">
            {isRegister ? 'Already have an account?' : 'New around here?'}{' '}
            <Link to={isRegister ? '/login' : '/register'}>
              {isRegister ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
