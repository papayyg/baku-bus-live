import type { Me, NewAlert } from "@shared/api.ts";
import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api.ts";
import { type Lang, setLang } from "./i18n.ts";
import { haptic } from "./telegram.ts";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            refetchOnWindowFocus: true,
            staleTime: 10_000,
        },
    },
});

const LIVE_MS = 15_000;

export const useMe = () =>
    useQuery({
        queryKey: ["me"],
        queryFn: async () => {
            const me = await api.me();
            setLang(me.user.lang);
            return me;
        },
        staleTime: 60_000,
    });

export const useBoard = (enabled = true) => useQuery({ queryKey: ["board"], queryFn: api.board, refetchInterval: LIVE_MS, enabled });

export const useArrivals = (code9: string) =>
    useQuery({ queryKey: ["arrivals", code9], queryFn: () => api.arrivals(code9), refetchInterval: LIVE_MS });

export const useStopInfo = (code9: string) =>
    useQuery({ queryKey: ["stop", code9], queryFn: () => api.stop(code9), staleTime: 60 * 60_000 });

export const useRoutes = () => useQuery({ queryKey: ["routes"], queryFn: api.routes, staleTime: 60 * 60_000 });

export const useRoute = (line: string) => useQuery({ queryKey: ["route", line], queryFn: () => api.route(line), staleTime: 60 * 60_000 });

export const useVehicles = (line: string, enabled = true) =>
    useQuery({ queryKey: ["vehicles", line], queryFn: () => api.vehicles(line), refetchInterval: 10_000, enabled });

export const useSearch = (text: string) =>
    useQuery({
        queryKey: ["search", text],
        queryFn: () => api.search(text),
        enabled: text.trim().length >= 2,
        staleTime: 5 * 60_000,
        placeholderData: (prev) => prev,
    });

export function useProfileMutations() {
    const client = useQueryClient();
    const refresh = () => Promise.all([client.invalidateQueries({ queryKey: ["me"] }), client.invalidateQueries({ queryKey: ["board"] })]);
    const callbacks = {
        onSuccess: () => {
            haptic.success();
            return refresh();
        },
        onError: () => haptic.warning(),
    };

    return {
        saveStop: useMutation({ mutationFn: ([code9, alias]: [string, (string | null)?]) => api.saveStop(code9, alias), ...callbacks }),
        removeStop: useMutation({ mutationFn: ([code9]: [string]) => api.removeStop(code9), ...callbacks }),
        addTrip: useMutation({
            mutationFn: ([code9, line, label]: [string, string, (string | null)?]) => api.addTrip(code9, line, label),
            ...callbacks,
        }),
        renameTrip: useMutation({ mutationFn: ([id, label]: [number, string | null]) => api.renameTrip(id, label), ...callbacks }),
        removeTrip: useMutation({ mutationFn: ([id]: [number]) => api.removeTrip(id), ...callbacks }),
        addAlert: useMutation({ mutationFn: ([alert]: [NewAlert]) => api.addAlert(alert), ...callbacks }),
        removeAlert: useMutation({ mutationFn: ([id]: [number]) => api.removeAlert(id), ...callbacks }),
        setLang: useMutation({
            mutationFn: ([lang]: [Lang | null]) => {
                setLang(lang);
                return api.setLang(lang);
            },
            ...callbacks,
        }),
    };
}

export function savedState(me: Me | undefined, code9: string, line?: string) {
    const stop = me?.stops.find((s) => s.code9 === code9);
    const trip = line ? me?.trips.find((t) => t.code9 === code9 && t.line === line) : undefined;
    const alerts = me?.alerts.filter((a) => a.code9 === code9 && (!line || a.line === line)) ?? [];
    return { stop, trip, alerts, alias: stop?.alias ?? null };
}
