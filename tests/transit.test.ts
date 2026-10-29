import { describe, expect, test } from "bun:test";
import { formatTime } from "../server/time.ts";
import { parseAynaBus, parseAynaStops } from "../server/transit/ayna.ts";
import { convertRoute, convertStops, Directory } from "../server/transit/directory.ts";
import { fixCoordinate, haversine, Polyline, padCode } from "../server/transit/geo.ts";
import { buildBoards, parseStopMonitoring, parseTime, parseVehicleMonitoring, TransitServiceError } from "../server/transit/live.ts";
import { compareLines, foldText, looksLikeLine, normalizeLine } from "../server/transit/text.ts";

const fixture = (name: string) => Bun.file(new URL(`./fixtures/${name}`, import.meta.url)).json();

describe("codes and coordinates", () => {
    test("stop codes are padded to 9 digits", () => {
        expect(padCode("1001280")).toBe("001001280");
        expect(padCode("10000011")).toBe("010000011");
        expect(padCode(" 1001237 ")).toBe("001001237");
    });

    test.each([
        ["40,498,112", "lat", 40.498112],
        ["4,049,233", "lat", 40.49233],
        ["50,206,297", "lon", 50.206297],
        ["49.942556", "lon", 49.942556],
    ] as const)("coordinate %j → %d", (raw, axis, expected) => {
        expect(fixCoordinate(raw, axis)).toBeCloseTo(expected, 6);
    });

    test("garbage coordinates are rejected", () => {
        for (const raw of ["0", "55.5", "abc", "", null]) expect(fixCoordinate(raw, "lat")).toBeUndefined();
    });

    test("broken stops in the real directory are repaired", async () => {
        const { stops, skipped } = convertStops(parseAynaStops(await fixture("ayna-stop-paged-list.json")));
        expect(skipped).toEqual([]);
        expect(stops.find((s) => s.code9 === "001003892")).toMatchObject({ lat: 40.498112, lon: 50.206297 });
    });

    test("haversine and polyline projection", () => {
        expect(haversine({ lat: 40, lon: 49 }, { lat: 41, lon: 49 })).toBeCloseTo(111_195, -2);
        const line = new Polyline([
            { lat: 40.4, lon: 49.8 },
            { lat: 40.4, lon: 49.81 },
        ]);
        const p = line.project({ lat: 40.4001, lon: 49.805 })!;
        expect(p.along).toBeCloseTo(line.length / 2, -1);
        expect(p.offset).toBeLessThan(15);
        expect(Math.round(p.heading)).toBe(90);
    });
});

describe("text", () => {
    test("line numbers", () => {
        expect(normalizeLine("88а")).toBe("88A");
        expect(normalizeLine("м7")).toBe("M7");
        expect(normalizeLine("M9_")).toBe("M9");
        expect(looksLikeLine("26")).toBe(true);
        expect(looksLikeLine("7А")).toBe(true);
        expect(looksLikeLine("Нариманов")).toBe(false);
        expect(["M7", "202", "88A", "6", "E1", "88", "26"].sort(compareLines)).toEqual(["6", "26", "88", "88A", "202", "E1", "M7"]);
    });

    test("folding for search", () => {
        expect(foldText("Neftçilər m/st")).toBe("neftciler metro");
        expect(foldText("“Şimal” Elektrik Stansiyası")).toBe("simal elektrik stansiyasi");
        expect(foldText("Нариманов")).toBe("narimanov");
        expect(foldText("м/ст Гянджлик")).toBe("metro gyandjlik");
    });
});

describe("stop monitoring", () => {
    const parsed = async () => parseStopMonitoring(await fixture("necpt-stop-monitoring.json"));
    const board = async (line: string) => buildBoards(await parsed()).find((b) => b.line === line)!;

    test("server offset -07:00 is honoured: 01:37:10-07:00 is 12:37 in Baku", async () => {
        const data = await parsed();
        expect(data.now.toISOString()).toBe("2026-10-27T08:37:10.000Z");
        expect(formatTime(data.now)).toBe("12:37");
        expect(parseTime("0001-01-01T00:00:00")).toBeNull();
    });

    test("202: at stop, 3 min late by 11, 9 min, waiting at the terminal", async () => {
        const b = await board("202");
        const [atStop, soon, later, terminal] = b.live;
        expect(atStop!.atStop).toBe(true);
        expect(soon).toMatchObject({ etaMin: 3, distanceM: 662, delayMin: 11, occupancy: "free" });
        expect(later).toMatchObject({ etaMin: 9, distanceM: 2146 });
        expect(terminal!.terminal).toBe(true);
        expect(b.directionName).toBe("Dərbəndqala küç. 84A - Nəriman Nərimanov m/st");
    });

    test("88: scheduled trips come after the last live one; 6 has only a timetable", async () => {
        const b88 = await board("88");
        expect(b88.live).toHaveLength(1);
        expect(b88.scheduled.map((s) => s.at)).toEqual(["2026-10-27T08:50:00.000Z"]);
        const b6 = await board("6");
        expect(b6.live).toEqual([]);
        expect(b6.scheduled).toHaveLength(3);
    });

    test("lines with live buses go first", async () => {
        const boards = buildBoards(await parsed());
        const firstScheduledOnly = boards.findIndex((b) => b.live.length === 0);
        expect(boards.slice(firstScheduledOnly).every((b) => b.live.length === 0)).toBe(true);
    });

    test("an unexpected response is a service error", () => {
        expect(() => parseStopMonitoring({ status: false, message: "token" })).toThrow(TransitServiceError);
    });
});

