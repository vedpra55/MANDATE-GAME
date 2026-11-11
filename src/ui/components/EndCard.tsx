import { useGame } from '../../state/gameStore.ts';
import { deciderText } from '../paText.ts';
import { strings as S } from '../strings.ts';
import { Stamp } from './Stamp.tsx';

/** The shareable end card: result, title, what decided it, and what it cost. */
export function EndCard() {
  const game = useGame((s) => s.game)!;
  const quit = useGame((s) => s.quitToTitle);
  const r = game.result;
  if (!r) return null;
  const E = S.endings;
  const title =
    r.title === 'nearly' && game.player.address === 'didi' ? E.nearlyWoman : E.titles[r.title];
  const p = r.promises;

  return (
    <div className="overlay end-overlay">
      <article className="end-card">
        <div className="end-masthead">{E.masthead}</div>
        <h1 className={r.won ? 'won' : 'lost'}>{title}</h1>
        <p className="end-name">{game.player.name}</p>
        <p className="end-line">{E.lines[r.title]}</p>
        {r.title !== 'barred' && (
          <p className="end-result">{`You ${r.playerVotes} · ${game.rival.name} ${r.rivalVotes} · Others ${r.otherVotes}`}</p>
        )}
        {r.deciders.length > 0 && (
          <section>
            <h2>{E.decided}</h2>
            <ol>
              {r.deciders.map((d) => (
                <li key={d.logId}>
                  {deciderText(d, game.rival.name)}
                  {d.count > 1 ? ` (${E.times(d.count)})` : ''}{' '}
                  <span className={d.impact >= 0 ? 'helped' : 'hurt'}>
                    ({d.impact >= 0 ? E.helped : E.hurt}, {E.votes(Math.round(Math.abs(d.impact)))})
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
        <p className="end-ledger">{E.ledger(p.made, p.kept, p.broken, p.open)}</p>
        {r.tags.length > 0 && (
          <div className="end-tags">
            {r.tags.map((t) => (
              <span key={t} className="end-tag">
                {E.tags[t]}
              </span>
            ))}
          </div>
        )}
        <footer>
          <Stamp onClick={quit}>{E.playAgain}</Stamp>
        </footer>
      </article>
    </div>
  );
}
