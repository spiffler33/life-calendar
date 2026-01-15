/**
 * Daily Inspiration
 *
 * Naval quote + goal countdown. Minimal, stoic.
 */

import { getDailyQuote } from '../data/navalQuotes';
import { getDaysUntilEndOfYear, parseDate } from '../utils/dates';

interface DailyInspirationProps {
  selectedDate: string;
}

export function DailyInspiration({ selectedDate }: DailyInspirationProps) {
  const date = parseDate(selectedDate);
  const quote = getDailyQuote(date);
  const daysLeft = getDaysUntilEndOfYear(selectedDate);

  return (
    <div className="space-y-2">
      {/* Naval quote */}
      <blockquote className="text-sm text-text-secondary italic border-l-2 border-border pl-3">
        "{quote}"
        <cite className="block text-xs text-text-muted mt-1 not-italic">— Naval</cite>
      </blockquote>

      {/* Countdown */}
      {daysLeft > 0 && (
        <div className="text-xs text-text-muted font-mono">
          {daysLeft} days left this year
        </div>
      )}
    </div>
  );
}
