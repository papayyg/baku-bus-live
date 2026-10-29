import { ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { LazyMap } from "../components/LazyMap.tsx";
import { RoutePlate } from "../components/RoutePlate.tsx";
import type { MapBus, MapPath, MapStop } from "../components/TransitMap.tsx";
import { ErrorNote, Skeleton } from "../components/ui.tsx";
import { errorText } from "../lib/api.ts";
import { shortPlace } from "../lib/format.ts";
import { useT } from "../lib/i18n.ts";
import { useNav } from "../lib/nav.ts";
import { useMe, useRoute, useVehicles } from "../lib/queries.ts";
import { haptic } from "../lib/telegram.ts";

export function RouteScreen({ line, dir: initialDir }: { line: string; dir?: 1 | 2 }) {
    const push = useNav((s) => s.push);
    const route = useRoute(line);
    const vehicles = useVehicles(line);
    const me = useMe();
    const [dir, setDir] = useState<1 | 2 | undefined>(initialDir);
    const t = useT();
    const directions = route.data?.directions ?? [];
    const current = directions.find((d) => d.dir === dir) ?? directions[0];
    const savedCodes = new Set(me.data?.stops.map((s) => s.code9));

    const paths = useMemo<MapPath[]>(
        () => directions.map((d) => ({ id: String(d.dir), coords: d.path, tone: d.dir === current?.dir ? "main" : "faint" })),
        [directions, current],
    );
    const stops = useMemo<MapStop[]>(
        () => (current?.stops ?? []).map((s) => ({ code9: s.code9, lat: s.lat, lon: s.lon, kind: "small" })),
        [current],
    );
    const onDir = (vehicles.data ?? []).filter((v) => v.dir === current?.dir || v.dir === null).length;
    const buses = useMemo<MapBus[]>(
        () =>
            (vehicles.data ?? []).map((v) => ({
                id: v.id,
                lat: v.lat,
                lon: v.lon,
                line: v.line,
                heading: v.heading,
                dim: v.dir !== null && v.dir !== current?.dir,
            })),
        [vehicles.data, current],
    );
    const fit = useMemo(() => current?.path.map(([lon, lat]) => ({ lat, lon })), [current]);
    const keyedStops = useMemo(() => {
        const seen = new Map<string, number>();
        return (current?.stops ?? []).map((stop) => {
            const n = seen.get(stop.code9) ?? 0;
            seen.set(stop.code9, n + 1);
            return { stop, key: `${stop.code9}-${n}` };
        });
    }, [current]);

    if (route.isError)
        return (
            <div className="p-4">
                <ErrorNote text={errorText(route.error)} onRetry={() => route.refetch()} />
            </div>
        );

    return (
        <div className="pb-10">
            <LazyMap
                className="h-[36vh] min-h-[220px]"
                paths={paths}
                stops={stops}
                buses={buses}
                fit={fit}
                fitKey={`${line}-${current?.dir}`}
                onStopClick={(code9) => push({ name: "trip", code9, line })}
            />

            <div className="relative z-10 -mt-4 rounded-t-2xl bg-canvas px-4 pt-5">
                <div className="flex items-center gap-3">
                    <RoutePlate line={line} size="lg" />
                    <div className="min-w-0 flex-1">
                        {current ? (
                            <>
                                <p className="truncate text-d-sm font-bold">{t.routeTo(shortPlace(current.to))}</p>
                                <p className="truncate text-sm text-body">
                                    {vehicles.data ? (onDir ? t.busesOnRoute(onDir) : t.noBusesOnRoute) : t.lookingForBuses}
                                </p>
                            </>
                        ) : (
                            <Skeleton className="h-10 w-3/4" />
                        )}
                    </div>
                    {directions.length > 1 && (
                        <button
                            type="button"
                            aria-label={t.oppositeDirection}
                            onClick={() => {
                                haptic.select();
                                setDir(current?.dir === 1 ? 2 : 1);
                            }}
                            className="press grid size-11 shrink-0 place-items-center rounded-full bg-soft"
                        >
                            <ArrowUpDown size={18} />
                        </button>
                    )}
                </div>

                {route.data && (route.data.tariff || route.data.durationMin) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {route.data.tariff && (
                            <span className="inline-flex h-8 items-center rounded-full bg-soft px-3 text-sm">{route.data.tariff}</span>
                        )}
                        {route.data.durationMin && (
                            <span className="inline-flex h-8 items-center rounded-full bg-soft px-3 text-sm">
                                {t.tripDuration(route.data.durationMin)}
                            </span>
                        )}
                    </div>
                )}

                <ol className="mt-5">
                    {keyedStops.map(({ stop: s, key }, i, all) => {
                        const end = i === 0 || i === all.length - 1;
                        return (
                            <li key={key}>
                                <button
                                    type="button"
                                    onClick={() => push({ name: "trip", code9: s.code9, line })}
                                    className="press flex w-full items-stretch gap-3 text-left"
                                >
                                    <span className="relative flex w-4 shrink-0 justify-center" aria-hidden>
                                        <span
                                            className={`absolute w-0.5 bg-ink ${i === 0 ? "top-1/2" : "top-0"} ${i === all.length - 1 ? "bottom-1/2" : "bottom-0"}`}
                                        />
                                        <span
                                            className={`relative z-10 self-center rounded-full ${end ? "size-3 bg-ink" : "size-2 bg-canvas ring-2 ring-ink"}`}
                                        />
                                    </span>
                                    <span className="flex min-w-0 flex-1 items-center gap-2 py-3">
                                        <span className={`truncate text-md ${end ? "font-semibold" : ""}`}>{s.name}</span>
                                        {savedCodes.has(s.code9) && (
                                            <span className="shrink-0 rounded-full bg-soft px-2 py-0.5 text-caption font-medium">
                                                {t.mine}
                                            </span>
                                        )}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ol>
            </div>
        </div>
    );
}
