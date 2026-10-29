import type {
    Alert,
    Me,
    NearbyStop,
    NewAlert,
    RouteBrief,
    RouteDetail,
    StopArrivals,
    StopInfo,
    StopWithLines,
    Trip,
    TripBoard,
    Vehicle,
} from "@shared/api.ts";
import { currentT, type Lang } from "./i18n.ts";
import { initData } from "./telegram.ts";

export class ApiError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
    ) {
        super(code);
    }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {};
    const auth = initData();
    if (auth) headers.Authorization = `tma ${auth}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) throw new ApiError(res.status, data.error ?? "internal");
    return data;
}

const q = encodeURIComponent;

export const api = {
    me: () => request<Me>("GET", "/api/me"),
    board: () => request<TripBoard[]>("GET", "/api/board"),
    search: (text: string) => request<StopWithLines[]>("GET", `/api/stops/search?q=${q(text)}`),
    nearby: (lat: number, lon: number) => request<NearbyStop[]>("GET", `/api/stops/nearby?lat=${lat}&lon=${lon}`),
    stop: (code9: string) => request<StopInfo>("GET", `/api/stops/${code9}`),
    arrivals: (code9: string) => request<StopArrivals>("GET", `/api/stops/${code9}/arrivals`),
    routes: () => request<RouteBrief[]>("GET", "/api/routes"),
    route: (line: string) => request<RouteDetail>("GET", `/api/routes/${q(line)}`),
    vehicles: (line: string) => request<Vehicle[]>("GET", `/api/vehicles?line=${q(line)}`),

    saveStop: (code9: string, alias?: string | null) => request("PUT", `/api/me/stops/${code9}`, alias === undefined ? {} : { alias }),
    removeStop: (code9: string) => request("DELETE", `/api/me/stops/${code9}`),
    addTrip: (code9: string, line: string, label?: string | null) => request<Trip>("POST", "/api/me/trips", { code9, line, label }),
    renameTrip: (id: number, label: string | null) => request("PATCH", `/api/me/trips/${id}`, { label }),
    removeTrip: (id: number) => request("DELETE", `/api/me/trips/${id}`),
    reorderTrips: (ids: number[]) => request("PUT", "/api/me/trips/order", { ids }),
    addAlert: (alert: NewAlert) => request<Alert>("POST", "/api/me/alerts", alert),
    removeAlert: (id: number) => request("DELETE", `/api/me/alerts/${id}`),
    setLang: (lang: Lang | null) => request<{ ok: true; lang: Lang }>("PUT", "/api/me/lang", { lang }),
};

export function errorText(err: unknown): string {
    const e = currentT().errors;
    if (err instanceof ApiError) {
        if (err.code === "transit_unavailable") return e.transit;
        if (err.code === "unauthorized") return e.unauthorized;
        if (err.code === "limit_trips") return e.limitTrips;
        if (err.code === "limit_stops") return e.limitStops;
        if (err.code === "limit_alerts") return e.limitAlerts;
        if (err.code === "not_found") return e.notFound;
    }
    if (err instanceof DOMException && err.name === "TimeoutError") return e.timeout;
    return e.generic;
}
