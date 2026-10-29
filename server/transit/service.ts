import type { LatLon, LineBoard, StopArrivals, Vehicle } from "../../shared/api.ts";
import type { Directory } from "./directory.ts";
import { bearing, haversine } from "./geo.ts";
import { buildBoards } from "./live.ts";
import type { NecptClient } from "./necpt.ts";
import { normalizeLine } from "./text.ts";

export class TransitService {
    private readonly tracks = new Map<string, { at: LatLon; heading: number | null; seen: number }>();

    constructor(
        readonly necpt: NecptClient,
        readonly directory: Directory,
    ) {}

    async arrivals(code9: string): Promise<StopArrivals> {
        const data = await this.necpt.stopMonitoring(code9);
        const lines: LineBoard[] = buildBoards(data).map(({ directionName, ...board }) => {
            const dir = this.directory.resolveDir(board.line, { directionName, code9 });
            const live = dir
                ? board.live.map((a) =>
                      a.position && !a.atStop ? { ...a, stopsAway: this.directory.stopsAway(board.line, dir, code9, a.position) } : a,
                  )
                : board.live;
            return { ...board, dir, live };
        });
        return { code9, now: data.now.toISOString(), lines };
    }

    async lineAt(code9: string, line: string): Promise<{ now: string; boards: LineBoard[] }> {
        const wanted = normalizeLine(line);
        const all = await this.arrivals(code9);
        return { now: all.now, boards: all.lines.filter((b) => b.line === wanted) };
    }

    async vehicles(line: string): Promise<Vehicle[]> {
        const wanted = normalizeLine(line);
        const { vehicles } = await this.necpt.vehicles();
        const now = Date.now();
        const result: Vehicle[] = [];
        for (const v of vehicles) {
            if (v.line !== wanted) continue;
            const dir = this.directory.resolveDir(v.line, { directionName: v.directionName, position: v.position });
            const moved = this.track(v.id, v.position, now);
            result.push({
                id: v.id,
                line: v.line,
                dir,
                destination: v.destination,
                lat: v.position.lat,
                lon: v.position.lon,
                heading: this.directory.headingOnRoute(v.line, dir, v.position) ?? moved,
                recordedAt: v.recordedAt.toISOString(),
            });
        }
        this.forgetOld(now);
        return result;
    }

    private track(id: string, at: LatLon, now: number): number | null {
        const prev = this.tracks.get(id);
        if (!prev) {
            this.tracks.set(id, { at, heading: null, seen: now });
            return null;
        }
        prev.seen = now;
        if (haversine(prev.at, at) >= 25) {
            prev.heading = Math.round(bearing(prev.at, at));
            prev.at = at;
        }
        return prev.heading;
    }

    private forgetOld(now: number): void {
        if (this.tracks.size < 3000) return;
        for (const [id, t] of this.tracks) if (now - t.seen > 15 * 60_000) this.tracks.delete(id);
    }
}
