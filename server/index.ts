import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { run } from "@grammyjs/runner";
import { pollAlerts } from "./alerts.ts";
import { createBot } from "./bot/bot.ts";
import { openDb } from "./db.ts";
import { loadEnv } from "./env.ts";
import { createApp } from "./http/app.ts";
import { log, setLogLevel } from "./log.ts";
import { UserStore } from "./store/users.ts";
import { AynaClient } from "./transit/ayna.ts";
import { Directory } from "./transit/directory.ts";
import { NecptClient } from "./transit/necpt.ts";
import { TransitService } from "./transit/service.ts";

const env = loadEnv();
setLogLevel(env.LOG_LEVEL);
mkdirSync(env.DATA_DIR, { recursive: true });

const db = openDb(join(env.DATA_DIR, "bus.sqlite"));
const ayna = new AynaClient(env.AYNA_API_URL);
const directory = new Directory();
directory.loadFromDb(db);

const transit = new TransitService(
    new NecptClient({ url: env.NECPT_URL, token: env.NECPT_TOKEN, appVersion: env.NECPT_APP_VERSION }),
    directory,
);
const store = new UserStore(db, directory);
const busBot = createBot({ token: env.BOT_TOKEN, publicUrl: env.PUBLIC_URL, store, transit });

let syncing = false;
const syncDirectory = async () => {
    if (syncing) return;
    syncing = true;
    try {
        while (!(await directory.sync(db, ayna)) && directory.stopCount === 0) await Bun.sleep(60_000);
    } finally {
        syncing = false;
    }
};
if (directory.needsSync(db)) void syncDirectory();
setInterval(() => directory.needsSync(db) && void syncDirectory(), 60 * 60_000);

const server = Bun.serve({
    hostname: env.HOST,
    port: env.PORT,
    idleTimeout: 30,
    fetch: createApp({
        botToken: env.BOT_TOKEN,
        store,
        transit,
        staticDir: env.STATIC_DIR,
        devUserId: env.DEV_USER_ID,
        onTripsChanged: env.BOT_DISABLED ? undefined : (userId) => busBot.keyboardChanged(userId),
    }),
});
log.info("http listening", { url: server.url.toString(), stops: directory.stopCount, routes: directory.routeCount });

let runner: ReturnType<typeof run> | undefined;
let alertTimer: ReturnType<typeof setInterval> | undefined;

if (!env.BOT_DISABLED) {
    runner = run(busBot.bot);
    log.info("bot started");

    const sender = {
        fire: (alert: Parameters<typeof busBot.sendAlert>[0], arrival: Parameters<typeof busBot.sendAlert>[1]) =>
            busBot.sendAlert(alert, arrival),
        expired: (alert: Parameters<typeof busBot.sendAlertExpired>[0]) => busBot.sendAlertExpired(alert),
    };

    let polling = false;
    alertTimer = setInterval(async () => {
        if (polling) return;
        polling = true;
        try {
            await pollAlerts({ store, arrivals: (code9) => transit.arrivals(code9), sender });
        } catch (err) {
            log.error("alert poll failed", { err });
        } finally {
            polling = false;
        }
    }, 30_000);
}

async function shutdown(signal: string) {
    log.info("shutting down", { signal });
    clearInterval(alertTimer);
    await runner?.stop().catch(() => undefined);
    await server.stop();
    db.close();
    process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
