import type { Database } from "bun:sqlite";
import type { LatLon, NearbyStop, RouteBrief, RouteDetail, RouteDirection, Stop, StopWithLines } from "../../shared/api.ts";
import { getMeta, setMeta } from "../db.ts";
import { log } from "../log.ts";
import type { AynaBus, AynaClient, AynaStop } from "./ayna.ts";
import { fixCoordinate, haversine, Polyline, padCode } from "./geo.ts";
import { compareLines, foldText, normalizeLine, skeleton, tokenize } from "./text.ts";

export const SYNC_MAX_AGE_MS = 24 * 60 * 60_000;

type IndexedStop = Stop & { words: string[]; skeletons: string[] };

type IndexedDirection = RouteDirection & {
    folded: string;
    line: Polyline;

    stopAlong: number[];
};

type IndexedRoute = Omit<RouteDetail, "directions"> & { directions: IndexedDirection[] };

export function convertStops(items: AynaStop[]): { stops: Array<Stop & { id: number }>; skipped: string[] } {
    const stops: Array<Stop & { id: number }> = [];
    const skipped: string[] = [];
    for (const item of items) {
        const lat = fixCoordinate(item.latitude, "lat");
        const lon = fixCoordinate(item.longitude, "lon");
        if (lat === undefined || lon === undefined) {
            skipped.push(item.code);
            continue;
        }
        stops.push({ id: item.id, code9: padCode(item.code), name: item.name.trim().replace(/\s+/g, " "), lat, lon });
    }
    return { stops, skipped };
}

const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

export function convertRoute(bus: AynaBus): RouteDetail {
    const directions: RouteDirection[] = [];
    for (const dir of [1, 2] as const) {
        const stops: Stop[] = [];
        for (const s of bus.stops ?? []) {
            if (s.directionTypeId !== dir) continue;
            const lat = fixCoordinate(s.stop?.latitude, "lat");
            const lon = fixCoordinate(s.stop?.longitude, "lon");
            if (lat === undefined || lon === undefined) continue;
            stops.push({ code9: padCode(s.stopCode), name: s.stopName.trim().replace(/\s+/g, " "), lat, lon });
        }
        if (stops.length === 0) continue;
        const route = bus.routes?.find((r) => r.directionTypeId === dir);
        const path = (route?.flowCoordinates ?? []).map((p): [number, number] => [round6(p.lng), round6(p.lat)]);
        directions.push({
            dir,
            name: route?.destination?.trim() || `${stops[0]!.name} — ${stops.at(-1)!.name}`,
            to: stops.at(-1)!.name,
            stops,
            path: path.length >= 2 ? path : stops.map((s) => [s.lon, s.lat]),
        });
    }
    return {
        number: normalizeLine(bus.number),
        from: (bus.firstPoint ?? directions[0]?.stops[0]?.name ?? "").trim(),
        to: (bus.lastPoint ?? directions[0]?.to ?? "").trim(),
        carrier: bus.carrier?.trim() || null,
        tariff: bus.tariffStr?.trim() || null,
        lengthKm: bus.routLength ?? null,
        durationMin: bus.durationMinuts ?? null,
        directions,
    };
}

function indexDirection(d: RouteDirection): IndexedDirection {
    const line = new Polyline(d.path.map(([lon, lat]) => ({ lat, lon })));
    const stopAlong: number[] = [];
    let from = 0;
    for (const s of d.stops) {
        const p = line.project(s, Math.max(0, from - 30));
        const along = p && p.offset < 250 ? p.along : from;
        stopAlong.push(along);
        from = along;
    }
    return { ...d, folded: foldText(d.name), line, stopAlong };
}

export class Directory {
    private stops: IndexedStop[] = [];
    private byCode = new Map<string, IndexedStop>();
    private routes = new Map<string, IndexedRoute>();
    private linesByStop = new Map<string, string[]>();
    private towardsByStop = new Map<string, string[]>();

    get stopCount(): number {
        return this.stops.length;
    }

    get routeCount(): number {
        return this.routes.size;
    }

