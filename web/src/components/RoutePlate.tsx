type Props = {
    line: string;
    size?: "sm" | "md" | "lg";
    dim?: boolean;
    className?: string;
};

const SIZES = {
    sm: "h-6 min-w-8 px-2 text-caption",
    md: "h-8 min-w-12 px-3 text-sm",
    lg: "h-11 min-w-14 px-4 text-lg",
} as const;

export function RoutePlate({ line, size = "md", dim = false, className = "" }: Props) {
    return (
        <span
            className={`tabular inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${SIZES[size]} ${
                dim ? "bg-soft text-body" : "bg-primary text-on-primary"
            } ${className}`}
        >
            {line}
        </span>
    );
}

export function LinePlates({ lines, max }: { lines: string[]; max: number }) {
    if (lines.length === 0) return null;
    return (
        <span className="flex shrink-0 items-center gap-1">
            {lines.slice(0, max).map((l) => (
                <RoutePlate key={l} line={l} size="sm" />
            ))}
            {lines.length > max && <span className="pl-0.5 text-caption text-body">+{lines.length - max}</span>}
        </span>
    );
}
