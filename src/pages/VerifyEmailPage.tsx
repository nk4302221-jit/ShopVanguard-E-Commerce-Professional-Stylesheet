import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { MailCheck, ArrowRight, RotateCcw } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const VerifyEmailPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { updateUser, user } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState((location.state as any)?.email || user?.email || '');
  const [token, setToken] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      showToast('Please enter the verification code', 'error');
      return;
    }

    setIsVerifying(true);
    try {
      const res = await api.post('/auth/verify-email', { token: token.trim() });
      if (res.data.success) {
        showToast('Email verified successfully! Welcome to ShopVanguard.', 'success');
        if (user) {
          updateUser({ ...user, email_verified: true });
        }
        navigate('/');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Verification token is invalid or expired', 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      showToast('Please enter your registered email address', 'error');
      return;
    }

    setIsResending(true);
    try {
      const res = await api.post('/auth/resend-verification', { email });
      if (res.data.success) {
        showToast('A new verification code has been dispatched to your email!', 'success');
        if (res.data.data?.demoToken) {
          setToken(res.data.data.demoToken);
        }
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to resend code', 'error');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="site-wrapper" style={{ margin: '60px auto 80px', maxWidth: '460px' }} id="verify-email-container">
      <div className="card" style={{ padding: '36px 32px', textAlign: 'center' }}>
        <div
          style={{
            width: '60px',
            height: '60px',
            background: 'var(--primary-light)',
            color: 'var(--primary)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <MailCheck size={30} />
        </div>

        <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Verify Your Email</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
          Please enter the verification token sent to <strong>{email || 'your email'}</strong>
        </p>

        <form onSubmit={handleVerify} style={{ textAlign: 'left' }}>
          {!user && (
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-control"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                id="verify-email-address-input"
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Verification Code / Token</label>
            <input
              type="text"
              className="form-control"
              required
              placeholder="e.g. 64-character verification code"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              style={{ letterSpacing: '1px' }}
              id="verification-token-input"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: '8px' }}
            disabled={isVerifying}
            id="submit-verify-btn"
          >
            {isVerifying ? 'Verifying...' : 'Verify Email'} <ArrowRight size={18} />
          </button>
        </form>

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleResend}
            disabled={isResending}
            id="resend-code-btn"
          >
            <RotateCcw size={14} /> {isResending ? 'Resending...' : 'Resend Code'}
          </button>
        </div>

        <div style={{ marginTop: '20px', fontSize: '13px' }}>
          <Link to="/" style={{ color: 'var(--text-muted)' }}>Return to Home</Link>
        </div>
      </div>
    </div>
  );
};
