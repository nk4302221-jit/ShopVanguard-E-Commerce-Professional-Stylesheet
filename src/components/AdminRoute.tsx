import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AdminRouteProps {
  children: React.ReactNode;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <div style={{ fontSize: '16px', color: 'var(--text-muted)' }}>Verifying administrative rights...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    return (
      <div className="site-wrapper" style={{ margin: '80px auto', maxWidth: '580px', textAlign: 'center' }}>
        <div className="card" style={{ padding: '48px 32px' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              background: '#fee2e2',
              color: '#dc2626',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
            }}
          >
            <ShieldAlert size={36} />
          </div>
          <span className="badge badge-danger" style={{ marginBottom: '12px', fontSize: '13px' }}>
            HTTP 403 Forbidden
          </span>
          <h1 style={{ fontSize: '28px', marginBottom: '12px' }}>Access Denied</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '28px', lineHeight: 1.6 }}>
            You do not have administrative credentials to view the ShopVanguard Admin Management Portal.
            This incident is logged for security compliance.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <Link to="/" className="btn btn-primary" id="return-home-btn">
              <ArrowLeft size={16} /> Return to Store
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
