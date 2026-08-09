export type Grade = "recalled" | "forgotten";

export type SchedulingState = {
  readonly intervalDays: number;
  readonly easeFactor: number;
  readonly repetitions: number;
  /** Epoch milliseconds the card next becomes due. */
  readonly dueAt: number;
};

export const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const EASE_DEFAULT = 2.5;
export const EASE_FLOOR = 1.3;
export const EASE_CEILING = 3.0;

const EASE_STEP_UP = 0.1;
const EASE_STEP_DOWN = 0.2;

const FIRST_INTERVAL_DAYS = 1;
const SECOND_INTERVAL_DAYS = 6;
const FORGOTTEN_INTERVAL_DAYS = 1;

/** The state of a card that has never been reviewed. */
export const UNSTUDIED_STATE: SchedulingState = {
  intervalDays: 0,
  easeFactor: EASE_DEFAULT,
  repetitions: 0,
  dueAt: 0,
};

/**
 * Keeps the ease factor within its floor and ceiling, and rounds it to two
 * decimal places so it settles on a clean number rather than drifting
 * across repeated `0.1` steps of binary floating-point error.
 */
function clampEase(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Math.min(EASE_CEILING, Math.max(EASE_FLOOR, rounded));
}

/**
 * Advances a card's scheduling state by one review. Adapted from SM-2 to a
 * two-way grade: forgetting resets the interval and lowers the ease against
 * its floor; recalling steps the interval up — a short first success, a
 * longer second one, then the prior interval multiplied by the ease — and
 * raises the ease against its ceiling.
 *
 * `now` is a parameter rather than read from the clock so the result is
 * deterministic and the function stays pure.
 */
export function schedule(
  state: SchedulingState,
  grade: Grade,
  now: number,
): SchedulingState {
  if (grade === "forgotten") {
    const easeFactor = clampEase(state.easeFactor - EASE_STEP_DOWN);

    return {
      intervalDays: FORGOTTEN_INTERVAL_DAYS,
      easeFactor,
      repetitions: 0,
      dueAt: now + FORGOTTEN_INTERVAL_DAYS * DAY_IN_MS,
    };
  }

  const easeFactor = clampEase(state.easeFactor + EASE_STEP_UP);
  const repetitions = state.repetitions + 1;

  let intervalDays: number;
  if (repetitions === 1) {
    intervalDays = FIRST_INTERVAL_DAYS;
  } else if (repetitions === 2) {
    intervalDays = SECOND_INTERVAL_DAYS;
  } else {
    intervalDays = Math.round(state.intervalDays * easeFactor);
  }

  return {
    intervalDays,
    easeFactor,
    repetitions,
    dueAt: now + intervalDays * DAY_IN_MS,
  };
}
