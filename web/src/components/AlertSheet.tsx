import type { NewAlert } from "@shared/api.ts";
import { useState } from "react";
import { minutesToClock } from "../lib/format.ts";
import { useT } from "../lib/i18n.ts";
import { haptic } from "../lib/telegram.ts";
import { Button, Chips, Sheet } from "./ui.tsx";

const TIMES = Array.from({ length: (24 * 60 - 5 * 60) / 15 + 1 }, (_, i) => 5 * 60 + i * 15);

export function AlertSheet({
    open,
    onClose,
    code9,
    line,
    busy,
    onCreate,
}: {
    open: boolean;
    onClose: () => void;
    code9: string;
    line: string;
    busy: boolean;
    onCreate: (alert: NewAlert) => void;
}) {
    const t = useT();
    const [threshold, setThreshold] = useState(5);
    const [kind, setKind] = useState<"once" | "daily">("once");
    const [days, setDays] = useState(0b0011111);
    const [from, setFrom] = useState(8 * 60);
    const [to, setTo] = useState(9 * 60);

    const valid = kind === "once" || (days !== 0 && from < to);

    return (
        <Sheet open={open} onClose={onClose} title={t.alertTitle}>
            <Label>{t.howEarly}</Label>
            <Chips
                value={threshold}
                onChange={setThreshold}
                options={[3, 5, 7, 10, 15].map((v) => ({ value: v, label: `${v} ${t.min}` }))}
            />

            <Label>{t.when}</Label>
            <Chips
                value={kind}
                onChange={setKind}
                options={[
                    { value: "once", label: t.once },
                    { value: "daily", label: t.regularly },
                ]}
            />

            {kind === "daily" && (
                <>
                    <fieldset className="mt-4 flex gap-1.5" aria-label={t.daysOfWeek}>
                        {t.weekdaysShort.map((d, i) => {
                            const on = (days & (1 << i)) !== 0;
                            return (
                                <button
                                    key={d}
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() => {
                                        haptic.select();
                                        setDays(days ^ (1 << i));
                                    }}
                                    className={`h-10 flex-1 rounded-full text-sm font-medium transition-colors ${on ? "bg-primary text-on-primary" : "bg-soft text-ink"}`}
                                >
                                    {d}
                                </button>
                            );
                        })}
                    </fieldset>
                    <div className="mt-3 flex gap-2">
                        <TimeSelect label={t.from} value={from} onChange={setFrom} />
                        <TimeSelect label={t.to} value={to} onChange={setTo} />
                    </div>
                </>
            )}

            <p className="mt-4 text-sm text-body">
                {kind === "once" ? t.alertOnceText(line, threshold) : t.alertDailyText(line, threshold)}
            </p>

            <Button
                variant="primary"
                className="mt-5 w-full"
                disabled={!valid}
                busy={busy}
                onClick={() =>
                    onCreate(
                        kind === "once"
                            ? { code9, line, thresholdMin: threshold, kind }
                            : { code9, line, thresholdMin: threshold, kind, days, fromMin: from, toMin: to },
                    )
                }
            >
                {t.turnOn}
            </Button>
        </Sheet>
    );
}

function Label({ children }: { children: string }) {
    return <p className="mt-5 mb-2 text-sm font-medium text-body first:mt-0">{children}</p>;
}

function TimeSelect({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
    return (
        <label className="flex h-12 flex-1 items-center gap-2 rounded-xl bg-soft px-4">
            <span className="text-sm text-body">{label}</span>
            <select
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="tabular w-full appearance-none bg-transparent text-md font-medium text-ink outline-none"
            >
                {TIMES.map((t) => (
                    <option key={t} value={t}>
                        {minutesToClock(t)}
                    </option>
                ))}
            </select>
        </label>
    );
}
