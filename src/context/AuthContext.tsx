import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { User, MembershipStatus } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  membership: MembershipStatus | null;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string; requiresVerification?: boolean }>;
  register: (nameOrData: any, email?: string, password?: string) => Promise<{ success: boolean; message: string; verificationLink?: string }>;
  socialLogin: (provider: 'google' | 'facebook', profileData: any) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  updateUser: (user: User) => void;
  refreshUser: () => Promise<void>;
  refreshMembership: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('shopvanguard_token'));
  const [membership, setMembership] = useState<MembershipStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshMembership = useCallback(async () => {
    try {
      const res = await api.get('/plans/my-status');
      if (res.data.success) {
        setMembership(res.data.data);
      }
    } catch {
      setMembership(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const storedToken = localStorage.getItem('shopvanguard_token');
    if (!storedToken) {
      setUser(null);
      setMembership(null);
      setLoading(false);
      return;
    }

    try {
      const res = await api.get('/auth/me');
      if (res.data.success) {
        setUser(res.data.data.user);
        await refreshMembership();
      } else {
        localStorage.removeItem('shopvanguard_token');
        setUser(null);
        setMembership(null);
      }
    } catch (err: any) {
      console.error('Auth verification failed:', err);
      if (err.response?.status === 401) {
        localStorage.removeItem('shopvanguard_token');
        setUser(null);
        setMembership(null);
      }
    } finally {
      setLoading(false);
    }
  }, [refreshMembership]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data.success) {
        const { token: receivedToken, user: receivedUser } = res.data.data;
        localStorage.setItem('shopvanguard_token', receivedToken);
        setToken(receivedToken);
        setUser(receivedUser);
        await refreshMembership();
        return { success: true, message: res.data.message };
      }
      return { success: false, message: res.data.message || 'Login failed' };
    } catch (err: any) {
      return {
        success: false,
        message: err.response?.data?.message || 'Login error occurred',
        requiresVerification: err.response?.data?.requiresVerification || false,
      };
    }
  };

  const register = async (nameOrData: any, email?: string, password?: string) => {
    try {
      const payload = typeof nameOrData === 'object'
        ? nameOrData
        : { full_name: nameOrData, email, password };
      const res = await api.post('/auth/register', payload);
      return {
        success: true,
        message: res.data.message,
        verificationLink: res.data.data?.verificationLink,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.response?.data?.message || 'Registration failed',
      };
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const socialLogin = async (provider: 'google' | 'facebook', profileData: any) => {
    try {
      const endpoint = provider === 'google' ? '/auth/google' : '/auth/facebook';
      const res = await api.post(endpoint, profileData);
      if (res.data.success) {
        const { token: receivedToken, user: receivedUser } = res.data.data;
        localStorage.setItem('shopvanguard_token', receivedToken);
        setToken(receivedToken);
        setUser(receivedUser);
        await refreshMembership();
        return { success: true, message: res.data.message };
      }
      return { success: false, message: res.data.message || 'Social login failed' };
    } catch (err: any) {
      return {
        success: false,
        message: err.response?.data?.message || 'Social login failed',
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('shopvanguard_token');
    setToken(null);
    setUser(null);
    setMembership(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        membership,
        login,
        register,
        socialLogin,
        logout,
        updateUser,
        refreshUser,
        refreshMembership,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
