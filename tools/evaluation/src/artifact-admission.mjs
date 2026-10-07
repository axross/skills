import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { JUDGE_ROUTE } from "./judge.mjs";
import { FACTORS_FILE, METADATA_FILE, INVOCATIONS_FILE, PROBE_MEASURED_FILES } from "./layout.mjs";

export const BUNDLE_FILE = "record.json";

const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) => typeof value === "string" && value.length > 0;
const positiveInteger = (value) => Number.isSafeInteger(value) && value > 0;
const segment = (value) => text(value) && /^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/.test(value);
const cellPath = (cell) => `${cell.measurementDirName}/${cell.condition}-${cell.repetition}`;
const probeName = (cell) => `probe-${cell.scenarioId}-${cell.condition}-${cell.repetition}`;
const judgedName = (scenario) => `judged-${scenario.scenarioId}`;

/** @throws {Error} with the boundary-specific reason when a requirement fails */
function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * establishes ownership from the independently planned dispatch, not bundle labels.
 * @throws {Error} on invalid identity, unsafe or duplicate cells, or inconsistent matrices
 */
export function dispatchContract({ identity, probes, judgments }) {
  requireValue(object(identity) && text(identity.repository) && /^\d+$/.test(identity.runId) &&
    /^[a-f0-9]{40}$/.test(identity.sourceCommit), "Invalid dispatch identity");
  requireValue(Array.isArray(probes) && probes.length > 0 && Array.isArray(judgments), "Invalid dispatch matrices");
  const scenarios = new Map();
  const cells = new Map();
  for (const scenario of judgments) {
    requireValue(object(scenario) && segment(scenario.scenarioId) && segment(scenario.measurementId) &&
      scenario.measurementDirName === `${scenario.scenarioId}-${scenario.measurementId}` &&
      !scenarios.has(scenario.scenarioId) &&
      ![...scenarios.values()].some((entry) => entry.measurementDirName === scenario.measurementDirName),
    "Invalid or duplicate judgment matrix entry");
    scenarios.set(scenario.scenarioId, scenario);
  }
  for (const cell of probes) {
    const scenario = scenarios.get(cell?.scenarioId);
    requireValue(object(cell) && scenario && scenario.measurementId === cell.measurementId &&
      scenario.measurementDirName === cell.measurementDirName &&
      ["skill-present", "skill-absent"].includes(cell.condition) && positiveInteger(cell.repetition) &&
      !cells.has(cellPath(cell)), "Invalid or duplicate probe matrix entry");
    cells.set(cellPath(cell), cell);
  }
  requireValue([...scenarios.keys()].every((id) => probes.some((cell) => cell.scenarioId === id)),
    "Judgment matrix has no planned probes");
  return { identity, scenarios, cells };
}

/**
 * missing paths are distinct from unsafe or unreadable paths, including ancestors.
 * @throws {Error} on links, special files, non-directory ancestors, or filesystem errors other than absence
 */
