type LogLevel = "info" | "warn" | "error" | "debug";

const COLORS: Record<LogLevel, string> = {
  debug: "\x1b[90m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
};
const RESET = "\x1b[0m";

function format(level: LogLevel, context: string, message: string, meta?: Record<string, unknown>): string {
  const ts = new Date().toISOString().slice(11, 23);
  const metaStr = meta ? " " + JSON.stringify(meta) : "";
  return `${COLORS[level]}${ts} [${level.toUpperCase()}]${RESET} ${context}: ${message}${metaStr}`;
}

function createLogger(context: string) {
  return {
    debug: (msg: string, meta?: Record<string, unknown>) => {
      if (process.env.NODE_ENV === "development") console.debug(format("debug", context, msg, meta));
    },
    info: (msg: string, meta?: Record<string, unknown>) => console.log(format("info", context, msg, meta)),
    warn: (msg: string, meta?: Record<string, unknown>) => console.warn(format("warn", context, msg, meta)),
    error: (msg: string, meta?: Record<string, unknown>) => console.error(format("error", context, msg, meta)),
  };
}

export default createLogger;
