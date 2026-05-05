// MIGRATED from: hooks/useKeyboard.ts
import { onMounted, onUnmounted } from 'vue'

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
  const handleKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      onDelete()
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault()
      onDuplicate()
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault()
      onSelectAll()
    } else if (e.key === 'Escape') {
      onEscape()
    }
  }

  onMounted(() => window.addEventListener('keydown', handleKeyDown))
  onUnmounted(() => window.removeEventListener('keydown', handleKeyDown))
}
