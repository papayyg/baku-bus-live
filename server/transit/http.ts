export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export const defaultFetcher: Fetcher = (url, init) => fetch(url, init);

export async function fetchJson(fetcher: Fetcher, url: string, init: RequestInit = {}, timeoutMs = 10_000): Promise<unknown> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) await Bun.sleep(400);
        try {
            const res = await fetcher(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
            if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (err) {
            lastError = err;
        }
    }
    throw lastError;
}

export class TtlCache<K, V> {
    private readonly values = new Map<K, { at: number; value: V }>();
    private readonly pending = new Map<K, Promise<V>>();

    constructor(
        private readonly ttlMs: number,
        private readonly now: () => number = Date.now,
    ) {}

    peek(key: K): { at: number; value: V } | undefined {
        return this.values.get(key);
    }

    get(key: K, load: () => Promise<V>): Promise<V> {
        const hit = this.values.get(key);
        if (hit && this.now() - hit.at < this.ttlMs) return Promise.resolve(hit.value);
        let p = this.pending.get(key);
        if (!p) {
            p = load()
                .then((value) => {
                    this.values.set(key, { at: this.now(), value });
                    if (this.values.size > 2000) this.evict();
                    return value;
                })
                .finally(() => this.pending.delete(key));
            this.pending.set(key, p);
        }
        return p;
    }

    private evict(): void {
        const limit = this.now() - this.ttlMs;
        for (const [k, v] of this.values) if (v.at < limit) this.values.delete(k);
    }
}
