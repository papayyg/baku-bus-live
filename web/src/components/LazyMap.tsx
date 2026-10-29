import { lazy, Suspense } from "react";
import { useT } from "../lib/i18n.ts";
import { useTheme } from "../lib/theme.ts";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import type { TransitMapProps } from "./TransitMap.tsx";

const TransitMap = lazy(() => import("./TransitMap.tsx"));

export function LazyMap(props: Omit<TransitMapProps, "theme"> & { className?: string }) {
    const theme = useTheme();
    const t = useT();
    return (
        <div className={`relative overflow-hidden bg-soft ${props.className ?? ""}`}>
            <ErrorBoundary
                fallback={(retry) => (
                    <button type="button" onClick={retry} className="absolute inset-0 grid place-items-center text-sm text-body">
                        {t.mapFailed}
                    </button>
                )}
            >
                <Suspense fallback={<div className="skeleton absolute inset-0 rounded-none" />}>
                    <div className="absolute inset-0">
                        <TransitMap {...props} theme={theme} className="h-full w-full" />
                    </div>
                </Suspense>
            </ErrorBoundary>
        </div>
    );
}
