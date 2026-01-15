/**
 * Settings View
 *
 * Configuration. Theme, habits, data.
 */

import type React from 'react';
import { useState, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { useTheme, THEMES } from '../store/ThemeContext';
import type { HabitDefinition, HabitCategory } from '../types';
import { DEFAULT_HABITS } from '../types';
import { exportData, importData } from '../utils/storage';

interface HabitEditorProps {
  habit: HabitDefinition;
  onUpdate: (habit: HabitDefinition) => void;
  onDelete: () => void;
}

function HabitEditor({ habit, onUpdate, onDelete }: HabitEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editHabit, setEditHabit] = useState(habit);

  const handleSave = () => {
    if (editHabit.label.trim()) {
      onUpdate(editHabit);
      setIsEditing(false);
    }
  };

  const categories: HabitCategory[] = ['health', 'work', 'family', 'learning', 'other'];

  if (isEditing) {
    return (
      <div className="p-3 bg-bg-hover rounded border border-border space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">label</label>
            <input
              type="text"
              value={editHabit.label}
              onChange={e => setEditHabit({ ...editHabit, label: e.target.value })}
              className="w-full px-2 py-1.5 text-sm rounded border border-border bg-bg-card text-text focus:border-accent outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">category</label>
            <select
              value={editHabit.category}
              onChange={e => setEditHabit({ ...editHabit, category: e.target.value as HabitCategory })}
              className="w-full px-2 py-1.5 text-sm rounded border border-border bg-bg-card text-text focus:border-accent outline-none"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">description</label>
          <input
            type="text"
            value={editHabit.description || ''}
            onChange={e => setEditHabit({ ...editHabit, description: e.target.value })}
            className="w-full px-2 py-1.5 text-sm rounded border border-border bg-bg-card text-text focus:border-accent outline-none"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => { setEditHabit(habit); setIsEditing(false); }}
            className="px-2 py-1 text-xs text-text-muted hover:text-text"
          >
            cancel
          </button>
          <button
            onClick={handleSave}
            className="px-2 py-1 text-xs text-accent hover:text-accent-hover"
          >
            save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-2 group">
      <div>
        <div className="text-sm text-text">{habit.label}</div>
        {habit.description && (
          <div className="text-xs text-text-muted">{habit.description}</div>
        )}
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setIsEditing(true)}
          className="text-xs text-text-muted hover:text-text"
        >
          edit
        </button>
        <button
          onClick={onDelete}
          className="text-xs text-text-muted hover:text-error"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function SettingsView() {
  const { state, updateSettings, updateHabits, importData: importAppData } = useApp();
  const { theme, setTheme } = useTheme();
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [addingHabit, setAddingHabit] = useState(false);
  const [newHabitLabel, setNewHabitLabel] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const data = exportData(state);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calendar-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      const parsed = importData(content);
      if (parsed) {
        setShowImportConfirm(true);
        setImportError(null);
        (window as unknown as { __pendingImport?: typeof parsed }).__pendingImport = parsed;
      } else {
        setImportError('invalid file format');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmImport = () => {
    const parsed = (window as unknown as { __pendingImport?: typeof state }).__pendingImport;
    if (parsed) {
      importAppData(parsed);
      delete (window as unknown as { __pendingImport?: typeof state }).__pendingImport;
    }
    setShowImportConfirm(false);
  };

  const handleAddHabit = () => {
    if (!newHabitLabel.trim()) return;
    const habit: HabitDefinition = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
      label: newHabitLabel.trim(),
      description: '',
      emoji: '',
      category: 'health',
    };
    updateHabits([...state.settings.habits, habit]);
    setNewHabitLabel('');
    setAddingHabit(false);
  };

  const handleUpdateHabit = (index: number, habit: HabitDefinition) => {
    const newHabits = [...state.settings.habits];
    newHabits[index] = habit;
    updateHabits(newHabits);
  };

  const handleDeleteHabit = (index: number) => {
    updateHabits(state.settings.habits.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6 max-w-xl">
      <h2 className="text-lg font-medium text-text">settings</h2>

      {/* Theme */}
      <section className="bg-bg-card rounded border border-border p-4">
        <div className="text-xs text-text-muted uppercase tracking-wide mb-3">theme</div>
        <div className="grid grid-cols-5 gap-2">
          {THEMES.map(t => (
            <button
              key={t.name}
              onClick={() => setTheme(t.name)}
              className={`
                px-2 py-2 rounded border text-xs transition-all
                ${theme === t.name
                  ? 'border-accent text-accent'
                  : 'border-border text-text-muted hover:text-text hover:border-border-focus'
                }
              `}
            >
              {t.label.toLowerCase()}
            </button>
          ))}
        </div>
      </section>

      {/* Habits */}
      <section className="bg-bg-card rounded border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-text-muted uppercase tracking-wide">habits</span>
          <button
            onClick={() => updateHabits(DEFAULT_HABITS)}
            className="text-xs text-text-muted hover:text-text"
          >
            reset
          </button>
        </div>

        <div className="divide-y divide-border">
          {state.settings.habits.map((habit, index) => (
            <HabitEditor
              key={habit.id}
              habit={habit}
              onUpdate={h => handleUpdateHabit(index, h)}
              onDelete={() => handleDeleteHabit(index)}
            />
          ))}
        </div>

        {addingHabit ? (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
            <input
              type="text"
              value={newHabitLabel}
              onChange={e => setNewHabitLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddHabit(); if (e.key === 'Escape') setAddingHabit(false); }}
              placeholder="habit name"
              className="flex-1 px-2 py-1.5 text-sm rounded border border-border bg-transparent text-text focus:border-accent outline-none"
              autoFocus
            />
            <button onClick={handleAddHabit} className="text-xs text-accent">add</button>
            <button onClick={() => setAddingHabit(false)} className="text-xs text-text-muted">cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setAddingHabit(true)}
            className="w-full mt-3 pt-3 border-t border-border text-xs text-text-muted hover:text-accent text-left"
          >
            + add habit
          </button>
        )}
      </section>

      {/* Week start */}
      <section className="bg-bg-card rounded border border-border p-4">
        <div className="text-xs text-text-muted uppercase tracking-wide mb-3">week starts</div>
        <div className="flex gap-2">
          <button
            onClick={() => updateSettings({ weekStartsOn: 1 })}
            className={`px-3 py-1.5 text-sm rounded border transition-colors ${
              state.settings.weekStartsOn === 1
                ? 'border-accent text-accent'
                : 'border-border text-text-muted hover:text-text'
            }`}
          >
            monday
          </button>
          <button
            onClick={() => updateSettings({ weekStartsOn: 0 })}
            className={`px-3 py-1.5 text-sm rounded border transition-colors ${
              state.settings.weekStartsOn === 0
                ? 'border-accent text-accent'
                : 'border-border text-text-muted hover:text-text'
            }`}
          >
            sunday
          </button>
        </div>
      </section>

      {/* Data */}
      <section className="bg-bg-card rounded border border-border p-4">
        <div className="text-xs text-text-muted uppercase tracking-wide mb-3">data</div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="px-3 py-1.5 text-sm rounded border border-border text-text-muted hover:text-text transition-colors"
          >
            export
          </button>
          <button
            onClick={handleImportClick}
            className="px-3 py-1.5 text-sm rounded border border-border text-text-muted hover:text-text transition-colors"
          >
            import
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" />
        </div>
        {importError && (
          <div className="mt-2 text-xs text-error">{importError}</div>
        )}
      </section>

      {/* Shortcuts */}
      <section className="bg-bg-card rounded border border-border p-4">
        <div className="text-xs text-text-muted uppercase tracking-wide mb-3">shortcuts</div>
        <div className="text-xs text-text-muted font-mono space-y-1">
          <div>[t] day view</div>
          <div>[w] week view</div>
          <div>[y] year view</div>
          <div>[←][→] navigate</div>
        </div>
      </section>

      {/* Import modal */}
      {showImportConfirm && (
        <div className="fixed inset-0 bg-bg/90 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-card rounded border border-border p-4 max-w-sm w-full">
            <div className="text-sm text-text mb-3">replace all data with import?</div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowImportConfirm(false)} className="text-xs text-text-muted hover:text-text">
                cancel
              </button>
              <button onClick={confirmImport} className="text-xs text-accent">
                confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
