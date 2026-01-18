/**
 * App State Management using React Context
 *
 * Supabase is the source of truth for authenticated users.
 * Habits and completions are loaded from and saved to Supabase.
 */

import { createContext, useContext, useReducer, useEffect, useCallback, useRef, useState } from 'react';
import type {
  AppState,
  AppSettings,
  DailyData,
  TodoItem,
  HabitId,
  MitCategory,
  HabitDefinition,
} from '../types';
import { createEmptyDailyData, DEFAULT_HABITS } from '../types';

// Create initial state with EMPTY habits (will load from Supabase)
function createEmptyState(): AppState {
  return {
    settings: {
      habits: [], // Start empty - will load from Supabase
      yearThemes: [],
      weekStartsOn: 1,
    },
    dailyData: {},
  };
}
import { addDays, getToday } from '../utils/dates';
import { toggleCompletion, getCompletions, getHabits } from '../services/data';

// Action types for the reducer
type Action =
  | { type: 'SET_HABITS'; payload: HabitDefinition[] }
  | { type: 'SET_COMPLETIONS'; payload: Record<string, Record<string, boolean>> }
  | { type: 'TOGGLE_HABIT'; payload: { date: string; habitId: HabitId } }
  | { type: 'ADD_MIT'; payload: { date: string; category: MitCategory; text: string; firstStep?: string } }
  | { type: 'UPDATE_MIT'; payload: { date: string; category: MitCategory; id: string; text: string } }
  | { type: 'DELETE_MIT'; payload: { date: string; category: MitCategory; id: string } }
  | { type: 'TOGGLE_MIT'; payload: { date: string; category: MitCategory; id: string } }
  | { type: 'SET_MIT_FIRST_STEP'; payload: { date: string; category: MitCategory; id: string; firstStep: string } }
  | { type: 'SET_FOCUS'; payload: { date: string; focus: string } }
  | { type: 'SET_REFLECTION'; payload: { date: string; reflection: string } }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<AppSettings> }
  | { type: 'SET_YEAR_THEME'; payload: { year: number; theme: string } };

// Generate a simple unique ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Reducer function
function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_HABITS': {
      return {
        ...state,
        settings: {
          ...state.settings,
          habits: action.payload,
        },
      };
    }

    case 'SET_COMPLETIONS': {
      const newDailyData = { ...state.dailyData };
      for (const [date, habits] of Object.entries(action.payload)) {
        newDailyData[date] = {
          ...(newDailyData[date] || createEmptyDailyData(date)),
          habits,
        };
      }
      return {
        ...state,
        dailyData: newDailyData,
      };
    }

    case 'TOGGLE_HABIT': {
      const { date, habitId } = action.payload;
      const dayData = state.dailyData[date] || createEmptyDailyData(date);
      return {
        ...state,
        dailyData: {
          ...state.dailyData,
          [date]: {
            ...dayData,
            habits: {
              ...dayData.habits,
              [habitId]: !dayData.habits[habitId],
            },
          },
        },
      };
    }

    case 'ADD_MIT': {
      const { date, category, text, firstStep } = action.payload;
      const dayData = state.dailyData[date] || createEmptyDailyData(date);
      const newItem: TodoItem = { id: generateId(), text, completed: false, firstStep };
      return {
        ...state,
        dailyData: {
          ...state.dailyData,
          [date]: {
            ...dayData,
            mit: {
              ...dayData.mit,
              [category]: [...dayData.mit[category], newItem],
            },
          },
        },
      };
    }

    case 'UPDATE_MIT': {
      const { date, category, id, text } = action.payload;
      const dayData = state.dailyData[date];
      if (!dayData) return state;
      return {
        ...state,
        dailyData: {
          ...state.dailyData,
          [date]: {
            ...dayData,
            mit: {
              ...dayData.mit,
              [category]: dayData.mit[category].map(item =>
                item.id === id ? { ...item, text } : item
              ),
            },
          },
        },
      };
    }

    case 'DELETE_MIT': {
      const { date, category, id } = action.payload;
      const dayData = state.dailyData[date];
      if (!dayData) return state;
      return {
        ...state,
        dailyData: {
          ...state.dailyData,
          [date]: {
            ...dayData,
            mit: {
              ...dayData.mit,
              [category]: dayData.mit[category].filter(item => item.id !== id),
            },
          },
        },
      };
    }

    case 'TOGGLE_MIT': {
      const { date, category, id } = action.payload;
      const dayData = state.dailyData[date];
      if (!dayData) return state;
      return {
        ...state,
        dailyData: {
          ...state.dailyData,
          [date]: {
            ...dayData,
            mit: {
              ...dayData.mit,
              [category]: dayData.mit[category].map(item =>
                item.id === id ? { ...item, completed: !item.completed } : item
              ),
            },
          },
        },
      };
    }

    case 'SET_MIT_FIRST_STEP': {
      const { date, category, id, firstStep } = action.payload;
      const dayData = state.dailyData[date];
      if (!dayData) return state;
      return {
        ...state,
        dailyData: {
          ...state.dailyData,
          [date]: {
            ...dayData,
            mit: {
              ...dayData.mit,
              [category]: dayData.mit[category].map(item =>
                item.id === id ? { ...item, firstStep } : item
              ),
            },
          },
        },
      };
    }

    case 'SET_FOCUS': {
      const { date, focus } = action.payload;
      const dayData = state.dailyData[date] || createEmptyDailyData(date);
      return {
        ...state,
        dailyData: {
          ...state.dailyData,
          [date]: {
            ...dayData,
            focus,
          },
        },
      };
    }

    case 'SET_REFLECTION': {
      const { date, reflection } = action.payload;
      const dayData = state.dailyData[date] || createEmptyDailyData(date);
      return {
        ...state,
        dailyData: {
          ...state.dailyData,
          [date]: {
            ...dayData,
            reflection,
          },
        },
      };
    }

    case 'UPDATE_SETTINGS': {
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.payload,
        },
      };
    }

    case 'SET_YEAR_THEME': {
      const { year, theme } = action.payload;
      const existingThemes = state.settings.yearThemes.filter(t => t.year !== year);
      return {
        ...state,
        settings: {
          ...state.settings,
          yearThemes: [...existingThemes, { year, theme }],
        },
      };
    }

    default:
      return state;
  }
}

