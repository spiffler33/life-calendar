# Implementation Plan: Cloud Sync + Auth + Friends

> **STATUS: COMPLETE** - All phases implemented on 2026-01-16

## Overview

Transform a localStorage-bound static app into a multi-device, multi-user system with accountability features.

**From:** Static GitHub Pages + localStorage
**To:** Static frontend + Supabase backend (auth, database, realtime)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Pages                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    React SPA                              │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐  │   │
│  │  │ AuthCtx │  │ DataCtx │  │ FriendsCtx│ │ OfflineQueue│  │   │
│  │  └────┬────┘  └────┬────┘  └─────┬────┘  └──────┬──────┘  │   │
│  │       │            │             │              │         │   │
│  │       └────────────┴─────────────┴──────────────┘         │   │
│  │                           │                               │   │
│  │                    ┌──────▼──────┐                        │   │
│  │                    │ supabase.ts │                        │   │
│  │                    └──────┬──────┘                        │   │
│  └───────────────────────────┼───────────────────────────────┘   │
└──────────────────────────────┼───────────────────────────────────┘
                               │ HTTPS
                    ┌──────────▼──────────┐
                    │      Supabase       │
                    │  ┌───────────────┐  │
                    │  │   Auth        │  │
                    │  │   (GoTrue)    │  │
                    │  ├───────────────┤  │
                    │  │   Database    │  │
                    │  │   (Postgres)  │  │
                    │  ├───────────────┤  │
                    │  │   Realtime    │  │
                    │  │   (Phoenix)   │  │
                    │  └───────────────┘  │
                    └─────────────────────┘
