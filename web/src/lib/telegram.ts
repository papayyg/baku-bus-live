import type { LatLon } from "@shared/api.ts";

const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;

export const inTelegram = Boolean(tg?.initData);

export const initData = (): string => tg?.initData ?? "";

const supports = (version: string): boolean => Boolean(tg?.isVersionAtLeast?.(version));

export type Theme = "light" | "dark";

export function currentTheme(): Theme {
    if (tg?.colorScheme && inTelegram) return tg.colorScheme;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function onThemeChange(fn: (t: Theme) => void): () => void {
    const handler = () => fn(currentTheme());
    tg?.onEvent("themeChanged", handler);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", handler);
    return () => {
        tg?.offEvent("themeChanged", handler);
        mq.removeEventListener("change", handler);
    };
}

export function paintChrome(bg: string): void {
    if (!tg || !supports("6.1")) return;
    try {
        tg.setHeaderColor(bg as `#${string}`);
        tg.setBackgroundColor(bg as `#${string}`);
        if (supports("7.10")) tg.setBottomBarColor(bg as `#${string}`);
    } catch {}
}

export function boot(): void {
    if (!tg) return;
    tg.ready();
    tg.expand();
    if (supports("7.7")) tg.disableVerticalSwipes();
}

export const haptic = {
    tap: () => supports("6.1") && tg?.HapticFeedback.impactOccurred("light"),
    select: () => supports("6.1") && tg?.HapticFeedback.selectionChanged(),
    success: () => supports("6.1") && tg?.HapticFeedback.notificationOccurred("success"),
    warning: () => supports("6.1") && tg?.HapticFeedback.notificationOccurred("warning"),
};

export const backButton = {
    show(handler: () => void): () => void {
        if (!tg || !supports("6.1")) return () => undefined;
        tg.BackButton.onClick(handler);
        tg.BackButton.show();
        return () => {
            tg.BackButton.offClick(handler);
            tg.BackButton.hide();
        };
    },
};

export function confirm(message: string): Promise<boolean> {
    if (tg && supports("6.2")) return new Promise((resolve) => tg.showConfirm(message, resolve));
    return Promise.resolve(window.confirm(message));
}

export function closeApp(): void {
    tg?.close();
}

export function locate(): Promise<LatLon> {
    const viaBrowser = () =>
        new Promise<LatLon>((resolve, reject) => {
            if (!navigator.geolocation) return reject(new Error("unsupported"));
            navigator.geolocation.getCurrentPosition(
                (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
                (e) => reject(new Error(e.code === e.PERMISSION_DENIED ? "denied" : "unavailable")),
                { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
            );
        });

    const lm = (tg as unknown as { LocationManager?: TgLocationManager } | undefined)?.LocationManager;
    if (!inTelegram || !lm || !supports("8.0")) return viaBrowser();

    return new Promise<LatLon>((resolve, reject) => {
        const ask = () => {
            if (!lm.isLocationAvailable) return viaBrowser().then(resolve, reject);
            lm.getLocation((loc) => {
                if (loc) resolve({ lat: loc.latitude, lon: loc.longitude });
                else reject(new Error(lm.isAccessGranted ? "unavailable" : "denied"));
            });
        };
        if (lm.isInited) ask();
        else lm.init(ask);
    });
}

export function openLocationSettings(): void {
    const lm = (tg as unknown as { LocationManager?: TgLocationManager } | undefined)?.LocationManager;
    lm?.openSettings?.();
}

type TgLocationManager = {
    isInited: boolean;
    isLocationAvailable: boolean;
    isAccessGranted: boolean;
    init(cb?: () => void): void;
    getLocation(cb: (loc: { latitude: number; longitude: number } | null) => void): void;
    openSettings?(): void;
};

export type Entry =
    | { screen: "stop"; stop: string }
    | { screen: "trip"; stop: string; line: string }
    | { screen: "route"; line: string }
    | { screen: "search"; q: string }
    | null;

export function entryFromLaunch(): Entry {
    const q = new URLSearchParams(window.location.search);
    const sp = tg?.initDataUnsafe?.start_param ?? "";
    const [kind, a, b] = sp.split("_");
    const screen = q.get("screen") ?? kind;
    const stop = q.get("stop") ?? (kind === "stop" || kind === "trip" ? a : undefined);
    const line = q.get("line") ?? (kind === "trip" ? b : kind === "route" ? a : undefined);
    if (screen === "trip" && stop && line) return { screen, stop, line };
    if (screen === "stop" && stop) return { screen, stop };
    if (screen === "route" && line) return { screen, line };
    if (screen === "search") return { screen, q: q.get("q") ?? "" };
    return null;
}
