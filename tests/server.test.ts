import { beforeEach, describe, expect, test } from "bun:test";
import { dueArrival, isDailyDue, pollAlerts } from "../server/alerts.ts";
import { alertMessage, lineMessage, nearestText, summaryMessage } from "../server/bot/format.ts";
import { openDb } from "../server/db.ts";
import { createApp } from "../server/http/app.ts";
import { signInitData, verifyInitData } from "../server/http/auth.ts";
import { UserStore } from "../server/store/users.ts";
import { bakuClock } from "../server/time.ts";
import { parseAynaBus, parseAynaStops } from "../server/transit/ayna.ts";
import { convertRoute, convertStops, Directory } from "../server/transit/directory.ts";
import { NecptClient } from "../server/transit/necpt.ts";
import { TransitService } from "../server/transit/service.ts";
import type { LiveArrival, Me } from "../shared/api.ts";
import { formatDistance, plural } from "../shared/i18n.ts";

const fixture = (name: string) => Bun.file(new URL(`./fixtures/${name}`, import.meta.url)).json();
const TOKEN = "123456:TEST-token-for-unit-tests-only";

const live = (over: Partial<LiveArrival> = {}): LiveArrival => ({
    kind: "live",
    at: "2026-10-27T08:41:00.000Z",
    etaMin: 4,
    atStop: false,
    terminal: false,
    distanceM: 1200,
    delayMin: null,
    occupancy: null,
    position: null,
    journeyId: null,
    stopsAway: null,
    ...over,
});

describe("init data", () => {
    test("a signed payload is accepted, a tampered one is rejected", () => {
        const now = 1_800_000_000;
        const raw = signInitData({ auth_date: String(now), user: JSON.stringify({ id: 42, first_name: "Ann" }), query_id: "x" }, TOKEN);
        expect(verifyInitData(raw, TOKEN, now)).toEqual({ id: 42, firstName: "Ann", username: null, languageCode: null });
        expect(verifyInitData(raw.replace("Ann", "Bob"), TOKEN, now)).toBeNull();
        expect(verifyInitData(raw, "other:token-xxxxxxxxxxxxxxxx", now)).toBeNull();
        expect(verifyInitData(raw, TOKEN, now + 8 * 24 * 3600)).toBeNull();
    });
});

