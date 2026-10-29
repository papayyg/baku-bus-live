import { statSync } from "node:fs";
import { extname, join, normalize, sep } from "node:path";
import { brotliCompressSync, constants } from "node:zlib";

const TYPES: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".txt": "text/plain; charset=utf-8",
};

const COMPRESSIBLE = new Set([".html", ".js", ".mjs", ".css", ".json", ".svg", ".webmanifest", ".txt"]);

type Entry = { raw: Uint8Array; mtime: number; br?: Uint8Array; gz?: Uint8Array; type: string };

export class StaticFiles {
    private readonly cache = new Map<string, Entry>();

    constructor(private readonly root: string) {}

    async serve(req: Request, url: URL): Promise<Response> {
        if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
        let path = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, "");
        if (path.split(sep).includes("..")) return new Response("Not found", { status: 404 });
        if (!path || !extname(path)) path = "index.html";

        const entry = await this.load(path);
        if (!entry)
            return path === "index.html" ? new Response("App is not built", { status: 503 }) : new Response("Not found", { status: 404 });

        const immutable = path.startsWith("assets/");
        const headers: Record<string, string> = {
            "Content-Type": entry.type,
            "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
            Vary: "Accept-Encoding",
            "X-Content-Type-Options": "nosniff",
        };
        const accept = req.headers.get("accept-encoding") ?? "";
        let body = entry.raw;
        if (entry.br && accept.includes("br")) {
            body = entry.br;
            headers["Content-Encoding"] = "br";
        } else if (entry.gz && accept.includes("gzip")) {
            body = entry.gz;
            headers["Content-Encoding"] = "gzip";
        }
        return new Response(req.method === "HEAD" ? null : body, { headers });
    }

    private async load(path: string): Promise<Entry | undefined> {
        const full = join(this.root, path);
        let mtime: number;
        try {
            mtime = statSync(full).mtimeMs;
        } catch {
            this.cache.delete(path);
            return undefined;
        }
        const hit = this.cache.get(path);
        if (hit && hit.mtime === mtime) return hit;
        const raw = new Uint8Array(await Bun.file(full).arrayBuffer());
        const ext = extname(path);
        const entry: Entry = { raw, mtime, type: TYPES[ext] ?? "application/octet-stream" };
        if (COMPRESSIBLE.has(ext) && raw.length > 1024) {
            entry.br = new Uint8Array(brotliCompressSync(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }));
            entry.gz = Bun.gzipSync(raw);
        }
        this.cache.set(path, entry);
        return entry;
    }
}
