import type { Lang } from "./i18n.ts";

export type LatLon = { lat: number; lon: number };

export type Stop = {
    code9: string;
    name: string;
    lat: number;
    lon: number;
};

export type StopWithLines = Stop & {
    lines: string[];

    towards: string[];
};

export type NearbyStop = StopWithLines & { distanceM: number };

export type StopInfo = {
    stop: StopWithLines;

    lines: Array<{ line: string; towards: string[] }>;
};

export type Occupancy = "free" | "standing" | "full";

export type LiveArrival = {
    kind: "live";

    at: string;
    etaMin: number;
    atStop: boolean;

    terminal: boolean;
    distanceM: number | null;

    delayMin: number | null;
    occupancy: Occupancy | null;
    position: LatLon | null;
    journeyId: string | null;

    stopsAway: number | null;
};

export type ScheduledArrival = { kind: "scheduled"; at: string; etaMin: number };

export type LineBoard = {
    line: string;
    destination: string;

    dir: 1 | 2 | null;
    live: LiveArrival[];
    scheduled: ScheduledArrival[];
};

export type StopArrivals = {
    code9: string;

    now: string;
    lines: LineBoard[];
};

export type RouteBrief = {
    number: string;
    from: string;
    to: string;
};

export type RouteDirection = {
    dir: 1 | 2;

    name: string;

    to: string;
    stops: Stop[];

    path: [number, number][];
};

export type RouteDetail = RouteBrief & {
    carrier: string | null;
    tariff: string | null;
    lengthKm: number | null;
    durationMin: number | null;
    directions: RouteDirection[];
};

export type Vehicle = {
    id: string;
    line: string;
    dir: 1 | 2 | null;
    destination: string;
    lat: number;
    lon: number;

    heading: number | null;
    recordedAt: string;
};

export type SavedStop = {
    code9: string;
    alias: string | null;
    stop: StopWithLines;
};

export type Trip = {
    id: number;
    code9: string;
    line: string;
    label: string | null;
    stop: Stop;

    towards: string | null;
};

export type AlertKind = "once" | "daily";

export type Alert = {
    id: number;
    code9: string;
    line: string;
    stopName: string;
    thresholdMin: number;
    kind: AlertKind;

    days: number;

    fromMin: number;
    toMin: number;

    expiresAt: string | null;
    active: boolean;
};

export type Me = {
    user: {
        id: number;
        firstName: string;

        lang: Lang;

        chosenLang: Lang | null;
    };
    trips: Trip[];
    stops: SavedStop[];
    alerts: Alert[];
};

export type TripBoard = {
    tripId: number;

    boards: LineBoard[] | null;
    now: string | null;
};

export type NewAlert = {
    code9: string;
    line: string;
    thresholdMin: number;
    kind: AlertKind;
    days?: number;
    fromMin?: number;
    toMin?: number;
};

export type ApiError = { error: string };
