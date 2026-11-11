import layout from '../../data/desk-layout.json' with { type: 'json' };
import { bandOfTola } from '../../engine/pa.ts';
import type { TolaId } from '../../engine/types.ts';
import { useGame } from '../../state/gameStore.ts';
import { art } from '../assets.ts';
import { Stamp } from '../components/Stamp.tsx';
import { strings as S } from '../strings.ts';
import { TolaCard } from './TolaCard.tsx';

const areas = layout.map.areas as {
  tola: TolaId;
  x: number;
  y: number;
  width: number;
  height: number;
}[];

/** The village map: five tolas you can visit, each tinted by how it feels about you. */
export function VillageMap() {
  const game = useGame((s) => s.game)!;
  const goTo = useGame((s) => s.goTo);
  const selected = useGame((s) => s.selectedTola);
  const selectTola = useGame((s) => s.selectTola);
  const bg = art('scene-village-map');

  return (
    <div className="map-scene">
      <img
        className="desk-bg"
        src={bg.src}
        srcSet={bg.srcSet}
        alt={S.map.title}
        draggable={false}
      />
      {areas.map((a) => {
        const band = bandOfTola(game, a.tola);
        return (
          <button
            key={a.tola}
            type="button"
            className={`map-area tint-${band}${selected === a.tola ? ' selected' : ''}`}
            style={{ left: a.x, top: a.y, width: a.width, height: a.height }}
            onClick={() => selectTola(a.tola)}
            aria-label={S.tolas[a.tola]}
          >
            <span className="map-tag hand">{S.tolas[a.tola]}</span>
          </button>
        );
      })}
      {!selected && (
        <div className="paper map-note">
          <h2>{S.map.title}</h2>
          <p className="hand">{S.map.hint}</p>
          <Stamp onClick={() => goTo('desk')}>{S.map.backToDesk}</Stamp>
        </div>
      )}
      {selected && <TolaCard tola={selected} />}
    </div>
  );
}