async function inspectPath(path) {
  const parent = dirname(resolve(path));
  if (parent !== resolve(path)) {
    const parentStat = await inspectPath(parent);
    requireValue(!parentStat || parentStat.isDirectory(), `Not a directory: ${parent}`);
  }
  let stat;
  try {
    stat = await lstat(path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  requireValue(stat.isDirectory() || stat.isFile(), `Not a regular file or directory: ${path}`);
  return stat;
}

/**
 * returns both directories and verbatim UTF-8 files so empty extras remain visible.
 * @throws {Error} on unsafe paths, invalid UTF-8, or unreadable entries
 */
async function readTree(root, prefix = "") {
  const stat = await inspectPath(root);
  if (!stat) return [];
  requireValue(stat.isDirectory(), `Not a directory: ${root}`);
  const files = [];
  for (const entry of await readdir(root)) {
    const path = join(root, entry);
    const relative = prefix ? `${prefix}/${entry}` : entry;
    const entryStat = await inspectPath(path);
    if (entryStat.isDirectory()) {
      files.push({ path: relative, directory: true });
      files.push(...await readTree(path, relative));
    } else {
      const bytes = await readFile(path);
      const content = bytes.toString("utf8");
      requireValue(Buffer.from(content).equals(bytes), `Not UTF-8 measurement data: ${relative}`);
      files.push({ path: relative, content });
    }
  }
  return files;
}

/**
 * checks JSON consumers' required fields; transcript tails and patch text stay inert.
 * @throws {Error} on malformed JSON, mismatched identity, or invalid consumed fields
 */
function validateMeasured(file, cell, sourceCommit) {
  if (file.path.endsWith(`/${METADATA_FILE}`)) {
    const metadata = JSON.parse(file.content);
    requireValue(object(metadata) && metadata.scenario === cell.scenarioId &&
      metadata.condition === cell.condition && metadata.repetition === cell.repetition &&
      metadata.runtime?.instrumentCommit === sourceCommit, `Metadata identity mismatch: ${file.path}`);
    requireValue(text(metadata.timestamp) && Number.isFinite(Date.parse(metadata.timestamp)) &&
      text(metadata.runtime.model) && text(metadata.runtime.project?.tree) &&
      text(metadata.runtime.project?.commit) && text(metadata.runtime.project?.mock) &&
      object(metadata.harness?.skills) && Object.values(metadata.harness.skills).every(text) &&
      typeof metadata.task?.prompt === "string" &&
      (metadata.costUsd === null || (Number.isFinite(metadata.costUsd) && metadata.costUsd >= 0)) &&
      (metadata.cliExitCode === null || Number.isInteger(metadata.cliExitCode)) &&
      (metadata.turns === null || (Number.isSafeInteger(metadata.turns) && metadata.turns >= 0)) &&
      typeof metadata.truncated === "boolean",
    `Invalid metadata content: ${file.path}`);
  } else if (file.path.endsWith(`/${INVOCATIONS_FILE}`)) {
    const invocations = JSON.parse(file.content);
    requireValue(object(invocations) && Array.isArray(invocations.skillsInvoked) &&
      invocations.skillsInvoked.every(text), `Invalid invocations: ${file.path}`);
  }
}

/**
 * checks judgments against source declarations, preserving errors rather than coercing verdicts.
 * @throws {Error} on unreadable declarations, malformed JSON, or invalid factor identity/content
 */
async function validateFactors(file, cell, scenariosRoot) {
  const judgment = JSON.parse(file.content);
  requireValue(object(judgment) && judgment.scenario === cell.scenarioId &&
    judgment.condition === cell.condition && judgment.repetition === cell.repetition &&
    Array.isArray(judgment.factors), `Judgment identity mismatch: ${file.path}`);
  const scenario = JSON.parse(await readFile(join(scenariosRoot, cell.scenarioId, "scenario.json"), "utf8"));
  const declared = new Map(scenario.factors.map((factor) => [factor.id, factor]));
  requireValue(judgment.factors.length === declared.size, `Incomplete declared factor set: ${file.path}`);
  for (const factor of judgment.factors) {
    const declaration = declared.get(factor?.id);
    requireValue(object(factor) && declaration && factor.phase === declaration.phase &&
      factor.method === declaration.judgment.method, `Invalid declared factor: ${file.path}`);
    declared.delete(factor.id);
    const errored = object(factor.result) && Object.keys(factor.result).length === 1 && text(factor.result.error);
    requireValue(errored || (typeof factor.result === "boolean" && text(factor.evidence)),
      `Invalid factor result: ${file.path}`);
    if (factor.method === "reasoning") {
      requireValue(factor.judge?.model === declaration.judgment.model &&
        factor.judge?.route === JUDGE_ROUTE && typeof factor.prompt === "string",
      `Invalid reasoning judge: ${file.path}`);
    }
  }
}

/**
 * validates supplied content without treating descriptive attempts as a retry restriction.
 * @throws {Error} on inconsistent identity, unplanned ownership, duplicate paths, or invalid content
 */
async function validateBundle(bundle, name, contract, scenariosRoot) {
  requireValue(object(bundle) && bundle.version === 1 && bundle.name === name &&
    Object.keys(bundle).sort().join(",") === "attempt,files,name,repository,runId,sourceCommit,version" &&
    ["repository", "runId", "sourceCommit"].every((key) => bundle[key] === contract.identity[key]) &&
    typeof bundle.attempt === "string" && /^[1-9]\d*$/.test(bundle.attempt) &&
    Array.isArray(bundle.files), `Bundle identity mismatch: ${name}`);
  const probe = [...contract.cells.values()].find((cell) => probeName(cell) === name);
  const scenario = [...contract.scenarios.values()].find((entry) => judgedName(entry) === name);
  requireValue(probe || scenario, `Unplanned artifact: ${name}`);
  const allowed = new Map();
  for (const cell of contract.cells.values()) {
    if (probe ? cellPath(cell) !== cellPath(probe) : cell.scenarioId !== scenario.scenarioId) continue;
    for (const filename of probe ? PROBE_MEASURED_FILES : [FACTORS_FILE]) {
      allowed.set(`${cellPath(cell)}/${filename}`, cell);
    }
  }
  const seen = new Set();
  for (const file of bundle.files) {
    const cell = allowed.get(file?.path);
    requireValue(object(file) && Object.keys(file).sort().join(",") === "content,path" &&
      cell && typeof file.content === "string" && Buffer.from(file.content).toString("utf8") === file.content &&
      !seen.has(file.path),
      `Unexpected or duplicate payload path in ${name}: ${file?.path}`);
    seen.add(file.path);
    if (probe) validateMeasured(file, cell, contract.identity.sourceCommit);
    else await validateFactors(file, cell, scenariosRoot);
  }
  return bundle.files;
}

/**
 * packages only role-owned data; an interrupted writer may supply a valid empty subset.
 * @throws {Error} on unplanned selectors, unsafe or unexpected output entries, or invalid content
 */
export async function packBundle({ kind, input, selector, contract, attempt, scenariosRoot }) {
  requireValue(kind === "probe" || kind === "judged", "Unknown bundle role");
  requireValue(object(selector), "Invalid bundle selector");
  const selected = kind === "probe"
    ? contract.cells.get(cellPath(selector)) : contract.scenarios.get(selector.scenarioId);
  requireValue(selected && Object.keys(selected).every((key) => selector[key] === selected[key]),
    "Unplanned bundle selector");
  const name = kind === "probe" ? probeName(selected) : judgedName(selected);
  const tree = await readTree(input);
  const allowed = new Set([...contract.cells.values()]
    .filter((cell) => kind === "probe" ? cellPath(cell) === cellPath(selected) : cell.scenarioId === selected.scenarioId)
    .flatMap((cell) => (kind === "probe" ? PROBE_MEASURED_FILES : [...PROBE_MEASURED_FILES, FACTORS_FILE])
      .map((file) => `${cellPath(cell)}/${file}`)));
  for (const entry of tree) {
    requireValue(entry.directory ? [...allowed].some((path) => path.startsWith(`${entry.path}/`)) : allowed.has(entry.path),
      `Unexpected producer path: ${entry.path}`);
  }
  const files = tree.filter((entry) => !entry.directory);
  const bundle = { version: 1, ...contract.identity, attempt, name,
    files: kind === "probe" ? files : files.filter((file) => file.path.endsWith(`/${FACTORS_FILE}`)) };
  await validateBundle(bundle, name, contract, scenariosRoot);
  return bundle;
}

/**
 * a missing artifact root is absence; an extracted artifact without its record is invalid material.
 * @throws {Error} on unexpected extraction layout or refused bundle content
 */
async function downloadedBundles(root, kind, contract, scenariosRoot) {
  if (!root || !(await inspectPath(root))) return [];
  const files = await readTree(root);
  const planned = new Set(kind === "probe" ? [...contract.cells.values()].map(probeName)
    : [...contract.scenarios.values()].map(judgedName));
  const bundles = [];
  for (const file of files) {
    const parts = file.path.split("/");
    requireValue(planned.has(parts[0]), `Unplanned ${kind} artifact: ${parts[0]}`);
    if (file.directory) {
      requireValue(parts.length === 1, `Unexpected downloaded directory: ${file.path}`);
      requireValue(files.some((entry) => entry.path === `${file.path}/${BUNDLE_FILE}` && !entry.directory),
        `Missing downloaded bundle: ${file.path}`);
      continue;
    }
    requireValue(parts.length === 2 && parts[1] === BUNDLE_FILE,
      `Unexpected downloaded entry: ${file.path}`);
    const name = parts[0];
    const bundle = JSON.parse(file.content);
    bundles.push({ name, files: await validateBundle(bundle, name, contract, scenariosRoot) });
  }
  return bundles;
}

/**
 * completeness concerns the planned files, not successful probes or factor verdicts.
 * @throws {SyntaxError} if a caller supplies unvalidated judgment JSON
 */
function availability(contract, bundles, files, scenarioId) {
  const names = new Set(bundles.map((bundle) => bundle.name));
  return [...contract.scenarios.values()].filter((scenario) => !scenarioId || scenario.scenarioId === scenarioId)
    .map((scenario) => {
      const missingArtifacts = [];
      const missingFiles = [];
      const factorErrors = [];
      if (!names.has(judgedName(scenario))) missingArtifacts.push(judgedName(scenario));
      for (const cell of contract.cells.values()) {
        if (cell.scenarioId !== scenario.scenarioId) continue;
        if (!names.has(probeName(cell))) missingArtifacts.push(probeName(cell));
        for (const filename of [...PROBE_MEASURED_FILES, FACTORS_FILE]) {
          const path = `${cellPath(cell)}/${filename}`;
          if (!files.has(path)) missingFiles.push(path);
          else if (filename === FACTORS_FILE) {
            const judgment = JSON.parse(files.get(path));
            for (const factor of judgment.factors) {
              if (object(factor.result)) factorErrors.push(`${cellPath(cell)}: ${factor.id}`);
            }
          }
        }
      }
      return { scenarioId: scenario.scenarioId, measurementDirName: scenario.measurementDirName,
        complete: missingFiles.length === 0, missingArtifacts, missingFiles, factorErrors };
    });
}

/**
 * validates every bundle before selected data enters fresh measurement directories.
 * @returns {Promise<object>} availability, missing material and factor errors, not a success verdict
 * @throws {Error} on invalid material, empty input, reused destinations, or failed effects;
 *   filesystem-copy failure can leave a partial destination and retains its cause.
 */
export async function admitBundles({ probesRoot, judgedRoot, out, contract, scenariosRoot, scenarioId }) {
  requireValue(!scenarioId || contract.scenarios.has(scenarioId), "Unplanned admission scenario");
  const bundles = [
    ...await downloadedBundles(probesRoot, "probe", contract, scenariosRoot),
    ...await downloadedBundles(judgedRoot, "judged", contract, scenariosRoot),
  ];
  const files = new Map();
  const names = new Set();
  for (const bundle of bundles) {
    requireValue(!names.has(bundle.name), `Duplicate artifact: ${bundle.name}`);
    names.add(bundle.name);
    for (const file of bundle.files) {
      requireValue(!files.has(file.path), `Duplicate payload ownership: ${file.path}`);
      files.set(file.path, file.content);
    }
  }
  const scenarios = availability(contract, bundles, files, scenarioId);
  const selected = new Set(scenarios.map((scenario) => scenario.measurementDirName));
  const admitted = [...files].filter(([path]) => selected.has(path.split("/")[0]));
  requireValue(admitted.length > 0, "Nothing to land: no measurement content was supplied");
  await inspectPath(out);
  for (const directory of new Set(admitted.map(([path]) => path.split("/")[0]))) {
    requireValue(!(await inspectPath(join(out, directory))), `Measurement destination already exists: ${directory}`);
  }
  try {
    for (const [path, content] of admitted) {
      const destination = join(out, path);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, content, { flag: "wx" });
    }
  } catch (error) {
    throw new Error(`Admission copy failed; destination may be partial: ${error.message}`, { cause: error });
  }
  return { ...contract.identity, status: scenarios.every((scenario) => scenario.complete) ? "complete" : "partial",
    scenarios, copiedFiles: admitted.length };
}