    load(stops: Stop[], routes: RouteDetail[]): void {
        const byCode = new Map<string, IndexedStop>();
        for (const s of stops) byCode.set(s.code9, indexStop(s));
        for (const r of routes)
            for (const d of r.directions) for (const s of d.stops) if (!byCode.has(s.code9)) byCode.set(s.code9, indexStop(s));

        const lines = new Map<string, Set<string>>();
        const towards = new Map<string, Map<string, number>>();
        const indexed = new Map<string, IndexedRoute>();
        for (const r of routes) {
            indexed.set(r.number, { ...r, directions: r.directions.map(indexDirection) });
            for (const d of r.directions) {
                d.stops.forEach((s, i) => {
                    (lines.get(s.code9) ?? lines.set(s.code9, new Set()).get(s.code9)!).add(r.number);
                    if (i === d.stops.length - 1) return;
                    const counts = towards.get(s.code9) ?? towards.set(s.code9, new Map()).get(s.code9)!;
                    counts.set(d.to, (counts.get(d.to) ?? 0) + 1);
                });
            }
        }

        this.byCode = byCode;
        this.stops = [...byCode.values()];
        this.routes = indexed;
        this.linesByStop = new Map([...lines].map(([code, set]) => [code, [...set].sort(compareLines)]));
        this.towardsByStop = new Map(
            [...towards].map(([code, counts]) => [
                code,
                [...counts]
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 2)
                    .map(([to]) => to),
            ]),
        );
    }

    loadFromDb(db: Database): void {
        const stops = db.query("SELECT code9, name, lat, lon FROM dir_stops").all() as Stop[];
        const routes = (db.query("SELECT data FROM dir_routes").all() as Array<{ data: string }>).map(
            (r) => JSON.parse(r.data) as RouteDetail,
        );
        this.load(stops, routes);
    }

    stop(code9: string): Stop | undefined {
        const s = this.byCode.get(code9);
        return s && { code9: s.code9, name: s.name, lat: s.lat, lon: s.lon };
    }

    linesAt(code9: string): string[] {
        return this.linesByStop.get(code9) ?? [];
    }

    towardsAt(code9: string): string[] {
        return this.towardsByStop.get(code9) ?? [];
    }

    stopWithLines(code9: string): StopWithLines | undefined {
        const s = this.stop(code9);
        return s && { ...s, lines: this.linesAt(code9), towards: this.towardsAt(code9) };
    }

    searchStops(query: string, limit = 30): StopWithLines[] {
        const tokens = tokenize(foldText(query));
        if (tokens.length === 0) return [];
        const scored: Array<{ s: IndexedStop; score: number }> = [];
        for (const s of this.stops) {
            let score = 0;
            for (const t of tokens) {
                const best = matchToken(s, t);
                if (best === 0) {
                    score = 0;
                    break;
                }
                score += best;
            }
            if (score > 0) scored.push({ s, score: score * 10 + Math.min(this.linesAt(s.code9).length, 9) });
        }
        return scored
            .sort((a, b) => b.score - a.score || a.s.name.length - b.s.name.length || a.s.name.localeCompare(b.s.name))
            .slice(0, limit)
            .map(({ s }) => this.stopWithLines(s.code9)!);
    }

    nearby(at: LatLon, limit = 12, radiusM = 800): NearbyStop[] {
        const found: NearbyStop[] = [];
        for (const s of this.stops) {
            if (Math.abs(s.lat - at.lat) > radiusM / 100_000 || Math.abs(s.lon - at.lon) > radiusM / 80_000) continue;
            const lines = this.linesAt(s.code9);
            if (lines.length === 0 && this.routes.size > 0) continue;
            const distanceM = haversine(at, s);
            if (distanceM <= radiusM) found.push({ ...this.stopWithLines(s.code9)!, distanceM: Math.round(distanceM) });
        }
        return found.sort((a, b) => a.distanceM - b.distanceM).slice(0, limit);
    }

    routeList(): RouteBrief[] {
        return [...this.routes.values()]
            .map((r) => ({ number: r.number, from: r.from, to: r.to }))
            .sort((a, b) => compareLines(a.number, b.number));
    }

    route(number: string): RouteDetail | undefined {
        const r = this.routes.get(normalizeLine(number));
        if (!r) return undefined;
        return { ...r, directions: r.directions.map(({ dir, name, to, stops, path }) => ({ dir, name, to, stops, path })) };
    }

    hasRoute(number: string): boolean {
        return this.routes.has(normalizeLine(number));
    }

    directionsAt(line: string, code9: string): Array<{ dir: 1 | 2; to: string }> {
        const r = this.routes.get(normalizeLine(line));
        return r ? r.directions.filter((d) => d.stops.some((s) => s.code9 === code9)).map((d) => ({ dir: d.dir, to: d.to })) : [];
    }

    resolveDir(line: string, opts: { directionName?: string | null; code9?: string; position?: LatLon | null }): 1 | 2 | null {
        const r = this.routes.get(normalizeLine(line));
        if (!r || r.directions.length === 0) return null;
        if (opts.directionName) {
            const folded = foldText(opts.directionName);
            const exact = r.directions.find((d) => d.folded === folded);
            if (exact) return exact.dir;
        }
        let candidates = r.directions;
        if (opts.code9) {
            const through = candidates.filter((d) => d.stops.some((s) => s.code9 === opts.code9));
            if (through.length === 1) return through[0]!.dir;
            if (through.length > 1) candidates = through;
        }
        if (opts.position) {
            let best: { dir: 1 | 2; offset: number } | null = null;
            for (const d of candidates) {
                const p = d.line.project(opts.position);
                if (p && (!best || p.offset < best.offset)) best = { dir: d.dir, offset: p.offset };
            }
            if (best && best.offset < 200) return best.dir;
        }
        return candidates.length === 1 ? candidates[0]!.dir : null;
    }

    stopsAway(line: string, dir: 1 | 2, code9: string, position: LatLon): number | null {
        const d = this.routes.get(normalizeLine(line))?.directions.find((x) => x.dir === dir);
        if (!d) return null;
        const ours = d.stops.findIndex((s) => s.code9 === code9);
        if (ours < 0) return null;
        const ourAlong = d.stopAlong[ours]!;
        const p = d.line.project(position, 0, ourAlong + 30);
        if (!p || p.offset > 250) return null;
        let count = 0;
        for (let i = 0; i < ours; i++) if (d.stopAlong[i]! > p.along + 15) count++;
        return count;
    }

    headingOnRoute(line: string, dir: 1 | 2 | null, position: LatLon): number | null {
        const r = this.routes.get(normalizeLine(line));
        const d = r?.directions.find((x) => x.dir === dir);
        const p = d?.line.project(position);
        return p && p.offset < 120 ? Math.round(p.heading) : null;
    }

    needsSync(db: Database, now = Date.now()): boolean {
        const last = Number(getMeta(db, "directory_synced_at") ?? 0);
        return this.stops.length === 0 || this.routes.size === 0 || now - last > SYNC_MAX_AGE_MS;
    }

    async sync(db: Database, client: AynaClient): Promise<boolean> {
        const started = Date.now();
        try {
            const { items, total } = await client.stops();
            if (items.length === 0 || (total !== undefined && items.length < total * 0.5))
                throw new Error(`suspicious stop list: ${items.length} of ${total}`);
            const { stops, skipped } = convertStops(items);
            if (skipped.length) log.warn("stops skipped because of broken coordinates", { codes: skipped });

            const list = await client.busList();
            const routes: RouteDetail[] = [];
            let pending = list;
            for (let pass = 0; pass < 2 && pending.length > 0; pass++) {
                const failedNow: typeof list = [];
                await forEachLimit(pending, 4, async (b) => {
                    try {
                        const route = convertRoute(await client.bus(b.id));
                        if (route.directions.length > 0) routes.push(route);
                    } catch (err) {
                        failedNow.push(b);
                        if (pass === 1) log.warn("route fetch failed", { id: b.id, number: b.number, err: (err as Error).message });
                    }
                });
                pending = failedNow;
            }
            const failed = pending.length;
            if (routes.length < list.length * 0.8) throw new Error(`too many routes failed: ${failed} of ${list.length}`);

            db.transaction(() => {
                db.run("DELETE FROM dir_stops");
                const insStop = db.query("INSERT OR REPLACE INTO dir_stops (code9, id, name, lat, lon) VALUES (?, ?, ?, ?, ?)");
                for (const s of stops) insStop.run(s.code9, s.id, s.name, s.lat, s.lon);
                db.run("DELETE FROM dir_routes");
                const insRoute = db.query("INSERT OR REPLACE INTO dir_routes (number, id, data) VALUES (?, ?, ?)");
                for (const [i, r] of routes.entries()) insRoute.run(r.number, i, JSON.stringify(r));
                setMeta(db, "directory_synced_at", String(Date.now()));
            })();

            this.load(stops, routes);
            log.info("directory synced", { stops: stops.length, routes: routes.length, failed, ms: Date.now() - started });
            return true;
        } catch (err) {
            log.error("directory sync failed, keeping the old one", { err });
            return false;
        }
    }
}

function indexStop(s: Stop): IndexedStop {
    const words = tokenize(foldText(s.name));
    return { code9: s.code9, name: s.name, lat: s.lat, lon: s.lon, words, skeletons: words.map(skeleton) };
}

function matchToken(s: IndexedStop, token: string): number {
    let best = 0;
    const sk = skeleton(token);
    for (let i = 0; i < s.words.length; i++) {
        const w = s.words[i]!;
        if (w.startsWith(token)) return 3;
        if (token.length >= 3 && w.includes(token)) best = Math.max(best, 2);
        else if (sk.length >= 3 && s.skeletons[i]!.startsWith(sk)) best = Math.max(best, 1);
    }
    return best;
}

async function forEachLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
    let next = 0;
    const worker = async () => {
        while (next < items.length) await fn(items[next++]!);
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
