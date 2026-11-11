import { useGame } from '../../state/gameStore.ts';
import { art } from '../assets.ts';
import { Stamp } from '../components/Stamp.tsx';
import { strings } from '../strings.ts';

/** Village map placeholder: the art, a note from the PA, and the way back. Visits come later. */
export function VillageMap() {
  const goTo = useGame((s) => s.goTo);
  const bg = art('scene-village-map');
  return (
    <div className="map-scene">
      <img
        className="desk-bg"
        src={bg.src}
        srcSet={bg.srcSet}
        alt={strings.map.title}
        draggable={false}
      />
      <div className="paper map-note">
        <h2>{strings.map.title}</h2>
        <p className="hand">{strings.map.hint}</p>
        <Stamp onClick={() => goTo('desk')}>{strings.map.backToDesk}</Stamp>
      </div>
    </div>
  );
}
