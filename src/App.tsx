/**
 * Life Calendar - Main App Component
 *
 * "Frictionless. Track, reflect, see patterns."
 * Terminal meets journal - clean, fast, keyboard-first.
 */

import { AppProvider } from './store/AppContext';
import { ThemeProvider } from './store/ThemeContext';
import { Layout } from './components/Layout';
import { useNavigation } from './hooks/useNavigation';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { TodayView } from './views/TodayView';
import { WeekView } from './views/WeekView';
import { YearView } from './views/YearView';
import { SettingsView } from './views/SettingsView';

function AppContent() {
  const nav = useNavigation();

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onViewChange: nav.setView,
    onGoToToday: nav.goToToday,
    onPreviousDay: nav.goToPreviousDay,
    onNextDay: nav.goToNextDay,
  });

  const handleDateSelect = (date: string) => {
    nav.setSelectedDate(date);
    nav.setView('today');
  };

  const renderView = () => {
    switch (nav.view) {
      case 'today':
        return (
          <TodayView
            selectedDate={nav.selectedDate}
            onPrevious={nav.goToPreviousDay}
            onNext={nav.goToNextDay}
            onDateSelect={nav.setSelectedDate}
          />
        );
      case 'week':
        return (
          <WeekView
            selectedDate={nav.selectedDate}
            onDateSelect={handleDateSelect}
            onPreviousWeek={nav.goToPreviousWeek}
            onNextWeek={nav.goToNextWeek}
          />
        );
      case 'year':
        return (
          <YearView
            selectedYear={nav.selectedYear}
            onYearChange={nav.setSelectedYear}
            onDateSelect={handleDateSelect}
          />
        );
      case 'settings':
        return <SettingsView />;
      default:
        return null;
    }
  };

  return (
    <Layout
      currentView={nav.view}
      selectedDate={nav.selectedDate}
      onViewChange={nav.setView}
      onTodayClick={nav.goToToday}
    >
      {renderView()}
    </Layout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ThemeProvider>
  );
}
