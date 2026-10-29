import { Check } from "lucide-react";
import { LANGS, type Lang, langLabel, useT } from "../lib/i18n.ts";
import { useProfileMutations } from "../lib/queries.ts";
import { Sheet } from "./ui.tsx";

export function LanguageSheet({ open, onClose, chosen }: { open: boolean; onClose: () => void; chosen: Lang | null }) {
    const t = useT();
    const { setLang } = useProfileMutations();
    const options: Array<{ value: Lang | null; label: string }> = [
        { value: null, label: t.sameAsTelegram },
        ...LANGS.map((l) => ({ value: l, label: langLabel(l) })),
    ];

    return (
        <Sheet open={open} onClose={onClose} title={t.language}>
            <ul className="pb-2">
                {options.map((o, i) => {
                    const on = o.value === chosen;
                    return (
                        <li key={o.value ?? "auto"}>
                            <button
                                type="button"
                                aria-pressed={on}
                                onClick={() => {
                                    setLang.mutate([o.value]);
                                    onClose();
                                }}
                                className={`press flex w-full items-center justify-between py-4 text-left text-md ${i ? "border-t border-line" : ""} ${on ? "font-semibold" : ""}`}
                            >
                                {o.label}
                                {on && <Check size={20} />}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </Sheet>
    );
}
