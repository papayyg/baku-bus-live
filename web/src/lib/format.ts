import type { Alert, LineBoard, LiveArrival } from "@shared/api.ts";
import type { DICTS } from "./i18n.ts";

type Dict = (typeof DICTS)["ru"];

const hm = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Baku", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export const formatTime = (d: Date | string): string => hm.format(typeof d === "string" ? new Date(d) : d);

export type Lead =
    | { kind: "here" }
    | { kind: "arriving" }
    | { kind: "minutes"; value: number }
    | { kind: "terminal"; at: string }
    | { kind: "scheduled"; at: string }
    | { kind: "none" };

export function leadOf(boards: Array<Pick<LineBoard, "live" | "scheduled">>): { lead: Lead; first: LiveArrival | null; rest: number[] } {
    const live = boards.flatMap((b) => b.live).sort((a, b) => a.at.localeCompare(b.at));
    const moving = live.filter((a) => !a.terminal);
    const first = moving[0] ?? live[0] ?? null;
    const rest = moving.slice(first && !first.terminal ? 1 : 0, 3).map((a) => a.etaMin);
    if (first) {
        if (first.atStop) return { lead: { kind: "here" }, first, rest };
        if (first.terminal) return { lead: { kind: "terminal", at: first.at }, first, rest };
        if (first.etaMin === 0) return { lead: { kind: "arriving" }, first, rest };
        return { lead: { kind: "minutes", value: first.etaMin }, first, rest };
    }
    const sched = boards.flatMap((b) => b.scheduled).sort((a, b) => a.at.localeCompare(b.at))[0];
    if (sched) return { lead: { kind: "scheduled", at: sched.at }, first: null, rest: [] };
    return { lead: { kind: "none" }, first: null, rest: [] };
}

export const shortPlace = (s: string): string => s.replace(/\s+/g, " ").trim();

export function daysText(t: Dict, mask: number): string {
    if (mask === 127) return t.days.every;
    if (mask === 0b0011111) return t.days.weekdays;
    if (mask === 0b1100000) return t.days.weekends;
    return t.weekdaysShort.filter((_, i) => mask & (1 << i)).join(", ");
}

export const minutesToClock = (m: number): string =>
    `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

const windowText = (from: number, to: number): string => `${minutesToClock(from)}\u2060–\u2060${minutesToClock(to)}`;

export function alertText(t: Dict, a: Alert): string {
    return a.kind === "once"
        ? t.alertOnce(a.thresholdMin, a.expiresAt ? formatTime(a.expiresAt) : "—")
        : t.alertDaily(a.thresholdMin, daysText(t, a.days), windowText(a.fromMin, a.toMin));
}
