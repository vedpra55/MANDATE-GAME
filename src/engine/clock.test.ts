import { describe, expect, it } from 'vitest';
import { canAct, createClock, endDay, isPollDay, MVP_CAMPAIGN_DAYS, spendSlot } from './clock.ts';

describe('clock', () => {
  it('starts on day 1 with 3 slots and 21 days to poll', () => {
    expect(createClock()).toEqual({ day: 1, daysToPoll: MVP_CAMPAIGN_DAYS, slotsLeftToday: 3 });
  });

  it('spends slots without mutating the input', () => {
    const start = createClock();
    const after = spendSlot(start);
    expect(after.slotsLeftToday).toBe(2);
    expect(start.slotsLeftToday).toBe(3);
  });

  it('refuses to spend a slot when none are left', () => {
    const empty = spendSlot(spendSlot(spendSlot(createClock())));
    expect(canAct(empty)).toBe(false);
    expect(() => spendSlot(empty)).toThrow(/No action slot/);
  });

  it('ending the day resets slots and counts down to the poll', () => {
    const next = endDay(spendSlot(createClock()));
    expect(next).toEqual({ day: 2, daysToPoll: MVP_CAMPAIGN_DAYS - 1, slotsLeftToday: 3 });
  });

  it('reaches polling day after the campaign length, and stops there', () => {
    let clock = createClock(2);
    clock = endDay(endDay(clock));
    expect(isPollDay(clock)).toBe(true);
    expect(canAct(clock)).toBe(false);
    expect(() => endDay(clock)).toThrow(/polling day/);
  });

  it('rejects a non-positive campaign length', () => {
    expect(() => createClock(0)).toThrow();
  });
});
