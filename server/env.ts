import { z } from "zod";

const schema = z.object({
    BOT_TOKEN: z.string().min(20),
    PUBLIC_URL: z.url(),
    PORT: z.coerce.number().int().default(8080),
    HOST: z.string().default("0.0.0.0"),
    DATA_DIR: z.string().default("./data"),
    STATIC_DIR: z.string().default("./web/dist"),
    NECPT_URL: z.url(),
    NECPT_TOKEN: z.string().min(10),
    NECPT_APP_VERSION: z.string().min(1),
    AYNA_API_URL: z.url().default("https://map-api.ayna.gov.az"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    DEV_USER_ID: z.coerce.number().int().optional(),
    BOT_DISABLED: z.stringbool().default(false),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
    const parsed = schema.safeParse(source);
    if (!parsed.success) {
        const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
        throw new Error(`Invalid environment: ${fields}`);
    }
    return parsed.data;
}
