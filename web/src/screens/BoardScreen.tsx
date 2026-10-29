import type { Alert, SavedStop, Trip, TripBoard } from "@shared/api.ts";
import { Bell, Globe, X } from "lucide-react";
import { useState } from "react";
import { LanguageSheet } from "../components/LanguageSheet.tsx";
import { Minutes } from "../components/Minutes.tsx";
import { LinePlates, RoutePlate } from "../components/RoutePlate.tsx";
import { Button, ErrorNote, ListRow, SectionTitle, Skeleton } from "../components/ui.tsx";
import { errorText } from "../lib/api.ts";
import { alertText, leadOf } from "../lib/format.ts";
import { useT } from "../lib/i18n.ts";
import { useNav } from "../lib/nav.ts";
import { useBoard, useMe, useProfileMutations } from "../lib/queries.ts";
import { confirm } from "../lib/telegram.ts";

export function BoardScreen() {
    const me = useMe();
    const trips = me.data?.trips ?? [];
    const board = useBoard(trips.length > 0);
    const byTrip = new Map(board.data?.map((b) => [b.tripId, b]));
    const aliasOf = (code9: string) => me.data?.stops.find((s) => s.code9 === code9)?.alias ?? null;
    const t = useT();
    const [choosingLang, setChoosingLang] = useState(false);

    return (
        <div className="px-4 pt-6 pb-8">
            <div className="mb-4 flex items-center justify-between gap-3">
                <h1 className="text-d-lg font-bold">{t.myTrips}</h1>
                <button
                    type="button"
                    aria-label={t.language}
                    onClick={() => setChoosingLang(true)}
                    className="press grid size-11 shrink-0 place-items-center rounded-full bg-soft"
                >
                    <Globe size={19} />
                </button>
            </div>

            {me.isPending ? (
                <div className="space-y-2">
                    <Skeleton className="h-[76px]" />
                    <Skeleton className="h-[76px]" />
                </div>
            ) : me.isError ? (
                <ErrorNote text={errorText(me.error)} onRetry={() => me.refetch()} />
            ) : trips.length === 0 ? (
                <EmptyBoard />
            ) : (
                <ul className="space-y-2">
                    {trips.map((trip) => (
                        <TripCard key={trip.id} trip={trip} board={byTrip.get(trip.id)} alias={aliasOf(trip.code9)} />
                    ))}
                </ul>
            )}

            {board.isError && trips.length > 0 && <p className="mt-3 text-sm text-body">{errorText(board.error)}</p>}

            {me.data && me.data.stops.length > 0 && <SavedStops stops={me.data.stops} />}
            {me.data && me.data.alerts.length > 0 && <Alerts alerts={me.data.alerts} />}

            <LanguageSheet open={choosingLang} onClose={() => setChoosingLang(false)} chosen={me.data?.user.chosenLang ?? null} />
        </div>
    );
}

function TripCard({ trip, board, alias }: { trip: Trip; board: TripBoard | undefined; alias: string | null }) {
    const push = useNav((s) => s.push);
    const t = useT();
    const title = trip.label ?? alias ?? trip.stop.name;
    const { lead, rest } = leadOf(board?.boards ?? []);

    return (
        <li>
            <button
                type="button"
                onClick={() => push({ name: "trip", code9: trip.code9, line: trip.line })}
                className="press flex w-full items-center gap-3 rounded-2xl bg-soft px-4 py-4 text-left active:bg-pressed"
            >
                <RoutePlate line={trip.line} />
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-md font-semibold">{title}</span>
                    {title !== trip.stop.name && <span className="block truncate text-sm text-body">{trip.stop.name}</span>}
                </span>
                <span className="flex shrink-0 flex-col items-end">
                    {board === undefined ? (
                        <span className="skeleton h-7 w-14" />
                    ) : board.boards === null ? (
                        <span className="text-sm text-body">{t.noConnection}</span>
                    ) : (
                        <Minutes lead={lead} size="row" />
                    )}
                    {rest.length > 0 && <span className="tabular text-caption text-body">{t.thenList(rest.join(", "))}</span>}
                </span>
            </button>
        </li>
    );
}

function EmptyBoard() {
    const setTab = useNav((s) => s.setTab);
    const t = useT();
    return (
        <div className="rounded-2xl bg-soft p-6">
            <p className="text-d-sm font-bold">{t.emptyTitle}</p>
            <p className="mt-2 text-md text-body">{t.emptyText}</p>
            <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => setTab("nearby")}>
                    {t.stopsNearby}
                </Button>
                <Button onClick={() => setTab("search")} className="bg-canvas">
                    {t.findByName}
                </Button>
            </div>
        </div>
    );
}

function SavedStops({ stops }: { stops: SavedStop[] }) {
    const push = useNav((s) => s.push);
    const t = useT();
    return (
        <section className="mt-8">
            <SectionTitle>{t.stops}</SectionTitle>
            <ul>
                {stops.map((s, i) => (
                    <ListRow key={s.code9} first={i === 0} onClick={() => push({ name: "stop", code9: s.code9 })}>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-md font-medium">{s.alias ?? s.stop.name}</span>
                            {s.alias && <span className="block truncate text-sm text-body">{s.stop.name}</span>}
                        </span>
                        <LinePlates lines={s.stop.lines} max={3} />
                    </ListRow>
                ))}
            </ul>
        </section>
    );
}

function Alerts({ alerts }: { alerts: Alert[] }) {
    const { removeAlert } = useProfileMutations();
    const t = useT();
    return (
        <section className="mt-8">
            <SectionTitle>{t.alerts}</SectionTitle>
            <ul>
                {alerts.map((a, i) => (
                    <li key={a.id} className={`flex items-center gap-3 py-3 ${i ? "border-t border-line" : ""}`}>
                        <Bell size={18} className="shrink-0" />
                        <RoutePlate line={a.line} size="sm" />
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-md">{a.stopName}</span>
                            <span className="block text-sm text-body">{alertText(t, a)}</span>
                        </span>
                        <button
                            type="button"
                            aria-label={t.turnOff}
                            onClick={async () => (await confirm(t.confirmAlertOff)) && removeAlert.mutate([a.id])}
                            className="press grid size-9 place-items-center rounded-full bg-soft"
                        >
                            <X size={16} />
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    );
}
