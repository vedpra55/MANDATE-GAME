/**
 * The campaign clock: days and action slots (morning / afternoon / evening).
 * Pure functions only. Every function returns a new value, never mutates.
 */

export const SLOTS_PER_DAY = 3;
export const MVP_CAMPAIGN_DAYS = 21;

export type SlotCount = 0 | 1 | 2 | 3;

export type Clock = {
  day: number;
  daysToPoll: number;
  slotsLeftToday: SlotCount;
};

export function createClock(campaignDays: number = MVP_CAMPAIGN_DAYS): Clock {
  if (!Number.isInteger(campaignDays) || campaignDays < 1) {
    throw new Error(`campaignDays must be a positive integer, got ${campaignDays}`);
  }
  return { day: 1, daysToPoll: campaignDays, slotsLeftToday: SLOTS_PER_DAY };
}

export function canAct(clock: Clock): boolean {
  return clock.slotsLeftToday > 0 && !isPollDay(clock);
}

/** Spend one action slot. Throws if no slot is left: the UI must check `canAct` first. */
export function spendSlot(clock: Clock): Clock {
  if (!canAct(clock)) {
    throw new Error('No action slot left today');
  }
  return { ...clock, slotsLeftToday: (clock.slotsLeftToday - 1) as SlotCount };
}

/** Tear the calendar page: move to the next morning. Unused slots are lost. */
export function endDay(clock: Clock): Clock {
  if (isPollDay(clock)) {
    throw new Error('The campaign is over; it is polling day');
  }
  return {
    day: clock.day + 1,
    daysToPoll: clock.daysToPoll - 1,
    slotsLeftToday: SLOTS_PER_DAY,
  };
}

export function isPollDay(clock: Clock): boolean {
  return clock.daysToPoll <= 0;
}