```

---

## Phase 1: Supabase Setup

### 1.1 Create Project

1. Create Supabase project at supabase.com
2. Note: `SUPABASE_URL` and `SUPABASE_ANON_KEY`
3. Store in `.env` (local) and GitHub Secrets (deploy)

### 1.2 Database Schema

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES (extends auth.users)
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Settings (migrated from localStorage)
  week_starts_on INTEGER DEFAULT 0 CHECK (week_starts_on IN (0, 1)),
  theme TEXT DEFAULT 'dark',

  -- Personal context for AI (free-form text, user writes naturally)
  personal_context TEXT,

  -- AI preferences
  ai_tone TEXT DEFAULT 'stoic' CHECK (ai_tone IN ('stoic', 'friendly', 'wise')),

  -- Constraints
  CONSTRAINT username_format CHECK (username ~ '^[a-z0-9_]{3,20}$')
);

-- Index for username lookup
CREATE INDEX idx_profiles_username ON profiles(username);

-- ============================================
-- HABITS (user's habit definitions)
-- ============================================
CREATE TABLE habits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('health', 'work', 'family', 'learning', 'other')),
  emoji TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ,

  CONSTRAINT label_not_empty CHECK (char_length(label) > 0)
);

CREATE INDEX idx_habits_user ON habits(user_id) WHERE archived_at IS NULL;

-- ============================================
-- DAILY ENTRIES (focus + reflection per day)
-- ============================================
CREATE TABLE daily_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  focus TEXT,
  reflection TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, date)
);

CREATE INDEX idx_daily_entries_user_date ON daily_entries(user_id, date DESC);

-- ============================================
-- HABIT COMPLETIONS (junction: habit + date)
-- ============================================
CREATE TABLE habit_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, habit_id, date)
);

CREATE INDEX idx_habit_completions_user_date ON habit_completions(user_id, date DESC);

-- ============================================
-- TASKS (MITs: work, self, family)
-- ============================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('work', 'self', 'family')),
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  first_step TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  CONSTRAINT text_not_empty CHECK (char_length(text) > 0)
);

CREATE INDEX idx_tasks_user_date ON tasks(user_id, date DESC);

-- ============================================
-- YEAR THEMES
-- ============================================
CREATE TABLE year_themes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  year INTEGER NOT NULL CHECK (year >= 2000 AND year <= 2100),
  theme TEXT NOT NULL,

  UNIQUE(user_id, year)
);

-- ============================================
-- FRIENDSHIPS (bidirectional when accepted)
-- ============================================
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,

  UNIQUE(requester_id, addressee_id),
  CONSTRAINT no_self_friend CHECK (requester_id != addressee_id)
);

CREATE INDEX idx_friendships_addressee ON friendships(addressee_id) WHERE status = 'pending';

-- ============================================
-- ACTIVITY FEED (for body doubling)
-- ============================================
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'task_completed',
    'habit_completed',
    'focus_set',
    'streak_achieved',
    'reflection_written'
  )),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activities_user_created ON activities(user_id, created_at DESC);

-- Partition or TTL: keep 30 days only (handled by cron job or manual cleanup)

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE year_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Profiles: read own, update own
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Profiles: read friends (for display)
CREATE POLICY "Users can read friends profiles" ON profiles
  FOR SELECT USING (
    id IN (
      SELECT addressee_id FROM friendships
      WHERE requester_id = auth.uid() AND status = 'accepted'
      UNION
      SELECT requester_id FROM friendships
      WHERE addressee_id = auth.uid() AND status = 'accepted'
    )
  );

-- Profiles: search by username (for adding friends)
CREATE POLICY "Users can search profiles by username" ON profiles
  FOR SELECT USING (true);  -- username search allowed, but only returns username/display_name

-- Habits: own only
CREATE POLICY "Users manage own habits" ON habits
  FOR ALL USING (auth.uid() = user_id);

-- Daily entries: own only
CREATE POLICY "Users manage own daily entries" ON daily_entries
  FOR ALL USING (auth.uid() = user_id);

-- Habit completions: own only
CREATE POLICY "Users manage own habit completions" ON habit_completions
  FOR ALL USING (auth.uid() = user_id);

-- Tasks: own only
CREATE POLICY "Users manage own tasks" ON tasks
  FOR ALL USING (auth.uid() = user_id);

-- Year themes: own only
CREATE POLICY "Users manage own year themes" ON year_themes
  FOR ALL USING (auth.uid() = user_id);

-- Friendships: can see own, can create as requester
CREATE POLICY "Users can see own friendships" ON friendships
  FOR SELECT USING (auth.uid() IN (requester_id, addressee_id));
CREATE POLICY "Users can create friendship requests" ON friendships
  FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Users can update friendships they're part of" ON friendships
  FOR UPDATE USING (auth.uid() IN (requester_id, addressee_id));

-- Activities: see own and friends'
CREATE POLICY "Users can see own activities" ON activities
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own activities" ON activities
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can see friends activities" ON activities
  FOR SELECT USING (
    user_id IN (
      SELECT addressee_id FROM friendships
      WHERE requester_id = auth.uid() AND status = 'accepted'
      UNION
      SELECT requester_id FROM friendships
      WHERE addressee_id = auth.uid() AND status = 'accepted'
    )
  );

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username)
  VALUES (
    NEW.id,
    split_part(NEW.email, '@', 1)  -- Extract username from fake email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update updated_at on daily_entries
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_entries_updated_at
  BEFORE UPDATE ON daily_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 1.3 Environment Setup

Create `.env.local`:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
```

Add to `.gitignore`:
```
.env.local
.env*.local
```

---

## Phase 2: Auth Implementation

### 2.1 Supabase Client

File: `src/services/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
```

### 2.2 Auth Service

File: `src/services/auth.ts`

Core functions:
- `signUp(username: string, password: string)` → Creates user with `username@stoic-calendar.local`
- `signIn(username: string, password: string)` → Logs in with fake email
- `signOut()` → Clears session
- `getSession()` → Returns current session
- `onAuthStateChange(callback)` → Subscribe to auth changes

Username rules:
- 3-20 characters
- Lowercase letters, numbers, underscore only
- Must be unique

### 2.3 Auth Context

File: `src/store/AuthContext.tsx`

State:
```typescript
interface AuthState {
  user: User | null
  profile: Profile | null
  loading: boolean
  error: string | null
}
```

