/**
 * Claude API Service
 *
 * Client-side integration with Claude API for daily insights.
 * API key stored locally, never exported with data.
 */

import type { HistoricalAnalytics, HabitAnalytics } from '../utils/analytics';

const API_KEY_STORAGE_KEY = 'calendar-claude-api-key';

export function saveApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
}

export function loadApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
}

export function clearApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
}

interface HabitData {
  name: string;
  completed: boolean;
  streak: number;
}

interface DayInsightRequest {
  habits: HabitData[];
  tasksCompleted: number;
  totalTasks: number;
  daysUntilEndOfYear: number;
  reflection?: string;
}

export interface EnhancedInsightRequest extends DayInsightRequest {
  analytics: HistoricalAnalytics;
}

/**
 * Generate a personalized daily insight using Claude
 */
export async function generateDailyInsight(data: DayInsightRequest): Promise<string> {
  const apiKey = loadApiKey();
  if (!apiKey) {
    throw new Error('No API key configured');
  }

  const habitSummary = data.habits
    .map(h => `${h.name}: ${h.completed ? '✓' : '✗'}${h.streak > 0 ? ` (${h.streak}d streak)` : ''}`)
    .join('\n');

  const prompt = `You are a stoic, Naval Ravikant-inspired life coach. Be extremely brief (2-3 sentences max). No fluff, no emojis. Give one sharp insight based on this data:

Habits today:
${habitSummary}

Tasks: ${data.tasksCompleted}/${data.totalTasks}
Days left this year: ${data.daysUntilEndOfYear}
${data.reflection ? `Reflection: "${data.reflection}"` : ''}

Give one actionable insight. Focus on leverage, compound effects, or what matters most today. Be direct.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(error.error?.message || 'API request failed');
  }

  const result = await response.json();
  return result.content[0]?.text || 'No insight generated.';
}

/**
 * Format trend as arrow symbol
 */
function formatTrend(trend: 'up' | 'down' | 'stable'): string {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  return '→';
}

/**
 * Format day-of-week rates compactly
 */
function formatDowRates(rates: Record<string, number>): string {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map(d => `${d}:${rates[d] || 0}`).join(' ');
}

/**
 * Format habit analytics for prompt (token-efficient)
 */
function formatHabitAnalytics(habits: HabitAnalytics[]): string {
  return habits
    .map(h => {
      const trend = formatTrend(h.trend);
      const dow = formatDowRates(h.dayOfWeekRates);
      return `• ${h.name}: ${h.completionRate}% (${trend}) streak:${h.currentStreak}d best:${h.bestStreak}d | ${dow}`;
    })
    .join('\n');
}

/**
 * Format analytics section for prompt
 */
function formatAnalyticsPrompt(analytics: HistoricalAnalytics): string {
  const sections: string[] = [];

  // Habit performance
  sections.push(`Habit Performance (${analytics.periodDays}d):\n${formatHabitAnalytics(analytics.habits)}`);

  // Correlations (if any)
  if (analytics.correlations.length > 0) {
    const corrLines = analytics.correlations
      .map(c => `• ${c.habitA} + ${c.habitB}: ${c.correlation}%`)
      .join('\n');
    sections.push(`Correlations (habits done together):\n${corrLines}`);
  }

  // Day patterns
  const dp = analytics.dayPatterns;
  sections.push(
    `Weekly Pattern:\n• Best: ${dp.bestDay}, Worst: ${dp.worstDay}\n• Weekdays: ${dp.weekdayAvg}% vs Weekends: ${dp.weekendAvg}%`
  );

  // Recent reflections
  if (analytics.recentReflections.length > 0) {
    const reflections = analytics.recentReflections.map(r => `• "${r}"`).join('\n');
    sections.push(`Recent reflections:\n${reflections}`);
  }

  return sections.join('\n\n');
}

/**
 * Generate enhanced insight with historical analytics
 */
export async function generateEnhancedInsight(data: EnhancedInsightRequest): Promise<string> {
  const apiKey = loadApiKey();
  if (!apiKey) {
    throw new Error('No API key configured');
  }

  const habitSummary = data.habits
    .map(h => `${h.name}: ${h.completed ? '✓' : '✗'}${h.streak > 0 ? ` (${h.streak}d)` : ''}`)
    .join(', ');

  const analyticsSection = formatAnalyticsPrompt(data.analytics);

  const prompt = `You are a stoic, Naval Ravikant-inspired life coach. Be extremely brief (2-3 sentences max). No fluff, no emojis.

TODAY:
Habits: ${habitSummary}
Tasks: ${data.tasksCompleted}/${data.totalTasks}
Days left this year: ${data.daysUntilEndOfYear}
${data.reflection ? `Reflection: "${data.reflection}"` : ''}

HISTORICAL ANALYTICS:
${analyticsSection}

Based on both today's status AND the historical patterns, give one sharp insight. Look for:
- Day-of-week patterns (best/worst days)
- Habit correlations (which habits cluster)
- Trends (improving/declining habits)
- Weekend vs weekday differences

Focus on leverage and what action today would have compound effects. Be direct.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(error.error?.message || 'API request failed');
  }

  const result = await response.json();
  return result.content[0]?.text || 'No insight generated.';
}
