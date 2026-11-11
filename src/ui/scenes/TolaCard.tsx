import { useState } from 'react';
import { bandOfTola } from '../../engine/pa.ts';
import { pollRanges } from '../../engine/polls.ts';
import { worksCost } from '../../engine/promises.ts';
import type { IssueId, TolaId } from '../../engine/types.ts';
import { useGame } from '../../state/gameStore.ts';
import { Stamp } from '../components/Stamp.tsx';
import { noteText } from '../paText.ts';
import { strings as S } from '../strings.ts';

const GIFT_AMOUNTS = [2000, 5000, 10000];

/** Everything you can do in one tola: talk at the doors, fix things, hand out money, recruit. */
export function TolaCard({ tola }: { tola: TolaId }) {
  const game = useGame((s) => s.game)!;
  const dispatch = useGame((s) => s.dispatch);
  const selectTola = useGame((s) => s.selectTola);
  const error = useGame((s) => s.lastError);
  const [text, setText] = useState('');
  const [acted, setActed] = useState(false);

  const t = game.tolas[tola];
  const range = pollRanges(game)[tola];
  const band = bandOfTola(game, tola);
  const slots = game.clock.slotsLeftToday;
  const silence = game.clock.daysToPoll === 1;
  const grievances = (Object.entries(t.grievances) as [IssueId, number][])
    .filter(([, v]) => v >= 0.05)
    .sort((a, b) => b[1] - a[1]);
  const lastNote = game.paNotes.at(-1);

  const act = (ok: boolean) => {
    if (ok) setActed(true);
  };

  return (
    <aside className="paper tola-card">
      <header className="tola-head">
        <h2>{S.tolas[tola]}</h2>
        <span className="muted">
          {S.map.slotsLeft(slots)} · ₹ {game.cash.toLocaleString('en-IN')}
        </span>
      </header>
      <p className="hand pintu-line">
        {S.map.pintuSays} {S.bands[band]}. {S.map.tally(range.low, range.high)}
      </p>
      {(acted || error) && lastNote && (
        <p className="hand pintu-line flash">
          {error ? S.errors[error] : noteText(lastNote, game.player.address)}
        </p>
      )}
      {silence && <p className="muted">{S.map.silence}</p>}

      <section>
        <h3>{S.map.visit}</h3>
        <textarea
          className="hand"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={S.map.visitPlaceholder}
          disabled={slots === 0}
        />
        <Stamp
          disabled={slots === 0 || !text.trim()}
          onClick={() => {
            const ok = dispatch({ type: 'visit', tola, text });
            if (ok) setText('');
            act(ok);
          }}
        >
          {S.writing.stamp}
        </Stamp>
      </section>

      <section>
        <h3>{S.map.grievances}</h3>
        {grievances.length === 0 && <p className="muted">{S.map.noGrievances}</p>}
        <ul className="works-list">
          {grievances.map(([issue, v]) => {
            const cost = worksCost(issue);
            return (
              <li key={issue}>
                <span className="hand">
                  {S.issues[issue]}, {S.grievance(v)}
                </span>
                {cost !== null && (
                  <Stamp
                    className="small"
                    disabled={slots === 0 || game.cash < cost}
                    onClick={() => act(dispatch({ type: 'publicWorks', tola, issue }))}
                    title={S.map.works}
                  >
                    {S.works[issue]} · ₹{cost.toLocaleString('en-IN')}
                  </Stamp>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="tola-row">
        <section>
          <h3>{S.map.gifts}</h3>
          <p className="muted">{S.map.giftsWarning}</p>
          {GIFT_AMOUNTS.map((amount) => (
            <Stamp
              key={amount}
              className="small"
              disabled={slots === 0 || game.cash < amount}
              onClick={() => act(dispatch({ type: 'gifts', tola, amount }))}
            >
              ₹{amount.toLocaleString('en-IN')}
            </Stamp>
          ))}
        </section>
        <section>
          <h3>{S.map.recruit}</h3>
          <Stamp
            className="small"
            disabled={slots === 0}
            onClick={() => act(dispatch({ type: 'recruit', tola, strongman: false }))}
          >
            {S.map.recruitYouth}
          </Stamp>
          <Stamp
            className="small"
            disabled={slots === 0}
            onClick={() => act(dispatch({ type: 'recruit', tola, strongman: true }))}
          >
            {S.map.recruitStrongman}
          </Stamp>
        </section>
      </div>

      <footer className="tola-foot">
        <Stamp onClick={() => selectTola(null)}>{S.back}</Stamp>
      </footer>
    </aside>
  );
}
