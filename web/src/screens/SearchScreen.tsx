import { Search, X } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef } from "react";
import { RoutePlate } from "../components/RoutePlate.tsx";
import { StopRow } from "../components/StopRow.tsx";
import { ErrorNote, ListRow, Skeleton } from "../components/ui.tsx";
import { errorText } from "../lib/api.ts";
import { shortPlace } from "../lib/format.ts";
import { useT } from "../lib/i18n.ts";
import { useNav } from "../lib/nav.ts";
import { useRoutes, useSearch } from "../lib/queries.ts";

const LOOKALIKES: Record<string, string> = { А: "A", В: "B", Е: "E", К: "K", М: "M", Н: "H", О: "O", Р: "P", С: "C", Т: "T", Х: "X" };
const normalizeLine = (s: string) =>
    [...s.trim().toUpperCase()]
        .map((c) => LOOKALIKES[c] ?? c)
        .join("")
        .replace(/[^0-9A-Z]/g, "");

export function SearchScreen() {
    const push = useNav((s) => s.push);
    const text = useNav((s) => s.searchText);
    const setText = useNav((s) => s.setSearchText);
    const deferred = useDeferredValue(text.trim());
    const routes = useRoutes();
    const stops = useSearch(deferred);
    const t = useT();
    const input = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (input.current && input.current.value === "") input.current.focus();
    }, []);

    const lineQuery = normalizeLine(deferred);
    const matchingRoutes = useMemo(() => {
        if (!routes.data || !lineQuery || !/^[A-Z]?\d/.test(lineQuery)) return [];
        return routes.data.filter((r) => r.number.startsWith(lineQuery)).slice(0, 6);
    }, [routes.data, lineQuery]);

    return (
        <div className="pb-8">
            <div className="sticky top-0 z-10 bg-canvas px-4 pt-6 pb-3">
                <h1 className="mb-4 text-d-lg font-bold">{t.searchTitle}</h1>
                <label className="flex h-12 items-center gap-3 rounded-full bg-soft px-4 focus-within:ring-2 focus-within:ring-ink">
                    <Search size={18} className="shrink-0" />
                    <input
                        ref={input}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={t.searchPlaceholder}
                        enterKeyHint="search"
                        className="h-full min-w-0 flex-1 bg-transparent text-md outline-none"
                    />
                    {text && (
                        <button
                            type="button"
                            aria-label={t.clear}
                            onClick={() => setText("")}
                            className="grid size-7 place-items-center rounded-full bg-pressed"
                        >
                            <X size={14} />
                        </button>
                    )}
                </label>
            </div>

            <div className="px-4">
                {matchingRoutes.length > 0 && (
                    <ul className="mb-4">
                        {matchingRoutes.map((r, i) => (
                            <ListRow key={r.number} first={i === 0} onClick={() => push({ name: "route", line: r.number })}>
                                <RoutePlate line={r.number} />
                                <span className="min-w-0 flex-1 truncate text-md">
                                    {shortPlace(r.from)} — {shortPlace(r.to)}
                                </span>
                            </ListRow>
                        ))}
                    </ul>
                )}

                {deferred.length >= 2 ? (
                    stops.isPending ? (
                        <div className="space-y-2">
                            {[0, 1, 2].map((i) => (
                                <Skeleton key={i} className="h-14" />
                            ))}
                        </div>
                    ) : stops.isError ? (
                        <ErrorNote text={errorText(stops.error)} onRetry={() => stops.refetch()} />
                    ) : stops.data.length === 0 ? (
                        matchingRoutes.length === 0 && <p className="text-md text-body">{t.nothingFound}</p>
                    ) : (
                        <ul>
                            {stops.data.map((s, i) => (
                                <StopRow key={s.code9} stop={s} first={i === 0} />
                            ))}
                        </ul>
                    )
                ) : (
                    <AllRoutes />
                )}
            </div>
        </div>
    );
}

function AllRoutes() {
    const push = useNav((s) => s.push);
    const routes = useRoutes();
    const t = useT();
    return (
        <section aria-label={t.routes}>
            <h2 className="mb-3 text-d-sm font-bold">{t.routes}</h2>
            {routes.isPending ? (
                <Skeleton className="h-40" />
            ) : routes.isError ? (
                <ErrorNote text={errorText(routes.error)} onRetry={() => routes.refetch()} />
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-2">
                    {routes.data.map((r) => (
                        <button
                            key={r.number}
                            type="button"
                            onClick={() => push({ name: "route", line: r.number })}
                            className="press"
                            aria-label={t.route(r.number)}
                        >
                            <RoutePlate line={r.number} className="w-full" />
                        </button>
                    ))}
                </div>
            )}
        </section>
    );
}
