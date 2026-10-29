import type { LatLon } from "../../shared/api.ts";

export const AZ_BOUNDS = { latMin: 38, latMax: 42, lonMin: 44, lonMax: 51 } as const;

export const inAzerbaijan = ({ lat, lon }: LatLon): boolean =>
    lat >= AZ_BOUNDS.latMin && lat <= AZ_BOUNDS.latMax && lon >= AZ_BOUNDS.lonMin && lon <= AZ_BOUNDS.lonMax;

export const padCode = (code: string): string => code.trim().padStart(9, "0");

export function fixCoordinate(raw: unknown, axis: "lat" | "lon"): number | undefined {
    const text = String(raw ?? "").trim();
    let value: number | undefined;
    if (/^-?\d+(?:\.\d+)?$/.test(text)) {
        value = Number(text);
    } else {
        const digits = text.replace(/\D/g, "");
        if (digits.length >= 3) value = Number(`${digits.slice(0, 2)}.${digits.slice(2)}`);
    }
    if (value === undefined || !Number.isFinite(value)) return undefined;
    const [min, max] = axis === "lat" ? [AZ_BOUNDS.latMin, AZ_BOUNDS.latMax] : [AZ_BOUNDS.lonMin, AZ_BOUNDS.lonMax];
    return value >= min && value <= max ? value : undefined;
}

const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number): number => (deg * Math.PI) / 180;

export function haversine(a: LatLon, b: LatLon): number {
    const dLat = rad(b.lat - a.lat);
    const dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearing(a: LatLon, b: LatLon): number {
    const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
    const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export class Polyline {
    private readonly xs: number[] = [];
    private readonly ys: number[] = [];
    private readonly cum: number[] = [];
    private readonly kx: number;
    private readonly ky = 111_320;

    constructor(readonly points: LatLon[]) {
        const lat0 = points[0]?.lat ?? 40.4;
        this.kx = 111_320 * Math.cos(rad(lat0));
        let total = 0;
        points.forEach((p, i) => {
            this.xs.push(p.lon * this.kx);
            this.ys.push(p.lat * this.ky);
            if (i > 0) total += Math.hypot(this.xs[i]! - this.xs[i - 1]!, this.ys[i]! - this.ys[i - 1]!);
            this.cum.push(total);
        });
    }

    get length(): number {
        return this.cum.at(-1) ?? 0;
    }

    project(p: LatLon, minAlong = 0, maxAlong = Number.POSITIVE_INFINITY): { along: number; offset: number; heading: number } | null {
        if (this.points.length < 2) return null;
        const px = p.lon * this.kx;
        const py = p.lat * this.ky;
        let best = { along: 0, offset: Number.POSITIVE_INFINITY, seg: 0 };
        for (let i = 0; i < this.points.length - 1; i++) {
            if (this.cum[i + 1]! < minAlong || this.cum[i]! > maxAlong) continue;
            const ax = this.xs[i]!;
            const ay = this.ys[i]!;
            const dx = this.xs[i + 1]! - ax;
            const dy = this.ys[i + 1]! - ay;
            const len2 = dx * dx + dy * dy;
            const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
            const offset = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
            if (offset < best.offset) best = { along: this.cum[i]! + t * Math.sqrt(len2), offset, seg: i };
        }
        return { along: best.along, offset: best.offset, heading: bearing(this.points[best.seg]!, this.points[best.seg + 1]!) };
    }
}
