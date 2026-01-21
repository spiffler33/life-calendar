/**
 * Habit Grid
 *
 * Daily habits as simple toggles. No emojis, just labels.
 * Stoic display - facts only.
 *
 * Click ● to toggle completion.
 * Click habit label to view stats popover.
 */

import { useRef } from 'react';
import type { HabitDefinition, HabitId } from '../types';

interface HabitGridProps {
  habits: HabitDefinition[];
  completedHabits: Record<HabitId, boolean>;
  streaks: Record<HabitId, number>;
  onToggle: (habitId: HabitId) => void;
  onHabitStats?: (habitId: HabitId, anchorRect: DOMRect) => void;
}

interface HabitToggleProps {
  habit: HabitDefinition;
  isCompleted: boolean;
  streak: number;
  onToggle: () => void;
  onStats?: (anchorRect: DOMRect) => void;
}

function HabitToggle({ habit, isCompleted, streak, onToggle, onStats }: HabitToggleProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  const handleLabelClick = () => {
    if (onStats && rowRef.current) {
      const rect = rowRef.current.getBoundingClientRect();
      onStats(rect);
    }
  };

  return (
    <div
      ref={rowRef}
      className={`
        flex items-center gap-2 px-3 py-2 rounded border text-left transition-all text-sm
        ${isCompleted
          ? 'border-accent/50 bg-accent/5 text-text'
          : 'border-border bg-bg-card text-text-secondary hover:border-border-focus'
        }
      `}
      title={habit.description}
    >
      <button
        onClick={onToggle}
        className={`flex-shrink-0 ${isCompleted ? 'text-accent' : 'text-text-muted'} hover:opacity-80 transition-opacity`}
        aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
      >
        {isCompleted ? '●' : '○'}
      </button>
      <button
        onClick={handleLabelClick}
        className="truncate flex-1 text-left hover:text-text transition-colors"
      >
        {habit.label}
      </button>
      {streak > 0 && (
        <span className="text-xs text-text-muted font-mono flex-shrink-0">{streak}d</span>
      )}
    </div>
  );
}

export function HabitGrid({ habits, completedHabits, streaks, onToggle, onHabitStats }: HabitGridProps) {
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
            onStats={onHabitStats ? (rect) => onHabitStats(habit.id, rect) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
