import { z } from "zod";
import type { Me, StopInfo, TripBoard } from "../../shared/api.ts";
import { log } from "../log.ts";
import { LimitError, NotFoundError, type UserStore } from "../store/users.ts";
import { TransitServiceError } from "../transit/live.ts";
import type { TransitService } from "../transit/service.ts";
import { normalizeLine } from "../transit/text.ts";
import { type TgUser, verifyInitData } from "./auth.ts";
import { StaticFiles } from "./static.ts";

export type ApiDeps = {
    botToken: string;
    store: UserStore;
    transit: TransitService;
    staticDir: string;
    devUserId?: number;

    onTripsChanged?: (userId: number) => void;
};

class HttpError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
    ) {
        super(code);
    }
}

type Handler = (ctx: { req: Request; url: URL; params: string[]; user: TgUser }) => unknown | Promise<unknown>;

const code9Param = z.string().regex(/^\d{9}$/);
const lineParam = z
    .string()
    .min(1)
    .max(8)
    .transform(normalizeLine)
    .pipe(z.string().regex(/^[0-9A-Z]{1,6}$/));

const bodies = {
    stop: z.object({ alias: z.string().max(64).nullable().optional() }),
    trip: z.object({ code9: code9Param, line: lineParam, label: z.string().max(64).nullable().optional() }),
    rename: z.object({ label: z.string().max(64).nullable() }),
    order: z.object({ ids: z.array(z.number().int()).max(50) }),
    lang: z.object({ lang: z.enum(["az", "ru", "en"]).nullable() }),
    alert: z
        .object({
            code9: code9Param,
            line: lineParam,
            thresholdMin: z.number().int().min(1).max(30),
            kind: z.enum(["once", "daily"]),
            days: z.number().int().min(1).max(127).optional(),
            fromMin: z.number().int().min(0).max(1439).optional(),
            toMin: z.number().int().min(1).max(1440).optional(),
        })
        .refine((a) => a.kind === "once" || (a.fromMin ?? 0) < (a.toMin ?? 1440), "window"),
};

async function readBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
    const parsed = schema.safeParse(await req.json().catch(() => undefined));
    if (!parsed.success) throw new HttpError(400, "bad_request");
    return parsed.data;
}

