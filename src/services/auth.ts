/**
 * Auth Service
 *
 * Username-based authentication using Supabase.
 * Converts usernames to fake emails for Supabase auth.
 */

import type { Session, User, Subscription } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { DEFAULT_HABITS } from '../types';

const EMAIL_DOMAIN = 'stoicuser.mailinator.com';

/**
 * Username validation rules:
 * - 3-20 characters
 * - Lowercase letters, numbers, underscore only
 */
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export interface AuthResult {
  user: User | null;
  error: string | null;
}

/**
 * Validate username format
 */
export function isValidUsername(username: string): boolean {
  return USERNAME_REGEX.test(username);
}

/**
 * Get validation error message for username
 */
export function getUsernameError(username: string): string | null {
  if (username.length < 3) {
    return 'min 3 characters';
  }
  if (username.length > 20) {
    return 'max 20 characters';
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    return 'lowercase letters, numbers, underscore only';
  }
  return null;
}

/**
 * Convert username to fake email for Supabase
 */
function usernameToEmail(username: string): string {
  return `${username}@${EMAIL_DOMAIN}`;
}

/**
 * Extract username from fake email
 */
export function emailToUsername(email: string): string {
  return email.replace(`@${EMAIL_DOMAIN}`, '');
}

/**
 * Sign up with username and password
 */
export async function signUp(
  username: string,
  password: string
): Promise<AuthResult> {
  const normalizedUsername = username.toLowerCase().trim();

  if (!isValidUsername(normalizedUsername)) {
    return {
      user: null,
      error: getUsernameError(normalizedUsername) || 'invalid username',
    };
  }

  if (password.length < 6) {
    return {
      user: null,
      error: 'password must be at least 6 characters',
    };
  }

  const email = usernameToEmail(normalizedUsername);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: normalizedUsername,
      },
    },
  });

  if (error) {
    // Handle common errors with user-friendly messages
    if (error.message.includes('already registered')) {
      return { user: null, error: 'username taken' };
    }
    return { user: null, error: error.message };
  }

  // Create default habits for new user
  if (data.user) {
    try {
      await createDefaultHabits(data.user.id);
    } catch (err) {
      console.error('Failed to create default habits:', err);
      // Don't fail signup if habit creation fails
    }
  }

  return { user: data.user, error: null };
}

/**
 * Create default habits for a new user
 */
async function createDefaultHabits(userId: string): Promise<void> {
  const habitsToCreate = DEFAULT_HABITS.map((habit, index) => ({
    user_id: userId,
    label: habit.label,
    description: habit.description || null,
    category: habit.category,
    emoji: habit.emoji || null,
    sort_order: index,
  }));

  const { error } = await supabase
    .from('habits')
    .insert(habitsToCreate);

  if (error) {
    throw error;
  }
}

/**
 * Sign in with username and password
 */
export async function signIn(
  username: string,
  password: string
): Promise<AuthResult> {
  const normalizedUsername = username.toLowerCase().trim();

  if (!normalizedUsername) {
    return { user: null, error: 'username required' };
  }

  if (!password) {
    return { user: null, error: 'password required' };
  }

  const email = usernameToEmail(normalizedUsername);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      return { user: null, error: 'invalid username or password' };
    }
    return { user: null, error: error.message };
  }

  return { user: data.user, error: null };
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Get current session
 */
export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
): Subscription {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return data.subscription;
}
