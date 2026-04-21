import { useCallback, useMemo, useState } from 'react';
import type { Block, ZoneType } from './types';
import {
  DEFAULT_DURATION,
  MIN_DURATION,
  ZONE_CONFIG,
  ZONES,
  generateId,
} from './types';
import type { ZoneSystem } from './zones';
import { createDefaultZoneSystem, getZoneIndexForWatts } from './zones';
import Timeline       from './components/Timeline';
import BlockEditor    from './components/BlockEditor';
import ShortcutHelper from './components/ShortcutHelper';
import ZoneSettings   from './components/ZoneSettings';
import { useKeyboard } from './hooks/useKeyboard';
import styles from './App.module.css';

/* ─── Initial session (showcase) ─────────────────────────────────────────── */
const INITIAL_BLOCKS: Block[] = [
  { id: generateId(), duration: 600, zone: 'z1' },
  { id: generateId(), duration: 300, zone: 'z2' },
  { id: generateId(), duration: 240, zone: 'z3' },
  { id: generateId(), duration: 180, zone: 'z4' },
  { id: generateId(), duration: 90,  zone: 'z5' },
  { id: generateId(), duration: 180, zone: 'z2' },
  { id: generateId(), duration: 90,  zone: 'z5' },
  { id: generateId(), duration: 180, zone: 'z2' },
  { id: generateId(), duration: 90,  zone: 'z4' },
  { id: generateId(), duration: 300, zone: 'z1' },
];

