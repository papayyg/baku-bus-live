import type { LineBoard, LiveArrival, Trip } from "../../shared/api.ts";
import { formatDistance, type Lang } from "../../shared/i18n.ts";
import { formatTime } from "../time.ts";
import { T } from "./i18n.ts";

export const escapeHtml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const b = (s: string): string => `<b>${escapeHtml(s)}</b>`;

const moving = (boards: LineBoard[]): LiveArrival[] =>
    boards
        .flatMap((x) => x.live)
        .filter((a) => !a.terminal)
        .sort((x, y) => x.at.localeCompare(y.at));

const far = (lang: Lang, a: LiveArrival): string => (!a.atStop && a.distanceM ? ` (${formatDistance(lang, a.distanceM)})` : "");

export function arrivalLines(lang: Lang, boards: LineBoard[]): string[] {
    const t = T[lang];
    const [first, ...rest] = moving(boards);
    if (first) {
        const lead = first.atStop
            ? t.nowAtStop
            : first.etaMin === 0
              ? t.nowArriving(far(lang, first))
              : t.arrivesIn(b(`${first.etaMin} ${t.min}`), far(lang, first));
        const next = rest.map((a) => (a.atStop ? t.atStop : `${a.etaMin} ${t.min}`));
        return next.length ? [lead, t.following(next.join(", "))] : [lead];
    }

    const planned = [
        ...boards.flatMap((x) => x.live).map((a) => ({ at: a.at, note: t.fromTerminus })),
        ...boards.flatMap((x) => x.scheduled).map((s) => ({ at: s.at, note: t.scheduled })),
    ].sort((x, y) => x.at.localeCompare(y.at))[0];
    if (planned) return [t.nextPlanned(formatTime(planned.at), planned.note)];
    return [t.noBuses];
}

export function lineMessage(lang: Lang, opts: { line: string; title: string; boards: LineBoard[] }): string {
    const t = T[lang];
    return [`${t.bus} ${b(opts.line)}`, `${t.stop} ${escapeHtml(opts.title)}`, "", ...arrivalLines(lang, opts.boards)].join("\n");
}

export function nearestText(lang: Lang, boards: LineBoard[] | null): string {
    const t = T[lang];
    if (boards === null) return t.noConnection;
    const [first, ...rest] = moving(boards);
    if (first) {
        const head = first.atStop ? b(t.atStop) : b(`${first.etaMin} ${t.min}`);
        return rest.length ? `${head}, ${t.thenShort(rest.map((a) => a.etaMin).join(", "))}` : head;
    }
    const planned = [...boards.flatMap((x) => x.live).map((a) => a.at), ...boards.flatMap((x) => x.scheduled).map((s) => s.at)].sort()[0];
    return planned ? t.at(formatTime(planned)) : t.notRunning;
}

export function summaryMessage(lang: Lang, items: Array<{ trip: Trip; title: string; boards: LineBoard[] | null }>): string {
    return items.map(({ trip, title, boards }) => `🚌 ${b(trip.line)} · ${escapeHtml(title)} — ${nearestText(lang, boards)}`).join("\n");
}

export function tripButton(trip: Trip, stopTitle: string): string {
    const title = (trip.label ?? stopTitle).slice(0, 22);
    return `🚌 ${trip.line} · ${title}`;
}

export function alertMessage(lang: Lang, opts: { line: string; stopTitle: string; arrival: LiveArrival }): string {
    const t = T[lang];
    const a = opts.arrival;
    const line = b(opts.line);
    const head = a.atStop
        ? t.alertAtStop(line)
        : a.etaMin === 0
          ? t.alertArriving(line, far(lang, a))
          : t.alertIn(line, b(`${a.etaMin} ${t.min}`), far(lang, a));
    return [head, `${t.stop} ${escapeHtml(opts.stopTitle)}`].join("\n");
}
