import type { StopWithLines } from "@shared/api.ts";
import type { ReactNode } from "react";
import { shortPlace } from "../lib/format.ts";
import { useT } from "../lib/i18n.ts";
import { useNav } from "../lib/nav.ts";
import { LinePlates } from "./RoutePlate.tsx";
import { ListRow } from "./ui.tsx";

export function StopRow({ stop, first, meta }: { stop: StopWithLines; first: boolean; meta?: ReactNode }) {
    const push = useNav((s) => s.push);
    const t = useT();
    return (
        <ListRow first={first} chevron={false} onClick={() => push({ name: "stop", code9: stop.code9 })}>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-md font-medium">{stop.name}</span>
                <span className="block truncate text-sm text-body">
                    {meta}
                    {meta && stop.towards.length > 0 ? " · " : ""}
                    {stop.towards.length > 0 ? t.towards(shortPlace(stop.towards[0]!)) : ""}
                </span>
            </span>
            <LinePlates lines={stop.lines} max={3} />
        </ListRow>
    );
}
