import { useState } from 'react';
import { homeTola } from '../../engine/faultlines.ts';
import { bandOfTola } from '../../engine/pa.ts';
import { pollRanges } from '../../engine/polls.ts';
import { worksCost } from '../../engine/promises.ts';
import type { IssueId, TolaId } from '../../engine/types.ts';
import { useGame } from '../../state/gameStore.ts';
import { Stamp } from '../components/Stamp.tsx';
import { leaderOf, residentsOf } from '../../engine/residents.ts';
import { PLAY_PLACE, SHRAMDAAN_WORKERS } from '../../engine/verbs.ts';
import { art } from '../assets.ts';
import { Reactions } from '../desk/overlays/Overlays.tsx';
import { noteText } from '../paText.ts';
import { strings as S } from '../strings.ts';

const GIFT_AMOUNTS = [2000, 5000, 10000];

type Mode = 'visit' | 'chai' | 'sabha' | 'leader' | 'debate';

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
  const [mode, setMode] = useState<Mode>('visit');
  const [sweets, setSweets] = useState<0 | 1000 | 3000>(0);
  const leader = leaderOf(tola);
  const met = game.flags.leadersMet?.[leader.id];
  const modes: Mode[] = [
    'visit',
    'chai',
    'sabha',
    'leader',
    ...(tola === 'bazaar' ? (['debate'] as const) : []),
  ];
  const playHere = (Object.keys(PLAY_PLACE) as (keyof typeof PLAY_PLACE)[]).find(
    (k) => PLAY_PLACE[k] === tola,
  );

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
    .filter((st) => st.tola === tola || st.channel === 'debate')
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
        <div className="modes" role="tablist">
          {modes.map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={mode === m ? 'on' : ''}
              onClick={() => setMode(m)}
            >
              {m === 'leader'
                ? S.map.modes.leader(leader.name)
                : m === 'debate'
                  ? S.map.modes.debate(game.rival.name)
                  : S.map.modes[m]}
            </button>
          ))}
        </div>
        <p className="muted mode-help">
          {mode === 'leader'
            ? S.map.modeHelp.leader(leader.name, leader.about)
            : mode === 'debate'
              ? S.map.modeHelp.debate(game.rival.name)
              : S.map.modeHelp[mode]}
          {mode === 'leader' && met ? ` ${S.map.leaderMet(leader.name, met.day)}` : ''}
        </p>
        {mode === 'debate' && game.flags.debate ? (
          <p className="hand">{S.map.debateDone(game.flags.debate.won)}</p>
        ) : (
          <>
            <textarea
              className="hand"
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                mode === 'debate'
                  ? S.map.debatePlaceholder(game.rival.name)
                  : S.map.visitPlaceholder
              }
              disabled={busy}
            />
            {mode === 'debate' && (
              <p className="hand rival-debate-line">
                {game.rival.name}: “{S.rivalDebate[game.rival.archetype]}”
              </p>
            )}
            {mode === 'sabha' && (
              <div className="sweets">
                <span className="muted">{S.map.sweets}:</span>
                {([0, 1000, 3000] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={sweets === v ? 'on' : ''}
                    onClick={() => setSweets(v)}
                  >
                    {v === 0 ? S.map.sweetsNone : `₹${v.toLocaleString('en-IN')}`}
                  </button>
                ))}
              </div>
            )}
            <Stamp
              disabled={busy || !text.trim()}
              onClick={async () => {
                const action =
                  mode === 'visit'
                    ? ({ type: 'visit', tola, text } as const)
                    : mode === 'chai'
                      ? ({ type: 'chai', tola, text } as const)
                      : mode === 'sabha'
                        ? ({ type: 'sabha', tola, text, sweets } as const)
                        : mode === 'leader'
                          ? ({ type: 'meetLeader', tola, text } as const)
                          : ({ type: 'debate', text } as const);
                const ok = await say(action);
                if (ok) setText('');
                act(ok);
              }}
            >
              {thinking ? S.thinking : S.writing.stamp}
            </Stamp>
          </>
        )}
      </section>

      <section>
        <h3>{S.map.deeds}</h3>
        <div className="deeds">
          {playHere && (
            <Stamp
              className="small"
              disabled={busy}
              onClick={() => act(dispatch({ type: 'play', tola, kind: playHere }))}
            >
              {S.map.play[playHere]}
            </Stamp>
          )}
          <Stamp
            className="small"
            disabled={busy || game.cadre.size < SHRAMDAAN_WORKERS}
            onClick={() => act(dispatch({ type: 'shramdaan', tola }))}
          >
            {S.map.shramdaan(game.cadre.size)}
          </Stamp>
        </div>
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
