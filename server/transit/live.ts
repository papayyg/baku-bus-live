import { z } from "zod";
import type { LatLon, LineBoard, LiveArrival, Occupancy, ScheduledArrival } from "../../shared/api.ts";
import { compareLines, normalizeLine } from "./text.ts";

export class TransitServiceError extends Error {}

const journeySchema = z.object({
    publishedLineName: z.string(),
    directionRef: z.string().nullish(),
    destinationName: z.string().nullish(),
    originName: z.string().nullish(),
    monitored: z.boolean(),
    vehicleLocation: z.object({ latitude: z.number(), longitude: z.number() }).nullish(),
    occupancy: z.string().nullish(),
    approachingDistance: z.coerce.number().nullish(),
    vehicleRef: z.string().nullish(),
    framedVehicleJourneyRef: z.object({ datedVehicleJourneyRef: z.string().nullish() }).nullish(),
    monitoredCall: z
        .object({
            vehicleAtStop: z.boolean().nullish(),
            stopPointName: z.string().nullish(),
            expectedArrivalTime: z.string().nullish(),
            aimedArrivalTime: z.string().nullish(),
        })
        .nullish(),
});

const stopResponseSchema = z.object({
    status: z.literal(true),
    data: z.object({
        siri: z.object({
            serviceDelivery: z.object({
                responseTimestamp: z.string(),
                stopMonitoringDelivery: z
                    .array(
                        z.object({
                            monitoredStopVisit: z.array(z.object({ monitoredVehicleJourney: journeySchema })).nullable(),
                        }),
                    )
                    .min(1),
            }),
        }),
    }),
});

export type Visit = {
    line: string;
    destination: string;
    directionName: string | null;
    monitored: boolean;
    journeyId: string | null;
    expected: Date | null;
    aimed: Date | null;
    atStop: boolean;
    distanceM: number | null;
    occupancy: string | null;
    position: LatLon | null;
};

export type StopMonitoring = { now: Date; visits: Visit[] };

export function parseTime(value: string | null | undefined): Date | null {
    if (!value) return null;
    const t = new Date(value);
    return Number.isNaN(t.getTime()) || t.getUTCFullYear() <= 2000 ? null : t;
}

export function parseStopMonitoring(raw: unknown): StopMonitoring {
    const parsed = stopResponseSchema.safeParse(raw);
    if (!parsed.success) throw new TransitServiceError("unexpected stop monitoring response");
    const delivery = parsed.data.data.siri.serviceDelivery;
    const now = parseTime(delivery.responseTimestamp);
    if (!now) throw new TransitServiceError("bad responseTimestamp");

    const visits = (delivery.stopMonitoringDelivery[0]!.monitoredStopVisit ?? []).map(
        ({ monitoredVehicleJourney: j }): Visit => ({
            line: normalizeLine(j.publishedLineName),
            destination: (j.destinationName ?? j.originName ?? "").trim(),
            directionName: j.directionRef?.trim() || null,
            monitored: j.monitored,
            journeyId: j.framedVehicleJourneyRef?.datedVehicleJourneyRef ?? null,
            expected: parseTime(j.monitoredCall?.expectedArrivalTime),
            aimed: parseTime(j.monitoredCall?.aimedArrivalTime),
            atStop: j.monitoredCall?.vehicleAtStop === true,
            distanceM: j.approachingDistance ?? null,
            occupancy: j.occupancy ?? null,
            position:
                j.vehicleLocation && j.vehicleLocation.latitude !== 0
                    ? { lat: j.vehicleLocation.latitude, lon: j.vehicleLocation.longitude }
                    : null,
        }),
    );
    return { now, visits };
}

export function describeOccupancy(value: string | null): Occupancy | null {
    switch (value) {
        case "Seats Available":
            return "free";
        case "Standing Available":
        case "Standing Room Only":
            return "standing";
        case "Full":
        case "Crushed Standing Room Only":
            return "full";
        default:
            return null;
    }
}

const minutesBetween = (from: Date, to: Date): number => (to.getTime() - from.getTime()) / 60_000;

export function toLiveArrival(v: Visit, now: Date): LiveArrival | null {
    if (!v.monitored || !v.expected) return null;
    const etaMin = Math.max(0, Math.round(minutesBetween(now, v.expected)));
    return {
        kind: "live",
        at: v.expected.toISOString(),
        etaMin,
        atStop: v.atStop,
        terminal: v.distanceM === 0 && !v.atStop && etaMin >= 3,
        distanceM: v.distanceM,
        delayMin: v.aimed ? Math.round(minutesBetween(v.aimed, v.expected)) : null,
        occupancy: describeOccupancy(v.occupancy),
        position: v.position,
        journeyId: v.journeyId,
        stopsAway: null,
    };
}

const MAX_SCHEDULED = 3;

export type RawBoard = LineBoard & { directionName: string | null };

