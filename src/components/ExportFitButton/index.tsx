import { useRef, useState } from 'react';
import { FitWriter } from '@markw65/fit-file-writer';
import type { Block } from '../../types';
import { ZONES } from '../../types';
import type { ZoneSystem } from '../../zones';
import { getBlockWatts, zoneMidpoint } from '../../zones';
import styles from './ExportFitButton.module.css';

interface ExportFitButtonProps {
  blocks: Block[];
  zoneSystem: ZoneSystem;
  workoutTitle?: string;
}

/** Derive a FIT intensity value from a block's position and zone. */
function getIntensity(
  idx: number,
  blocks: Block[],
): 'warmup' | 'cooldown' | 'active' {
  // Leading run of z1 blocks → warmup
  let warmupEnd = 0;
  while (warmupEnd < blocks.length && blocks[warmupEnd].zone === 'z1') {
    warmupEnd++;
  }

  // Trailing run of z1 blocks → cooldown (only if there are non-z1 blocks before)
  let cooldownStart = blocks.length;
  if (warmupEnd < blocks.length) {
    cooldownStart = blocks.length;
    while (cooldownStart > warmupEnd && blocks[cooldownStart - 1].zone === 'z1') {
      cooldownStart--;
    }
  }

  if (idx < warmupEnd) return 'warmup';
  if (idx >= cooldownStart) return 'cooldown';
  return 'active';
}

function IconDownload() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 2v8M5 7l3 3 3-3" />
      <path d="M3 13h10" />
    </svg>
  );
}

function IconSpinner() {
  return (
    <svg
      className={styles.spinner}
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6" strokeOpacity="0.25" />
      <path d="M14 8a6 6 0 0 0-6-6" />
    </svg>
  );
}

export default function ExportFitButton({
  blocks,
  zoneSystem,
  workoutTitle,
}: ExportFitButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const anchorRef = useRef<HTMLAnchorElement>(null);

  const handleExport = () => {
    setLoading(true);
    setError(null);

    try {
      const isHrMode = zoneSystem.mode === 'hrmax';
      const fw = new FitWriter();
      const timeCreated = fw.time(new Date());

      fw.writeMessage(
        'file_id',
        {
          type: 'workout',
          manufacturer: 'development',
          time_created: timeCreated,
        },
        null,
        true,
      );

      fw.writeMessage(
        'workout',
        {
          sport: 'cycling',
          num_valid_steps: blocks.length,
        },
        null,
        true,
      );

      blocks.forEach((block, idx) => {
        const zoneIdx = ZONES.indexOf(block.zone);
        const zoneRange = zoneSystem.zones[zoneIdx >= 0 ? zoneIdx : 0];

        const targetValue = isHrMode
          ? zoneMidpoint(zoneRange)
          : getBlockWatts(block.watts, zoneIdx >= 0 ? zoneIdx : 0, zoneSystem.zones);

        fw.writeMessage(
          'workout_step',
          {
            duration_type: 'time',
            duration_value: block.duration * 1000,
            target_type: isHrMode ? 'heart_rate' : 'power',
            target_value: targetValue,
            intensity: getIntensity(idx, blocks),
          },
          null,
          idx === blocks.length - 1,
        );
      });

      const dataView = fw.finish();
      // Copy bytes into a fresh ArrayBuffer to satisfy Blob's type constraints
      const fitBytes = new Uint8Array(dataView.byteLength);
      fitBytes.set(new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength));
      const blob = new Blob([fitBytes], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);

      const title = workoutTitle?.trim() ?? '';
      const filename = title
        ? `${title.toLowerCase().replace(/\s+/g, '_')}.fit`
        : 'workout.fit';

      const anchor = anchorRef.current;
      if (anchor) {
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
      }

      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('FIT export error:', err);
      setError('Erreur lors de la génération du fichier .fit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <button
        className={styles.btn}
        onClick={handleExport}
        disabled={loading || blocks.length === 0}
        title="Exporter le workout au format .fit"
        aria-label="Exporter .fit"
      >
        {loading ? <IconSpinner /> : <IconDownload />}
        <span>Export .fit</span>
      </button>
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
      {/* Hidden anchor used to trigger the file download */}
      <a ref={anchorRef} style={{ display: 'none' }} aria-hidden="true" />
    </div>
  );
}