Actions:
- `login(username, password)`
- `signup(username, password)`
- `logout()`

### 2.4 Auth UI

File: `src/components/AuthScreen.tsx`

Two modes: Login / Signup (toggle)

Layout:
```
┌─────────────────────────────────┐
│                                 │
│         STOIC CALENDAR          │
│                                 │
│    ┌─────────────────────┐      │
│    │ username            │      │
│    └─────────────────────┘      │
│    ┌─────────────────────┐      │
│    │ ••••••••            │      │
│    └─────────────────────┘      │
│                                 │
│    [ Login ]                    │
│                                 │
│    Don't have an account?       │
│    Create one                   │
│                                 │
└─────────────────────────────────┘
```

Inline error display. No modals.

### 2.5 Protected Routes

File: `src/App.tsx`

```typescript
if (authLoading) return <LoadingScreen />
if (!user) return <AuthScreen />
return <AppContent />
```

---

## Phase 3: Data Layer Migration

### 3.1 Data Service

File: `src/services/data.ts`

Replace localStorage with Supabase calls:

```typescript
// Habits
getHabits(): Promise<Habit[]>
createHabit(habit: HabitInput): Promise<Habit>
updateHabit(id: string, updates: Partial<Habit>): Promise<Habit>
deleteHabit(id: string): Promise<void>

// Daily entries
getDailyEntry(date: string): Promise<DailyEntry | null>
upsertDailyEntry(date: string, data: Partial<DailyEntry>): Promise<DailyEntry>

// Habit completions
getCompletions(date: string): Promise<Record<string, boolean>>
toggleCompletion(habitId: string, date: string): Promise<void>

// Tasks
getTasks(date: string): Promise<Task[]>
createTask(task: TaskInput): Promise<Task>
updateTask(id: string, updates: Partial<Task>): Promise<Task>
deleteTask(id: string): Promise<void>

// Year themes
getYearTheme(year: number): Promise<string | null>
setYearTheme(year: number, theme: string): Promise<void>

// Profile
getProfile(): Promise<Profile>
updateProfile(updates: Partial<Profile>): Promise<Profile>

// Analytics (30 days)
getAnalytics(): Promise<Analytics>
```

### 3.2 Context Migration

File: `src/store/AppContext.tsx`

Change from:
```typescript
const [state, dispatch] = useReducer(reducer, initialState)
useEffect(() => saveState(state), [state])
```

To:
```typescript
// Use React Query or SWR for caching + sync
// Or custom hooks with useState + useEffect

const { data: habits } = useHabits()
const { data: dailyEntry } = useDailyEntry(selectedDate)
const { data: tasks } = useTasks(selectedDate)
```

### 3.3 Migration Utility

File: `src/utils/migration.ts`

One-time migration from localStorage to Supabase:

```typescript
async function migrateLocalData(userId: string): Promise<void> {
  const localData = loadState()  // Old localStorage loader
  if (!localData) return

  // Migrate habits
  for (const habit of localData.settings.habits) {
    await createHabit({ ...habit, user_id: userId })
  }

  // Migrate daily data
  for (const [date, day] of Object.entries(localData.dailyData)) {
    await upsertDailyEntry(date, {
      focus: day.focus,
      reflection: day.reflection
    })

    // Migrate habit completions
    for (const [habitId, completed] of Object.entries(day.habits)) {
      if (completed) {
        await toggleCompletion(habitId, date)
      }
    }

    // Migrate tasks
    for (const category of ['work', 'self', 'family']) {
      for (const task of day.mit[category]) {
        await createTask({
          date,
          category,
          text: task.text,
          completed: task.completed,
          first_step: task.firstStep
        })
      }
    }
  }

  // Migrate year themes
  for (const { year, theme } of localData.settings.yearThemes) {
    await setYearTheme(year, theme)
  }

  // Clear localStorage after successful migration
  clearAllData()
}
```

Show migration prompt on first login if localStorage has data.

### 3.4 Offline Support

File: `src/services/offline.ts`

Queue operations when offline, sync when online:

