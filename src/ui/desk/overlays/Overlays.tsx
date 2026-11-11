import { useEffect, useState, type ReactNode } from 'react';
import { headlineFor, useGame } from '../../../state/gameStore.ts';
import { art } from '../../assets.ts';
import { canAct } from '../../../engine/clock.ts';
import { Stamp } from '../../components/Stamp.tsx';
import { grievanceFiles } from '../../content.ts';
import { strings } from '../../strings.ts';

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
        <Stamp className="overlay-close" onClick={close} aria-label={strings.close}>
          ✕
        </Stamp>
      </div>
    </div>
  );
}

function Phone() {
  const messages = useGame((s) => s.messages);
  return (
    <div className="phone-device">
      <div className="phone-screen">
        <div className="phone-header">{strings.phone.title}</div>
        {messages.length === 0 && <p className="phone-empty">{strings.phone.empty}</p>}
        {messages.map((m) => (
          <div key={m.id} className="phone-msg">
            <div className="phone-from">{m.from}</div>
            <div>{m.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Ledger() {
  const img = art('prop-ledger-open');
  return (
    <div className="ledger-open">
      <img src={img.src} srcSet={img.srcSet} alt="" draggable={false} />
      <Page side="left" title={strings.ledger.promises} empty={strings.ledger.noPromises} />
      <Page side="right" title={strings.ledger.favours} empty={strings.ledger.noFavours} />
    </div>
  );
}

function Page({ side, title, empty }: { side: 'left' | 'right'; title: string; empty: string }) {
  return (
    <div className={`ledger-page ledger-${side}`}>
      <h2>{title}</h2>
      <p className="hand muted">{empty}</p>
    </div>
  );
}

function Newspaper() {
  const day = useGame((s) => s.clock.day);
  const daysToPoll = useGame((s) => s.clock.daysToPoll);
  const statements = useGame((s) => s.statements);
  const last = statements.at(-1);
  return (
    <article className="newspaper-page">
      <header>
        <div className="masthead">{strings.newspaper.masthead}</div>
        <div className="edition">{strings.newspaper.edition(day)}</div>
      </header>
      <h1>{headlineFor(day)}</h1>
      <div className="columns">
        <p>The village votes in {daysToPoll} days. Tea stalls talk of little else.</p>
        {last && <p className="quote">Candidate says: “{last.text.slice(0, 160)}”</p>}
      </div>
    </article>
  );
}

function WritingPad() {
  const clock = useGame((s) => s.clock);
  const submit = useGame((s) => s.submitStatement);
  const statements = useGame((s) => s.statements);
  const [text, setText] = useState('');
  const able = canAct(clock);
  const onSay = () => {
    if (submit(text)) setText('');
  };
  return (
    <div className="paper writing">
      <h2>{strings.writing.title}</h2>
      <textarea
        className="hand"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={strings.writing.placeholder}
        disabled={!able}
        autoFocus
        rows={6}
      />
      <div className="writing-foot">
        <span className="muted">{able ? strings.writing.slotCost : strings.writing.noSlots}</span>
        <Stamp onClick={onSay} disabled={!able || !text.trim()}>
          {strings.writing.stamp}
        </Stamp>
      </div>
      {statements.length > 0 && (
        <ol className="said hand">
          {statements
            .slice(-3)
            .reverse()
            .map((s) => (
              <li key={s.id}>
                <span className="muted">
                  {strings.calendar.day} {s.day}, {strings.slots[s.slot]}:
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
  const notes = useGame((s) => s.paNotes);
  return (
    <div className="diary">
      <h2>{strings.diary.title}</h2>
      {notes
        .slice(-4)
        .reverse()
        .map((n, i) => (
          <p key={i} className="hand">
            {n}
          </p>
        ))}
    </div>
  );
}

function Files() {
  return (
    <Sheet title={strings.files.title}>
      <ul className="files-list hand">
        {grievanceFiles.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <p className="muted">{strings.files.hint}</p>
    </Sheet>
  );
}

function Cash() {
  const cash = useGame((s) => s.cash);
  return (
    <Sheet title={strings.cash.title}>
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
