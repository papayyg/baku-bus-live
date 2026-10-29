import type { LineBoard } from "@shared/api.ts";
import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { LazyMap } from "../components/LazyMap.tsx";
import { Minutes } from "../components/Minutes.tsx";
import { NameSheet } from "../components/NameSheet.tsx";
import { RoutePlate } from "../components/RoutePlate.tsx";
import { Button, ErrorNote, ListRow, Skeleton } from "../components/ui.tsx";
import { errorText } from "../lib/api.ts";
import { leadOf } from "../lib/format.ts";
import { useT } from "../lib/i18n.ts";
import { useNav } from "../lib/nav.ts";
import { savedState, useArrivals, useMe, useProfileMutations, useStopInfo } from "../lib/queries.ts";
import { confirm } from "../lib/telegram.ts";

export function StopScreen({ code9 }: { code9: string }) {
    const push = useNav((s) => s.push);
    const info = useStopInfo(code9);
    const arrivals = useArrivals(code9);
    const me = useMe();
    const { saveStop, removeStop } = useProfileMutations();
    const [naming, setNaming] = useState(false);
    const t = useT();
    const saved = savedState(me.data, code9);
    const stop = info.data?.stop;

    const lines = useMemo(() => {
        const byLine = new Map<string, LineBoard[]>();
        for (const b of arrivals.data?.lines ?? []) byLine.set(b.line, [...(byLine.get(b.line) ?? []), b]);
        return [...byLine];
    }, [arrivals.data]);
    const visible = new Set(lines.map(([l]) => l));
    const quiet = (stop?.lines ?? []).filter((l) => !visible.has(l));

    const buses = useMemo(
        () =>
            (arrivals.data?.lines ?? []).flatMap((b) =>
                b.live
                    .filter((a) => a.position && !a.terminal)
                    .map((a, i) => ({
                        id: `${b.line}-${a.journeyId ?? i}`,
                        lat: a.position!.lat,
                        lon: a.position!.lon,
                        line: b.line,
                        heading: null,
                    })),
            ),
        [arrivals.data],
    );
    const mapStops = useMemo(() => (stop ? [{ code9, lat: stop.lat, lon: stop.lon, kind: "target" as const }] : []), [stop, code9]);
    const fit = useMemo(() => {
        if (!stop) return undefined;
        const near = [...buses].sort((a, b) => dist(a, stop) - dist(b, stop)).slice(0, 3);
        return [stop, ...near];
    }, [stop, buses]);

    if (info.isError)
        return (
            <div className="p-4">
                <ErrorNote text={errorText(info.error)} onRetry={() => info.refetch()} />
            </div>
        );

    return (
        <div className="pb-10">
            <LazyMap className="h-[30vh] min-h-[200px]" stops={mapStops} buses={buses} fit={fit} fitKey={`${code9}-${buses.length > 0}`} />

            <div className="relative z-10 -mt-4 rounded-t-2xl bg-canvas px-4 pt-5">
                {stop ? (
                    <>
                        <h1 className="text-d-md font-bold text-balance">{saved.alias ?? stop.name}</h1>
                        {saved.alias && <p className="mt-0.5 text-sm text-body">{stop.name}</p>}
                    </>
                ) : (
                    <Skeleton className="h-8 w-3/4" />
                )}

                <div className="mt-4 flex gap-2">
                    {saved.stop ? (
                        <>
                            <Button
                                icon={<Check size={18} />}
                                onClick={async () => (await confirm(t.confirmRemoveStop)) && removeStop.mutate([code9])}
                            >
                                {t.stopSaved}
                            </Button>
                            <Button onClick={() => setNaming(true)}>{saved.alias ? t.rename : t.giveName}</Button>
                        </>
                    ) : (
                        <Button variant="primary" busy={saveStop.isPending} onClick={() => saveStop.mutate([code9])}>
                            {t.saveStop}
                        </Button>
                    )}
                </div>

                <section className="mt-7">
                    {arrivals.isPending ? (
                        <div className="space-y-2">
                            {[0, 1, 2].map((i) => (
                                <Skeleton key={i} className="h-12" />
                            ))}
                        </div>
                    ) : arrivals.isError && !arrivals.data ? (
                        <ErrorNote text={errorText(arrivals.error)} onRetry={() => arrivals.refetch()} />
                    ) : lines.length === 0 ? (
                        <p className="rounded-2xl bg-soft p-4 text-md text-body">{t.noBusesToStop}</p>
                    ) : (
                        <ul>
                            {lines.map(([line, boards], i) => (
                                <LineRow
                                    key={line}
                                    line={line}
                                    boards={boards}
                                    first={i === 0}
                                    onClick={() => push({ name: "trip", code9, line })}
                                />
                            ))}
                        </ul>
                    )}

                    {quiet.length > 0 && arrivals.data && (
                        <div className="mt-6">
                            <p className="mb-2 text-sm text-body">{t.notRunningNow}</p>
                            <div className="flex flex-wrap gap-1.5">
                                {quiet.map((l) => (
                                    <button
                                        key={l}
                                        type="button"
                                        onClick={() => push({ name: "trip", code9, line: l })}
                                        className="press"
                                        aria-label={t.route(l)}
                                    >
                                        <RoutePlate line={l} size="sm" dim />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </section>
            </div>

            <NameSheet
                open={naming}
                onClose={() => setNaming(false)}
                title={t.stopName}
                initial={saved.alias ?? ""}
                placeholder={stop?.name ?? ""}
                onSave={(alias) => saveStop.mutate([code9, alias])}
            />
        </div>
    );
}

function LineRow({ line, boards, first, onClick }: { line: string; boards: LineBoard[]; first: boolean; onClick: () => void }) {
    const { lead, rest } = leadOf(boards);
    const t = useT();
    return (
        <ListRow first={first} onClick={onClick} chevron={false}>
            <RoutePlate line={line} dim={boards.every((b) => b.live.length === 0)} />
            <span className="flex-1" />
            {rest.length > 0 && <span className="tabular text-sm text-body">{t.thenList(rest.slice(0, 2).join(", "))}</span>}
            <span className="w-[76px] text-right">
                <Minutes lead={lead} size="row" />
            </span>
        </ListRow>
    );
}

const dist = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => (a.lat - b.lat) ** 2 + (a.lon - b.lon) ** 2;
