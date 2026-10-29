import { formatDistance } from "@shared/i18n.ts";
import { useQuery } from "@tanstack/react-query";
import { LocateFixed } from "lucide-react";
import { useMemo } from "react";
import { LazyMap } from "../components/LazyMap.tsx";
import { StopRow } from "../components/StopRow.tsx";
import type { MapStop } from "../components/TransitMap.tsx";
import { Button, ErrorNote, Skeleton } from "../components/ui.tsx";
import { api, errorText } from "../lib/api.ts";
import { useLang, useT } from "../lib/i18n.ts";
import { useNav } from "../lib/nav.ts";
import { inTelegram, locate, openLocationSettings } from "../lib/telegram.ts";

export function NearbyScreen() {
    const push = useNav((s) => s.push);
    const setTab = useNav((s) => s.setTab);
    const t = useT();
    const lang = useLang();
    const where = useQuery({ queryKey: ["location"], queryFn: locate, staleTime: 60_000, retry: false });
    const near = useQuery({
        queryKey: ["nearby", where.data?.lat.toFixed(4), where.data?.lon.toFixed(4)],
        queryFn: () => api.nearby(where.data!.lat, where.data!.lon),
        enabled: Boolean(where.data),
        staleTime: 5 * 60_000,
    });

    const stops = useMemo<MapStop[]>(
        () => (near.data ?? []).map((s) => ({ code9: s.code9, lat: s.lat, lon: s.lon, kind: "normal" })),
        [near.data],
    );
    const fit = useMemo(() => (where.data ? [where.data, ...(near.data ?? []).slice(0, 4)] : undefined), [where.data, near.data]);
    const denied = where.error instanceof Error && where.error.message === "denied";

    return (
        <div className="px-4 pt-6 pb-8">
            <div className="mb-4 flex items-center justify-between">
                <h1 className="text-d-lg font-bold">{t.nearbyTitle}</h1>
                {where.data && (
                    <button
                        type="button"
                        aria-label={t.updateLocation}
                        onClick={() => where.refetch()}
                        className="press grid size-11 place-items-center rounded-full bg-soft"
                    >
                        <LocateFixed size={19} className={where.isFetching ? "animate-pulse" : ""} />
                    </button>
                )}
            </div>

            {where.isError ? (
                <div className="rounded-2xl bg-soft p-6">
                    <p className="text-d-sm font-bold">{denied ? t.noLocationAccess : t.locationFailed}</p>
                    <p className="mt-2 text-md text-body">{denied ? t.noLocationAccessText : t.locationFailedText}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                        <Button variant="primary" onClick={() => (denied && inTelegram ? openLocationSettings() : where.refetch())}>
                            {denied && inTelegram ? t.openSettings : t.tryAgain}
                        </Button>
                        <Button onClick={() => setTab("search")} className="bg-canvas">
                            {t.findByName}
                        </Button>
                    </div>
                </div>
            ) : (
                <>
                    <LazyMap
                        className="h-[240px] rounded-2xl"
                        me={where.data ?? null}
                        stops={stops}
                        fit={fit}
                        fitKey={`${where.dataUpdatedAt}-${near.data?.length ?? 0}`}
                        onStopClick={(code9) => push({ name: "stop", code9 })}
                    />

                    <section className="mt-4">
                        {where.isPending || near.isPending ? (
                            <div className="space-y-2">
                                {[0, 1, 2, 3].map((i) => (
                                    <Skeleton key={i} className="h-14" />
                                ))}
                            </div>
                        ) : near.isError ? (
                            <ErrorNote text={errorText(near.error)} onRetry={() => near.refetch()} />
                        ) : near.data.length === 0 ? (
                            <p className="rounded-2xl bg-soft p-4 text-md text-body">{t.noStopsNearby}</p>
                        ) : (
                            <ul>
                                {near.data.map((s, i) => (
                                    <StopRow key={s.code9} stop={s} first={i === 0} meta={formatDistance(lang, s.distanceM)} />
                                ))}
                            </ul>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}