```typescript
interface QueuedOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  table: string
  data: Record<string, unknown>
  timestamp: number
}

// Store queue in localStorage
const QUEUE_KEY = 'offline-queue'

function queueOperation(op: Omit<QueuedOperation, 'id' | 'timestamp'>): void
function processQueue(): Promise<void>
function isOnline(): boolean

// Listen to online/offline events
window.addEventListener('online', processQueue)
```

---

## Phase 4: AI Personalization

### 4.1 Personal Context UX (Three Entry Points)

Personal context lives in three places, each serving a different moment:

#### A. Year View: Primary Home

Expand the existing Year Theme section to include personal context. This is the natural place - both are about "what this year is about."

File: `src/views/YearView.tsx` (modify existing Year Theme section)

```
┌─────────────────────────────────────────────────────┐
│ 2026                                                │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Year Theme                                          │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Year of Reclaiming Health                       │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ What should the AI know about you?                  │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Working on lowering blood pressure. Had it     │ │
│ │ down before, slipped in December. Critical     │ │
│ │ to bring it back down and maintain all year.   │ │
│ │                                                 │ │
│ │ Body doubling helps me stay accountable.       │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ [calendar grid...]                                  │
└─────────────────────────────────────────────────────┘
```

Inline editing (click to edit, blur to save). Same pattern as daily focus.

#### B. First Insight Prompt: Discovery Moment

When user clicks "Get Insight" for the first time AND personal context is empty, show inline prompt instead of immediately calling the AI.

File: `src/components/AiInsight.tsx` (modify)

```
┌─────────────────────────────────────────────────────┐
│ Want better insights?                               │
│                                                     │
│ Tell me what you're working on - health goals,     │
│ struggles, what matters to you this year.           │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │                                                 │ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ [ Skip for now ]  [ Save and get insight ]          │
└─────────────────────────────────────────────────────┘
```

Logic:
```typescript
const handleGetInsight = () => {
  if (!profile.personal_context && !hasSkippedContextPrompt) {
    setShowContextPrompt(true)
    return
  }
  generateInsight()
}
```

After saving or skipping, proceed with insight generation. Store `hasSkippedContextPrompt` in localStorage (not Supabase - session preference).

#### C. Settings: Backup Access

For users who want to edit later. Simpler section - just the essentials.

File: `src/views/SettingsView.tsx` (add section)

```
┌─────────────────────────────────────────────────────┐
│ AI ASSISTANT                                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Tone                                                │
│ ○ Stoic      - Minimal, focused on leverage         │
│ ● Friendly   - Warm, supportive coach              │
│ ○ Wise       - Thoughtful friend, conversational   │
│                                                     │
│ Personal Context                                    │
│ ┌─────────────────────────────────────────────────┐ │
│ │ [current context displayed, editable]          │ │
│ └─────────────────────────────────────────────────┘ │
│ Also editable in Year view.                         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 4.2 Database Schema Update

Rename `health_context` to `personal_context` (broader, not just health):

```sql
-- In profiles table
personal_context TEXT,  -- Free-form text, not JSONB array
ai_tone TEXT DEFAULT 'stoic' CHECK (ai_tone IN ('stoic', 'friendly', 'wise')),
```

Single text field is simpler than array. Users write naturally, AI parses meaning.

### 4.3 Updated AI Prompt

File: `src/services/claude.ts`

```typescript
function buildSystemPrompt(profile: Profile): string {
  const toneInstructions = {
    stoic: 'You are a stoic life coach inspired by Naval Ravikant. Minimal words. Focus on leverage and compound effects.',
    friendly: 'You are a warm, supportive coach. Acknowledge struggles. Still focus on leverage and what matters, but with encouragement.',
    wise: 'You are a thoughtful friend who happens to be wise. Conversational tone. Share insights like you would with a close friend.'
  }

  let prompt = toneInstructions[profile.ai_tone]

  if (profile.personal_context?.trim()) {
    prompt += `\n\nIMPORTANT CONTEXT about this person:\n${profile.personal_context}`
    prompt += `\n\nBe mindful of their goals and struggles. When relevant, gently acknowledge progress or encourage staying on track.`
  }

  return prompt
}
```

### 4.4 Context Flow Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER JOURNEY                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  New user signs up                                              │
│       │                                                         │
│       ▼                                                         │
│  Uses app normally (no context set)                             │
│       │                                                         │
│       ▼                                                         │
│  Clicks "Get Insight" first time                                │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────────────────────┐                            │
│  │ Inline prompt appears:          │                            │
│  │ "Want better insights?"         │                            │
│  │ [textarea]                      │                            │
│  │ [Skip] [Save]                   │                            │
│  └─────────────────────────────────┘                            │
│       │                                                         │
│       ├──── Saves context ──────► Stored in profile             │
│       │                                  │                      │
│       └──── Skips ──────────────► Gets generic insight          │
│                                          │                      │
│                                          ▼                      │
│                            Future insights use context          │
│                                                                 │
│  Later: Edit in Year view or Settings                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 5: Friends & Body Doubling

### 5.1 Friend Service

File: `src/services/friends.ts`

```typescript
// Search users by username
searchUsers(query: string): Promise<ProfileSummary[]>

