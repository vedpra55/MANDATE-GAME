import layout from '../../data/desk-layout.json';
import { useGame, type OverlayId } from '../../state/gameStore.ts';
import { art } from '../assets.ts';
import { strings } from '../strings.ts';
import { Calendar } from './Calendar.tsx';
import { Overlays } from './overlays/Overlays.tsx';

const tier = layout.tiers['1'];
type PropId = keyof typeof strings.props;

/** The sarpanch desk: empty background + each prop as its own clickable object. */
export function Desk() {
  const open = useGame((s) => s.open);
  const goTo = useGame((s) => s.goTo);
  const unread = useGame((s) => s.unread);
  const bg = art(tier.background);

  return (
    <div className="desk">
      <img className="desk-bg" src={bg.src} srcSet={bg.srcSet} alt="" draggable={false} />

      {tier.props.map((p) => {
        if (p.id === 'calendar') return <Calendar key={p.id} x={p.x} y={p.y} width={p.width} />;
        const img = art(p.asset);
        const isChai = p.id === 'chai';
        const ringing = p.id === 'phone' && unread > 0;
        return (
          <button
            key={p.id}
            type="button"
            className={`prop prop-${p.id}${ringing ? ' ringing' : ''}`}
            style={{ left: p.x, top: p.y, width: p.width, zIndex: p.z }}
            aria-label={strings.props[p.id as PropId]}
            title={strings.props[p.id as PropId]}
            onClick={isChai ? undefined : () => open(p.id as OverlayId)}
          >
            <img src={img.src} srcSet={img.srcSet} alt="" draggable={false} />
            {ringing && <span className="badge">{unread}</span>}
          </button>
        );
      })}

      {tier.hotspots.map((h) => (
        <button
          key={h.id}
          type="button"
          className="hotspot"
          style={{ left: h.x, top: h.y, width: h.width, height: h.height }}
          aria-label={strings.props.bicycle}
          title={strings.props.bicycle}
          onClick={() => goTo('map')}
        />
      ))}

      <Overlays />
    </div>
  );
}
