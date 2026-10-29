import type { LiveArrival } from "../shared/api.ts";
import { log } from "./log.ts";
import type { AlertRecord, UserStore } from "./store/users.ts";
import { bakuClock } from "./time.ts";

export type AlertSender = {
    fire(alert: AlertRecord, arrival: LiveArrival): Promise<void>;
    expired(alert: AlertRecord): Promise<void>;
};

export function dueArrival(live: LiveArrival[], thresholdMin: number): LiveArrival | null {
    return live.find((a) => !a.terminal && (a.atStop || a.etaMin <= thresholdMin)) ?? null;
}

export function isDailyDue(alert: Pick<AlertRecord, "days" | "fromMin" | "toMin" | "lastFiredOn">, now: Date): boolean {
    const clock = bakuClock(now);
    return (
        (alert.days & clock.weekdayBit) !== 0 &&
        clock.minutes >= alert.fromMin &&
        clock.minutes < alert.toMin &&
        alert.lastFiredOn !== clock.day
    );
}

export async function pollAlerts(deps: {
    store: UserStore;
    arrivals: (code9: string) => Promise<{ lines: Array<{ line: string; live: LiveArrival[] }> }>;
    sender: AlertSender;
    now?: Date;
}): Promise<void> {
    const now = deps.now ?? new Date();
    const today = bakuClock(now).day;
    const due = new Map<string, AlertRecord[]>();

    for (const alert of deps.store.activeAlerts()) {
        if (alert.kind === "once") {
            if (alert.expiresAtMs !== null && alert.expiresAtMs <= now.getTime()) {
                deps.store.deactivateAlert(alert.id);
                await deps.sender.expired(alert).catch((err) => log.warn("expired alert not delivered", { id: alert.id, err }));
                continue;
            }
        } else if (!isDailyDue(alert, now)) {
            continue;
        }
        (due.get(alert.code9) ?? due.set(alert.code9, []).get(alert.code9)!).push(alert);
    }

    await Promise.all(
        [...due].map(async ([code9, alerts]) => {
            let lines: Array<{ line: string; live: LiveArrival[] }>;
            try {
                ({ lines } = await deps.arrivals(code9));
            } catch (err) {
                log.warn("alert poll: stop unavailable", { code9, err: (err as Error).message });
                return;
            }
            for (const alert of alerts) {
                const live = lines
                    .filter((l) => l.line === alert.line)
                    .flatMap((l) => l.live)
                    .sort((a, b) => a.at.localeCompare(b.at));
                const arrival = dueArrival(live, alert.thresholdMin);
                if (!arrival) continue;
                deps.store.markFired(alert.id, today, alert.kind === "once");
                await deps.sender.fire(alert, arrival).catch((err) => log.warn("alert not delivered", { id: alert.id, err }));
            }
        }),
    );
}
