/**
 * AI Insight Component
 *
 * On-demand Claude-powered daily insight.
 * Minimal, stoic, actionable.
 */

import { useState, useCallback } from 'react';
import { generateDailyInsight, loadApiKey } from '../services/claude';
import type { HabitDefinition, HabitId } from '../types';
import { getDaysUntilEndOfYear } from '../utils/dates';

interface AiInsightProps {
  selectedDate: string;
  habits: HabitDefinition[];
  completedHabits: Record<HabitId, boolean>;
  streaks: Record<HabitId, number>;
  tasksCompleted: number;
  totalTasks: number;
  reflection?: string;
}

export function AiInsight({
  selectedDate,
  habits,
  completedHabits,
  streaks,
  tasksCompleted,
  totalTasks,
  reflection,
}: AiInsightProps) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasApiKey = !!loadApiKey();

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const habitData = habits.map(h => ({
        name: h.label,
        completed: completedHabits[h.id] || false,
        streak: streaks[h.id] || 0,
      }));

      const result = await generateDailyInsight({
        habits: habitData,
        tasksCompleted,
        totalTasks,
        daysUntilEndOfYear: getDaysUntilEndOfYear(selectedDate),
        reflection,
      });

      setInsight(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate insight');
    } finally {
      setLoading(false);
    }
  }, [habits, completedHabits, streaks, tasksCompleted, totalTasks, selectedDate, reflection]);

  if (!hasApiKey) {
    return null;
  }

  return (
    <div className="bg-bg-card rounded border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
          ai insight
        </span>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="text-xs text-text-muted hover:text-accent disabled:opacity-50 transition-colors"
        >
          {loading ? 'thinking...' : insight ? 'refresh' : 'generate'}
        </button>
      </div>

      {error && (
        <div className="text-xs text-error">{error}</div>
      )}

      {insight && !error && (
        <div className="text-sm text-text-secondary leading-relaxed">
          {insight}
        </div>
      )}

      {!insight && !error && !loading && (
        <div className="text-xs text-text-muted">
          click generate for a personalized insight
        </div>
      )}
    </div>
  );
}
