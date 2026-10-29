import { log } from "../log.ts";
import { defaultFetcher, type Fetcher, fetchJson, TtlCache } from "./http.ts";
import { parseStopMonitoring, parseVehicleMonitoring, type RawVehicle, type StopMonitoring, TransitServiceError } from "./live.ts";

export type NecptConfig = { url: string; token: string; appVersion: string };

const STOP_TTL_MS = 15_000;
const VEHICLES_TTL_MS = 10_000;

export class NecptClient {
    private readonly stops: TtlCache<string, StopMonitoring>;
    private readonly fleet: TtlCache<"all", { now: Date; vehicles: RawVehicle[] }>;

    constructor(
        private readonly config: NecptConfig,
        private readonly fetcher: Fetcher = defaultFetcher,
        now: () => number = Date.now,
    ) {
        this.stops = new TtlCache(STOP_TTL_MS, now);
        this.fleet = new TtlCache(VEHICLES_TTL_MS, now);
    }

    fetchedAt(code9: string): number | undefined {
        return this.stops.peek(code9)?.at;
    }

    stopMonitoring(code9: string): Promise<StopMonitoring> {
        return this.stops.get(code9, async () =>
            parseOrReport(await this.call(`/siri-stop-monitoring-detailV2?stopCode=${code9}`), parseStopMonitoring),
        );
    }

    vehicles(): Promise<{ now: Date; vehicles: RawVehicle[] }> {
        return this.fleet.get("all", async () => parseOrReport(await this.call("/siri-vehicle-monitoring"), parseVehicleMonitoring));
    }

    private async call(endpoint: string): Promise<unknown> {
        const { url, token, appVersion } = this.config;
        const body = new URLSearchParams({
            method: "otpGateway",
            token,
            endpoint,
            methodType: "GET",
            payload: "%7B%7D",
            version: "3",
            page: "stop_details",
            platform: "android",
            appVersion,
        });
        try {
            return await fetchJson(this.fetcher, url, {
                method: "POST",
                headers: {
                    "User-Agent": "Dart/3.9 (dart:io)",
                    "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
                },
                body: body.toString(),
            });
        } catch (err) {
            throw new TransitServiceError(`necpt request failed: ${(err as Error).message}`);
        }
    }
}

function parseOrReport<T>(raw: unknown, parse: (raw: unknown) => T): T {
    try {
        return parse(raw);
    } catch (err) {
        const message = (raw as { message?: unknown } | null)?.message;
        if (typeof message === "string") log.error("necpt rejected the request (token may have changed)", { message });
        else log.error("unexpected necpt response", { snippet: JSON.stringify(raw)?.slice(0, 300) });
        throw err instanceof TransitServiceError ? err : new TransitServiceError("unexpected necpt response");
    }
}
