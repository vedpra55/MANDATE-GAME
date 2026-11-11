import { useEffect, useState } from 'react';
import { useGame } from '../../state/gameStore.ts';
import { strings as S } from '../strings.ts';
import { Stamp } from './Stamp.tsx';

const DELAY_MS = 3000;

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
  const [waitedOn, setWaitedOn] = useState<number | null>(null);

  const ready =
    auto &&
    !!game &&
    game.phase === 'campaign' &&
    game.clock.slotsLeftToday === 0 &&
    !game.pending.question &&
    !game.pending.call &&
    !thinking &&
    overlay === null &&
    (scene === 'desk' || (scene === 'map' && selectedTola === null)) &&
    waitedOn !== game.clock.day;

  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => {
      if (dispatch({ type: 'endDay' })) {
        const g = useGame.getState();
        if (g.overlay !== 'phone') goTo('desk');
      }
    }, DELAY_MS);
    return () => window.clearTimeout(t);
  }, [ready, dispatch, goTo]);

  if (!ready) return null;
  return (
    <div className="dusk">
      <span className="hand">{S.dusk.text}</span>
      <Stamp className="small" onClick={() => setWaitedOn(game!.clock.day)}>
        {S.dusk.wait}
      </Stamp>
    </div>
  );
}
