import { useState } from 'react';
import { isPollDay } from '../../engine/clock.ts';
import { useGame } from '../../state/gameStore.ts';
import { art } from '../assets.ts';
import { strings } from '../strings.ts';

const TEAR_MS = 650;

/** Tear-off calendar: shows the day and today's slots; tearing the page ends the day. */
export function Calendar({ x, y, width }: { x: number; y: number; width: number }) {
  const clock = useGame((s) => s.clock);
  const tear = useGame((s) => s.tearCalendarPage);
  const [tearing, setTearing] = useState(false);
  const pollDay = isPollDay(clock);
  const img = art('prop-calendar');
  const used = 3 - clock.slotsLeftToday;

  const onTear = () => {
    if (tearing || pollDay) return;
    setTearing(true);
    window.setTimeout(() => {
      tear();
      setTearing(false);
    }, TEAR_MS);
  };

  const page = (
    <div className="calendar-page-text">
      {pollDay ? (
        <span className="calendar-poll">{strings.calendar.pollDay}</span>
      ) : (
        <>
          <span className="calendar-day-label">{strings.calendar.day}</span>
          <span className="calendar-day">{clock.day}</span>
          <span className="calendar-left">{strings.calendar.daysToPoll(clock.daysToPoll)}</span>
          <span className="calendar-slots" aria-label={`${clock.slotsLeftToday} of 3 slots left`}>
            {strings.slots.map((name, i) => (
              <span key={name} className={i < used ? 'slot used' : 'slot'} title={name} />
            ))}
          </span>
        </>
      )}
    </div>
  );

  return (
    <button
      type="button"
      className="prop calendar"
      style={{ left: x, top: y, width, zIndex: 2 }}
      onClick={onTear}
      aria-label={strings.props.calendar}
      title={pollDay ? strings.calendar.pollDay : strings.calendar.tearHint}
    >
      <img src={img.src} srcSet={img.srcSet} alt="" draggable={false} />
      {page}
      {tearing && <div className="calendar-tear">{page}</div>}
    </button>
  );
}
