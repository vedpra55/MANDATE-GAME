import { useState } from 'react';
import { useGame } from '../../state/gameStore.ts';
import { art } from '../assets.ts';
import { strings as S } from '../strings.ts';

const TEAR_MS = 650;

/** Tear-off calendar: shows the day and today's slots; tearing the page ends the day. */
export function Calendar({ x, y, width }: { x: number; y: number; width: number }) {
  const game = useGame((s) => s.game)!;
  const dispatch = useGame((s) => s.dispatch);
  const goTo = useGame((s) => s.goTo);
  const [tearing, setTearing] = useState(false);
  const { clock, phase } = game;
  const pollDay = phase === 'polling';
  const img = art('prop-calendar');
  const used = 3 - clock.slotsLeftToday;
  const canTear = phase === 'campaign' || pollDay;

  const onTear = () => {
    if (tearing || !canTear) return;
    setTearing(true);
    window.setTimeout(() => {
      if (pollDay) {
        if (dispatch({ type: 'beginCounting' })) goTo('counting');
      } else {
        dispatch({ type: 'endDay' });
      }
      setTearing(false);
    }, TEAR_MS);
  };

  const page = (
    <div className="calendar-page-text">
      {pollDay ? (
        <span className="calendar-poll">{S.calendar.pollDay}</span>
      ) : (
        <>
          <span className="calendar-day-label">{S.calendar.day}</span>
          <span className="calendar-day">{clock.day}</span>
          <span className="calendar-left">{S.calendar.daysToPoll(clock.daysToPoll)}</span>
          <span className="calendar-slots" aria-label={`${clock.slotsLeftToday} of 3 slots left`}>
            {S.slots.map((name, i) => (
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
      disabled={!canTear}
      aria-label={pollDay ? S.calendar.pollHint : S.calendar.tearHint}
      title={pollDay ? S.calendar.pollHint : S.calendar.tearHint}
    >
      <img src={img.src} srcSet={img.srcSet} alt="" draggable={false} />
      {page}
      {tearing && <div className="calendar-tear">{page}</div>}
    </button>
  );
}
