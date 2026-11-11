import { useState } from 'react';
import { TOLAS, type TolaId } from '../../engine/types.ts';
import { pollRanges } from '../../engine/polls.ts';
import { useGame } from '../../state/gameStore.ts';
import { Stamp } from '../components/Stamp.tsx';
import { strings as S } from '../strings.ts';

/** Polling day: put your workers at the booths. Unmanned booths lose you votes. */
export function BoothPlan() {
  const game = useGame((s) => s.game)!;
  const dispatch = useGame((s) => s.dispatch);
  const goTo = useGame((s) => s.goTo);
  const total = game.cadre.size;
  const ranges = pollRanges(game);
  const [plan, setPlan] = useState<Record<TolaId, number>>(() => {
    const even = Math.floor(total / TOLAS.length);
    return Object.fromEntries(TOLAS.map((t) => [t, even])) as Record<TolaId, number>;
  });
  const used = TOLAS.reduce((a, t) => a + plan[t], 0);
  const change = (t: TolaId, d: number) => setPlan((p) => ({ ...p, [t]: Math.max(0, p[t] + d) }));

  return (
    <div className="overlay">
      <div className="overlay-body">
        <div className="paper booth-plan">
          <h2>{S.booths.title}</h2>
          <p className="muted">{S.booths.hint}</p>
          <table className="booth-table hand">
            <tbody>
              {TOLAS.map((t) => (
                <tr key={t}>
                  <th>{S.tolas[t]}</th>
                  <td className="muted">
                    {ranges[t].low}–{ranges[t].high}%
                  </td>
                  <td>
                    <button
                      type="button"
                      className="chip"
                      onClick={() => change(t, -1)}
                      disabled={plan[t] === 0}
                      aria-label={`fewer workers in ${S.tolas[t]}`}
                    >
                      −
                    </button>
                    <span className="booth-count">{plan[t]}</span>
                    <button
                      type="button"
                      className="chip"
                      onClick={() => change(t, 1)}
                      disabled={used >= total}
                      aria-label={`more workers in ${S.tolas[t]}`}
                    >
                      +
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="writing-foot">
            <span className="muted">{S.booths.workersLeft(total - used)}</span>
            <Stamp
              onClick={() => {
                if (dispatch({ type: 'assignBooths', plan }) && dispatch({ type: 'beginCounting' }))
                  goTo('counting');
              }}
            >
              {S.booths.go}
            </Stamp>
          </div>
        </div>
      </div>
    </div>
  );
}