describe("vehicle monitoring", () => {
    test("parses the stringified payload, normalises line names and drops stale vehicles", async () => {
        const raw = await fixture("necpt-vehicle-monitoring.json");
        const { now, vehicles } = parseVehicleMonitoring(raw);
        expect(vehicles.length).toBeGreaterThan(0);
        expect(vehicles.every((v) => v.line === "26" || v.line === "M9")).toBe(true);
        expect(vehicles.every((v) => now.getTime() - v.recordedAt.getTime() <= 3 * 60_000)).toBe(true);

        const data = JSON.parse(raw.data);
        data.Siri.ServiceDelivery.ResponseTimestamp = new Date(now.getTime() + 10 * 60_000).toISOString();
        expect(parseVehicleMonitoring({ ...raw, data: JSON.stringify(data) }).vehicles).toEqual([]);
    });
});

describe("directory", () => {
    const load = async () => {
        const dir = new Directory();
        const stops = convertStops(parseAynaStops(await fixture("ayna-stop-paged-list.json"))).stops;
        dir.load(stops, [convertRoute(parseAynaBus(await fixture("ayna-bus-26-full.json")))]);
        return dir;
    };

    test("route conversion keeps both directions with paths", async () => {
        const route = convertRoute(parseAynaBus(await fixture("ayna-bus-26-full.json")));
        expect(route.number).toBe("26");
        expect(route.directions.map((d) => d.dir)).toEqual([1, 2]);
        expect(route.directions[0]!.path.length).toBeGreaterThan(100);
        expect(route.directions[0]!.stops[0]!.code9).toBe("001001791");
    });

    test("search finds stops by Russian transliteration and by metro synonyms", async () => {
        const dir = await load();
        expect(dir.searchStops("Neftçilər")[0]?.code9).toBe("001001237");
        expect(dir.searchStops("нефтчиляр")[0]?.code9).toBe("001001237");
        expect(dir.searchStops("метро нефтчиляр")[0]?.code9).toBe("001001237");
        expect(dir.searchStops("zzzz")).toEqual([]);
    });

    test("nearby lists served stops with their directions", async () => {
        const dir = await load();
        const [first] = dir.nearby({ lat: 40.393706, lon: 49.876396 });
        expect(first).toMatchObject({ code9: "001001791", distanceM: 0, lines: ["26"] });
        expect(first?.towards).toEqual(["H.Babaşov küç. 29Q"]);
        expect(dir.nearby({ lat: 40.41164, lon: 49.94256 }, 5, 50)).toEqual([]);
    });

    test("gateway direction numbers are inverted, so directions are matched by name", async () => {
        const dir = await load();
        const { vehicles } = parseVehicleMonitoring(await fixture("necpt-vehicle-monitoring.json"));
        const v = vehicles.find((x) => x.line === "26" && x.directionName?.startsWith("V.Mayakovski"))!;
        expect(dir.resolveDir("26", { directionName: v.directionName })).toBe(1);
        expect(dir.resolveDir("26", { directionName: "H.Babaşov küç. 29Q - V.Mayakovski küç. 19" })).toBe(2);
    });

    test("stops away counts stops between the bus and ours", async () => {
        const dir = await load();
        const d = dir.route("26")!.directions[0]!;
        const ours = d.stops[10]!;
        expect(dir.stopsAway("26", 1, ours.code9, d.stops[5]!)).toBe(4);
        expect(dir.stopsAway("26", 1, ours.code9, d.stops[9]!)).toBe(0);
        expect(dir.stopsAway("26", 1, ours.code9, d.stops[20]!)).toBeNull();
    });
});
