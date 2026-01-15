/**
 * MIT Section
 *
 * Task list for a single category. Minimal, keyboard-first.
 */

import type React from 'react';
import { useState, useRef, useEffect } from 'react';
import type { TodoItem, MitCategory } from '../types';

interface MitSectionProps {
  category: MitCategory;
  title: string;
  items: TodoItem[];
  onAdd: (text: string) => void;
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}

interface MitItemProps {
  item: TodoItem;
  onUpdate: (text: string) => void;
  onDelete: () => void;
  onToggle: () => void;
}

function MitItem({ item, onUpdate, onDelete, onToggle }: MitItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSubmit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== item.text) {
      onUpdate(trimmed);
    } else {
      setEditText(item.text);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') {
      setEditText(item.text);
      setIsEditing(false);
    }
  };

  return (
    <div className="group flex items-start gap-3 py-1.5">
      <button
        onClick={onToggle}
        className="mt-0.5 text-text-muted hover:text-accent transition-colors"
        aria-label={item.completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {item.completed ? (
          <span className="text-accent">●</span>
        ) : (
          <span>○</span>
        )}
      </button>

      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editText}
          onChange={e => setEditText(e.target.value)}
          onBlur={handleSubmit}
          onKeyDown={handleKeyDown}
          className="flex-1 text-sm bg-transparent border-b border-border focus:border-accent outline-none text-text"
        />
      ) : (
        <span
          onClick={() => setIsEditing(true)}
          className={`flex-1 text-sm cursor-text ${
            item.completed ? 'line-through text-text-muted' : 'text-text'
          }`}
        >
          {item.text}
        </span>
      )}

      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-error transition-all text-xs"
        aria-label="Delete"
      >
        ×
      </button>
    </div>
  );
}

export function MitSection({
  title,
  items,
  onAdd,
  onUpdate,
  onDelete,
  onToggle,
}: MitSectionProps) {
  const [newItemText, setNewItemText] = useState('');

  const handleAdd = () => {
    const trimmed = newItemText.trim();
    if (trimmed) {
      onAdd(trimmed);
      setNewItemText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
  };

  const completedCount = items.filter(i => i.completed).length;

  return (
    <div className="bg-bg-card rounded border border-border p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
          {title}
        </span>
        {items.length > 0 && (
          <span className="text-xs text-text-muted font-mono">
            {completedCount}/{items.length}
          </span>
        )}
      </div>

      {/* Items */}
      <div className="space-y-0">
        {items.map(item => (
          <MitItem
            key={item.id}
            item={item}
            onUpdate={text => onUpdate(item.id, text)}
            onDelete={() => onDelete(item.id)}
            onToggle={() => onToggle(item.id)}
          />
        ))}
      </div>

      {/* Add input */}
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border">
        <span className="text-text-muted">+</span>
        <input
          type="text"
          value={newItemText}
          onChange={e => setNewItemText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="add item"
          className="flex-1 text-sm bg-transparent outline-none text-text placeholder:text-text-muted"
        />
      </div>
    </div>
  );
}
