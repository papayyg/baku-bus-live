const LINE_LOOKALIKES: Record<string, string> = {
    А: "A",
    В: "B",
    Е: "E",
    К: "K",
    М: "M",
    Н: "H",
    О: "O",
    Р: "P",
    С: "C",
    Т: "T",
    Х: "X",
};

export function normalizeLine(input: string): string {
    return [...input.trim().toUpperCase()]
        .map((ch) => LINE_LOOKALIKES[ch] ?? ch)
        .join("")
        .replace(/[^0-9A-Z]/g, "");
}

export const looksLikeLine = (input: string): boolean => /^[A-Za-zА-Яа-я]?\d{1,3}[A-Za-zА-Яа-я]?_?$/.test(input.trim());

export function compareLines(a: string, b: string): number {
    const ta = a.match(/\d+|\D+/g) ?? [];
    const tb = b.match(/\d+|\D+/g) ?? [];
    for (let i = 0; i < Math.min(ta.length, tb.length); i++) {
        const x = ta[i]!;
        const y = tb[i]!;
        const xn = /^\d/.test(x);
        const yn = /^\d/.test(y);
        if (xn && yn) {
            const d = Number(x) - Number(y);
            if (d !== 0) return d;
        } else if (xn !== yn) {
            return xn ? -1 : 1;
        } else if (x !== y) {
            return x < y ? -1 : 1;
        }
    }
    return ta.length - tb.length;
}

const AZ_FOLD: Record<string, string> = { ə: "e", ı: "i", ş: "s", ç: "c", ğ: "g", ö: "o", ü: "u" };

const CYR_TO_LAT: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    ғ: "g",
    д: "d",
    е: "e",
    ё: "yo",
    ж: "j",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "x",
    ц: "ts",
    ч: "c",
    ш: "s",
    щ: "s",
    ъ: "",
    ы: "i",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
    ә: "e",
    ө: "o",
    ү: "u",
    һ: "h",
};

export function foldText(input: string): string {
    const lower = input.toLowerCase().normalize("NFC");
    let out = "";
    for (const ch of lower) out += AZ_FOLD[ch] ?? CYR_TO_LAT[ch] ?? ch;
    return out
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\bm\s*[/.]\s*st\b\.?|\bmst\b|\bmetrosu\b|\bmetro stansiyasi\b/g, " metro ")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

export function skeleton(word: string): string {
    return word.replace(/[aeiouyhj]/g, "").replace(/(.)\1+/g, "$1");
}

export const tokenize = (folded: string): string[] => folded.split(" ").filter(Boolean);
