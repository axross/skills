// Turning repeated runs into findings.
//
// The measurement is one turn per run, so N repeats yield a DISTRIBUTION over
// what discovery selected, not a single answer. The classification below exists
// to keep that distribution honest in both directions.
//
// THE ASYMMETRY IS THE WHOLE DESIGN. A `mustInclude` skill is a finding only at
// ZERO hits — an unambiguous claim that discovery never reached it across every
// repeat. A `mustExclude` skill is a finding only ABOVE half — so one stray
// selection is never reported as a defect.
//
// The reason is that the pilot deliberately targets skills that compete:
// wireframe-design, high-fidelity-ui-design and react-component-styling each
// disclaim the others in their own discovery text. Two skills that legitimately
// both apply will SPLIT the distribution, and a symmetric majority rule would
// then report the correct behaviour as two misses — worst exactly where the
// fixture is most informative. Under this rule a 3/5 + 2/5 split reports both as
// reachable, and the case-level coverage figure says whether anything was missed.
//
// No tuned constant appears here beyond the half-way mark. A band such as
// "contested when two skills each sit in [0.3, 0.7]" was considered and rejected
// for now: those constants would be chosen before the determinism probe has
// measured this corpus's noise floor, which is the exact mistake that probe
// exists to prevent.

import { compareCorpus } from "./corpus.mjs";

/**
 * A skill counts as selected for a case above this hit rate.
 * Only `mustExclude` uses it; `mustInclude` keys on zero hits instead.
 */
export const SELECTION_RATE = 0.5;

/** Per-skill verdicts, and whether each one is a finding. */
export const VERDICTS = {
  clear: { finding: false, label: "clear" },
  miss: { finding: true, label: "MISS", remedy: "widen" },
  weak: { finding: false, label: "weak" },
  spurious: { finding: true, label: "SPURIOUS", remedy: "narrow" },
  occasional: { finding: false, label: "occasional" },
  optional: { finding: false, label: "optional" },
  expected: { finding: false, label: "expect-always" },
  unlabelled: { finding: false, label: "unlabelled" },
};

/**
 * The skills a run TRACKS for a case — the union of the tiers whose absence is
 * itself a measurement.
 *
 * This is the set that makes an inferred zero prior sound. A selection snapshot records a
 * zero-hit skill by omitting it, so "absent from the tally" means "measured,
 * and zero" for a tracked skill and "nobody ever looked" for any other.
 *
 * `mayInclude` is deliberately excluded. Its skills are legitimate either way
 * and are never a finding, so a run has no obligation to tally them — reading
 * an absence there as a measured zero would manufacture priors out of silence.
 *
 * The inference stays sound only while, since the tally was recorded, no
 * measured case has gained a `mustInclude`/`mustExclude` label and
 * `expectAlways` has gained no skill. The second is the sharper edge: an
 * `expectAlways` addition changes this set for EVERY case at once.
 *
 * @param {object} testCase
 * @param {string[]} expectAlways
 * @returns {string[]}
 */
export function trackedSkills(testCase, expectAlways = []) {
  return [
    ...new Set([...testCase.mustInclude, ...testCase.mustExclude, ...expectAlways]),
  ];
}

/**
 * Which tier a case puts a skill in.
 * @returns {"mustInclude"|"mustExclude"|"mayInclude"|"expectAlways"|null}
 */
function tierOf(testCase, expectAlways, skill) {
  if (testCase.mustInclude.includes(skill)) return "mustInclude";
  if (testCase.mustExclude.includes(skill)) return "mustExclude";
  if (testCase.mayInclude.includes(skill)) return "mayInclude";
  if (expectAlways.includes(skill)) return "expectAlways";
  return null;
}

/**
 * Classify one skill's tally.
 *
 * @param {string|null} tier
 * @param {number} hits     runs in which the skill was selected
 * @param {number} repeats  total runs
 * @returns {keyof VERDICTS}
 */
export function verdictFor(tier, hits, repeats) {
  const rate = repeats === 0 ? 0 : hits / repeats;
  switch (tier) {
    case "mustInclude":
      // Zero, not a majority: a skill selected even once is demonstrably
      // reachable, and calling that a miss would misreport a contested case.
      if (hits === 0) return "miss";
      return rate > SELECTION_RATE ? "clear" : "weak";
    case "mustExclude":
      if (hits === 0) return "clear";
      return rate > SELECTION_RATE ? "spurious" : "occasional";
    case "mayInclude":
      return "optional";
    case "expectAlways":
      // Informational for now. These skills claim in their own `when_to_use`
      // that they apply to every session; whether that actually holds under a
      // one-turn measurement is what the determinism probe settles, and until
      // it does, promoting a shortfall to a finding would bury the real ones.
      return "expected";
    default:
      // A skill nobody labelled. Reported so a surprise is visible, never
      // counted against the change — precision matters more than recall here,
      // because a spurious trigger is only claimed where a human said so.
      return "unlabelled";
  }
}

