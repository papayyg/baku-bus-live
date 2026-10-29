import type { LatLon } from "@shared/api.ts";
import type { GeoJSONSource, Map as MlMap } from "maplibre-gl";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { useEffect, useRef } from "react";
import type { Theme } from "../lib/telegram.ts";

maplibregl.setWorkerUrl(workerUrl);

export type MapPath = { id: string; coords: [number, number][]; tone: "main" | "faint" };
export type MapStop = { code9: string; lat: number; lon: number; kind: "target" | "normal" | "small" };
export type MapBus = { id: string; lat: number; lon: number; line: string; heading: number | null; dim?: boolean };

export type TransitMapProps = {
    theme: Theme;
    paths?: MapPath[];
    stops?: MapStop[];
    buses?: MapBus[];
    me?: LatLon | null;
    fit?: LatLon[];
    fitKey?: string;
    onStopClick?: (code9: string) => void;
    className?: string;
};

type Layers = Pick<TransitMapProps, "paths" | "stops" | "buses" | "me">;

const STYLES: Record<Theme, string> = {
    light: "https://tiles.openfreemap.org/styles/positron",
    dark: "https://tiles.openfreemap.org/styles/dark",
};

const BAKU: [number, number] = [49.8671, 40.4093];
const ANIMATION_MS = 1400;
const ROUND = { "line-cap": "round", "line-join": "round" } as const;

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

type FeatureCollection = Extract<Parameters<GeoJSONSource["setData"]>[0], { type: "FeatureCollection" }>;
const emptyFc = (): FeatureCollection => ({ type: "FeatureCollection", features: [] });

type BusEntry = { marker: maplibregl.Marker; el: HTMLDivElement; from: LatLon; to: LatLon; start: number };

class MapController {
    private readonly map: MlMap;
    private readonly buses = new Map<string, BusEntry>();
    private target: maplibregl.Marker | null = null;
    private me: maplibregl.Marker | null = null;
    private ready = false;
    private layers: Layers = {};
    private raf = 0;

    constructor(container: HTMLElement, theme: Theme, onStopClick: (code9: string) => void, initialFit: () => LatLon[] | undefined) {
        this.map = new maplibregl.Map({
            container,
            style: STYLES[theme],
            center: BAKU,
            zoom: 12,
            attributionControl: false,
            dragRotate: false,
            pitchWithRotate: false,
            touchPitch: false,
            fadeDuration: 0,
        });
        this.map.touchZoomRotate.disableRotation();
        this.map.addControl(new maplibregl.AttributionControl({ compact: true }), "top-right");
        this.map.on("load", () => {
            this.addLayers(onStopClick);
            this.ready = true;
            this.apply();
            this.fitTo(initialFit(), true);
        });
        this.raf = requestAnimationFrame(this.tick);
    }

    destroy(): void {
        cancelAnimationFrame(this.raf);
        this.ready = false;
        this.buses.clear();
        this.map.remove();
    }

    setLayers(layers: Layers): void {
        this.layers = layers;
        this.apply();
    }

    fitTo(points: LatLon[] | undefined, instant = false): void {
        if (!this.ready || !points || points.length === 0) return;
        if (points.length === 1) {
            this.map.jumpTo({ center: [points[0]!.lon, points[0]!.lat], zoom: 15.5 });
            return;
        }
        const bounds = new maplibregl.LngLatBounds();
        for (const p of points) bounds.extend([p.lon, p.lat]);
        this.map.fitBounds(bounds, { padding: { top: 72, bottom: 56, left: 40, right: 40 }, maxZoom: 16, duration: instant ? 0 : 600 });
    }

    private readonly tick = () => {
        const now = performance.now();
        for (const b of this.buses.values()) {
            const t = Math.min(1, (now - b.start) / ANIMATION_MS);
            const e = 1 - (1 - t) ** 3;
            b.marker.setLngLat([b.from.lon + (b.to.lon - b.from.lon) * e, b.from.lat + (b.to.lat - b.from.lat) * e]);
        }
        this.raf = requestAnimationFrame(this.tick);
    };

    private addLayers(onStopClick: (code9: string) => void): void {
        const m = this.map;
        const ink = cssVar("--ink") || "#000";
        const canvas = cssVar("--canvas") || "#fff";
        m.addSource("paths", { type: "geojson", data: emptyFc() });
        m.addLayer({
            id: "paths-faint",
            type: "line",
            source: "paths",
            filter: ["==", ["get", "tone"], "faint"],
            paint: { "line-color": ink, "line-width": 3, "line-opacity": 0.18 },
            layout: ROUND,
        });
        m.addLayer({
            id: "paths-casing",
            type: "line",
            source: "paths",
            filter: ["==", ["get", "tone"], "main"],
            paint: { "line-color": canvas, "line-width": 9 },
            layout: ROUND,
        });
        m.addLayer({
            id: "paths-main",
            type: "line",
            source: "paths",
            filter: ["==", ["get", "tone"], "main"],
            paint: { "line-color": ink, "line-width": 5 },
            layout: ROUND,
        });
        m.addSource("stops", { type: "geojson", data: emptyFc() });
        m.addLayer({
            id: "stops",
            type: "circle",
            source: "stops",
            paint: {
                "circle-radius": ["case", ["==", ["get", "kind"], "small"], 3.5, 6],
                "circle-color": canvas,
                "circle-stroke-color": ink,
                "circle-stroke-width": ["case", ["==", ["get", "kind"], "small"], 1.5, 2.5],
            },
        });
        m.on("click", "stops", (e) => {
            const code9 = e.features?.[0]?.properties?.code9;
            if (typeof code9 === "string") onStopClick(code9);
        });
        m.on("mouseenter", "stops", () => {
            m.getCanvas().style.cursor = "pointer";
        });
        m.on("mouseleave", "stops", () => {
            m.getCanvas().style.cursor = "";
        });
    }

