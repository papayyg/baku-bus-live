import { ChevronLeft, Home, MapPin, Search } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect } from "react";
import { useT } from "./lib/i18n.ts";
import { type Screen, type Tab, useNav } from "./lib/nav.ts";
import { backButton, entryFromLaunch, haptic, inTelegram } from "./lib/telegram.ts";
import { BoardScreen } from "./screens/BoardScreen.tsx";
import { NearbyScreen } from "./screens/NearbyScreen.tsx";
import { RouteScreen } from "./screens/RouteScreen.tsx";
import { SearchScreen } from "./screens/SearchScreen.tsx";
import { StopScreen } from "./screens/StopScreen.tsx";
import { TripScreen } from "./screens/TripScreen.tsx";

const TABS: Array<{ id: Tab; icon: ReactNode }> = [
    { id: "board", icon: <Home size={22} /> },
    { id: "nearby", icon: <MapPin size={22} /> },
    { id: "search", icon: <Search size={22} /> },
];

export function App() {
    const { tab, stack, direction, pop } = useNav();
    const top = stack.at(-1);
    const reduce = useReducedMotion();
    const t = useT();

    useEffect(() => {
        const entry = entryFromLaunch();
        const nav = useNav.getState();
        if (entry?.screen === "stop") nav.push({ name: "stop", code9: entry.stop });
        else if (entry?.screen === "trip") nav.push({ name: "trip", code9: entry.stop, line: entry.line });
        else if (entry?.screen === "route") nav.push({ name: "route", line: entry.line });
        else if (entry?.screen === "search") {
            nav.setTab("search");
            nav.setSearchText(entry.q);
        }
    }, []);

    useEffect(() => (top ? backButton.show(pop) : undefined), [top, pop]);

    const offset = reduce ? 0 : 28;

    return (
        <div className="flex h-full flex-col">
            <div className="relative min-h-0 flex-1">
                <div className={`scroll-area safe-top absolute inset-0 ${top ? "invisible" : ""}`} aria-hidden={Boolean(top)}>
                    {tab === "board" && <BoardScreen />}
                    {tab === "nearby" && <NearbyScreen />}
                    {tab === "search" && <SearchScreen />}
                </div>

                <AnimatePresence initial={false} custom={direction}>
                    {top && (
                        <motion.div
                            key={top.key}
                            custom={direction}
                            className="scroll-area safe-top absolute inset-0 bg-canvas"
                            initial={{ x: direction * offset, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -direction * offset, opacity: 0 }}
                            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        >
                            {!inTelegram && (
                                <button
                                    type="button"
                                    onClick={pop}
                                    className="press absolute top-3 left-3 z-20 grid size-11 place-items-center rounded-full bg-canvas shadow-[var(--float)]"
                                    aria-label={t.back}
                                >
                                    <ChevronLeft size={22} />
                                </button>
                            )}
                            <ScreenView screen={top} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {!top && <TabBar />}
        </div>
    );
}

function ScreenView({ screen }: { screen: Screen }) {
    switch (screen.name) {
        case "stop":
            return <StopScreen code9={screen.code9} />;
        case "trip":
            return <TripScreen code9={screen.code9} line={screen.line} />;
        case "route":
            return <RouteScreen line={screen.line} dir={screen.dir} />;
    }
}

function TabBar() {
    const t = useT();
    const tab = useNav((s) => s.tab);
    const setTab = useNav((s) => s.setTab);
    return (
        <nav className="safe-bottom border-t border-line bg-canvas pt-1" aria-label={t.appTitle}>
            <ul className="mx-auto flex max-w-md">
                {TABS.map((item) => {
                    const on = item.id === tab;
                    return (
                        <li key={item.id} className="flex-1">
                            <button
                                type="button"
                                aria-current={on ? "page" : undefined}
                                onClick={() => {
                                    if (!on) haptic.select();
                                    setTab(item.id);
                                }}
                                className={`flex w-full flex-col items-center gap-1 py-1.5 text-caption font-medium transition-colors ${on ? "text-ink" : "text-mute"}`}
                            >
                                {item.icon}
                                {t.tabs[item.id]}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