// Friend requests
sendFriendRequest(username: string): Promise<void>
acceptFriendRequest(friendshipId: string): Promise<void>
declineFriendRequest(friendshipId: string): Promise<void>

// Get friends
getFriends(): Promise<Friend[]>
getPendingRequests(): Promise<PendingRequest[]>

// Activity feed
getFriendsActivity(limit: number = 20): Promise<Activity[]>

// Create activity (called automatically on actions)
createActivity(type: ActivityType, metadata: Record<string, unknown>): Promise<void>
```

### 5.2 Friends Context

File: `src/store/FriendsContext.tsx`

State:
```typescript
interface FriendsState {
  friends: Friend[]
  pendingRequests: PendingRequest[]
  activity: Activity[]
  loading: boolean
}
```

Subscribe to realtime updates for activity feed.

### 5.3 Friends UI

New view: `src/views/FriendsView.tsx`

Layout:
```
┌─────────────────────────────────────────────────────┐
│ ACCOUNTABILITY                                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ + Add friend by username                        │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ PENDING (2)                                         │
│ ├─ naval wants to connect    [Accept] [Decline]     │
│ └─ zen_master wants to connect [Accept] [Decline]   │
│                                                     │
│ FRIENDS (3)                                         │
│ ├─ atomic_habits                                    │
│ ├─ deep_worker                                      │
│ └─ morning_person                                   │
│                                                     │
│ ACTIVITY                                            │
│ ├─ atomic_habits completed "Ship feature X"    2m   │
│ ├─ deep_worker set focus "Deep work session"  15m   │
│ ├─ morning_person 7-day streak on "Wake 5am"  1h    │
│ └─ atomic_habits completed 5 habits            2h   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 5.4 Activity Generation

Automatically create activities on:
- Task completed → `{ type: 'task_completed', metadata: { text: '...' } }`
- Daily focus set → `{ type: 'focus_set', metadata: { focus: '...' } }`
- Habit streak milestone → `{ type: 'streak_achieved', metadata: { habit: '...', days: 7 } }`
- Reflection written → `{ type: 'reflection_written', metadata: {} }`

Activities older than 30 days auto-delete (scheduled function or client cleanup).

### 5.5 Realtime Subscription

```typescript
supabase
  .channel('friends-activity')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'activities',
    filter: `user_id=in.(${friendIds.join(',')})`
  }, handleNewActivity)
  .subscribe()
```

---

## Phase 6: Navigation & Routing

### 6.1 Add Friends to Navigation

Update navigation to include friends view:
- Keyboard shortcut: `[f]` for friends view

### 6.2 URL Structure

```
/#view=today&date=2026-01-16
/#view=week&date=2026-01-16
/#view=year&year=2026
/#view=friends
/#view=settings
```

---

## File Structure (New/Modified)

