import { useState } from 'react';
import styles from './ShortcutHelper.module.css';

const SHORTCUTS = [
  { keys: ['Suppr', 'Backspace'], action: 'Supprimer les blocs sélectionnés' },
  { keys: ['Ctrl/⌘', 'D'],        action: 'Dupliquer la sélection' },
  { keys: ['Ctrl/⌘', 'A'],        action: 'Tout sélectionner' },
  { keys: ['Shift', 'Clic'],      action: 'Sélection multiple' },
  { keys: ['Ctrl/⌘', 'Clic'],     action: 'Basculer la sélection' },
  { keys: ['Échap'],              action: 'Désélectionner tout' },
  { keys: ['Glisser'],            action: 'Réordonner les blocs' },
  { keys: ['≡', 'bord droit'],    action: 'Redimensionner la durée' },
];

export default function ShortcutHelper() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Trigger button */}
      <button
        className={styles.trigger}
        onClick={() => setIsOpen((v) => !v)}
        title="Raccourcis clavier"
        aria-label="Afficher les raccourcis clavier"
        aria-expanded={isOpen}
      >
        ?
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className={styles.backdrop}
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      {isOpen && (
        <div className={styles.panel} role="dialog" aria-label="Raccourcis clavier">
          <div className={styles.header}>
            <h3 className={styles.title}>Raccourcis clavier</h3>
            <button
              className={styles.closeBtn}
              onClick={() => setIsOpen(false)}
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
          <ul className={styles.list}>
            {SHORTCUTS.map(({ keys, action }) => (
              <li key={action} className={styles.item}>
                <div className={styles.keys}>
                  {keys.map((k) => (
                    <kbd key={k} className={styles.kbd}>{k}</kbd>
                  ))}
                </div>
                <span className={styles.action}>{action}</span>
              </li>
            ))}
          </ul>
          <p className={styles.footer}>
            Cliquez n'importe où dans la timeline vide pour ajouter un bloc.
          </p>
        </div>
      )}
    </>
  );
}