/**
 * Tally one case's runs and classify every skill that appeared or was labelled.
 *
 * @param {object} testCase          a parsed fixture case
 * @param {string[][]} runs          per repeat, the skill names that run selected
 * @param {{ expectAlways?: string[] }} [options]
 * @returns {{
 *   id: string,
 *   repeats: number,
 *   skills: Array<{ name: string, hits: number, rate: number, tier: string|null, verdict: string }>,
 *   coverage: { covered: number, repeats: number, skills: string[] } | null,
 *   findings: Array<{ kind: string, skill: string, hits: number, repeats: number, remedy: string }>,
 * }}
 */
export function tallyCase(testCase, runs, { expectAlways = [] } = {}) {
  const repeats = runs.length;

  // A skill counts once per run however many times that run named it: the unit
  // of observation is the run, not the tool call.
  const hitsBySkill = new Map();
  for (const run of runs) {
    for (const skill of new Set(run)) {
      hitsBySkill.set(skill, (hitsBySkill.get(skill) ?? 0) + 1);
    }
  }

  // Labelled-but-never-selected skills must still appear, or a miss would be
  // invisible — the whole point is reporting what did NOT happen.
  const tracked = trackedSkills(testCase, expectAlways);
  const names = new Set([...hitsBySkill.keys(), ...tracked]);

  const skills = [...names]
    .map((name) => {
      const hits = hitsBySkill.get(name) ?? 0;
      const tier = tierOf(testCase, expectAlways, name);
      return {
        name,
        hits,
        rate: repeats === 0 ? 0 : hits / repeats,
        tier,
        verdict: verdictFor(tier, hits, repeats),
      };
    })
    .sort((a, b) => b.hits - a.hits || a.name.localeCompare(b.name));

  // Coverage answers the question a per-skill rate cannot when two skills
  // compete: across the repeats, how often did the case get ANY of the skills
  // it was supposed to? A 3/5 + 2/5 split covering 5/5 is healthy contention;
  // the same split covering 3/5 means two runs found neither.
  const coverage =
    testCase.mustInclude.length >= 2
      ? {
          covered: runs.filter((run) =>
            run.some((skill) => testCase.mustInclude.includes(skill)),
          ).length,
          repeats,
          skills: [...testCase.mustInclude],
        }
      : null;

  const findings = skills
    .filter((skill) => VERDICTS[skill.verdict].finding)
    .map((skill) => ({
      kind: skill.verdict,
      skill: skill.name,
      hits: skill.hits,
      repeats,
      remedy: VERDICTS[skill.verdict].remedy,
    }));

  // `tracked` travels with the tally rather than being restated downstream:
  // the delta has to decide whether an absence is a measured zero, and deriving
  // that set twice is how the two ends start disagreeing about one skill.
  return { id: testCase.id, repeats, tracked, skills, coverage, findings };
}

/**
 * Tally every case.
 *
 * @param {object} fixture         a parsed fixture
 * @param {Map<string, string[][]>} runsByCase
 * @returns {object[]} one entry per fixture case, in fixture order
 */
export function tallyAll(fixture, runsByCase) {
  return fixture.cases.map((testCase) =>
    tallyCase(testCase, runsByCase.get(testCase.id) ?? [], {
      expectAlways: fixture.expectAlways,
    }),
  );
}

/**
 * Compare tallies against a recorded selection snapshot.
 *
 * THREE RESPONSES TO A STALE SELECTION SNAPSHOT, AND CORPUS DRIFT GETS THE THIRD.
 * A different MODEL suppresses the delta entirely — that is this harness's most
 * likely rot, so it is refused rather than rendered with a caveat nobody reads.
 * A different REPEAT COUNT is normalised away, since deltas compare rates. A
 * different CORPUS only ANNOTATES: it marks the comparisons it could explain
 * and leaves them readable.
 *
 * The asymmetry is deliberate, not an inconsistency. This repository ships
 * skill edits weekly, so suppressing on corpus drift would make the selection snapshot
 * stale almost continuously — and a suppression that fires on nearly every run
 * is one that gets ignored or re-recorded away at real expense. A model change
 * is rare and total; a corpus change is frequent and partial.
 *
 * @param {object[]} tallies
 * @param {object|null} selection snapshot
 * @param {string} model  the model identifier the current run observed
 * @param {Record<string, string>|null} [corpus]  digests of the corpus this run measured
 */