export function createApp(deps: ApiDeps): (req: Request) => Promise<Response> {
    const { store, transit } = deps;
    const directory = transit.directory;
    const files = new StaticFiles(deps.staticDir);
    const routes: Array<{ method: string; pattern: RegExp; handler: Handler }> = [];
    const on = (method: string, path: string, handler: Handler) => {
        const pattern = new RegExp(`^${path.replace(/:\w+/g, "([^/]+)")}$`);
        routes.push({ method, pattern, handler });
    };

    const changedTrips = (userId: number) => deps.onTripsChanged?.(userId);

    on(
        "GET",
        "/api/me",
        ({ user }): Me => ({
            user: { id: user.id, firstName: user.firstName, lang: store.lang(user.id), chosenLang: store.chosenLang(user.id) },
            trips: store.trips(user.id),
            stops: store.stops(user.id),
            alerts: store.alerts(user.id),
        }),
    );

    on("GET", "/api/board", async ({ user }): Promise<TripBoard[]> => {
        const trips = store.trips(user.id);
        const byStop = new Map<string, Promise<{ now: string; lines: TripBoard["boards"] } | null>>();
        for (const t of trips)
            if (!byStop.has(t.code9))
                byStop.set(
                    t.code9,
                    transit.arrivals(t.code9).catch(() => null),
                );
        return Promise.all(
            trips.map(async (t) => {
                const data = await byStop.get(t.code9)!;
                return { tripId: t.id, now: data?.now ?? null, boards: data?.lines?.filter((l) => l.line === t.line) ?? null };
            }),
        );
    });

    on("PUT", "/api/me/stops/:code9", async ({ req, params, user }) => {
        const { alias } = await readBody(req, bodies.stop);
        const code9 = code9Param.parse(params[0]);
        store.saveStop(user.id, code9, alias);
        if (alias !== undefined && store.trips(user.id).some((t) => t.code9 === code9)) changedTrips(user.id);
        return { ok: true };
    });

    on("DELETE", "/api/me/stops/:code9", ({ params, user }) => {
        store.removeStop(user.id, code9Param.parse(params[0]));
        return { ok: true };
    });

    on("POST", "/api/me/trips", async ({ req, user }) => {
        const body = await readBody(req, bodies.trip);
        const trip = store.addTrip(user.id, body.code9, body.line, body.label);
        changedTrips(user.id);
        return trip;
    });

    on("PATCH", "/api/me/trips/:id", async ({ req, params, user }) => {
        const { label } = await readBody(req, bodies.rename);
        store.renameTrip(user.id, Number(params[0]), label);
        changedTrips(user.id);
        return { ok: true };
    });

    on("DELETE", "/api/me/trips/:id", ({ params, user }) => {
        store.removeTrip(user.id, Number(params[0]));
        changedTrips(user.id);
        return { ok: true };
    });

    on("PUT", "/api/me/trips/order", async ({ req, user }) => {
        const { ids } = await readBody(req, bodies.order);
        store.reorderTrips(user.id, ids);
        changedTrips(user.id);
        return { ok: true };
    });

    on("PUT", "/api/me/lang", async ({ req, user }) => {
        const { lang } = await readBody(req, bodies.lang);
        const before = store.lang(user.id);
        store.setLang(user.id, lang);
        if (store.lang(user.id) !== before && store.trips(user.id).length > 1) changedTrips(user.id);
        return { ok: true, lang: store.lang(user.id) };
    });

    on("POST", "/api/me/alerts", async ({ req, user }) => store.addAlert(user.id, await readBody(req, bodies.alert)));

    on("DELETE", "/api/me/alerts/:id", ({ params, user }) => {
        store.removeAlert(user.id, Number(params[0]));
        return { ok: true };
    });

    on("GET", "/api/stops/search", ({ url }) => directory.searchStops(url.searchParams.get("q") ?? "", 30));

    on("GET", "/api/stops/nearby", ({ url }) => {
        const lat = Number(url.searchParams.get("lat"));
        const lon = Number(url.searchParams.get("lon"));
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new HttpError(400, "bad_request");
        return directory.nearby({ lat, lon }, 20, 1000);
    });

    on("GET", "/api/stops/:code9", ({ params }): StopInfo => {
        const stop = directory.stopWithLines(code9Param.parse(params[0]));
        if (!stop) throw new HttpError(404, "not_found");
        return { stop, lines: stop.lines.map((line) => ({ line, towards: directory.directionsAt(line, stop.code9).map((d) => d.to) })) };
    });

    on("GET", "/api/stops/:code9/arrivals", ({ params }) => transit.arrivals(code9Param.parse(params[0])));

    on("GET", "/api/routes", () => directory.routeList());

    on("GET", "/api/routes/:line", ({ params }) => {
        const route = directory.route(lineParam.parse(decodeURIComponent(params[0]!)));
        if (!route) throw new HttpError(404, "not_found");
        return route;
    });

    on("GET", "/api/vehicles", ({ url }) => transit.vehicles(lineParam.parse(url.searchParams.get("line") ?? "")));

    on("GET", "/api/health", () => ({ ok: true, stops: directory.stopCount, routes: directory.routeCount }));

    const authenticate = (req: Request): TgUser => {
        const header = req.headers.get("authorization") ?? "";
        if (header.startsWith("tma ")) {
            const user = verifyInitData(header.slice(4), deps.botToken);
            if (user) return user;
        } else if (deps.devUserId) {
            return { id: deps.devUserId, firstName: "Dev", username: null };
        }
        throw new HttpError(401, "unauthorized");
    };

    return async (req) => {
        const url = new URL(req.url);
        if (!url.pathname.startsWith("/api/")) return files.serve(req, url);

        const started = performance.now();
        try {
            const route = routes.find((r) => r.method === req.method && r.pattern.test(url.pathname));
            if (!route) throw new HttpError(404, "not_found");
            const params = route.pattern.exec(url.pathname)!.slice(1);
            const user = url.pathname === "/api/health" ? { id: 0, firstName: "", username: null } : authenticate(req);
            if (user.id) store.touchUser(user);
            const result = await route.handler({ req, url, params, user });
            return json(req, result ?? { ok: true }, 200);
        } catch (err) {
            const [status, code] =
                err instanceof HttpError
                    ? [err.status, err.code]
                    : err instanceof z.ZodError
                      ? [400, "bad_request"]
                      : err instanceof TransitServiceError
                        ? [503, "transit_unavailable"]
                        : err instanceof LimitError
                          ? [409, `limit_${err.message}`]
                          : err instanceof NotFoundError
                            ? [404, "not_found"]
                            : [500, "internal"];
            if (status === 500) log.error("api handler failed", { path: url.pathname, err });
            return json(req, { error: code }, status);
        } finally {
            log.debug("api", { method: req.method, path: url.pathname, ms: Math.round(performance.now() - started) });
        }
    };
}

function json(req: Request, data: unknown, status: number): Response {
    const body = JSON.stringify(data);
    const headers: Record<string, string> = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
    if (body.length > 2048 && (req.headers.get("accept-encoding") ?? "").includes("gzip")) {
        headers["Content-Encoding"] = "gzip";
        return new Response(Bun.gzipSync(body), { status, headers });
    }
    return new Response(body, { status, headers });
}
