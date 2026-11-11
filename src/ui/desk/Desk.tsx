import layout from '../../data/desk-layout.json';
import { useGame, type OverlayId } from '../../state/gameStore.ts';
import { art } from '../assets.ts';
import { EndCard } from '../components/EndCard.tsx';
import { openingMessages } from '../content.ts';
import { Calendar } from './Calendar.tsx';
import { Declaration, Overlays } from './overlays/Overlays.tsx';

const tier = layout.tiers['1'];
const LABELS: Record<string, string> = {
  phone: 'Phone',
  cash: 'Cash tin',
  ledger: 'Bahi-khata: promises and favours',
  newspaper: "Today's newspaper",
  files: 'Janta darbar files',
  writingPad: 'Writing pad: make a statement',
  diary: "Pintu's diary",
  chai: 'Chai',
};

/** The sarpanch desk: empty background + each prop as its own clickable object. */
export function Desk() {
  const game = useGame((s) => s.game)!;
  const open = useGame((s) => s.open);
  const goTo = useGame((s) => s.goTo);
  const phoneSeen = useGame((s) => s.phoneSeen);
  const unread = phoneSeen ? 0 : openingMessages.length;
  const bg = art(tier.background);
  const campaign = game.phase === 'campaign';

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
            aria-label={LABELS[p.id]}
            title={LABELS[p.id]}
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
          aria-label="Bicycle: ride out to the village"
          title="Bicycle: ride out to the village"
          disabled={!campaign}
          onClick={() => goTo('map')}
        />
      ))}

      {game.phase === 'nomination' ? <Declaration /> : <Overlays />}
      {game.phase === 'ended' && <EndCard />}
    </div>
  );
}
