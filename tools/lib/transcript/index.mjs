// The transcript layer's public surface.
//
// Callers import from here rather than reaching into `events.mjs` or
// `parse.mjs` directly, so the split between "frame the stream" and "read the
// stream" stays an implementation detail this module is free to move.

export { readEvents, toolUseBlocks } from "./events.mjs";
export {
  DEFAULT_FORMAT_COMMAND_PATTERNS,
  DEFAULT_LINT_COMMAND_PATTERNS,
  DEFAULT_TEST_COMMAND_PATTERNS,
  parseTranscript,
  readBehaviour,
} from "./parse.mjs";
