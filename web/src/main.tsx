import { QueryClientProvider } from "@tanstack/react-query";
import { polyfillCountryFlagEmojis } from "country-flag-emoji-polyfill";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { currentT, setLang, useLangStore } from "./lib/i18n.ts";
import { queryClient } from "./lib/queries.ts";
import { boot } from "./lib/telegram.ts";
import { initTheme } from "./lib/theme.ts";
import "./styles.css";

polyfillCountryFlagEmojis();
boot();
initTheme();
setLang(useLangStore.getState().lang);

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ErrorBoundary
            fallback={() => (
                <div className="flex h-full flex-col items-start justify-center gap-4 p-6">
                    <p className="text-d-md font-bold">{currentT().crashTitle}</p>
                    <p className="text-md text-body">{currentT().crashText}</p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="h-12 rounded-full bg-primary px-5 font-medium text-on-primary"
                    >
                        {currentT().reload}
                    </button>
                </div>
            )}
        >
            <QueryClientProvider client={queryClient}>
                <App />
            </QueryClientProvider>
        </ErrorBoundary>
    </StrictMode>,
);
