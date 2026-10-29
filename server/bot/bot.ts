import { autoRetry } from "@grammyjs/auto-retry";
import { Bot, type Context, GrammyError, InlineKeyboard, Keyboard } from "grammy";
import type { LineBoard, LiveArrival, Trip } from "../../shared/api.ts";
import { formatDistance, isLang, LANGS, type Lang, langLabel } from "../../shared/i18n.ts";
import { log } from "../log.ts";
import type { UserStore } from "../store/users.ts";
import { TransitServiceError } from "../transit/live.ts";
import type { TransitService } from "../transit/service.ts";
import { looksLikeLine, normalizeLine } from "../transit/text.ts";
import { alertMessage, escapeHtml, lineMessage, summaryMessage, tripButton } from "./format.ts";
import { ALL_TRIPS_LABELS, T } from "./i18n.ts";

export type BotDeps = {
    token: string;
    publicUrl: string;
    store: UserStore;
    transit: TransitService;
};

const REFRESH_COOLDOWN_MS = 8_000;

export function appUrl(base: string, params: Record<string, string> = {}): string {
    const url = new URL(base);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return url.toString();
}

type Reply = { text: string; keyboard: InlineKeyboard };

export function createBot(deps: BotDeps) {
    const bot = new Bot(deps.token);
    bot.api.config.use(autoRetry({ maxRetryAttempts: 2, maxDelaySeconds: 10 }));
    const { store, transit } = deps;
    const directory = transit.directory;
    const lastRefresh = new Map<string, number>();

    const stopTitle = (userId: number, code9: string): string => store.aliasOf(userId, code9) ?? directory.stop(code9)?.name ?? code9;
    const tripTitle = (userId: number, trip: Trip): string => trip.label ?? stopTitle(userId, trip.code9);

    function mainKeyboard(userId: number): Keyboard | { remove_keyboard: true } {
        const trips = store.trips(userId);
        if (trips.length === 0) return { remove_keyboard: true };
        const kb = new Keyboard();
        if (trips.length > 1) kb.text(T[store.lang(userId)].allTrips).row();
        trips.forEach((t, i) => {
            kb.text(tripButton(t, stopTitle(userId, t.code9)));
            if (i % 2 === 1) kb.row();
        });
        return kb.resized().persistent();
    }

    const appKeyboard = (text: string, params: Record<string, string> = {}) =>
        new InlineKeyboard().webApp(text, appUrl(deps.publicUrl, params));

    function lineKeyboard(lang: Lang, code9: string, line: string): InlineKeyboard {
        return new InlineKeyboard()
            .text(T[lang].refresh, `l:${code9}:${line}`)
            .webApp(T[lang].map, appUrl(deps.publicUrl, { screen: "trip", stop: code9, line }));
    }

    async function lineReply(userId: number, code9: string, line: string): Promise<Reply> {
        const lang = store.lang(userId);
        const { boards } = await transit.lineAt(code9, line);
        const trip = store.trips(userId).find((t) => t.code9 === code9 && t.line === line);
        const title = trip ? tripTitle(userId, trip) : stopTitle(userId, code9);
        return { text: lineMessage(lang, { line, title, boards }), keyboard: lineKeyboard(lang, code9, line) };
    }

    async function summaryReply(userId: number): Promise<Reply> {
        const lang = store.lang(userId);
        const trips = store.trips(userId);
        const byStop = new Map<string, Promise<LineBoard[] | null>>();
        for (const t of trips) {
            if (!byStop.has(t.code9))
                byStop.set(
                    t.code9,
                    transit.arrivals(t.code9).then(
                        (a) => a.lines,
                        () => null,
                    ),
                );
        }
        const items = await Promise.all(
            trips.map(async (trip) => {
                const lines = await byStop.get(trip.code9)!;
                return { trip, title: tripTitle(userId, trip), boards: lines ? lines.filter((l) => l.line === trip.line) : null };
            }),
        );
        return {
            text: summaryMessage(lang, items),
            keyboard: new InlineKeyboard().text(T[lang].refresh, "all").webApp(T[lang].openApp, deps.publicUrl),
        };
    }

    async function replyWith(ctx: Context & { from: { id: number } }, load: () => Promise<Reply>): Promise<void> {
        await ctx.replyWithChatAction("typing").catch(() => undefined);
        try {
            const { text, keyboard } = await load();
            await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard, link_preview_options: { is_disabled: true } });
        } catch (err) {
            if (!(err instanceof TransitServiceError)) throw err;
            await ctx.reply(T[store.lang(ctx.from.id)].serviceDown);
        }
    }

    async function editWith(ctx: Context & { from: { id: number } }, load: () => Promise<Reply>): Promise<void> {
        const t = T[store.lang(ctx.from.id)];
        const key = `${ctx.chat?.id}:${ctx.callbackQuery?.message?.message_id}`;
        if (Date.now() - (lastRefresh.get(key) ?? 0) < REFRESH_COOLDOWN_MS) {
            await ctx.answerCallbackQuery({ text: t.alreadyFresh });
            return;
        }
        lastRefresh.set(key, Date.now());
        if (lastRefresh.size > 5000) lastRefresh.clear();
        try {
            const { text, keyboard } = await load();
            await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard, link_preview_options: { is_disabled: true } });
            await ctx.answerCallbackQuery();
        } catch (err) {
            if (err instanceof TransitServiceError) {
                await ctx.answerCallbackQuery({ text: t.serviceDown, show_alert: true });
                return;
            }
            if (err instanceof GrammyError && err.description.includes("message is not modified")) {
                await ctx.answerCallbackQuery({ text: t.notModified });
                return;
            }
            throw err;
        }
    }

    bot.use(async (ctx, next) => {
        if (ctx.from && ctx.chat?.type === "private") {
            store.touchUser({
                id: ctx.from.id,
                firstName: ctx.from.first_name,
                username: ctx.from.username,
                languageCode: ctx.from.language_code,
            });
        }
        await next();
    });

    bot.chatType(["group", "supergroup", "channel"]).on("message", async (ctx) => {
        if (!ctx.message.text?.startsWith("/")) return;
        const t = T[store.lang(ctx.from?.id ?? 0)];
        await ctx.reply(t.privateOnly, { reply_markup: new InlineKeyboard().url(t.openBot, `https://t.me/${ctx.me.username}`) });
    });

    const pm = bot.chatType("private");

    pm.command("start", async (ctx) => {
        const t = T[store.lang(ctx.from.id)];
        const name = escapeHtml(ctx.from.first_name);
        const hasTrips = store.trips(ctx.from.id).length > 0;
        await ctx.reply(hasTrips ? t.welcomeBack(name) : t.welcomeNew(name), { parse_mode: "HTML", reply_markup: appKeyboard(t.openApp) });
        if (hasTrips) await ctx.reply(t.keyboardReady, { reply_markup: mainKeyboard(ctx.from.id) });
    });

    pm.command("help", async (ctx) => {
        const t = T[store.lang(ctx.from.id)];
        await ctx.reply(t.help, { parse_mode: "HTML", reply_markup: appKeyboard(t.openApp) });
    });

    pm.command("app", async (ctx) => {
        const t = T[store.lang(ctx.from.id)];
        await ctx.reply(t.openAppPrompt, { reply_markup: appKeyboard(t.openApp) });
    });

    pm.command("keyboard", async (ctx) => {
        await ctx.reply(T[store.lang(ctx.from.id)].keyboardReady, { reply_markup: mainKeyboard(ctx.from.id) });
    });

    pm.command(["language", "lang"], async (ctx) => {
        const lang = store.lang(ctx.from.id);
        const chosen = store.chosenLang(ctx.from.id);
        const kb = new InlineKeyboard();
        for (const l of LANGS) kb.text(`${chosen === l ? "✓ " : ""}${langLabel(l)}`, `lang:${l}`).row();
        kb.text(`${chosen === null ? "✓ " : ""}${T[lang].sameAsTelegram}`, "lang:auto");
        await ctx.reply(T[lang].chooseLanguage, { reply_markup: kb });
    });

    pm.on("message:text", async (ctx) => {
        const text = ctx.message.text.trim();
        const userId = ctx.from.id;
        if (text.startsWith("/")) return;
        const lang = store.lang(userId);
        const t = T[lang];

        if (ALL_TRIPS_LABELS.has(text)) {
            if (store.trips(userId).length === 0) return void (await ctx.reply(t.noTrips, { reply_markup: appKeyboard(t.pickStop) }));
            return replyWith(ctx, () => summaryReply(userId));
        }

        const trips = store.trips(userId);
        const pressed = trips.find((trip) => tripButton(trip, stopTitle(userId, trip.code9)) === text);
        if (pressed) return replyWith(ctx, () => lineReply(userId, pressed.code9, pressed.line));

        if (looksLikeLine(text)) {
            const line = normalizeLine(text);
            const ofLine = trips.filter((trip) => trip.line === line);
            if (ofLine.length === 1) return replyWith(ctx, () => lineReply(userId, ofLine[0]!.code9, line));
            if (ofLine.length > 1) {
                const kb = new InlineKeyboard();
                for (const trip of ofLine) kb.text(tripTitle(userId, trip), `l:${trip.code9}:${line}`).row();
                return void (await ctx.reply(t.whichStop(line), { reply_markup: kb }));
            }
            const saved = store.stops(userId).filter((s) => s.stop.lines.includes(line));
            if (saved.length === 1) return replyWith(ctx, () => lineReply(userId, saved[0]!.code9, line));
            if (saved.length > 1) {
                const kb = new InlineKeyboard();
                for (const s of saved.slice(0, 8)) kb.text(s.alias ?? s.stop.name, `l:${s.code9}:${line}`).row();
                return void (await ctx.reply(t.whichStop(line), { reply_markup: kb }));
            }
            if (directory.hasRoute(line)) {
                return void (await ctx.reply(t.notThroughStops(line), {
                    reply_markup: appKeyboard(t.routeButton(line), { screen: "route", line }),
                }));
            }
            return void (await ctx.reply(t.noRoute(line)));
        }

        const found = directory.searchStops(text, 6);
        if (found.length === 0) {
            return void (await ctx.reply(t.stopNotFound, { reply_markup: appKeyboard(t.searchInApp, { screen: "search", q: text }) }));
        }
        const kb = new InlineKeyboard();
        for (const s of found) {
            const lines = s.lines.length ? ` (${s.lines.slice(0, 4).join(", ")}${s.lines.length > 4 ? "…" : ""})` : "";
            kb.webApp(`${s.name}${lines}`, appUrl(deps.publicUrl, { screen: "stop", stop: s.code9 })).row();
        }
        await ctx.reply(escapeHtml(t.found(text)), { parse_mode: "HTML", reply_markup: kb });
    });

    pm.on(["message:location", "message:venue"], async (ctx) => {
        const lang = store.lang(ctx.from.id);
        const loc = ctx.message.location!;
        const near = directory.nearby({ lat: loc.latitude, lon: loc.longitude }, 5, 600);
        if (near.length === 0) return void (await ctx.reply(T[lang].nothingNearby));
        const kb = new InlineKeyboard();
        for (const s of near)
            kb.webApp(`${s.name} — ${formatDistance(lang, s.distanceM)}`, appUrl(deps.publicUrl, { screen: "stop", stop: s.code9 })).row();
        await ctx.reply(T[lang].nearby, { reply_markup: kb });
    });

    bot.callbackQuery(/^l:(\d{9}):([0-9A-Z]{1,6})$/, (ctx) => {
        const [, code9, line] = ctx.match;
        return editWith(ctx, () => lineReply(ctx.from.id, code9!, line!));
    });

    bot.callbackQuery("all", (ctx) => editWith(ctx, () => summaryReply(ctx.from.id)));

    bot.callbackQuery(/^a:off:(\d+)$/, async (ctx) => {
        store.removeAlert(ctx.from.id, Number(ctx.match[1]));
        await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => undefined);
        await ctx.answerCallbackQuery({ text: T[store.lang(ctx.from.id)].alertOff });
    });

    bot.callbackQuery(/^lang:(az|ru|en|auto)$/, async (ctx) => {
        const choice = ctx.match[1];
        store.setLang(ctx.from.id, isLang(choice) ? choice : null);
        const t = T[store.lang(ctx.from.id)];
        await ctx.editMessageText(t.languageSet).catch(() => undefined);
        await ctx.answerCallbackQuery();
        if (store.trips(ctx.from.id).length > 1) await ctx.reply(t.keyboardReady, { reply_markup: mainKeyboard(ctx.from.id) });
    });

    bot.on("callback_query", (ctx) => ctx.answerCallbackQuery({ text: T[store.lang(ctx.from.id)].staleButton }));

    bot.catch((err) => log.error("bot handler failed", { err: err.error, update: err.ctx.update.update_id }));

    const pendingKeyboard = new Map<number, ReturnType<typeof setTimeout>>();

    return {
        bot,

        keyboardChanged(userId: number): void {
            clearTimeout(pendingKeyboard.get(userId));
            pendingKeyboard.set(
                userId,
                setTimeout(() => {
                    pendingKeyboard.delete(userId);
                    const t = T[store.lang(userId)];
                    const trips = store.trips(userId);
                    const text = trips.length
                        ? t.keyboardUpdated(trips.map((trip) => `${trip.line} · ${tripTitle(userId, trip)}`).join(", "))
                        : t.keyboardRemoved;
                    bot.api
                        .sendMessage(userId, escapeHtml(text), {
                            parse_mode: "HTML",
                            reply_markup: mainKeyboard(userId),
                            disable_notification: true,
                        })
                        .catch((err) => {
                            log.warn("keyboard update not delivered", { userId, err });
                        });
                }, 2500),
            );
        },

        async sendAlert(
            alert: { id: number; userId: number; code9: string; line: string; kind: string },
            arrival: LiveArrival,
        ): Promise<void> {
            const lang = store.lang(alert.userId);
            const keyboard = lineKeyboard(lang, alert.code9, alert.line);
            if (alert.kind === "daily") keyboard.row().text(T[lang].stopAlerts, `a:off:${alert.id}`);
            await bot.api.sendMessage(
                alert.userId,
                alertMessage(lang, { line: alert.line, stopTitle: stopTitle(alert.userId, alert.code9), arrival }),
                {
                    parse_mode: "HTML",
                    reply_markup: keyboard,
                },
            );
        },

        async sendAlertExpired(alert: { userId: number; code9: string; line: string }): Promise<void> {
            const t = T[store.lang(alert.userId)];
            await bot.api.sendMessage(alert.userId, t.alertExpired(alert.line, stopTitle(alert.userId, alert.code9)), {
                disable_notification: true,
                reply_markup: appKeyboard(t.openApp, { screen: "trip", stop: alert.code9, line: alert.line }),
            });
        },
    };
}

export type BusBot = ReturnType<typeof createBot>;