/* ─── Zone legend sub-component ───────────────────────────────────────────── */
function ZoneLegend() {
  return (
    <div className={styles.legend}>
      {ZONES.map((zone) => {
        const cfg = ZONE_CONFIG[zone];
        return (
          <div key={zone} className={styles.legendItem}>
            <span
              className={styles.legendDot}
              style={{ background: cfg.bg, border: `2px solid ${cfg.border}` }}
            />
            <span className={styles.legendLabel}>{cfg.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Format duration helper ─────────────────────────────────────────────── */
function formatTotal(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`;
  return `${m}min`;
}

/* ─── App ─────────────────────────────────────────────────────────────────── */
export default function App() {
  const [blocks,      setBlocks]      = useState<Block[]>(INITIAL_BLOCKS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeId,    setActiveId]    = useState<string | null>(null);
  const [zoneSystem,  setZoneSystem]  = useState<ZoneSystem>(createDefaultZoneSystem);

  /* ── Selection ──────────────────────────────────────────────────────────── */

  const handleSelect = useCallback((id: string, mode: 'single' | 'multi') => {
    setSelectedIds((prev) => {
      if (mode === 'multi') {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else              next.add(id);
        return next;
      }
      if (prev.size === 1 && prev.has(id)) return new Set<string>();
      return new Set([id]);
    });
  }, []);

  const handleDeselectAll = useCallback(() => setSelectedIds(new Set<string>()), []);

  const handleSelectAll = useCallback(
    () => setSelectedIds(new Set(blocks.map((b) => b.id))),
    [blocks],
  );

  /* ── Add block ──────────────────────────────────────────────────────────── */

  const handleAddBlock = useCallback(() => {
    const newBlock: Block = {
      id:       generateId(),
      duration: DEFAULT_DURATION,
      zone:     'z2',
    };
    setBlocks((prev) => [...prev, newBlock]);
    setSelectedIds(new Set([newBlock.id]));
  }, []);

  /* ── Resize block (duration) ────────────────────────────────────────────── */

  const handleResizeBlock = useCallback((id: string, duration: number) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, duration } : b)),
    );
  }, []);

  /* ── Watts change ───────────────────────────────────────────────────────── */

  const handleWattsChange = useCallback((id: string, watts: number) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const zoneIdx = getZoneIndexForWatts(watts, zoneSystem.zones);
        return { ...b, watts, zone: ZONES[zoneIdx] };
      }),
    );
  }, [zoneSystem.zones]);

  /* ── Delete ─────────────────────────────────────────────────────────────── */

  const handleDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    setBlocks((prev) => prev.filter((b) => !selectedIds.has(b.id)));
    setSelectedIds(new Set<string>());
  }, [selectedIds]);

  /* ── Duplicate ──────────────────────────────────────────────────────────── */

  const handleDuplicate = useCallback(() => {
    if (selectedIds.size === 0) return;
    const selectedInOrder = blocks.filter((b) => selectedIds.has(b.id));
    const lastIdx = Math.max(
      ...selectedInOrder.map((b) => blocks.indexOf(b)),
    );
    const clones = selectedInOrder.map((b) => ({ ...b, id: generateId() }));
    setBlocks((prev) => [
      ...prev.slice(0, lastIdx + 1),
      ...clones,
      ...prev.slice(lastIdx + 1),
    ]);
    setSelectedIds(new Set(clones.map((c) => c.id)));
  }, [blocks, selectedIds]);

  /* ── Group edit ─────────────────────────────────────────────────────────── */

  const handleDurationChange = useCallback(
    (delta: number) => {
      setBlocks((prev) =>
        prev.map((b) =>
          selectedIds.has(b.id)
            ? { ...b, duration: Math.max(MIN_DURATION, b.duration + delta) }
            : b,
        ),
      );
    },
    [selectedIds],
  );

  const handleZoneChange = useCallback(
    (zone: ZoneType) => {
      setBlocks((prev) =>
        prev.map((b) => (selectedIds.has(b.id) ? { ...b, zone } : b)),
      );
    },
    [selectedIds],
  );

  /** Apply a watts value (absolute) to all selected blocks */
  const handleBlockEditorWattsChange = useCallback(
    (watts: number) => {
      setBlocks((prev) =>
        prev.map((b) => {
          if (!selectedIds.has(b.id)) return b;
          const zoneIdx = getZoneIndexForWatts(watts, zoneSystem.zones);
          return { ...b, watts, zone: ZONES[zoneIdx] };
        }),
      );
    },
    [selectedIds, zoneSystem.zones],
  );

  /* ── Zone system ────────────────────────────────────────────────────────── */

  const handleZoneSystemChange = useCallback((sys: ZoneSystem) => {
    setZoneSystem(sys);
    // Recompute zone labels for blocks with explicit watts when boundaries shift
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.watts === undefined) return b;
        const zoneIdx = getZoneIndexForWatts(b.watts, sys.zones);
        return { ...b, zone: ZONES[zoneIdx] };
      }),
    );
  }, []);

  /* ── Drag & drop ────────────────────────────────────────────────────────── */

  const handleDragStart = useCallback((id: string) => setActiveId(id), []);

  const handleDragEnd = useCallback((): void => {
    setActiveId(null);
  }, []);

  /* ── Keyboard shortcuts ─────────────────────────────────────────────────── */

  useKeyboard({
    onDelete:    handleDelete,
    onDuplicate: handleDuplicate,
    onSelectAll: handleSelectAll,
    onEscape:    handleDeselectAll,
  });

  /* ── Derived state ──────────────────────────────────────────────────────── */

  const selectedBlocks = useMemo(
    () => blocks.filter((b) => selectedIds.has(b.id)),
    [blocks, selectedIds],
  );

  const totalSeconds = useMemo(
    () => blocks.reduce((s, b) => s + b.duration, 0),
    [blocks],
  );

  return (
    <div className={styles.app}>
      {/* ══ Header ══════════════════════════════════════════════════════════ */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>⚡</span>
          <span className={styles.brandName}>VOLT</span>
          <span className={styles.brandSub}>Workout Builder</span>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{blocks.length}</span>
            <span className={styles.statLabel}>blocs</span>
          </div>
          {totalSeconds > 0 && (
            <div className={styles.stat}>
              <span className={styles.statValue}>{formatTotal(totalSeconds)}</span>
              <span className={styles.statLabel}>durée</span>
            </div>
          )}
          {selectedIds.size > 0 && (
            <div className={`${styles.stat} ${styles.statSelected}`}>
              <span className={styles.statValue}>{selectedIds.size}</span>
              <span className={styles.statLabel}>
                sélectionné{selectedIds.size > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        <div className={styles.headerActions}>
          {/* Zone settings */}
          <ZoneSettings
            zoneSystem={zoneSystem}
            onZoneSystemChange={handleZoneSystemChange}
          />

          <button
            className={styles.btnSecondary}
            onClick={handleDeselectAll}
            disabled={selectedIds.size === 0}
          >
            Désélectionner
          </button>
          <button className={styles.btnPrimary} onClick={handleAddBlock}>
            <span>+</span>&nbsp;Ajouter
          </button>
          {blocks.length > 0 && (
            <button
              className={styles.btnDanger}
              onClick={() => {
                setBlocks([]);
                setSelectedIds(new Set<string>());
              }}
              title="Vider la timeline"
            >
              Vider
            </button>
          )}
        </div>
      </header>

      {/* ══ Zone legend ════════════════════════════════════════════════════ */}
      <ZoneLegend />

      {/* ══ Main content ══════════════════════════════════════════════════ */}
      <main className={styles.main}>
        <Timeline
          blocks={blocks}
          selectedIds={selectedIds}
          activeId={activeId}
          zoneSystem={zoneSystem}
          onBlocksChange={setBlocks}
          onSelect={handleSelect}
          onAddBlock={handleAddBlock}
          onResizeBlock={handleResizeBlock}
          onWattsChange={handleWattsChange}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />
      </main>

      {/* ══ Block editor (floating) ════════════════════════════════════════ */}
      {selectedBlocks.length > 0 && (
        <BlockEditor
          selectedBlocks={selectedBlocks}
          zoneSystem={zoneSystem}
          onDurationChange={handleDurationChange}
          onZoneChange={handleZoneChange}
          onWattsChange={handleBlockEditorWattsChange}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onClose={handleDeselectAll}
        />
      )}

      {/* ══ Shortcut helper ═══════════════════════════════════════════════ */}
      <ShortcutHelper />
    </div>
  );
}