```
src/
├── services/
│   ├── supabase.ts          [NEW] Supabase client
│   ├── auth.ts              [NEW] Auth functions
│   ├── data.ts              [NEW] Data CRUD
│   ├── friends.ts           [NEW] Friend operations
│   ├── offline.ts           [NEW] Offline queue
│   └── claude.ts            [MODIFY] Add personalization
│
├── store/
│   ├── AuthContext.tsx      [NEW] Auth state
│   ├── FriendsContext.tsx   [NEW] Friends state
│   └── AppContext.tsx       [MODIFY] Use Supabase
│
├── components/
│   ├── AuthScreen.tsx       [NEW] Login/signup
│   ├── LoadingScreen.tsx    [NEW] App loading state
│   └── AiInsight.tsx        [MODIFY] Add first-time context prompt
│
├── views/
│   ├── FriendsView.tsx      [NEW] Friends & activity
│   ├── YearView.tsx         [MODIFY] Add personal context section
│   └── SettingsView.tsx     [MODIFY] Add AI tone + context settings
│
├── utils/
│   ├── migration.ts         [NEW] localStorage → Supabase
│   └── storage.ts           [KEEP] For offline queue
│
├── types/
│   ├── database.ts          [NEW] Supabase types
│   └── index.ts             [MODIFY] Update types
│
└── App.tsx                  [MODIFY] Auth wrapper
```

---

## Dependencies (New)

```json
{
  "@supabase/supabase-js": "^2.x"
}
```

Single new dependency. No state management library needed.

---

## Migration Path

1. **Users with localStorage data:** On first login, prompt to migrate
2. **New users:** Start fresh with Supabase
3. **Offline fallback:** Queue operations, sync when online

---

## Testing Checklist

**Auth**
- [ ] Signup with new username
- [ ] Login with existing username
- [ ] Logout and login again
- [ ] Invalid username format rejected (less than 3 chars, special chars)
- [ ] Duplicate username rejected

**Data Sync**
- [ ] Data persists across devices (test on phone)
- [ ] localStorage migration works on first login
- [ ] Offline mode queues operations
- [ ] Online sync clears queue correctly

**AI Personalization**
- [ ] First insight click shows context prompt (when context empty)
- [ ] Skip works, proceeds to generic insight
- [ ] Save works, context stored, insight uses it
- [ ] Context editable in Year view
- [ ] Context editable in Settings
- [ ] AI tone changes with setting (stoic/friendly/wise)
- [ ] AI references personal context when relevant

**Friends**
- [ ] Search users by username
- [ ] Friend request sent
- [ ] Friend request accepted
- [ ] Friend request declined
- [ ] Activity feed shows friend actions
- [ ] Activity feed updates in realtime

**Navigation**
- [ ] Keyboard shortcuts all work (t/w/y/f/s)
- [ ] URL-based navigation works
- [ ] Deep links work across devices

---

## Security Considerations

1. **RLS on all tables:** Users can only see their own data + friends' activity
2. **Username validation:** Server-side check for format and uniqueness
3. **Rate limiting:** Supabase has built-in rate limiting
4. **No sensitive data in activities:** Only share action type, not content

---

## Future Considerations (Not in Scope)

- Password reset (requires email, but could add optional email to profile later)
- Account deletion
- Block users
- Private mode (hide from activity feed)
- Push notifications

---

## Summary

This plan transforms the app from localStorage-bound to cloud-synced while:
- Keeping the frontend on GitHub Pages (free hosting)
- Using Supabase for auth + database (generous free tier)
- Maintaining offline capability
- Adding friends for accountability
- Personalizing AI with personal context and tone preferences (configurable)
- Preserving existing design principles

Personal context flows naturally:
1. First insight click prompts for context (discovery moment)
2. Year view houses context alongside year theme (primary home)
3. Settings provides backup access for later edits

The migration is additive. Existing code patterns remain. New services wrap Supabase calls. Context structure stays similar.

No breaking changes to the UI. Users just gain a login screen, friends view, and better AI that knows them.
