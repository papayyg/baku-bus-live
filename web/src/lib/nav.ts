import { create } from "zustand";

export type Tab = "board" | "nearby" | "search";

export type Screen =
    | { name: "stop"; code9: string }
    | { name: "trip"; code9: string; line: string }
    | { name: "route"; line: string; dir?: 1 | 2 };

type Entry = Screen & { key: number };

type NavState = {
    tab: Tab;
    stack: Entry[];
    direction: 1 | -1;
    searchText: string;
    setTab(tab: Tab): void;
    push(screen: Screen): void;
    pop(): void;
    setSearchText(text: string): void;
};

let seq = 0;

export const useNav = create<NavState>((set) => ({
    tab: "board",
    stack: [],
    direction: 1,
    searchText: "",
    setTab: (tab) => set((s) => (s.tab === tab && s.stack.length === 0 ? s : { tab, stack: [], direction: -1 })),
    push: (screen) => set((s) => ({ stack: [...s.stack, { ...screen, key: ++seq }], direction: 1 })),
    pop: () => set((s) => ({ stack: s.stack.slice(0, -1), direction: -1 })),
    setSearchText: (searchText) => set({ searchText }),
}));

export const nav = {
    push: (screen: Screen) => useNav.getState().push(screen),
    pop: () => useNav.getState().pop(),
};
