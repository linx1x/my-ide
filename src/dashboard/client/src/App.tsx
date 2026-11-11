import { useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ToastProvider } from './context/ToastContext';
import { IDELayout } from './components/IDELayout';
import { AppLoadingSkeleton } from './components/AppLoadingSkeleton';
import { api, fetchStatus } from './api';
import { queryKeys } from './queryKeys';

type LoginResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
};

function App() {
  const queryClient = useQueryClient();
  const statusQuery = useQuery({
    queryKey: queryKeys.status,
    queryFn: fetchStatus,
    retry: false,
    refetchOnWindowFocus: false, // avoid flipping back to Loading after showing Login
  });
  const authenticated = statusQuery.isSuccess;
  // Only show full-screen Loading on initial load (no data and no error yet).
  // Prevents Login from disappearing when a refetch runs (e.g. after refresh).
  const loading = statusQuery.isPending && !statusQuery.data && !statusQuery.error;

  const logoutMutation = useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.status });
    },
  });

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
  };

  if (loading) {
    return <AppLoadingSkeleton />;
  }

  if (!authenticated) {
    return <Login onSuccess={() => queryClient.invalidateQueries({ queryKey: queryKeys.status })} />;
  }

  return (
    <ToastProvider>
      <IDELayout onLogout={handleLogout} />
    </ToastProvider>
  );
}

/** Avoid showing raw TypeError messages; show a short user-facing message instead. */
function sanitizeLoginError(msg: unknown): string {
  if (typeof msg !== 'string' || !msg) {return '';}
  if (/Cannot read propert/i.test(msg) || /undefined.*reading/i.test(msg)) {
    return 'Something went wrong. Try again or check that WhatsApp is connected.';
  }
  return msg;
}

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [error, setError] = useState('');

  const requestOtpMutation = useMutation({
    mutationFn: (phoneVal: string) =>
      api('/auth/request-otp', {
        method: 'POST',
        body: { phone: phoneVal.trim() },
      }),
    onSuccess: async (r: Response) => {
      const data = (await r.json().catch(() => ({}))) as LoginResponse;
      if (data.message) {setOtpStep(true);}
      else {setError(sanitizeLoginError(data.error) || 'Failed to send code');}
    },
    onError: (err: Error) => setError(sanitizeLoginError(err.message) || 'Failed to send code'),
  });

  const verifyOtpMutation = useMutation({
    mutationFn: ({ phoneVal, codeVal }: { phoneVal: string; codeVal: string }) =>
      api('/auth/verify-otp', {
        method: 'POST',
        body: { phone: phoneVal.trim(), code: codeVal.trim() },
      }),
    onSuccess: async (r: Response) => {
      const data = (await r.json().catch(() => ({}))) as LoginResponse;
      if (r.ok && data.ok) {
        onSuccess();
      } else {
        setError(sanitizeLoginError(data.error) || 'Invalid code');
      }
    },
    onError: (err: Error) => setError(sanitizeLoginError(err.message) || 'Invalid code'),
  });

  const handleRequestOtp = () => {
    setError('');
    if (!phone.trim()) {return setError('Enter your phone number');}
    requestOtpMutation.mutate(phone);
  };

  const handleVerify = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    if (!phone.trim() || !code.trim()) {return setError('Enter phone and code');}
    verifyOtpMutation.mutate({ phoneVal: phone, codeVal: code });
  };

  const loading = requestOtpMutation.isPending || verifyOtpMutation.isPending;

  return (
    <div className="screen">
      <div className="login-card">
        <h1>My IDE</h1>
        <p className="sub">Secure access — verify with your phone</p>
        <form onSubmit={handleVerify}>
          <label>Phone number (e.g. +33 6 12 34 56 78)</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="33612345678"
            required
          />
          {otpStep && (
            <>
              <label>Verification code (sent to WhatsApp)</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
                pattern="[0-9]+"
              />
            </>
          )}
          <div className="btn-row">
            <button type="button" onClick={handleRequestOtp} disabled={loading}>
              Send code
            </button>
            {otpStep && (
              <button type="submit" disabled={loading}>
                Verify
              </button>
            )}
          </div>
        </form>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}

export default App;
