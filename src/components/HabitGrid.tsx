/**
 * Habit Grid
 *
 * Daily habits as simple toggles. No emojis, just labels.
 * Stoic display - facts only.
 */

import type { HabitDefinition, HabitId } from '../types';

interface HabitGridProps {
  habits: HabitDefinition[];
  completedHabits: Record<HabitId, boolean>;
  streaks: Record<HabitId, number>;
  onToggle: (habitId: HabitId) => void;
}

interface HabitToggleProps {
  habit: HabitDefinition;
  isCompleted: boolean;
  streak: number;
  onToggle: () => void;
}

function HabitToggle({ habit, isCompleted, streak, onToggle }: HabitToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={`
        flex items-center gap-2 px-3 py-2 rounded border text-left transition-all text-sm
        ${isCompleted
          ? 'border-accent/50 bg-accent/5 text-text'
          : 'border-border bg-bg-card text-text-secondary hover:border-border-focus'
        }
      `}
      title={habit.description}
    >
      <span className={isCompleted ? 'text-accent' : 'text-text-muted'}>
        {isCompleted ? '●' : '○'}
      </span>
      <span className="truncate flex-1">{habit.label}</span>
      {streak > 0 && (
        <span className="text-xs text-text-muted font-mono">{streak}d</span>
      )}
    </button>
  );
}

export function HabitGrid({ habits, completedHabits, streaks, onToggle }: HabitGridProps) {
  if (habits.length === 0) return null;

  const completedCount = Object.values(completedHabits).filter(Boolean).length;

  return (
    <div className="bg-bg-card rounded border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
          habits
        </span>
        <span className="text-xs text-text-muted font-mono">
          {completedCount}/{habits.length}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {habits.map(habit => (
          <HabitToggle
            key={habit.id}
            habit={habit}
            isCompleted={completedHabits[habit.id] || false}
            streak={streaks[habit.id] || 0}
            onToggle={() => onToggle(habit.id)}
          />
        ))}
      </div>
    </div>
  );
}
