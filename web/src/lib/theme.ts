import { create } from "zustand";
import { currentTheme, onThemeChange, paintChrome, type Theme } from "./telegram.ts";

const useThemeStore = create<{ theme: Theme }>(() => ({ theme: currentTheme() }));

export const useTheme = (): Theme => useThemeStore((s) => s.theme);

function apply(theme: Theme): void {
    document.documentElement.dataset.theme = theme;
    paintChrome(getComputedStyle(document.documentElement).getPropertyValue("--canvas").trim());
    useThemeStore.setState({ theme });
}

export function initTheme(): void {
    apply(currentTheme());
    onThemeChange(apply);
}