export function deltaAgainst(tallies, selectionSnapshot, model, corpus = null) {
  if (!selectionSnapshot) return { usable: false, reason: "no selection snapshot recorded" };
  if (selectionSnapshot.model !== model) {
    return {
      usable: false,
      reason: `selection snapshot was recorded on "${selectionSnapshot.model}", this run used "${model}"`,
    };
  }

  const corpusComparison = compareCorpus(selectionSnapshot.corpus, corpus);

  const cases = tallies.map((tally) => {
    const before = selectionSnapshot.cases[tally.id];
    if (!before) {
      // A case with no selection-snapshot entry has no comparison to attribute — but
      // there are two ways to get here and they are not the same event. A case
      // the selection snapshot DECLARES unmeasured is waiting for the next re-record; one
      // it does not is a case somebody added and never recorded. Reporting both
      // as "new" would bury the second in the first for as long as the first
      // lasts.
      return {
        id: tally.id,
        repeats: tally.repeats,
        isNew: true,
        isUnmeasured: selectionSnapshot.unmeasured?.includes(tally.id) ?? false,
        unattributable: false,
        // Not an empty record: a case the selection snapshot never measured has no prior
        // for ANY skill, which is a different claim from "every prior is zero".
        priors: null,
        changes: [],
      };
    }

    // The case's OWN recorded denominator. Since cases may declare their own
    // repeat count, the document-level `repeats` is a default rather than the
    // answer — and using it for a case recorded at two would report a settled
    // 2/2 against a 5/5 run as though the rate had fallen by half.
    const wasRepeats = selectionSnapshot.caseRepeats?.[tally.id] ?? selectionSnapshot.repeats;

    const names = new Set([
      ...Object.keys(before),
      ...tally.skills.map((skill) => skill.name),
    ]);

    // THE `?? 0` THIS REPLACED WAS THE BUG. It read every absence as a measured
    // zero, for every name in a union that includes each skill the RUN selected
    // — so a skill nobody labelled, appearing for the first time, was compared
    // against a measurement that was never taken. Absence is informative only
    // for a skill the run tracked; anywhere else it is silence, and silence
    // gets `null` rather than a number that reads like evidence.
    const tracked = new Set(tally.tracked ?? []);
    const priorFor = (name) => {
      if (name in before) return { hits: before[name], repeats: wasRepeats, inferred: false };
      if (tracked.has(name)) return { hits: 0, repeats: wasRepeats, inferred: true };
      return null;
    };

    const priors = Object.fromEntries([...names].sort().map((name) => [name, priorFor(name)]));

    const changes = [...names]
      .map((name) => {
        const prior = priors[name];
        const nowHits = tally.skills.find((skill) => skill.name === name)?.hits ?? 0;
        return {
          skill: name,
          was: prior ? prior.hits : null,
          now: nowHits,
          wasRepeats,
          prior,
        };
      })
      // Rates, not raw hits: a selection snapshot recorded at 5 repeats compared against a
      // 10-repeat run must not report every skill as doubled. A row with no
      // prior has no rate to compare, so it is included on the strength of the
      // run alone — explicitly, rather than by falling through arithmetic that
      // happens to work.
      .filter((change) =>
        change.prior
          ? change.was / wasRepeats !== change.now / tally.repeats
          : change.now > 0,
      )
      .sort((a, b) => a.skill.localeCompare(b.skill));

    // EVERY case, not a subset. The whole corpus is installed for every probe,
    // so a skill that was added, removed, or reworded competed in all of them —
    // there is no case the drift provably could not have touched.
    return {
      id: tally.id,
      repeats: tally.repeats,
      isNew: false,
      isUnmeasured: false,
      unattributable: corpusComparison.drifted,
      priors,
      changes,
    };
  });

  const removed = Object.keys(selectionSnapshot.cases)
    .filter((id) => !tallies.some((tally) => tally.id === id))
    .sort();

  return {
    usable: true,
    selectionSnapshotRepeats: selectionSnapshot.repeats,
    corpus: corpusComparison,
    cases,
    removed,
  };
}
