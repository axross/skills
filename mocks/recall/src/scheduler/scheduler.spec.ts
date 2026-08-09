import {
  DAY_IN_MS,
  EASE_CEILING,
  EASE_DEFAULT,
  EASE_FLOOR,
  UNSTUDIED_STATE,
  schedule,
  type SchedulingState,
} from "./scheduler";

const NOW = Date.UTC(2026, 0, 1);

describe("schedule", () => {
  it("schedules a never-reviewed card that is recalled for one day, and raises the ease", () => {
    const next = schedule(UNSTUDIED_STATE, "recalled", NOW);

    expect(next).toEqual<SchedulingState>({
      intervalDays: 1,
      easeFactor: EASE_DEFAULT + 0.1,
      repetitions: 1,
      dueAt: NOW + DAY_IN_MS,
    });
  });

  it("schedules a never-reviewed card that is forgotten for one day, and lowers the ease", () => {
    const next = schedule(UNSTUDIED_STATE, "forgotten", NOW);

    expect(next).toEqual<SchedulingState>({
      intervalDays: 1,
      easeFactor: EASE_DEFAULT - 0.2,
      repetitions: 0,
      dueAt: NOW + DAY_IN_MS,
    });
  });

  it("schedules the second successful review six days out", () => {
    const afterFirst = schedule(UNSTUDIED_STATE, "recalled", NOW);
    const afterSecond = schedule(afterFirst, "recalled", NOW);

    expect(afterSecond.intervalDays).toBe(6);
    expect(afterSecond.repetitions).toBe(2);
    expect(afterSecond.dueAt).toBe(NOW + 6 * DAY_IN_MS);
  });

  it("multiplies the prior interval by the ease from the third successful review on", () => {
    const afterFirst = schedule(UNSTUDIED_STATE, "recalled", NOW);
    const afterSecond = schedule(afterFirst, "recalled", NOW);
    const afterThird = schedule(afterSecond, "recalled", NOW);

    // ease: 2.5 -> 2.6 -> 2.7 -> 2.8; interval: round(6 * 2.8) = 17
    expect(afterThird.easeFactor).toBe(2.8);
    expect(afterThird.intervalDays).toBe(17);
    expect(afterThird.repetitions).toBe(3);
  });

  it("resets an in-progress card's interval and lowers its ease when it is forgotten", () => {
    const inProgress: SchedulingState = {
      intervalDays: 20,
      easeFactor: 2.4,
      repetitions: 4,
      dueAt: 0,
    };

    const next = schedule(inProgress, "forgotten", NOW);

    expect(next).toEqual<SchedulingState>({
      intervalDays: 1,
      easeFactor: 2.2,
      repetitions: 0,
      dueAt: NOW + DAY_IN_MS,
    });
  });

  it("floors the ease factor after repeated forgetting", () => {
    let state = UNSTUDIED_STATE;
    for (let i = 0; i < 20; i += 1) {
      state = schedule(state, "forgotten", NOW);
    }

    expect(state.easeFactor).toBe(EASE_FLOOR);
  });

  it("ceils the ease factor after repeated recalling", () => {
    let state = UNSTUDIED_STATE;
    for (let i = 0; i < 20; i += 1) {
      state = schedule(state, "recalled", NOW);
    }

    expect(state.easeFactor).toBe(EASE_CEILING);
  });

  it("computes dueAt from the now it was given, not the system clock", () => {
    const next = schedule(UNSTUDIED_STATE, "recalled", NOW);

    expect(next.dueAt).toBe(NOW + next.intervalDays * DAY_IN_MS);
  });

  it("does not mutate the state it was given", () => {
    const before: SchedulingState = { ...UNSTUDIED_STATE };

    schedule(UNSTUDIED_STATE, "recalled", NOW);

    expect(UNSTUDIED_STATE).toEqual(before);
  });
});
