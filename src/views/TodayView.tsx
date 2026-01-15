/**
 * Today View
 *
 * Daily execution view. MITs, habits, reflection.
 * Stoic, minimal, factual.
 */

import { useApp } from '../store/AppContext';
import { DateNavigation } from '../components/DateNavigation';
import { MitSection } from '../components/MitSection';
import { HabitGrid } from '../components/HabitGrid';
import { Reflection } from '../components/Reflection';

interface TodayViewProps {
  selectedDate: string;
  onPrevious: () => void;
  onNext: () => void;
  onDateSelect: (date: string) => void;
}

export function TodayView({ selectedDate, onPrevious, onNext, onDateSelect }: TodayViewProps) {
  const {
    state,
    getDailyData,
    toggleHabit,
    addMit,
    updateMit,
    deleteMit,
    toggleMit,
    setReflection,
    getHabitCount,
  } = useApp();

  const dayData = getDailyData(selectedDate);
  const habits = state.settings.habits;
  const habitCount = getHabitCount(selectedDate);

  const totalMits = dayData.mit.work.length + dayData.mit.self.length + dayData.mit.family.length;
  const completedMits =
    dayData.mit.work.filter(i => i.completed).length +
    dayData.mit.self.filter(i => i.completed).length +
    dayData.mit.family.filter(i => i.completed).length;

  return (
    <div className="space-y-6">
      <DateNavigation
        selectedDate={selectedDate}
        onPrevious={onPrevious}
        onNext={onNext}
        onDateSelect={onDateSelect}
      />

      {/* Status line - factual only */}
      {(totalMits > 0 || habitCount > 0) && (
        <div className="text-xs text-text-muted font-mono">
          {totalMits > 0 && <span>{completedMits}/{totalMits} tasks</span>}
          {totalMits > 0 && habitCount > 0 && <span className="mx-2">·</span>}
          {habits.length > 0 && <span>{habitCount}/{habits.length} habits</span>}
        </div>
      )}

      {/* MITs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <MitSection
          category="work"
          title="work"
          items={dayData.mit.work}
          onAdd={text => addMit(selectedDate, 'work', text)}
          onUpdate={(id, text) => updateMit(selectedDate, 'work', id, text)}
          onDelete={id => deleteMit(selectedDate, 'work', id)}
          onToggle={id => toggleMit(selectedDate, 'work', id)}
        />
        <MitSection
          category="self"
          title="self"
          items={dayData.mit.self}
          onAdd={text => addMit(selectedDate, 'self', text)}
          onUpdate={(id, text) => updateMit(selectedDate, 'self', id, text)}
          onDelete={id => deleteMit(selectedDate, 'self', id)}
          onToggle={id => toggleMit(selectedDate, 'self', id)}
        />
        <MitSection
          category="family"
          title="family"
          items={dayData.mit.family}
          onAdd={text => addMit(selectedDate, 'family', text)}
          onUpdate={(id, text) => updateMit(selectedDate, 'family', id, text)}
          onDelete={id => deleteMit(selectedDate, 'family', id)}
          onToggle={id => toggleMit(selectedDate, 'family', id)}
        />
      </div>

      {/* Habits */}
      <HabitGrid
        habits={habits}
        completedHabits={dayData.habits}
        onToggle={habitId => toggleHabit(selectedDate, habitId)}
      />

      {/* Reflection */}
      <Reflection
        value={dayData.reflection}
        onChange={value => setReflection(selectedDate, value)}
      />
    </div>
  );
}
