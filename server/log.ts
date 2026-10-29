type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

let threshold = ORDER.info;

export function setLogLevel(level: Level): void {
    threshold = ORDER[level];
}

function serialize(value: unknown): unknown {
    if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
    return value;
}

function write(level: Level, msg: string, fields?: Record<string, unknown>): void {
    if (ORDER[level] < threshold) return;
    const entry: Record<string, unknown> = { t: new Date().toISOString(), level, msg };
    if (fields) for (const [k, v] of Object.entries(fields)) entry[k] = serialize(v);
    const line = JSON.stringify(entry);
    if (level === "error" || level === "warn") console.error(line);
    else console.log(line);
}

export const log = {
    debug: (msg: string, fields?: Record<string, unknown>) => write("debug", msg, fields),
    info: (msg: string, fields?: Record<string, unknown>) => write("info", msg, fields),
    warn: (msg: string, fields?: Record<string, unknown>) => write("warn", msg, fields),
    error: (msg: string, fields?: Record<string, unknown>) => write("error", msg, fields),
};
