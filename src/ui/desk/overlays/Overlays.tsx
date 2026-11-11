import { useEffect, useState, type ReactNode } from 'react';
import { bandOfTola } from '../../../engine/pa.ts';
import { pollRanges } from '../../../engine/polls.ts';
import { canDate, lastCampaignDay, promisesNeedingDate } from '../../../engine/promises.ts';
import { TOLAS, type GameState, type Statement } from '../../../engine/types.ts';
import { FAULT_LINE_DATA } from '../../../engine/world.ts';
import { useGame } from '../../../state/gameStore.ts';
import { Stamp } from '../../components/Stamp.tsx';
import { openingMessages } from '../../content.ts';
import { noteText, solutionLabel, stanceLabel, storyHeadline } from '../../paText.ts';
import { strings as S } from '../../strings.ts';
import { offlineQuotes } from '../../offlineVoices.ts';
import { RESIDENTS } from '../../../engine/residents.ts';
import { art } from '../../assets.ts';

/** Whichever desk object is picked up, shown large over a dimmed desk. Esc or click outside closes. */
export function Overlays() {
  const overlay = useGame((s) => s.overlay);
  const close = useGame((s) => s.close);
  const thinking = useGame((s) => s.thinking);

  useEffect(() => {
    if (!overlay) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !thinking && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlay, close, thinking]);

  if (!overlay || overlay === 'booths' || overlay === 'guide') return null;
  const body = {
    phone: <Phone />,
    ledger: <Ledger />,
    newspaper: <Newspaper />,
    files: <Files />,
    writingPad: <WritingPad />,
    diary: <Diary />,
    cash: <Cash />,
  }[overlay];

  return (
    <div className="overlay" onClick={() => !thinking && close()}>
      <div className={`overlay-body overlay-${overlay}`} onClick={(e) => e.stopPropagation()}>
        {body}
        <Stamp className="overlay-close" onClick={close} disabled={thinking} aria-label={S.close}>
          ✕
        </Stamp>
      </div>
    </div>
  );
}

/** Pintu's line and villagers' quotes for a statement: AI voices if they came, else the engine's note. */
export function Reactions({
  game,
  statement,
  fallbackNote,
}: {
  game: GameState;
  statement: Statement | undefined;
  fallbackNote: string | null;
}) {
  if (!statement) return null;
  const v = statement.voices;
  const quotes =
    v?.quotes ??
    (statement.source === 'fallback' && statement.channel !== 'declaration'
      ? offlineQuotes(game, statement)
      : []);
  return (
    <div className="reactions">
      <p className="hand pintu-line">
        {S.pa}: {v?.pa ?? fallbackNote}
      </p>
      {quotes.map((q, i) => {
        const r = RESIDENTS.find((x) => x.name === q.who);
        const face = r ? art(r.portrait) : null;
        return (
          <p key={i} className="quote-line">
            {face && <img className="quote-face" src={face.src} srcSet={face.srcSet} alt="" />}
            <span className="hand">"{q.text}"</span> <span className="muted">— {q.who}</span>
          </p>
        );
      })}
      {!v && statement.source === 'ai' && <p className="muted">…</p>}
      {promisesNeedingDate(game).length > 0 && <KabTak />}
    </div>
  );
}

/** A promise without a date: Pintu asks, and the stamp opens the bahi-khata on the slip. */
function KabTak() {
  const open = useGame((s) => s.open);
  const goTo = useGame((s) => s.goTo);
  return (
    <p className="kab-tak">
      <span className="hand">{S.ledger.kabTakShort}</span>{' '}
      <Stamp
        className="small"
        onClick={() => {
          goTo('desk');
          open('ledger');
        }}
      >
        {S.ledger.openSlip}
      </Stamp>
    </p>
  );
}

