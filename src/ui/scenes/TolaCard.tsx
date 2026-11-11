import { useState } from 'react';
import { homeTola } from '../../engine/faultlines.ts';
import { bandOfTola } from '../../engine/pa.ts';
import { pollRanges } from '../../engine/polls.ts';
import { worksCost } from '../../engine/promises.ts';
import type { IssueId, TolaId } from '../../engine/types.ts';
import { useGame } from '../../state/gameStore.ts';
import { Stamp } from '../components/Stamp.tsx';
import { residentsOf } from '../../engine/residents.ts';
import { art } from '../assets.ts';
import { Reactions } from '../desk/overlays/Overlays.tsx';
import { noteText } from '../paText.ts';
import { strings as S } from '../strings.ts';

const GIFT_AMOUNTS = [2000, 5000, 10000];

/** Everything you can do in one tola: talk at the doors, fix what you know, money, workers. */
export function TolaCard({ tola }: { tola: TolaId }) {
  const game = useGame((s) => s.game)!;
  const dispatch = useGame((s) => s.dispatch);
  const say = useGame((s) => s.say);
  const thinking = useGame((s) => s.thinking);
  const selectTola = useGame((s) => s.selectTola);
  const error = useGame((s) => s.lastError);
  const [text, setText] = useState('');
  const [acted, setActed] = useState(false);

  const t = game.tolas[tola];
  const range = pollRanges(game)[tola];
  const band = bandOfTola(game, tola);
  const slots = game.clock.slotsLeftToday;
  const busy = slots === 0 || thinking;
  const silence = game.clock.daysToPoll === 1;
  const known = game.known.grievances[tola]
    .map((i) => [i, t.grievances[i] ?? 0] as [IssueId, number])
    .filter(([, v]) => v >= 0.05)
    .sort((a, b) => b[1] - a[1]);
  const building = game.projects.filter((p) => p.status === 'building' && p.tola === tola);
  const solutions = game.promises.filter(
    (p) =>
      p.faultLine &&
      p.status === 'open' &&
      homeTola(p.faultLine) === tola &&
      !building.some((b) => b.faultLine === p.faultLine),
  );
  const lastVisit = game.statements
    .filter((st) => st.channel === 'visit' && st.tola === tola)
    .at(-1);
  const lastNote = game.paNotes.at(-1);
  const act = (ok: boolean) => ok && setActed(true);

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
      <ul className="residents" aria-label={S.map.people}>
        {residentsOf(tola).map((r) => {
          const face = art(r.portrait);
          return (
            <li key={r.id} title={`${r.name}, ${r.age}: ${r.about}`}>
              <img src={face.src} srcSet={face.srcSet} alt="" />
              <span className="hand">{r.name}</span>
            </li>
          );
        })}
      </ul>
      {error && <p className="hand pintu-line flash">{S.errors[error]}</p>}
      {acted && !error && lastVisit?.day === game.clock.day ? (
        <Reactions
          game={game}
          statement={lastVisit}
          fallbackNote={lastNote ? noteText(lastNote, game.player.address, game.rival.name) : null}
        />
      ) : (
        acted &&
        lastNote &&
        !error && (
          <p className="hand pintu-line flash">
            {noteText(lastNote, game.player.address, game.rival.name)}
          </p>
        )
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
          disabled={busy}
        />
        <Stamp
          disabled={busy || !text.trim()}
          onClick={async () => {
            const ok = await say({ type: 'visit', tola, text });
            if (ok) setText('');
            act(ok);
          }}
        >
          {thinking ? S.thinking : S.writing.stamp}
        </Stamp>
      </section>

      <section>
        <h3>{S.map.grievances}</h3>
        {known.length === 0 && <p className="muted">{S.map.unknown}</p>}
        <ul className="works-list">
          {known.map(([issue, v]) => {
            const cost = worksCost(issue);
            const underway = building.find((b) => b.issue === issue);
            return (
              <li key={issue}>
                <span className="hand">
                  {S.issues[issue]}, {S.grievance(v)}
                </span>
                {underway ? (
                  <span className="muted">{S.map.building(underway.dueDay)}</span>
                ) : (
                  cost !== null && (
                    <Stamp
                      className="small"
                      disabled={busy || game.cash < cost}
                      onClick={() => act(dispatch({ type: 'publicWorks', tola, issue }))}
                      title={S.map.works}
                    >
                      {S.works[issue]} · ₹{cost.toLocaleString('en-IN')}
                    </Stamp>
                  )
                )}
              </li>
            );
          })}
          {solutions.map((p) => (
            <li key={p.id}>
              <span className="hand">{S.faultLines[p.faultLine!].name}</span>
              <Stamp
                className="small"
                disabled={busy || game.cash < p.cost}
                onClick={() => act(dispatch({ type: 'deliver', faultLine: p.faultLine! }))}
              >
                {S.map.deliver} · ₹{p.cost.toLocaleString('en-IN')}
              </Stamp>
            </li>
          ))}
          {building
            .filter((b) => b.faultLine)
            .map((b) => (
              <li key={b.id}>
                <span className="hand">{S.faultLines[b.faultLine!].name}</span>
                <span className="muted">{S.map.building(b.dueDay)}</span>
              </li>
            ))}
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
              disabled={busy || game.cash < amount}
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
            disabled={busy}
            onClick={() => act(dispatch({ type: 'recruit', tola, strongman: false }))}
          >
            {S.map.recruitYouth}
          </Stamp>
          <Stamp
            className="small"
            disabled={busy}
            onClick={() => act(dispatch({ type: 'recruit', tola, strongman: true }))}
          >
            {S.map.recruitStrongman}
          </Stamp>
        </section>
      </div>

      <footer className="tola-foot">
        <Stamp onClick={() => selectTola(null)} disabled={thinking}>
          {S.back}
        </Stamp>
      </footer>
    </aside>
  );
}
