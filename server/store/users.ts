import type { Database } from "bun:sqlite";
import type { Alert, AlertKind, NewAlert, SavedStop, Trip } from "../../shared/api.ts";
import { isLang, type Lang, langOf } from "../../shared/i18n.ts";
import type { Directory } from "../transit/directory.ts";
import { normalizeLine } from "../transit/text.ts";

export const LIMITS = { stops: 30, trips: 12, alerts: 10 } as const;

export class LimitError extends Error {}
export class NotFoundError extends Error {}

type TripRow = { id: number; code9: string; line: string; label: string | null };
type StopRow = { code9: string; alias: string | null };
type AlertRow = {
    id: number;
    user_id: number;
    code9: string;
    line: string;
    threshold_min: number;
    kind: AlertKind;
    days: number;
    from_min: number;
    to_min: number;
    expires_at: number | null;
    last_fired_on: string | null;
    active: number;
};

export type AlertRecord = Alert & { userId: number; lastFiredOn: string | null; expiresAtMs: number | null };

const ONCE_TTL_MS = 60 * 60_000;

export class UserStore {
    constructor(
        private readonly db: Database,
        private readonly directory: Directory,
        private readonly now: () => number = Date.now,
    ) {}

    touchUser(user: { id: number; firstName: string; username?: string | null; languageCode?: string | null }): void {
        const t = this.now();
        this.db
            .query(
                `INSERT INTO users (id, first_name, username, tg_lang, created_at, seen_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET first_name = excluded.first_name, username = excluded.username,
           tg_lang = COALESCE(excluded.tg_lang, users.tg_lang), seen_at = excluded.seen_at`,
            )
            .run(user.id, user.firstName, user.username ?? null, user.languageCode ?? null, t, t);
    }

    lang(userId: number): Lang {
        const row = this.db.query("SELECT lang, tg_lang FROM users WHERE id = ?").get(userId) as {
            lang: string | null;
            tg_lang: string | null;
        } | null;
        return isLang(row?.lang) ? row.lang : langOf(row?.tg_lang);
    }

    chosenLang(userId: number): Lang | null {
        const row = this.db.query("SELECT lang FROM users WHERE id = ?").get(userId) as { lang: string | null } | null;
        return isLang(row?.lang) ? row.lang : null;
    }

    setLang(userId: number, lang: Lang | null): void {
        this.db.query("UPDATE users SET lang = ? WHERE id = ?").run(lang, userId);
    }

    stops(userId: number): SavedStop[] {
        const rows = this.db
            .query("SELECT code9, alias FROM saved_stops WHERE user_id = ? ORDER BY position, created_at")
            .all(userId) as StopRow[];
        return rows.flatMap((r) => {
            const stop = this.directory.stopWithLines(r.code9);
            return stop ? [{ code9: r.code9, alias: r.alias, stop }] : [];
        });
    }

    saveStop(userId: number, code9: string, alias?: string | null): void {
        if (!this.directory.stop(code9)) throw new NotFoundError("stop");
        const exists = this.db.query("SELECT 1 FROM saved_stops WHERE user_id = ? AND code9 = ?").get(userId, code9);
        if (exists) {
            if (alias !== undefined)
                this.db.query("UPDATE saved_stops SET alias = ? WHERE user_id = ? AND code9 = ?").run(cleanLabel(alias), userId, code9);
            return;
        }
        const count = (this.db.query("SELECT COUNT(*) AS n FROM saved_stops WHERE user_id = ?").get(userId) as { n: number }).n;
        if (count >= LIMITS.stops) throw new LimitError("stops");
        this.db
            .query("INSERT INTO saved_stops (user_id, code9, alias, position, created_at) VALUES (?, ?, ?, ?, ?)")
            .run(userId, code9, cleanLabel(alias ?? null), count, this.now());
    }

    removeStop(userId: number, code9: string): void {
        this.db.query("DELETE FROM saved_stops WHERE user_id = ? AND code9 = ?").run(userId, code9);
    }

    aliasOf(userId: number, code9: string): string | null {
        return (
            (this.db.query("SELECT alias FROM saved_stops WHERE user_id = ? AND code9 = ?").get(userId, code9) as StopRow | null)?.alias ??
            null
        );
    }

    trips(userId: number): Trip[] {
        const rows = this.db
            .query("SELECT id, code9, line, label FROM trips WHERE user_id = ? ORDER BY position, id")
            .all(userId) as TripRow[];
        return rows.flatMap((r) => {
            const stop = this.directory.stop(r.code9);
            if (!stop) return [];
            const dirs = this.directory.directionsAt(r.line, r.code9);
            return [{ id: r.id, code9: r.code9, line: r.line, label: r.label, stop, towards: dirs.length === 1 ? dirs[0]!.to : null }];
        });
    }

    trip(userId: number, id: number): Trip | undefined {
        return this.trips(userId).find((t) => t.id === id);
    }

