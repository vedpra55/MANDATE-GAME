import { useEffect, useState, type ReactNode } from 'react';
import { pollRanges } from '../../../engine/polls.ts';
import { bandOfTola } from '../../../engine/pa.ts';
import { TOLAS } from '../../../engine/types.ts';
import { useGame } from '../../../state/gameStore.ts';
import { Stamp } from '../../components/Stamp.tsx';
import { openingMessages } from '../../content.ts';
import { noteText, storyHeadline } from '../../paText.ts';
import { strings as S } from '../../strings.ts';

/** Whichever desk object is picked up, shown large over a dimmed desk. Esc or click outside closes. */
export function Overlays() {
  const overlay = useGame((s) => s.overlay);
  const close = useGame((s) => s.close);

  useEffect(() => {
    if (!overlay) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlay, close]);

  if (!overlay) return null;
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
    <div className="overlay" onClick={close}>
      <div className={`overlay-body overlay-${overlay}`} onClick={(e) => e.stopPropagation()}>
        {body}
        <Stamp className="overlay-close" onClick={close} aria-label={S.close}>
          ✕
        </Stamp>
      </div>
    </div>
  );
}

/** Day 0: Pintu's cold open and the first thing you ever write. Cannot be skipped. */
export function Declaration() {
  const game = useGame((s) => s.game)!;
  const dispatch = useGame((s) => s.dispatch);
  const error = useGame((s) => s.lastError);
  const [text, setText] = useState('');
  return (
    <div className="overlay">
      <div className="overlay-body">
        <div className="paper writing">
          <p className="hand pintu-line">
            {noteText({ day: 1, kind: 'welcome' }, game.player.address)}
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
          />
          <div className="writing-foot">
            <span className="muted">{error ? S.errors[error] : S.writing.declareCost}</span>
            <Stamp onClick={() => dispatch({ type: 'declare', text })} disabled={!text.trim()}>
              {S.writing.declareStamp}
            </Stamp>
          </div>
        </div>
      </div>
    </div>
  );
}

function Phone() {
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
  const L = S.ledger;
  return (
    <div className="ledger-spread">
      <LedgerPage
        title={L.promises}
        columns={[L.colDay, L.colPromise, L.colStatus]}
        empty={L.noPromises}
        rows={game.promises.map((p) => [
          String(p.day),
          `${p.text} (${p.deadlineDay ? L.due(p.deadlineDay) : L.ifElected})`,
          L.status[p.status],
        ])}
        statusColumn
        kind="promises"
      />
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
  rows: string[][];
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
                  className={statusColumn && j === 2 ? `status status-${cell}` : undefined}
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
      <h1>{storyHeadline(story)}</h1>
      <div className="columns">
        <p>{S.newspaper.countdown(daysToPoll)}</p>
        {last && (
          <p className="quote">
            {S.newspaper.quote} "{last.text.slice(0, 160)}"
          </p>
        )}
      </div>
    </article>
  );
}

function WritingPad() {
  const game = useGame((s) => s.game)!;
  const dispatch = useGame((s) => s.dispatch);
  const error = useGame((s) => s.lastError);
  const [text, setText] = useState('');
  const silence = game.clock.daysToPoll === 1;
  const able = game.phase === 'campaign' && game.clock.slotsLeftToday > 0 && !silence;
  const lastNote = game.paNotes.at(-1);
  const recent = game.statements
    .filter((s) => s.channel !== 'declaration')
    .slice(-3)
    .reverse();
  return (
    <div className="paper writing">
      <h2>{S.writing.title}</h2>
      <textarea
        className="hand"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={S.writing.placeholder}
        disabled={!able}
        autoFocus
        rows={6}
      />
      <div className="writing-foot">
        <span className="muted">
          {error
            ? S.errors[error]
            : silence
              ? S.errors.silencePeriod
              : able
                ? S.writing.slotCost
                : S.errors.noSlots}
        </span>
        <Stamp
          onClick={() => {
            if (dispatch({ type: 'statement', text })) setText('');
          }}
          disabled={!able || !text.trim()}
        >
          {S.writing.stamp}
        </Stamp>
      </div>
      {recent.length > 0 && lastNote && (
        <p className="hand pintu-line">
          {S.pa}: {noteText(lastNote, game.player.address)}
        </p>
      )}
      {recent.length > 0 && (
        <ol className="said hand">
          {recent.map((s) => (
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
  const notes = game.paNotes.slice(-6).reverse();
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
              {noteText(n, game.player.address)}
            </p>
          ))}
        </div>
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