/** Day 0: Pintu's cold open and the first thing you ever write. Cannot be skipped. */
export function Declaration() {
  const game = useGame((s) => s.game)!;
  const say = useGame((s) => s.say);
  const thinking = useGame((s) => s.thinking);
  const error = useGame((s) => s.lastError);
  const [text, setText] = useState('');
  return (
    <div className="overlay">
      <div className="overlay-body">
        <div className="paper writing">
          <p className="hand pintu-line">
            {noteText({ day: 1, kind: 'welcome' }, game.player.address, game.rival.name)}
          </p>
          <p className="hand pintu-line">
            "Log poochhenge: aap kyun khade ho rahe ho? Ek-do line likh do."
          </p>
          <h2>{S.writing.declareTitle}</h2>
          <textarea
            className="hand"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={S.writing.placeholder}
            autoFocus
            rows={4}
            disabled={thinking}
          />
          <div className="writing-foot">
            <span className="muted">
              {thinking ? S.thinking : error ? S.errors[error] : S.writing.declareCost}
            </span>
            <Stamp
              onClick={() => void say({ type: 'declare', text })}
              disabled={!text.trim() || thinking}
            >
              {S.writing.declareStamp}
            </Stamp>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The phone: old messages, the donor's offer or demand, and the press asking the rival's question. */
function Phone() {
  const game = useGame((s) => s.game)!;
  const say = useGame((s) => s.say);
  const thinking = useGame((s) => s.thinking);
  const error = useGame((s) => s.lastError);
  const [text, setText] = useState('');
  const call = game.pending.call;
  const q = game.pending.question;
  const answered = game.statements.filter((st) => st.channel === 'answer').at(-1);
  const verdict = answered
    ? [...game.paNotes]
        .reverse()
        .find(
          (n) =>
            (n.kind === 'stanceTaken' || n.kind === 'notBelieved' || n.kind === 'contradiction') &&
            n.day === answered.day,
        )
    : undefined;
  const donorNote = [...game.paNotes]
    .reverse()
    .find((n) => n.kind === 'donorResult' || n.kind === 'favourLeaked');

  let incoming: { from: string; text: string } | null = null;
  if (call) incoming = { from: S.phone.donorFrom, text: S.phone.donorOffer };
  else if (q?.by === 'donor') incoming = { from: S.phone.donorFrom, text: S.phone.donorDemand };
  else if (q)
    incoming = {
      from: S.phone.priyaFrom,
      text: S.phone.wedge(game.rival.name, FAULT_LINE_DATA[q.faultLine].describe.question),
    };

  const send = async () => {
    const ok = call ? await say({ type: 'answerCall', text }) : await say({ type: 'answer', text });
    if (ok) setText('');
  };

  return (
    <div className="phone-device">
      <div className="phone-screen">
        <div className="phone-header">{S.phone.title}</div>
        {openingMessages.map((m) => (
          <div key={m.from} className="phone-msg">
            <div className="phone-from">{m.from}</div>
            <div>{m.text}</div>
          </div>
        ))}
        {donorNote && !incoming && (
          <div className="phone-msg">
            <div className="phone-from">{S.pa}</div>
            <div>{noteText(donorNote, game.player.address, game.rival.name)}</div>
          </div>
        )}
        {answered && !incoming && (
          <div className="phone-msg mine">
            <div>{answered.text}</div>
            {verdict && (
              <div className="phone-pa">
                {S.pa}: {noteText(verdict, game.player.address, game.rival.name)}
              </div>
            )}
            {answered.voices?.pa && (
              <div className="phone-pa">
                {S.pa}: {answered.voices.pa}
              </div>
            )}
          </div>
        )}
        {incoming && (
          <>
            <div className="phone-msg urgent">
              <div className="phone-from">{incoming.from}</div>
              <div>{incoming.text}</div>
              <div className="phone-due">{S.phone.dueToday}</div>
            </div>
            <textarea
              className="phone-input"
              rows={3}
              value={text}
              placeholder={S.phone.placeholder}
              onChange={(e) => setText(e.target.value)}
              disabled={thinking}
            />
            <div className="phone-actions">
              <span className="muted">{thinking ? S.thinking : error ? S.errors[error] : ''}</span>
              <Stamp
                className="small"
                onClick={() => void send()}
                disabled={!text.trim() || thinking}
              >
                {S.phone.send}
              </Stamp>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The open bahi-khata, built in code (not an image) so every line of handwriting sits exactly
 * on a ruled line and inside its column. Cover and paper use the generated textures.
 */
function Ledger() {
  const game = useGame((s) => s.game)!;
  const dispatch = useGame((s) => s.dispatch);
  const [editing, setEditing] = useState<number | null>(null);
  const L = S.ledger;
  const waiting = promisesNeedingDate(game);
  const slipFor = game.promises.find((p) => p.id === editing && canDate(p)) ?? waiting[0] ?? null;
  const first = game.clock.day + 1;
  const last = lastCampaignDay(game);
  const days = Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => first + i);
  const choose = (day: number | null) => {
    if (slipFor && dispatch({ type: 'setPromiseDate', id: slipFor.id, day })) setEditing(null);
  };
  return (
    <div className="ledger-spread">
      <LedgerPage
        title={L.promises}
        columns={[L.colDay, L.colPromise, L.colStatus]}
        empty={L.noPromises}
        rows={game.promises.map((p) => [
          String(p.day),
          <>
            {p.faultLine ? solutionLabel(p.faultLine) : p.text}{' '}
            {canDate(p) && p.status === 'open' ? (
              <button
                type="button"
                className={`date-tag${p.dateSource === 'default' ? ' undated' : ''}`}
                onClick={() => setEditing(p.id)}
                title={L.changeDate}
              >
                (
                {p.dateSource === 'default'
                  ? L.noDate
                  : p.deadlineDay
                    ? L.due(p.deadlineDay)
                    : L.ifElected}
                )
              </button>
            ) : (
              `(${p.deadlineDay ? L.due(p.deadlineDay) : L.ifElected})`
            )}
          </>,
          L.status[p.status],
        ])}
        statusColumn
        kind="promises"
      />
      {slipFor && game.phase === 'campaign' && (
        <div className="date-slip" role="dialog" aria-label={L.kabTak}>
          <p className="hand">
            {S.pa}: {L.kabTak.replace('{address}', game.player.address)}
          </p>
          <p className="slip-promise">“{slipFor.text}”</p>
          {slipFor.dateSource !== 'default' && <p className="muted">{L.changeWarning}</p>}
          <div className="slip-days">
            {days.map((d) => (
              <button
                type="button"
                key={d}
                className={
                  slipFor.deadlineDay === d && slipFor.dateSource !== 'default' ? 'on' : ''
                }
                onClick={() => choose(d)}
              >
                {d}
              </button>
            ))}
            <button type="button" className="after-win" onClick={() => choose(null)}>
              {L.afterWin}
            </button>
          </div>
          <p className="muted small">{L.dateHint}</p>
          {editing !== null && (
            <button type="button" className="slip-close" onClick={() => setEditing(null)}>
              ×
            </button>
          )}
        </div>
      )}
      <LedgerPage
        title={L.favours}
        columns={[L.colDay, L.colOwedTo, L.colAsk]}
        empty={L.noFavours}
        rows={game.favours.map((f) => [String(f.day), f.creditor, f.ask])}
        kind="favours"
      />
    </div>
  );
}

function LedgerPage({
  title,
  columns,
  rows,
  empty,
  kind,
  statusColumn = false,
}: {
  title: string;
  columns: [string, string, string];
  rows: ReactNode[][];
  empty: string;
  kind: 'promises' | 'favours';
  statusColumn?: boolean;
}) {
  return (
    <section className={`ledger-page ledger-${kind}`}>
      <h2>{title}</h2>
      <div role="table" aria-label={title}>
        <div className="ledger-row ledger-head" role="row">
          {columns.map((c) => (
            <span key={c} role="columnheader">
              {c}
            </span>
          ))}
        </div>
        {/* Fixed-height body: rules and column lines are drawn on it, so empty lines look ruled too. */}
        <div className="ledger-body">
          {rows.length === 0 && (
            <div className="ledger-row" role="row">
              <span />
              <span className="ledger-empty">{empty}</span>
              <span />
            </div>
          )}
          {rows.map((r, i) => (
            <div className="ledger-row" role="row" key={i}>
              {r.map((cell, j) => (
                <span
                  key={j}
                  className={
                    statusColumn && j === 2 && typeof cell === 'string'
                      ? `status status-${cell}`
                      : undefined
                  }
                >
                  {cell}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Newspaper() {
  const game = useGame((s) => s.game)!;
  const { day, daysToPoll } = game.clock;
  const story = [...game.stories].reverse().find((st) => st.day <= day) ?? {
    day,
    kind: 'quiet' as const,
  };
  const last =
    [...game.statements].reverse().find((st) => st.channel !== 'declaration') ?? game.statements[0];
  return (
    <article className="newspaper-page">
      <header>
        <div className="masthead">{S.newspaper.masthead}</div>
        <div className="edition">{S.newspaper.edition(day)}</div>
      </header>
      <h1>{storyHeadline(story, game.rival.name)}</h1>
      <div className="columns">
        <p>{S.newspaper.countdown(daysToPoll)}</p>
        {last && (
          <p className="quote">
            {S.newspaper.quote} "{last.text.slice(0, 160)}"
          </p>
        )}
        {last?.voices?.quotes?.[0] && (
          <p>
            "{last.voices.quotes[0].text}" — {last.voices.quotes[0].who}
          </p>
        )}
        <aside className="rival-column">
          <h3>{S.newspaper.rivalColumn(game.rival.name)}</h3>
          {game.rival.promises.length === 0 ? (
            <p>{S.newspaper.rivalNone(game.rival.name)}</p>
          ) : (
            game.rival.promises
              .slice(-3)
              .reverse()
              .map((p) => (
                <p key={p.id}>
                  {S.rivalPromise(
                    p.level,
                    p.raised,
                    S.issues[p.issue],
                    p.tola ? S.tolas[p.tola] : '',
                  )}
                </p>
              ))
          )}
        </aside>
      </div>
    </article>
  );
}

function WritingPad() {
  const game = useGame((s) => s.game)!;
  const say = useGame((s) => s.say);
  const thinking = useGame((s) => s.thinking);
  const error = useGame((s) => s.lastError);
  const [text, setText] = useState('');
  const silence = game.clock.daysToPoll === 1;
  const able = game.phase === 'campaign' && game.clock.slotsLeftToday > 0 && !silence;
  const recent = game.statements
    .filter((s) => s.channel === 'pad')
    .slice(-3)
    .reverse();
  const lastNote = game.paNotes.at(-1);
  return (
    <div className="paper writing">
      <h2>{S.writing.title}</h2>
      <textarea
        className="hand"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={S.writing.placeholder}
        disabled={!able || thinking}
        autoFocus
        rows={5}
      />
      <div className="writing-foot">
        <span className="muted">
          {thinking
            ? S.thinking
            : error
              ? S.errors[error]
              : silence
                ? S.errors.silencePeriod
                : able
                  ? S.writing.slotCost
                  : S.errors.noSlots}
        </span>
        <Stamp
          onClick={async () => {
            if (await say({ type: 'statement', text })) setText('');
          }}
          disabled={!able || !text.trim() || thinking}
        >
          {S.writing.stamp}
        </Stamp>
      </div>
      <Reactions
        game={game}
        statement={recent[0]}
        fallbackNote={lastNote ? noteText(lastNote, game.player.address, game.rival.name) : null}
      />
      {recent.length > 1 && (
        <ol className="said hand">
          {recent.slice(1).map((s) => (
            <li key={s.id}>
              <span className="muted">
                {S.calendar.day} {s.day}, {S.slots[s.slot]}:
              </span>{' '}
              {s.text}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Diary() {
  const game = useGame((s) => s.game)!;
  const ranges = pollRanges(game);
  const notes = game.paNotes.slice(-5).reverse();
  const building = game.projects.filter((p) => p.status === 'building');
  return (
    <div className="diary">
      <h2>{S.diary.title}</h2>
      <div className="diary-cols">
        <div>
          {notes.map((n, i) => (
            <p key={i} className="hand">
              <span className="muted">
                {S.calendar.day} {n.day}:
              </span>{' '}
              {noteText(n, game.player.address, game.rival.name)}
            </p>
          ))}
        </div>
        <div>
          <table className="tally hand">
            <caption>{S.diary.tally}</caption>
            <tbody>
              {TOLAS.map((t) => (
                <tr key={t}>
                  <th>{S.tolas[t]}</th>
                  <td>
                    {ranges[t].low}–{ranges[t].high}%
                  </td>
                  <td className={`band band-${bandOfTola(game, t)}`}>
                    {S.bands[bandOfTola(game, t)].split(' (')[0]}
                  </td>
                </tr>
              ))}
              <tr className="tally-total">
                <th>{S.diary.village}</th>
                <td>
                  {ranges.village.low}–{ranges.village.high}%
                </td>
                <td />
              </tr>
            </tbody>
          </table>
          <h3 className="diary-h3">{S.diary.divides}</h3>
          <ul className="divides hand">
            {game.known.faultLines.map((f) => {
              const w = game.publicWord[f];
              const label = !w
                ? null
                : w.word === 'side_a' || w.word === 'side_b'
                  ? stanceLabel(f, w.word)
                  : S.diary.words[w.word];
              return (
                <li key={f}>
                  <strong>{S.faultLines[f].name}</strong>
                  <span className="muted"> {S.diary.yourWord} </span>
                  {label ?? <span className="muted">{S.diary.noPosition}</span>}
                </li>
              );
            })}
          </ul>
          {game.known.faultLines.length < game.faultLines.length && (
            <p className="muted small-note">{S.diary.unknownDivides}</p>
          )}
          {game.rival.promises.length > 0 && (
            <>
              <h3 className="diary-h3">{S.diary.rivalPromises(game.rival.name)}</h3>
              <ul className="divides hand">
                {game.rival.promises
                  .slice(-5)
                  .reverse()
                  .map((p) => (
                    <li key={p.id}>
                      <span className="muted">
                        {S.calendar.day} {p.day}:
                      </span>{' '}
                      {S.rivalPromise(
                        p.level,
                        p.raised,
                        S.issues[p.issue],
                        p.tola ? S.tolas[p.tola] : '',
                      )}
                      {p.meToo && <span className="muted"> ({S.diary.meTooMark})</span>}
                    </li>
                  ))}
              </ul>
            </>
          )}
          {building.length > 0 && (
            <>
              <h3 className="diary-h3">{S.diary.works}</h3>
              <ul className="divides hand">
                {building.map((p) => (
                  <li key={p.id}>
                    {S.tolas[p.tola]}:{' '}
                    {p.faultLine ? S.faultLines[p.faultLine].name : S.issues[p.issue!]}{' '}
                    <span className="muted">({S.diary.due(p.dueDay)})</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Files() {
  return (
    <Sheet title={S.files.title}>
      <p className="muted">{S.files.hint}</p>
    </Sheet>
  );
}

function Cash() {
  const cash = useGame((s) => s.game!.cash);
  return (
    <Sheet title={S.cash.title}>
      <p className="hand cash-amount">₹ {cash.toLocaleString('en-IN')}</p>
    </Sheet>
  );
}

function Sheet({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="paper sheet">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
