/**
 * Claude API Service
 *
 * Client-side integration with Claude API for daily insights.
 * API key stored locally, never exported with data.
 */

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
