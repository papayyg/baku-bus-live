import { z } from "zod";
import { defaultFetcher, type Fetcher, fetchJson } from "./http.ts";

const coord = z.union([z.string(), z.number()]);

const stopSchema = z.object({
    id: z.number(),
    code: z.string(),
    name: z.string(),
    latitude: coord,
    longitude: coord,
});

const stopListSchema = z.object({ totalCount: z.number().optional(), items: z.array(stopSchema) });

const busListSchema = z.array(z.object({ id: z.number(), number: z.string() }));

const busSchema = z.object({
    id: z.number(),
    number: z.string(),
    carrier: z.string().nullish(),
    firstPoint: z.string().nullish(),
    lastPoint: z.string().nullish(),
    routLength: z.number().nullish(),
    tariffStr: z.string().nullish(),
    durationMinuts: z.number().nullish(),
    stops: z
        .array(
            z.object({
                stopCode: z.string(),
                stopName: z.string(),
                directionTypeId: z.number(),
                stop: z.object({ latitude: coord, longitude: coord }).nullish(),
            }),
        )
        .nullish(),
    routes: z
        .array(
            z.object({
                directionTypeId: z.number(),
                destination: z.string().nullish(),
                flowCoordinates: z.array(z.object({ lat: z.number(), lng: z.number() })).nullish(),
            }),
        )
        .nullish(),
});

export type AynaStop = z.infer<typeof stopSchema>;
export type AynaBus = z.infer<typeof busSchema>;

export class AynaClient {
    constructor(
        private readonly baseUrl: string,
        private readonly fetcher: Fetcher = defaultFetcher,
    ) {}

    private get(path: string): Promise<unknown> {
        return fetchJson(
            this.fetcher,
            `${this.baseUrl.replace(/\/$/, "")}${path}`,
            { headers: { Origin: "https://map.ayna.gov.az", Referer: "https://map.ayna.gov.az/", Accept: "application/json" } },
            20_000,
        );
    }

    async stops(): Promise<{ total: number | undefined; items: AynaStop[] }> {
        const parsed = stopListSchema.parse(await this.get("/api/stop/getPagedList?page=1&pageSize=10000"));
        return { total: parsed.totalCount, items: parsed.items };
    }

    async busList(): Promise<Array<{ id: number; number: string }>> {
        return busListSchema.parse(await this.get("/api/bus/getBusList"));
    }

    async bus(id: number): Promise<AynaBus> {
        return busSchema.parse(await this.get(`/api/bus/getBusById?id=${id}`));
    }
}

export const parseAynaBus = (raw: unknown): AynaBus => busSchema.parse(raw);
export const parseAynaStops = (raw: unknown): AynaStop[] => stopListSchema.parse(raw).items;
