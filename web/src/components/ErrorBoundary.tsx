import { Component, type ReactNode } from "react";

const RELOAD_KEY = "chunk-reload-at";

function reloadForStaleChunk(error: Error): boolean {
    if (!/dynamically imported module|Importing a module script failed|Failed to fetch/i.test(error.message)) return false;
    try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
        if (Date.now() - last < 30_000) return false;
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch {
        return false;
    }
    window.location.reload();
    return true;
}

export class ErrorBoundary extends Component<{ children: ReactNode; fallback: (retry: () => void) => ReactNode }, { error: Error | null }> {
    override state: { error: Error | null } = { error: null };

    static getDerivedStateFromError(error: Error) {
        return { error };
    }

    override componentDidCatch(error: Error) {
        reloadForStaleChunk(error);
    }

    override render() {
        if (this.state.error) return this.props.fallback(() => this.setState({ error: null }));
        return this.props.children;
    }
}
