import { useEffect, useState } from 'react';
import { useGame } from '../../state/gameStore.ts';
import { strings as S } from '../strings.ts';
import { Stamp } from './Stamp.tsx';

const DELAY_MS = 3000;
/** With a tola card open, people's reactions are still on screen: leave time to read them. */
const READING_DELAY_MS = 7000;

/**
 * When the day's slots are used and nothing is waiting, dusk falls and the day ends by itself
 * after a few seconds. Opening anything (or pressing Wait) cancels it; the calendar still works.
 */
export function Dusk() {
  const game = useGame((s) => s.game);
  const scene = useGame((s) => s.scene);
  const overlay = useGame((s) => s.overlay);
  const selectedTola = useGame((s) => s.selectedTola);
  const thinking = useGame((s) => s.thinking);
  const auto = useGame((s) => s.autoEndDay);
  const dispatch = useGame((s) => s.dispatch);
  const goTo = useGame((s) => s.goTo);
  const open = useGame((s) => s.open);
  const [waitedOn, setWaitedOn] = useState<number | null>(null);

  // Shown whenever the day's slots are used up, so the game never just goes quiet.
  const evening =
    !!game &&
    game.phase === 'campaign' &&
    game.clock.slotsLeftToday === 0 &&
    !thinking &&
    overlay === null &&
    (scene === 'desk' || scene === 'map');
  const waiting = !!game && (!!game.pending.question || !!game.pending.call);
  const ready = evening && auto && !waiting && waitedOn !== game!.clock.day;

  const delay = scene === 'map' && selectedTola !== null ? READING_DELAY_MS : DELAY_MS;

  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => {
      if (dispatch({ type: 'endDay' }) && useGame.getState().overlay !== 'phone') goTo('desk');
    }, delay);
    return () => window.clearTimeout(t);
  }, [ready, delay, dispatch, goTo]);

  const endNow = () => {
    if (dispatch({ type: 'endDay' }) && useGame.getState().overlay !== 'phone') goTo('desk');
  };
  if (!evening) return null;
  if (waiting)
    return (
      <div className={`dusk${scene === 'map' ? ' dusk-map' : ''}`}>
        <span className="hand">{S.dusk.waiting}</span>
        <Stamp
          className="small"
          onClick={() => {
            goTo('desk');
            open('phone');
          }}
        >
          {S.dusk.answer}
        </Stamp>
      </div>
    );
  if (!ready)
    return (
      <div className={`dusk${scene === 'map' ? ' dusk-map' : ''}`}>
        <span className="hand">{S.dusk.done}</span>
        <Stamp className="small" onClick={endNow}>
          {S.dusk.endNow}
        </Stamp>
      </div>
    );
  return (
    <div className={`dusk${scene === 'map' ? ' dusk-map' : ''}`}>
      <span className="hand">{S.dusk.text}</span>
      <Stamp className="small" onClick={() => setWaitedOn(game!.clock.day)}>
        {S.dusk.wait}
      </Stamp>
      <Stamp className="small" onClick={endNow}>
        {S.dusk.endNow}
      </Stamp>
    </div>
  );
}
