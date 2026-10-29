import { useEffect, useRef, useState } from "react";
import { useT } from "../lib/i18n.ts";
import { Button, Chips, Sheet } from "./ui.tsx";

export function NameSheet({
    open,
    onClose,
    title,
    initial,
    placeholder,
    onSave,
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    initial: string;
    placeholder: string;
    onSave: (value: string | null) => void;
}) {
    const t = useT();
    const [value, setValue] = useState(initial);
    const input = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (!open) return;
        setValue(initial);
        requestAnimationFrame(() => input.current?.focus());
    }, [open, initial]);

    return (
        <Sheet open={open} onClose={onClose} title={title}>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    onSave(value.trim() || null);
                    onClose();
                }}
            >
                <input
                    ref={input}
                    value={value}
                    maxLength={32}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={placeholder}
                    className="h-14 w-full rounded-xl bg-soft px-4 text-md text-ink outline-none focus:ring-2 focus:ring-ink"
                />
                <div className="mt-3">
                    <Chips value={value} onChange={setValue} options={t.namePresets.map((p) => ({ value: p, label: p }))} />
                </div>
                <div className="mt-6 flex gap-2">
                    <Button type="submit" variant="primary" className="flex-1">
                        {t.save}
                    </Button>
                    {initial && (
                        <Button
                            onClick={() => {
                                onSave(null);
                                onClose();
                            }}
                        >
                            {t.reset}
                        </Button>
                    )}
                </div>
            </form>
        </Sheet>
    );
}
