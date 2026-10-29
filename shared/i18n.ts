export type Lang = "az" | "ru" | "en";

export const LANGS: Lang[] = ["az", "ru", "en"];

export const LANG_NAMES: Record<Lang, string> = { az: "Azərbaycanca", ru: "Русский", en: "English" };

export const LANG_FLAGS: Record<Lang, string> = { az: "🇦🇿", ru: "🇷🇺", en: "🇬🇧" };

export const langLabel = (lang: Lang): string => `${LANG_FLAGS[lang]} ${LANG_NAMES[lang]}`;

export const isLang = (v: unknown): v is Lang => v === "az" || v === "ru" || v === "en";

export function langOf(code: string | null | undefined): Lang {
    const base = (code ?? "").toLowerCase().split("-")[0];
    if (base === "az") return "az";
    if (base === "ru" || base === "uk" || base === "be" || base === "kk") return "ru";
    return "en";
}

export const LOCALE: Record<Lang, string> = { az: "az-Latn-AZ", ru: "ru-RU", en: "en-GB" };

export type PluralForms = { one: string; few?: string; many: string };

const rules = new Map<Lang, Intl.PluralRules>();

export function plural(lang: Lang, n: number, forms: PluralForms): string {
    let rule = rules.get(lang);
    if (!rule) {
        rule = new Intl.PluralRules(LOCALE[lang]);
        rules.set(lang, rule);
    }
    const cat = rule.select(n);
    if (cat === "one") return forms.one;
    if (cat === "few") return forms.few ?? forms.many;
    return forms.many;
}

export function formatDistance(lang: Lang, meters: number): string {
    const unit = lang === "ru" ? { m: "м", km: "км" } : { m: "m", km: "km" };
    if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} ${unit.m}`;
    const km = (meters / 1000).toFixed(1);
    return `${lang === "en" ? km : km.replace(".", ",")} ${unit.km}`;
}
