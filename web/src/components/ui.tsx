import { ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { useT } from "../lib/i18n.ts";
import { haptic } from "../lib/telegram.ts";

type ButtonProps = {
    children: ReactNode;
    onClick?: () => void;

    variant?: "primary" | "subtle" | "ghost";
    icon?: ReactNode;
    disabled?: boolean;
    busy?: boolean;
    className?: string;
    type?: "button" | "submit";
};

export function Button({ children, onClick, variant = "subtle", icon, disabled, busy, className = "", type = "button" }: ButtonProps) {
    const look = {
        primary: "bg-primary text-on-primary",
        subtle: "bg-soft text-ink active:bg-pressed",
        ghost: "bg-transparent text-body",
    }[variant];
    return (
        <button
            type={type}
            disabled={disabled || busy}
            onClick={() => {
                haptic.tap();
                onClick?.();
            }}
            className={`press inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-md font-medium disabled:opacity-40 ${look} ${className}`}
        >
            {icon}
            <span className={busy ? "opacity-50" : ""}>{children}</span>
        </button>
    );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    return createPortal(
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
                    <motion.div
                        className="absolute inset-0 bg-black/50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    <motion.div
                        className="safe-bottom absolute inset-x-0 bottom-0 max-h-[88%] overflow-y-auto rounded-t-2xl bg-canvas px-4 pt-2"
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", stiffness: 380, damping: 38 }}
                        drag="y"
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={{ top: 0, bottom: 0.6 }}
                        onDragEnd={(_, info) => info.offset.y > 90 && onClose()}
                    >
                        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-pressed" />
                        <h2 className="mb-4 text-d-md font-bold">{title}</h2>
                        {children}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body,
    );
}

export function ErrorNote({ text, onRetry }: { text: string; onRetry?: () => void }) {
    const t = useT();
    return (
        <div className="rounded-2xl bg-soft p-4 text-sm text-body">
            <p>{text}</p>
            {onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="mt-3 h-9 rounded-full bg-primary px-4 text-sm font-medium text-on-primary"
                >
                    {t.retry}
                </button>
            )}
        </div>
    );
}

export function SectionTitle({ children }: { children: ReactNode }) {
    return <h2 className="mb-2 text-d-sm font-bold">{children}</h2>;
}

export function Skeleton({ className = "" }: { className?: string }) {
    return <div className={`skeleton ${className}`} aria-hidden />;
}

export function ListRow({
    onClick,
    children,
    first,
    chevron = true,
}: {
    onClick: () => void;
    children: ReactNode;
    first: boolean;
    chevron?: boolean;
}) {
    return (
        <li>
            <button
                type="button"
                onClick={onClick}
                className={`press flex w-full items-center gap-3 py-3.5 text-left ${first ? "" : "border-t border-line"}`}
            >
                {children}
                {chevron && <ChevronRight size={18} className="shrink-0 text-mute" />}
            </button>
        </li>
    );
}

export function Chips<T extends string | number>({
    value,
    options,
    onChange,
}: {
    value: T;
    options: Array<{ value: T; label: string }>;
    onChange: (v: T) => void;
}) {
    return (
        <div className="flex flex-wrap gap-2">
            {options.map((o) => {
                const on = o.value === value;
                return (
                    <button
                        key={String(o.value)}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                            haptic.select();
                            onChange(o.value);
                        }}
                        className={`h-10 rounded-full px-4 text-sm font-medium transition-colors ${on ? "bg-primary text-on-primary" : "bg-soft text-ink"}`}
                    >
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}
