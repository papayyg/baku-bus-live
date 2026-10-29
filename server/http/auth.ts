import { createHmac, timingSafeEqual } from "node:crypto";

export type TgUser = { id: number; firstName: string; username: string | null; languageCode?: string | null };

const MAX_AGE_S = 7 * 24 * 60 * 60;

export function verifyInitData(raw: string, botToken: string, nowS = Math.floor(Date.now() / 1000)): TgUser | null {
    const params = new URLSearchParams(raw);
    const hash = params.get("hash");
    if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
    params.delete("hash");

    const check = [...params]
        .map(([k, v]) => `${k}=${v}`)
        .sort()
        .join("\n");
    const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
    const expected = createHmac("sha256", secret).update(check).digest();
    if (!timingSafeEqual(expected, Buffer.from(hash, "hex"))) return null;

    const authDate = Number(params.get("auth_date"));
    if (!Number.isFinite(authDate) || nowS - authDate > MAX_AGE_S) return null;

    try {
        const user = JSON.parse(params.get("user") ?? "null") as {
            id?: unknown;
            first_name?: unknown;
            username?: unknown;
            language_code?: unknown;
        } | null;
        if (!user || typeof user.id !== "number") return null;
        return {
            id: user.id,
            firstName: String(user.first_name ?? ""),
            username: typeof user.username === "string" ? user.username : null,
            languageCode: typeof user.language_code === "string" ? user.language_code : null,
        };
    } catch {
        return null;
    }
}

export function signInitData(fields: Record<string, string>, botToken: string): string {
    const check = Object.entries(fields)
        .map(([k, v]) => `${k}=${v}`)
        .sort()
        .join("\n");
    const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
    const hash = createHmac("sha256", secret).update(check).digest("hex");
    return new URLSearchParams({ ...fields, hash }).toString();
}
