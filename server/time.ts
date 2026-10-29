export const TZ = "Asia/Baku";

const hm = new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
});

export const formatTime = (d: Date | string): string => hm.format(typeof d === "string" ? new Date(d) : d);

const WEEKDAY_BIT: Record<string, number> = { Mon: 1, Tue: 2, Wed: 4, Thu: 8, Fri: 16, Sat: 32, Sun: 64 };

export function bakuClock(d: Date): { day: string; weekdayBit: number; minutes: number } {
    const p = Object.fromEntries(parts.formatToParts(d).map((x) => [x.type, x.value]));
    return {
        day: `${p.year}-${p.month}-${p.day}`,
        weekdayBit: WEEKDAY_BIT[p.weekday!] ?? 0,
        minutes: Number(p.hour) * 60 + Number(p.minute),
    };
}
