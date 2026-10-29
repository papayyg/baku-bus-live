import type { LineBoard, LiveArrival } from "@shared/api.ts";
import { formatDistance } from "@shared/i18n.ts";
import { Bell, Check, X } from "lucide-react";
import { useMemo, useState } from "react";
import { AlertSheet } from "../components/AlertSheet.tsx";
import { LazyMap } from "../components/LazyMap.tsx";
import { Minutes } from "../components/Minutes.tsx";
import { NameSheet } from "../components/NameSheet.tsx";
import { RoutePlate } from "../components/RoutePlate.tsx";
import type { MapBus, MapPath, MapStop } from "../components/TransitMap.tsx";
import { Button, ErrorNote, ListRow, Skeleton } from "../components/ui.tsx";
import { errorText } from "../lib/api.ts";
import { alertText, formatTime, type Lead, leadOf } from "../lib/format.ts";
import { useLang, useT } from "../lib/i18n.ts";
import { useNav } from "../lib/nav.ts";
import { savedState, useArrivals, useMe, useProfileMutations, useRoute, useStopInfo, useVehicles } from "../lib/queries.ts";
import { confirm } from "../lib/telegram.ts";

export function TripScreen({ code9, line }: { code9: string; line: string }) {
    const push = useNav((s) => s.push);
    const info = useStopInfo(code9);
    const arrivals = useArrivals(code9);
    const route = useRoute(line);
    const vehicles = useVehicles(line);
    const me = useMe();
    const m = useProfileMutations();
    const saved = savedState(me.data, code9, line);
    const [alerting, setAlerting] = useState(false);
    const [naming, setNaming] = useState(false);
    const t = useT();

    const stop = info.data?.stop;
    const boards = useMemo(() => arrivals.data?.lines.filter((b) => b.line === line) ?? [], [arrivals.data, line]);
    const dir = boards.find((b) => b.dir)?.dir ?? route.data?.directions.find((d) => d.stops.some((s) => s.code9 === code9))?.dir ?? null;
    const direction = route.data?.directions.find((d) => d.dir === dir);
    const { lead, first } = leadOf(boards);
    const title = saved.trip?.label ?? saved.alias ?? stop?.name ?? "";

    const paths = useMemo<MapPath[]>(
        () =>
            (route.data?.directions ?? []).map((d) => ({
                id: String(d.dir),
                coords: d.path,
                tone: d.dir === dir || dir === null ? "main" : "faint",
            })),
        [route.data, dir],
    );
    const mapStops = useMemo<MapStop[]>(() => {
        const list: MapStop[] = (direction?.stops ?? [])
            .filter((s) => s.code9 !== code9)
            .map((s) => ({ code9: s.code9, lat: s.lat, lon: s.lon, kind: "small" }));
        if (stop) list.push({ code9, lat: stop.lat, lon: stop.lon, kind: "target" });
        return list;
    }, [direction, stop, code9]);
    const buses = useMemo<MapBus[]>(
        () =>
            (vehicles.data ?? []).map((v) => ({
                id: v.id,
                lat: v.lat,
                lon: v.lon,
                line: v.line,
                heading: v.heading,
                dim: dir !== null && v.dir !== null && v.dir !== dir,
            })),
        [vehicles.data, dir],
    );
    const fit = useMemo(() => {
        if (!stop) return undefined;
        const pos = first?.position;
        return pos ? [stop, pos] : [stop];
    }, [stop, first]);

    return (
        <div className="pb-10">
            <LazyMap
                className="h-[36vh] min-h-[220px]"
                paths={paths}
                stops={mapStops}
                buses={buses}
                fit={fit}
                fitKey={`${code9}-${line}-${first?.position ? first.journeyId : "none"}`}
                onStopClick={(c) => push({ name: "trip", code9: c, line })}
            />

            <div className="relative z-10 -mt-4 rounded-t-2xl bg-canvas px-4 pt-5">
                <div className="flex items-center gap-3">
                    <RoutePlate line={line} size="lg" />
                    <button type="button" onClick={() => push({ name: "stop", code9 })} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-d-sm font-bold">{title || "…"}</span>
                        {title !== stop?.name && stop && <span className="block truncate text-sm text-body">{stop.name}</span>}
                    </button>
                </div>

                <section className="mt-6">
                    {arrivals.isPending ? (
                        <Skeleton className="h-16 w-44" />
                    ) : arrivals.isError && !arrivals.data ? (
                        <ErrorNote text={errorText(arrivals.error)} onRetry={() => arrivals.refetch()} />
                    ) : (
                        <>
                            <Minutes lead={lead} size="hero" />
                            <Detail first={first} lead={lead} />
                            <Next boards={boards} />
                        </>
                    )}
                </section>

                <div className="mt-7 flex gap-2">
                    {saved.trip ? (
                        <Button icon={<Check size={18} />} className="flex-1" onClick={() => setNaming(true)}>
                            {t.saved}
                        </Button>
                    ) : (
                        <Button
                            variant="primary"
                            className="flex-1"
                            busy={m.addTrip.isPending}
                            onClick={() => m.addTrip.mutate([code9, line])}
                        >
                            {t.saveTrip}
                        </Button>
                    )}
                    <Button icon={<Bell size={18} />} onClick={() => setAlerting(true)}>
                        {t.notify}
                    </Button>
                </div>
                {m.addTrip.isError && <p className="mt-2 text-sm text-body">{errorText(m.addTrip.error)}</p>}
                {saved.trip && (
                    <button
                        type="button"
                        onClick={async () => (await confirm(t.confirmRemoveTrip(line))) && m.removeTrip.mutate([saved.trip!.id])}
                        className="mt-3 text-sm text-body underline underline-offset-4"
                    >
                        {t.removeFromTrips}
                    </button>
                )}

                {saved.alerts.length > 0 && (
                    <ul className="mt-5">
                        {saved.alerts.map((a, i) => (
                            <li key={a.id} className={`flex items-center gap-3 py-3 ${i ? "border-t border-line" : ""}`}>
                                <Bell size={18} className="shrink-0" />
                                <span className="flex-1 text-sm first-letter:uppercase">{alertText(t, a)}</span>
                                <button
                                    type="button"
                                    aria-label={t.turnOff}
                                    onClick={() => m.removeAlert.mutate([a.id])}
                                    className="press grid size-9 place-items-center rounded-full bg-soft"
                                >
                                    <X size={16} />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                <ul className="mt-6 border-t border-line">
                    <ListRow first onClick={() => push({ name: "route", line, dir: dir ?? undefined })}>
                        <span className="flex-1 text-md font-medium">{t.fullRoute(line)}</span>
                    </ListRow>
                </ul>
            </div>

            <AlertSheet
                open={alerting}
                onClose={() => setAlerting(false)}
                code9={code9}
                line={line}
                busy={m.addAlert.isPending}
                onCreate={(alert) => m.addAlert.mutate([alert], { onSuccess: () => setAlerting(false) })}
            />
            <NameSheet
                open={naming}
                onClose={() => setNaming(false)}
                title={t.tripName}
                initial={saved.trip?.label ?? ""}
                placeholder={saved.alias ?? stop?.name ?? ""}
                onSave={(label) => saved.trip && m.renameTrip.mutate([saved.trip.id, label])}
            />
        </div>
    );
}

function Detail({ first, lead }: { first: LiveArrival | null; lead: Lead }) {
    const t = useT();
    const lang = useLang();
    let text: string | null = null;
    if (lead.kind === "terminal") text = t.waitingAtTerminus;
    else if (lead.kind === "scheduled") text = t.scheduled;
    else if (first && !first.atStop && first.etaMin > 0) {
        text = first.stopsAway !== null ? t.stopsAway(first.stopsAway) : first.distanceM ? formatDistance(lang, first.distanceM) : null;
    }
    if (!text) return null;
    return <p className="mt-1 text-md text-body">{text}</p>;
}

function Next({ boards }: { boards: LineBoard[] }) {
    const t = useT();
    const live = boards
        .flatMap((b) => b.live)
        .filter((a) => !a.terminal)
        .sort((x, y) => x.at.localeCompare(y.at));
    const items = [
        ...live.slice(1, 7).map((a) => ({ key: a.journeyId ?? a.at, text: a.atStop ? t.hereRow : `${a.etaMin} ${t.min}` })),
        ...boards
            .flatMap((b) => b.scheduled)
            .sort((x, y) => x.at.localeCompare(y.at))
            .slice(live.length ? 0 : 1, 2)
            .map((s) => ({ key: s.at, text: formatTime(s.at) })),
    ].slice(0, 6);
    if (items.length === 0) return null;
    return (
        <div className="mt-5">
            <p className="mb-2 text-sm text-body">{t.next}</p>
            <div className="flex flex-wrap gap-2">
                {items.map((i) => (
                    <span key={i.key} className="tabular inline-flex h-9 items-center rounded-full bg-soft px-4 text-md font-medium">
                        {i.text}
                    </span>
                ))}
            </div>
        </div>
    );
}