describe("bot texts", () => {
    const board = (live_: LiveArrival[], scheduled: string[] = []) => ({
        line: "26",
        destination: "X",
        dir: null,
        live: live_,
        scheduled: scheduled.map((at) => ({ kind: "scheduled" as const, at, etaMin: 30 })),
    });

    test("a trip: bus, stop, when and how far, then the next ones", () => {
        const text = lineMessage("ru", {
            line: "32",
            title: "Elşən Süleymanov küçəsi 67",
            boards: [board([live({ etaMin: 3, distanceM: 1100 }), live({ etaMin: 8 }), live({ etaMin: 11 }), live({ etaMin: 30 })])],
        });
        expect(text).toBe(
            [
                "🚌 Автобус <b>32</b>",
                "📍 Остановка: Elşən Süleymanov küçəsi 67",
                "",
                "⏳ Через: <b>3 мин</b> (1,1 км)",
                "⏭ Затем: 8 мин, 11 мин, 30 мин",
            ].join("\n"),
        );
    });

    test("every state reads naturally", () => {
        const msg = (boards: ReturnType<typeof board>[]) => lineMessage("ru", { line: "26", title: "Дом", boards }).split("\n\n")[1];
        expect(msg([board([live({ atStop: true }), live({ etaMin: 7 })])])).toBe("⏳ Сейчас: <b>на остановке</b>\n⏭ Затем: 7 мин");
        expect(msg([board([live({ etaMin: 0, distanceM: 180 })])])).toBe("⏳ Сейчас: <b>подъезжает</b> (180 м)");
        expect(msg([board([live({ distanceM: null })])])).toBe("⏳ Через: <b>4 мин</b>");
        expect(msg([board([live({ terminal: true, at: "2026-10-27T08:57:00.000Z" })], ["2026-10-27T09:20:00.000Z"])])).toBe(
            "🕓 Ближайший: <b>в 12:57</b> (с конечной)",
        );
        expect(msg([board([], ["2026-10-27T09:20:00.000Z"])])).toBe("🕓 Ближайший: <b>в 13:20</b> (по расписанию)");
        expect(msg([])).toBe("😴 Сейчас на линии нет автобусов");
    });

    test("summary is one line per trip", () => {
        const trip = {
            id: 1,
            code9: "001001237",
            line: "26",
            label: null,
            stop: { code9: "001001237", name: "X", lat: 0, lon: 0 },
            towards: null,
        };
        expect(summaryMessage("ru", [{ trip, title: "Дом", boards: [board([live(), live({ etaMin: 11 }), live({ etaMin: 19 })])] }])).toBe(
            "🚌 <b>26</b> · Дом — <b>4 мин</b>, затем 11, 19 мин",
        );
        expect(nearestText("ru", null)).toBe("нет связи");
    });

    test("titles are escaped; alerts follow the same layout", () => {
        expect(lineMessage("ru", { line: "26", title: "<Дом>", boards: [] })).toContain("&lt;Дом&gt;");
        expect(alertMessage("ru", { line: "26", stopTitle: "Дом", arrival: live({ etaMin: 5 }) })).toBe(
            "🔔 Автобус <b>26</b> через <b>5 мин</b> (1,2 км)\n📍 Остановка: Дом",
        );
    });

    test("the same message in Azerbaijani and English", () => {
        const boards = [board([live({ etaMin: 3, distanceM: 1100 }), live({ etaMin: 8 })])];
        expect(lineMessage("az", { line: "32", title: "Ev", boards })).toBe(
            ["🚌 Avtobus <b>32</b>", "📍 Dayanacaq: Ev", "", "⏳ <b>3 dəq</b> sonra (1,1 km)", "⏭ Sonra: 8 dəq"].join("\n"),
        );
        expect(lineMessage("en", { line: "32", title: "Home", boards })).toBe(
            ["🚌 Bus <b>32</b>", "📍 Stop: Home", "", "⏳ Arrives in <b>3 min</b> (1.1 km)", "⏭ Then: 8 min"].join("\n"),
        );
        expect(alertMessage("az", { line: "26", stopTitle: "Ev", arrival: live({ etaMin: 5 }) })).toBe(
            "🔔 Avtobus <b>26</b> <b>5 dəq</b> sonra gələcək (1,2 km)\n📍 Dayanacaq: Ev",
        );
        expect(nearestText("en", [])).toBe("not running");
    });

    test("every language has every text", async () => {
        const { T } = await import("../server/bot/i18n.ts");
        const keys = Object.keys(T.ru).sort();
        expect(Object.keys(T.az).sort()).toEqual(keys);
        expect(Object.keys(T.en).sort()).toEqual(keys);
    });

    test("plural forms and distance follow the language", () => {
        const stops = { one: "остановка", few: "остановки", many: "остановок" };
        expect([1, 2, 5, 11, 21, 22].map((n) => plural("ru", n, stops))).toEqual([
            "остановка",
            "остановки",
            "остановок",
            "остановок",
            "остановка",
            "остановки",
        ]);
        expect([1, 3].map((n) => plural("en", n, { one: "stop", many: "stops" }))).toEqual(["stop", "stops"]);
        expect(formatDistance("ru", 662)).toBe("660 м");
        expect(formatDistance("ru", 2146)).toBe("2,1 км");
        expect(formatDistance("az", 2146)).toBe("2,1 km");
        expect(formatDistance("en", 2146)).toBe("2.1 km");
    });
});

describe("alerts", () => {
    test("the bus waiting at the terminal does not trigger an alert", () => {
        expect(dueArrival([live({ terminal: true, etaMin: 2 }), live({ etaMin: 6 })], 5)).toBeNull();
        expect(dueArrival([live({ etaMin: 5 })], 5)?.etaMin).toBe(5);
    });

    test("daily window in Baku time", () => {
        const at = new Date("2026-10-29T04:30:00Z");
        expect(bakuClock(at)).toEqual({ day: "2026-10-29", weekdayBit: 8, minutes: 510 });
        const alert = { days: 0b0011111, fromMin: 480, toMin: 540, lastFiredOn: null };
        expect(isDailyDue(alert, at)).toBe(true);
        expect(isDailyDue({ ...alert, lastFiredOn: "2026-10-29" }, at)).toBe(false);
        expect(isDailyDue({ ...alert, days: 0b1100000 }, at)).toBe(false);
        expect(isDailyDue({ ...alert, fromMin: 540, toMin: 600 }, at)).toBe(false);
    });
});

