import { useEffect, useRef, useState } from 'react';
import { LinearProgress } from '@mui/material';

const MINIMUM_VISIBLE_MS = 400;

export default function TopActivityBar({ active, label = 'Dashboard is updating' }) {
  const [visible, setVisible] = useState(active);
  const visibleSince = useRef(active ? Date.now() : 0);

  useEffect(() => {
    if (active) {
      visibleSince.current = Date.now();
      setVisible(true);
      return undefined;
    }

    if (!visible) return undefined;
    const remaining = Math.max(0, MINIMUM_VISIBLE_MS - (Date.now() - visibleSince.current));
    const timeout = globalThis.setTimeout(() => setVisible(false), remaining);
    return () => globalThis.clearTimeout(timeout);
  }, [active, visible]);

  if (!visible) return null;

  return (
    <LinearProgress
      aria-label={active ? label : 'Dashboard update complete'}
      color="secondary"
      variant={active ? 'indeterminate' : 'determinate'}
      value={active ? undefined : 100}
      sx={{
        position: 'fixed',
        inset: '0 0 auto 0',
        zIndex: (theme) => theme.zIndex.tooltip + 1,
        height: 10,
        pointerEvents: 'none',
        bgcolor: 'rgba(255, 255, 255, 0.24)',
        '& .MuiLinearProgress-bar': {
          transition: 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
        },
        '@media (prefers-reduced-motion: reduce)': {
          '& .MuiLinearProgress-bar': {
            animation: 'none',
            transform: 'scaleX(1)',
            transformOrigin: 'left',
            transition: 'none',
          },
        },
      }}
    />
  );
}
