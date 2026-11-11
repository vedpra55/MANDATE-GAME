import { useEffect, useState, type ReactNode } from 'react';
import layout from '../../data/desk-layout.json' with { type: 'json' };

const { width: W, height: H } = layout.stage;

/** Fixed 1920×1080 design surface, scaled to fit the window (letterboxed). */
export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return (
    <div className="stage-frame">
      {/* The wrapper takes the scaled size so centring works; the stage keeps 1920×1080 coordinates. */}
      <div style={{ width: W * scale, height: H * scale, position: 'relative' }}>
        <div className="stage" style={{ width: W, height: H, transform: `scale(${scale})` }}>
          {children}
        </div>
      </div>
    </div>
  );
}