export function buildBoards(data: StopMonitoring): RawBoard[] {
    const groups = new Map<string, { line: string; destination: string; directionName: string | null; visits: Visit[] }>();
    for (const v of data.visits) {
        const key = `${v.line}\u0000${v.destination}`;
        const group = groups.get(key) ?? { line: v.line, destination: v.destination, directionName: v.directionName, visits: [] };
        group.directionName ??= v.directionName;
        group.visits.push(v);
        groups.set(key, group);
    }

    const liveIds = new Set<string>();
    for (const v of data.visits) if (v.monitored && v.expected && v.journeyId) liveIds.add(v.journeyId);

    const boards: RawBoard[] = [];
    for (const { line, destination, directionName, visits } of groups.values()) {
        const live = visits
            .map((v) => toLiveArrival(v, data.now))
            .filter((t): t is LiveArrival => t !== null)
            .sort((a, c) => a.at.localeCompare(c.at));

        const lastLive = live.length ? new Date(live.at(-1)!.at).getTime() : Number.NEGATIVE_INFINITY;
        const scheduled: ScheduledArrival[] = visits
            .filter((v) => !v.monitored && !(v.journeyId && liveIds.has(v.journeyId)))
            .map((v) => v.aimed ?? v.expected)
            .filter((t): t is Date => t !== null && t.getTime() > lastLive && t.getTime() > data.now.getTime())
            .sort((a, c) => a.getTime() - c.getTime())
            .slice(0, MAX_SCHEDULED)
            .map((t) => ({ kind: "scheduled", at: t.toISOString(), etaMin: Math.round(minutesBetween(data.now, t)) }));

        boards.push({ line, destination, directionName, dir: null, live, scheduled });
    }

    return boards.sort(
        (a, c) =>
            Number(c.live.length > 0) - Number(a.live.length > 0) ||
            compareLines(a.line, c.line) ||
            a.destination.localeCompare(c.destination),
    );
}

export function nextEta(board: Pick<LineBoard, "live" | "scheduled">): number | null {
    return board.live[0]?.etaMin ?? board.scheduled[0]?.etaMin ?? null;
}

const vehicleActivitySchema = z.object({
    RecordedAt: z.string(),
    VehicleMonitoringRef: z.string().nullish(),
    MonitoredVehicleJourney: z.object({
        PublishedLineName: z.string(),
        DirectionRef: z.string().nullish(),
        DestinationName: z.string().nullish(),
        Monitored: z.boolean().nullish(),
        VehicleLocation: z.object({ Longitude: z.number(), Latitude: z.number() }).nullish(),
        FramedVehicleJourneyRef: z.object({ DatedVehicleJourneyRef: z.string().nullish() }).nullish(),
    }),
});

const vehicleResponseSchema = z.object({
    Siri: z.object({
        ServiceDelivery: z.object({
            ResponseTimestamp: z.string(),
            VehicleMonitoringDelivery: z.array(z.object({ VehicleActivity: z.array(z.unknown()).nullable() })).min(1),
        }),
    }),
});

export type RawVehicle = {
    id: string;
    line: string;
    directionName: string | null;
    destination: string;
    position: LatLon;
    recordedAt: Date;
};

const STALE_MS = 3 * 60_000;

export function parseVehicleMonitoring(raw: unknown): { now: Date; vehicles: RawVehicle[] } {
    const envelope = z.object({ status: z.literal(true), data: z.union([z.string(), z.record(z.string(), z.unknown())]) }).safeParse(raw);
    if (!envelope.success) throw new TransitServiceError("unexpected vehicle monitoring envelope");
    const data = typeof envelope.data.data === "string" ? (JSON.parse(envelope.data.data) as unknown) : envelope.data.data;
    const parsed = vehicleResponseSchema.safeParse(data);
    if (!parsed.success) throw new TransitServiceError("unexpected vehicle monitoring response");

    const now = parseTime(parsed.data.Siri.ServiceDelivery.ResponseTimestamp);
    if (!now) throw new TransitServiceError("bad ResponseTimestamp");

    const vehicles: RawVehicle[] = [];
    for (const item of parsed.data.Siri.ServiceDelivery.VehicleMonitoringDelivery[0]!.VehicleActivity ?? []) {
        const a = vehicleActivitySchema.safeParse(item);
        if (!a.success) continue;
        const j = a.data.MonitoredVehicleJourney;
        const recordedAt = parseTime(a.data.RecordedAt);
        const loc = j.VehicleLocation;
        if (!recordedAt || !loc || loc.Latitude === 0 || j.Monitored === false) continue;
        if (now.getTime() - recordedAt.getTime() > STALE_MS) continue;
        vehicles.push({
            id: a.data.VehicleMonitoringRef ?? j.FramedVehicleJourneyRef?.DatedVehicleJourneyRef ?? `${loc.Latitude},${loc.Longitude}`,
            line: normalizeLine(j.PublishedLineName),
            directionName: j.DirectionRef?.trim() || null,
            destination: (j.DestinationName ?? "").trim(),
            position: { lat: loc.Latitude, lon: loc.Longitude },
            recordedAt,
        });
    }
    return { now, vehicles };
}