describe("http api", () => {
    let app: (req: Request) => Promise<Response>;
    let store: UserStore;
    let changed: number[];

    beforeEach(async () => {
        const db = openDb(":memory:");
        const directory = new Directory();
        directory.load(convertStops(parseAynaStops(await fixture("ayna-stop-paged-list.json"))).stops, [
            convertRoute(parseAynaBus(await fixture("ayna-bus-26-full.json"))),
        ]);
        const stopFixture = await fixture("necpt-stop-monitoring.json");
        const necpt = new NecptClient({ url: "http://necpt", token: "t", appVersion: "v" }, async () => Response.json(stopFixture));
        store = new UserStore(db, directory);
        changed = [];
        app = createApp({
            botToken: TOKEN,
            store,
            transit: new TransitService(necpt, directory),
            staticDir: "./nope",
            onTripsChanged: (id) => changed.push(id),
        });
    });

    const auth = {
        Authorization: `tma ${signInitData({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: 7, first_name: "Ann" }) }, TOKEN)}`,
    };
    const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = auth) =>
        app(
            new Request(`http://x${path}`, {
                method,
                headers: { ...headers, "Content-Type": "application/json" },
                body: body ? JSON.stringify(body) : undefined,
            }),
        );

    test("requests without valid init data are rejected", async () => {
        expect((await call("GET", "/api/me", undefined, {})).status).toBe(401);
        expect((await call("GET", "/api/me", undefined, { Authorization: "tma hash=00" })).status).toBe(401);
    });

    test("saving a trip saves its stop, shows up on /me and notifies the bot", async () => {
        const res = await call("POST", "/api/me/trips", { code9: "001001237", line: "м7", label: "  Работа  " });
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ line: "M7", label: "Работа", code9: "001001237" });
        const me = (await (await call("GET", "/api/me")).json()) as Me;
        expect(me.trips).toHaveLength(1);
        expect(me.stops.map((s) => s.code9)).toEqual(["001001237"]);
        expect(changed).toEqual([7]);
    });

    test("arrivals and board", async () => {
        const res = await call("GET", "/api/stops/001001280/arrivals");
        const data = (await res.json()) as { lines: Array<{ line: string }> };
        expect(data.lines.some((l) => l.line === "202")).toBe(true);
        await call("POST", "/api/me/trips", { code9: "001001237", line: "202" });
        const board = (await (await call("GET", "/api/board")).json()) as Array<{ boards: unknown[] }>;
        expect(board[0]!.boards!.length).toBeGreaterThan(0);
    });

    test("bad input is a 400, unknown stop is a 404", async () => {
        expect((await call("POST", "/api/me/trips", { code9: "12", line: "26" })).status).toBe(400);
        expect((await call("POST", "/api/me/trips", { code9: "999999999", line: "26" })).status).toBe(404);
        expect(
            (
                await call("POST", "/api/me/alerts", {
                    code9: "001001237",
                    line: "26",
                    thresholdMin: 5,
                    kind: "daily",
                    fromMin: 600,
                    toMin: 500,
                })
            ).status,
        ).toBe(400);
    });

    test("a once-alert fires one message and switches off", async () => {
        await call("POST", "/api/me/alerts", { code9: "001001280", line: "202", thresholdMin: 5, kind: "once" });
        const fired: string[] = [];
        const sender = { fire: async (a: { line: string }) => void fired.push(a.line), expired: async () => undefined };
        const arrivals = async () => ({ lines: [{ line: "202", live: [live({ etaMin: 3 })] }] });
        await pollAlerts({ store, arrivals, sender });
        await pollAlerts({ store, arrivals, sender });
        expect(fired).toEqual(["202"]);
        expect(store.alerts(7)).toEqual([]);
    });
});

describe("welcome texts", async () => {
    const { LANGS, langOf, T } = await import("../server/bot/i18n.ts");

    test("language is picked from the Telegram language code", () => {
        expect(langOf("az")).toBe("az");
        expect(langOf("ru")).toBe("ru");
        expect(langOf("uk")).toBe("ru");
        expect(langOf("en-US")).toBe("en");
        expect(langOf("tr")).toBe("en");
        expect(langOf(undefined)).toBe("en");
    });

    test("every language greets by name", () => {
        for (const lang of LANGS) {
            expect(T[lang].welcomeNew("Ann")).toContain("Ann");
            expect(T[lang].welcomeBack("Ann")).toContain("Ann");
        }
    });
});
