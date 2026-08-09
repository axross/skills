// A small, levelled logger shared by the API and the SPA. Neither runtime
// gets anything fancier than console output: the API's process is short-lived
// enough that a transport-backed logger (pino, winston) would be more
// configuration than payoff, and the SPA can't use one of those at all.
//
// The threshold comes from LOG_LEVEL and falls back to "info", which drops
// `debug` and nothing else — `info`, `warn` and `error` all print until
// someone raises it. There is no dedicated error tracker on the API side, so
// `logger.error()` is this module's sanctioned channel for a failure nothing
// else reports — see deploy-hook.ts.

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  readonly [key: string]: unknown;
}

export interface Logger {
  child(moduleName: string): Logger;
  debug(context: LogContext, message: string): void;
  info(context: LogContext, message: string): void;
  warn(context: LogContext, message: string): void;
  error(context: LogContext, message: string): void;
}

const LEVEL_ORDER: Readonly<Record<LogLevel, number>> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function readEnvLogLevel(): string | undefined {
  // Reached through `globalThis` rather than a typed `process` import, so
  // this module compiles the same way under the browser build (no Node
  // types in scope there) and under the API's.
  const runtimeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process;
  return runtimeProcess?.env?.LOG_LEVEL;
}

export function createLogger(moduleName: string, threshold: LogLevel = "info"): Logger {
  function emit(level: LogLevel, context: LogContext, message: string): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[threshold]) return;
    console[level]({ level, module: moduleName, ...context, message });
  }

  return {
    child: (childModule) => createLogger(`${moduleName}:${childModule}`, threshold),
    debug: (context, message) => emit("debug", context, message),
    info: (context, message) => emit("info", context, message),
    warn: (context, message) => emit("warn", context, message),
    error: (context, message) => emit("error", context, message),
  };
}

function resolveThreshold(): LogLevel {
  const raw = readEnvLogLevel();
  return raw === "debug" || raw === "info" || raw === "warn" || raw === "error" ? raw : "info";
}

export const rootLogger = createLogger("blog-cms", resolveThreshold());
