import { useGame } from '../../state/gameStore.ts';
import { art } from '../assets.ts';
import { EndCard } from '../components/EndCard.tsx';
import { Stamp } from '../components/Stamp.tsx';
import { strings as S } from '../strings.ts';

/** Counting day: booths opened one round at a time, TV-style board, then the end card. */
export function Counting() {
  const game = useGame((s) => s.game)!;
  const dispatch = useGame((s) => s.dispatch);
  const bg = art('scene-counting-centre');
  const c = game.counting;
  if (!c) return null;

  const shown = c.rounds.slice(0, c.revealed);
  const you = shown.reduce((a, r) => a + r.player, 0);
  const rival = shown.reduce((a, r) => a + r.rival, 0);
  const others = shown.reduce((a, r) => a + r.others, 0);
  const diff = you - rival;
  const done = c.revealed === c.rounds.length;

  return (
    <div className="counting-scene">
      <img className="desk-bg" src={bg.src} srcSet={bg.srcSet} alt="" draggable={false} />
      <div className="tv-board">
        <div className="tv-head">
          <span>{S.counting.title}</span>
          <span>{c.revealed > 0 ? S.counting.round(c.revealed, c.rounds.length) : ''}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th />
              <th>{S.counting.you}</th>
              <th>{game.rival.name}</th>
              <th>{S.counting.others}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.tola} className="tv-row">
                <th>{S.tolas[r.tola]}</th>
                <td>{r.player}</td>
                <td>{r.rival}</td>
                <td>{r.others}</td>
              </tr>
            ))}
            {shown.length > 0 && (
              <tr className="tv-total">
                <th>{S.counting.total}</th>
                <td>{you}</td>
                <td>{rival}</td>
                <td>{others}</td>
              </tr>
            )}
          </tbody>
        </table>
        {shown.length > 0 && (
          <div className={`tv-banner ${diff > 0 ? 'lead' : diff < 0 ? 'trail' : 'level'}`}>
            {diff > 0
              ? S.counting.lead(diff)
              : diff < 0
                ? S.counting.trail(-diff)
                : S.counting.level}
          </div>
        )}
        {done && c.tieBrokenByLots && <p className="tv-lots">{S.counting.lots}</p>}
        {!done && (
          <Stamp className="tv-next" onClick={() => dispatch({ type: 'revealRound' })}>
            {c.revealed === 0 ? S.counting.start : S.counting.next}
          </Stamp>
        )}
      </div>
      {game.phase === 'ended' && <EndCard />}
    </div>
  );
}
