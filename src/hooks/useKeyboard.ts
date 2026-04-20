import { useEffect } from 'react';

interface KeyboardActions {
  onDelete: () => void;
  onDuplicate: () => void;
  onSelectAll: () => void;
  onEscape: () => void;
}

/**
 * Handles global keyboard shortcuts for the timeline.
 * Does nothing when focus is inside an interactive element.
 */
export function useKeyboard({
  onDelete,
  onDuplicate,
  onSelectAll,
  onEscape,
}: KeyboardActions): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDelete();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        onDuplicate();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        onSelectAll();
      } else if (e.key === 'Escape') {
        onEscape();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDelete, onDuplicate, onSelectAll, onEscape]);
}
