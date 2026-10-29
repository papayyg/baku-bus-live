import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Lead } from "../lib/format.ts";
import { formatTime } from "../lib/format.ts";
import { useT } from "../lib/i18n.ts";

export function Minutes({ lead, size }: { lead: Lead; size: "row" | "hero" }) {
    const reduce = useReducedMotion();
    const t = useT();
    const hero = size === "hero";
    const key = lead.kind === "minutes" ? `m${lead.value}` : lead.kind;
    const word = hero ? "text-d-lg font-bold" : "text-lg font-semibold";

    let content: React.ReactNode;
    switch (lead.kind) {
        case "minutes":
            content = (
                <span className="inline-flex items-baseline gap-1">
                    <span className={hero ? "text-hero font-bold tracking-tight" : "text-d-md font-bold"}>{lead.value}</span>
                    <span className={hero ? "text-d-sm font-semibold" : "text-sm font-medium"}>{t.min}</span>
                </span>
            );
            break;
        case "here":
            content = <span className={word}>{hero ? t.hereHero : t.hereRow}</span>;
            break;
        case "arriving":
            content = <span className={word}>{hero ? t.arrivingHero : t.arrivingRow}</span>;
            break;
        case "terminal":
        case "scheduled":
            content = <span className={`${word} text-body`}>{hero ? t.atTime(formatTime(lead.at)) : formatTime(lead.at)}</span>;
            break;
        case "none":
            content = <span className={`${hero ? "text-d-sm font-semibold" : "text-md"} text-mute`}>{hero ? t.notRunningHero : "—"}</span>;
            break;
    }

    return (
        <span className="tabular relative inline-flex overflow-hidden" aria-live="polite">
            <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                    key={key}
                    initial={reduce ? { opacity: 0 } : { y: "60%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={reduce ? { opacity: 0 } : { y: "-60%", opacity: 0 }}
                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    className="inline-flex"
                >
                    {content}
                </motion.span>
            </AnimatePresence>
        </span>
    );
}