    private apply(): void {
        if (!this.ready) return;
        const m = this.map;
        const { paths = [], stops = [], buses = [], me } = this.layers;

        (m.getSource("paths") as GeoJSONSource).setData({
            type: "FeatureCollection",
            features: paths.map((path) => ({
                type: "Feature",
                properties: { tone: path.tone },
                geometry: { type: "LineString", coordinates: path.coords },
            })),
        });
        (m.getSource("stops") as GeoJSONSource).setData({
            type: "FeatureCollection",
            features: stops
                .filter((s) => s.kind !== "target")
                .map((s) => ({
                    type: "Feature",
                    properties: { code9: s.code9, kind: s.kind },
                    geometry: { type: "Point", coordinates: [s.lon, s.lat] },
                })),
        });

        const target = stops.find((s) => s.kind === "target");
        if (target) {
            this.target ??= new maplibregl.Marker({ element: markerElement("stop-marker", { target: "true" }) }).addTo(m);
            this.target.setLngLat([target.lon, target.lat]);
        } else {
            this.target?.remove();
            this.target = null;
        }

        if (me) {
            this.me ??= new maplibregl.Marker({ element: markerElement("me-marker") }).addTo(m);
            this.me.setLngLat([me.lon, me.lat]);
        }

        const seen = new Set<string>();
        const now = performance.now();
        for (const bus of buses) {
            seen.add(bus.id);
            const existing = this.buses.get(bus.id);
            if (existing) {
                const cur = existing.marker.getLngLat();
                existing.from = { lat: cur.lat, lon: cur.lng };
                existing.to = { lat: bus.lat, lon: bus.lon };
                existing.start = now;
                paintBus(existing.el, bus);
                continue;
            }
            const el = markerElement("bus-marker");
            el.innerHTML = `<span class="heading"></span><span class="num"></span>`;
            paintBus(el, bus);
            const at = { lat: bus.lat, lon: bus.lon };
            const marker = new maplibregl.Marker({ element: el }).setLngLat([bus.lon, bus.lat]).addTo(m);
            this.buses.set(bus.id, { marker, el, from: at, to: at, start: now });
        }
        for (const [id, b] of this.buses) {
            if (seen.has(id)) continue;
            b.marker.remove();
            this.buses.delete(id);
        }
    }
}

function markerElement(className: string, data: Record<string, string> = {}): HTMLDivElement {
    const el = document.createElement("div");
    el.className = className;
    Object.assign(el.dataset, data);
    return el;
}

function paintBus(el: HTMLDivElement, bus: MapBus): void {
    el.dataset.dim = String(Boolean(bus.dim));
    el.style.zIndex = bus.dim ? "1" : "2";
    (el.querySelector(".num") as HTMLElement).textContent = bus.line;
    const heading = el.querySelector(".heading") as HTMLElement;
    heading.style.display = bus.heading === null ? "none" : "block";
    if (bus.heading !== null) heading.style.transform = `rotate(${bus.heading}deg)`;
}

export default function TransitMap({ theme, paths, stops, buses, me, fit, fitKey, onStopClick, className }: TransitMapProps) {
    const host = useRef<HTMLDivElement>(null);
    const controller = useRef<MapController | null>(null);
    const latest = useRef({ fit, onStopClick, layers: { paths, stops, buses, me } });
    latest.current = { fit, onStopClick, layers: { paths, stops, buses, me } };

    useEffect(() => {
        if (!host.current) return;
        const c = new MapController(
            host.current,
            theme,
            (code9) => latest.current.onStopClick?.(code9),
            () => latest.current.fit,
        );
        c.setLayers(latest.current.layers);
        controller.current = c;
        return () => {
            c.destroy();
            controller.current = null;
        };
    }, [theme]);

    useEffect(() => {
        controller.current?.setLayers({ paths, stops, buses, me });
    }, [paths, stops, buses, me]);

    useEffect(() => {
        if (fitKey !== undefined) controller.current?.fitTo(latest.current.fit);
    }, [fitKey]);

    return <div ref={host} className={className ?? "h-full w-full"} />;
}