// Context type
interface AppContextType {
  state: AppState;
  loading: boolean;
  getDailyData: (date: string) => DailyData;
  toggleHabit: (date: string, habitId: HabitId) => void;
  addMit: (date: string, category: MitCategory, text: string, firstStep?: string) => void;
  updateMit: (date: string, category: MitCategory, id: string, text: string) => void;
  deleteMit: (date: string, category: MitCategory, id: string) => void;
  toggleMit: (date: string, category: MitCategory, id: string) => void;
  setMitFirstStep: (date: string, category: MitCategory, id: string, firstStep: string) => void;
  setFocus: (date: string, focus: string) => void;
  setReflection: (date: string, reflection: string) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  updateHabits: (habits: HabitDefinition[]) => void;
  setYearTheme: (year: number, theme: string) => void;
  getYearTheme: (year: number) => string;
  getHabitCount: (date: string) => number;
  getHabitStreak: (habitId: HabitId, fromDate?: string) => number;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, createEmptyState());
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  // Load data from Supabase on mount
  useEffect(() => {
    const loadFromSupabase = async () => {
      if (initializedRef.current) return;
      initializedRef.current = true;

      try {
        // Load habits from Supabase
        const supabaseHabits = await getHabits();

        if (supabaseHabits.length > 0) {
          // Convert to HabitDefinition format
          const habits: HabitDefinition[] = supabaseHabits.map(h => ({
            id: h.id,
            label: h.label,
            description: h.description || undefined,
            category: h.category as HabitDefinition['category'],
            emoji: h.emoji || undefined,
          }));
          dispatch({ type: 'SET_HABITS', payload: habits });
        } else {
          // No habits in Supabase - use defaults
          dispatch({ type: 'SET_HABITS', payload: DEFAULT_HABITS });
        }

        // Load completions for last 90 days
        const todayStr = getToday(); // Local date
        const startDateObj = new Date();
        startDateObj.setDate(startDateObj.getDate() - 90);
        const startDateStr = `${startDateObj.getFullYear()}-${String(startDateObj.getMonth() + 1).padStart(2, '0')}-${String(startDateObj.getDate()).padStart(2, '0')}`;

        const completions = await getCompletions(startDateStr, todayStr);

        // Convert to date -> habitId -> true map
        const completionMap: Record<string, Record<string, boolean>> = {};
        for (const c of completions) {
          if (!completionMap[c.date]) {
            completionMap[c.date] = {};
          }
          completionMap[c.date][c.habit_id] = true;
        }

        if (Object.keys(completionMap).length > 0) {
          dispatch({ type: 'SET_COMPLETIONS', payload: completionMap });
        }
      } catch (err) {
        console.error('Failed to load from Supabase:', err);
        // Fall back to defaults on error
        dispatch({ type: 'SET_HABITS', payload: DEFAULT_HABITS });
      } finally {
        setLoading(false);
      }
    };

    loadFromSupabase();
  }, []);

  // Helper to get daily data (with fallback to empty)
  const getDailyData = useCallback(
    (date: string): DailyData => {
      return state.dailyData[date] || createEmptyDailyData(date);
    },
    [state.dailyData]
  );

  // Count completed habits for a given day
  const getHabitCount = useCallback(
    (date: string): number => {
      const dayData = state.dailyData[date];
      if (!dayData) return 0;
      return Object.values(dayData.habits).filter(Boolean).length;
    },
    [state.dailyData]
  );

  // Get year theme
  const getYearTheme = useCallback(
    (year: number): string => {
      const theme = state.settings.yearThemes.find(t => t.year === year);
      return theme?.theme || '';
    },
    [state.settings.yearThemes]
  );

  // Calculate habit streak
  const getHabitStreak = useCallback(
    (habitId: HabitId, fromDate: string = getToday()): number => {
      let streak = 0;
      let currentDate = fromDate;

      const todayData = state.dailyData[currentDate];
      if (!todayData?.habits[habitId]) {
        currentDate = addDays(currentDate, -1);
      }

      while (true) {
        const dayData = state.dailyData[currentDate];
        if (dayData?.habits[habitId]) {
          streak++;
          currentDate = addDays(currentDate, -1);
        } else {
          break;
        }
      }

      return streak;
    },
    [state.dailyData]
  );

  // Toggle habit with Supabase sync
  const toggleHabit = useCallback(
    async (date: string, habitId: HabitId) => {
      const dayData = state.dailyData[date] || createEmptyDailyData(date);
      const currentValue = dayData.habits[habitId] || false;
      const newValue = !currentValue;

      // Update local state immediately
      dispatch({ type: 'TOGGLE_HABIT', payload: { date, habitId } });

      // Sync to Supabase
      try {
        await toggleCompletion(habitId, date, newValue);
      } catch (err) {
        console.error('Failed to sync habit to Supabase:', err);
        // Revert on error
        dispatch({ type: 'TOGGLE_HABIT', payload: { date, habitId } });
      }
    },
    [state.dailyData]
  );

  const value: AppContextType = {
    state,
    loading,
    getDailyData,
    toggleHabit,
    addMit: (date, category, text, firstStep) => dispatch({ type: 'ADD_MIT', payload: { date, category, text, firstStep } }),
    updateMit: (date, category, id, text) => dispatch({ type: 'UPDATE_MIT', payload: { date, category, id, text } }),
    deleteMit: (date, category, id) => dispatch({ type: 'DELETE_MIT', payload: { date, category, id } }),
    toggleMit: (date, category, id) => dispatch({ type: 'TOGGLE_MIT', payload: { date, category, id } }),
    setMitFirstStep: (date, category, id, firstStep) => dispatch({ type: 'SET_MIT_FIRST_STEP', payload: { date, category, id, firstStep } }),
    setFocus: (date, focus) => dispatch({ type: 'SET_FOCUS', payload: { date, focus } }),
    setReflection: (date, reflection) => dispatch({ type: 'SET_REFLECTION', payload: { date, reflection } }),
    updateSettings: settings => dispatch({ type: 'UPDATE_SETTINGS', payload: settings }),
    updateHabits: habits => dispatch({ type: 'SET_HABITS', payload: habits }),
    setYearTheme: (year, theme) => dispatch({ type: 'SET_YEAR_THEME', payload: { year, theme } }),
    getYearTheme,
    getHabitCount,
    getHabitStreak,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Custom hook to use the app context
export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
