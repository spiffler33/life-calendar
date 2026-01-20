/**
 * Auth Context
 *
 * Global authentication state management.
 * Provides user session, profile, and auth actions.
 */

import type React from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import {
  signIn as authSignIn,
  signUp as authSignUp,
  signOut as authSignOut,
  onAuthStateChange,
  emailToUsername,
} from '../services/auth';
import { clearApiKeyCache } from '../services/claude';

/**
 * Profile from profiles table
 */
export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  created_at: string;
  week_starts_on: number;
  theme: string | null;
  personal_context: string | null;
  ai_tone: 'stoic' | 'friendly' | 'wise';
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<boolean>;
  signup: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<boolean>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    error: null,
  });

  /**
   * Fetch user profile from profiles table
   */
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (import.meta.env.DEV) console.error('Failed to fetch profile:', error.message);
      return null;
    }

    return data;
  }, []);

  /**
   * Handle user session changes
   */
  const handleUserChange = useCallback(
    async (user: User | null) => {
      if (user) {
        const profile = await fetchProfile(user.id);
        setState(prev => ({
          ...prev,
          user,
          profile,
          loading: false,
          error: null,
        }));
      } else {
        setState({
          user: null,
          profile: null,
          loading: false,
          error: null,
        });
      }
    },
    [fetchProfile]
  );

  /**
   * Subscribe to auth state changes on mount
   */
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleUserChange(session?.user ?? null);
    });

    // Subscribe to changes
    const subscription = onAuthStateChange((_event, session) => {
      handleUserChange(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [handleUserChange]);

  /**
   * Login with username and password
   */
  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    const { user, error } = await authSignIn(username, password);

    if (error) {
      setState(prev => ({ ...prev, loading: false, error }));
      return false;
    }

    if (user) {
      const profile = await fetchProfile(user.id);
      setState(prev => ({
        ...prev,
        user,
        profile,
        loading: false,
        error: null,
      }));
    }

    return true;
  }, [fetchProfile]);

  /**
   * Signup with username and password
   */
  const signup = useCallback(async (username: string, password: string): Promise<boolean> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    const { user, error } = await authSignUp(username, password);

    if (error) {
      setState(prev => ({ ...prev, loading: false, error }));
      return false;
    }

    // Auto-login after signup
    if (user) {
      const profile = await fetchProfile(user.id);
      setState(prev => ({
        ...prev,
        user,
        profile,
        loading: false,
        error: null,
      }));
    }

    return true;
  }, [fetchProfile]);

  /**
   * Logout current user
   */
  const logout = useCallback(async (): Promise<void> => {
    setState(prev => ({ ...prev, loading: true }));
    await authSignOut();
    // Clear cached data
    clearApiKeyCache();
    // Clear URL hash so next login starts on 'today' view
    window.location.hash = '';
    setState({
      user: null,
      profile: null,
      loading: false,
      error: null,
    });
  }, []);

  /**
   * Update user profile
   */
  const updateProfile = useCallback(
    async (updates: Partial<Profile>): Promise<boolean> => {
      if (!state.user) return false;

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', state.user.id)
        .select()
        .single();

      if (error) {
        setState(prev => ({ ...prev, error: error.message }));
        return false;
      }

      setState(prev => ({ ...prev, profile: data }));
      return true;
    },
    [state.user]
  );

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const value: AuthContextType = {
    ...state,
    login,
    signup,
    logout,
    updateProfile,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Get username from user object
 */
export function getUsername(user: User | null): string {
  if (!user?.email) return '';
  return emailToUsername(user.email);
}