    addTrip(userId: number, code9: string, line: string, label?: string | null): Trip {
        const wanted = normalizeLine(line);
        if (!this.directory.stop(code9)) throw new NotFoundError("stop");
        const existing = this.db.query("SELECT id FROM trips WHERE user_id = ? AND code9 = ? AND line = ?").get(userId, code9, wanted) as {
            id: number;
        } | null;
        if (!existing) {
            const count = (this.db.query("SELECT COUNT(*) AS n FROM trips WHERE user_id = ?").get(userId) as { n: number }).n;
            if (count >= LIMITS.trips) throw new LimitError("trips");
            this.db
                .query("INSERT INTO trips (user_id, code9, line, label, position, created_at) VALUES (?, ?, ?, ?, ?, ?)")
                .run(userId, code9, wanted, cleanLabel(label ?? null), count, this.now());
        } else if (label !== undefined) {
            this.db.query("UPDATE trips SET label = ? WHERE id = ?").run(cleanLabel(label), existing.id);
        }
        try {
            this.saveStop(userId, code9);
        } catch (err) {
            if (!(err instanceof LimitError)) throw err;
        }
        return this.trips(userId).find((t) => t.code9 === code9 && t.line === wanted)!;
    }

    renameTrip(userId: number, id: number, label: string | null): void {
        const res = this.db.query("UPDATE trips SET label = ? WHERE id = ? AND user_id = ?").run(cleanLabel(label), id, userId);
        if (res.changes === 0) throw new NotFoundError("trip");
    }

    removeTrip(userId: number, id: number): void {
        this.db.query("DELETE FROM trips WHERE id = ? AND user_id = ?").run(id, userId);
    }

    reorderTrips(userId: number, ids: number[]): void {
        const update = this.db.query("UPDATE trips SET position = ? WHERE id = ? AND user_id = ?");
        this.db.transaction(() => {
            for (const [i, id] of ids.entries()) update.run(i, id, userId);
        })();
    }

    alerts(userId: number): Alert[] {
        return (this.db.query("SELECT * FROM alerts WHERE user_id = ? AND active = 1 ORDER BY id").all(userId) as AlertRow[]).map((r) =>
            this.toAlert(r),
        );
    }

    addAlert(userId: number, input: NewAlert): Alert {
        if (!this.directory.stop(input.code9)) throw new NotFoundError("stop");
        const count = (this.db.query("SELECT COUNT(*) AS n FROM alerts WHERE user_id = ? AND active = 1").get(userId) as { n: number }).n;
        if (count >= LIMITS.alerts) throw new LimitError("alerts");
        const line = normalizeLine(input.line);
        const daily = input.kind === "daily";
        if (!daily)
            this.db
                .query("UPDATE alerts SET active = 0 WHERE user_id = ? AND code9 = ? AND line = ? AND kind = 'once'")
                .run(userId, input.code9, line);
        const row = this.db
            .query(
                `INSERT INTO alerts (user_id, code9, line, threshold_min, kind, days, from_min, to_min, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
            )
            .get(
                userId,
                input.code9,
                line,
                input.thresholdMin,
                input.kind,
                daily ? (input.days ?? 0b0011111) : 127,
                daily ? (input.fromMin ?? 7 * 60) : 0,
                daily ? (input.toMin ?? 9 * 60) : 1440,
                daily ? null : this.now() + ONCE_TTL_MS,
                this.now(),
            ) as AlertRow;
        return this.toAlert(row);
    }

    removeAlert(userId: number, id: number): void {
        this.db.query("UPDATE alerts SET active = 0 WHERE id = ? AND user_id = ?").run(id, userId);
    }

    activeAlerts(): AlertRecord[] {
        return (this.db.query("SELECT * FROM alerts WHERE active = 1").all() as AlertRow[]).map((r) => ({
            ...this.toAlert(r),
            userId: r.user_id,
            lastFiredOn: r.last_fired_on,
            expiresAtMs: r.expires_at,
        }));
    }

    markFired(id: number, day: string, deactivate: boolean): void {
        this.db
            .query("UPDATE alerts SET last_fired_on = ?, active = CASE WHEN ? THEN 0 ELSE active END WHERE id = ?")
            .run(day, deactivate ? 1 : 0, id);
    }

    deactivateAlert(id: number): void {
        this.db.query("UPDATE alerts SET active = 0 WHERE id = ?").run(id);
    }

    private toAlert(r: AlertRow): Alert {
        return {
            id: r.id,
            code9: r.code9,
            line: r.line,
            stopName: this.aliasOf(r.user_id, r.code9) ?? this.directory.stop(r.code9)?.name ?? r.code9,
            thresholdMin: r.threshold_min,
            kind: r.kind,
            days: r.days,
            fromMin: r.from_min,
            toMin: r.to_min,
            expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null,
            active: r.active === 1,
        };
    }
}

function cleanLabel(label: string | null): string | null {
    const t = label?.trim().replace(/\s+/g, " ").slice(0, 32);
    return t ? t : null;
}
