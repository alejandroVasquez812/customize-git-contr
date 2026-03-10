import React from "react";

interface ContributionSquareProps {
    date: string;
    count: number;
    isSelected: boolean;
    intensity: number;
    onSelect: (date: string) => void;
}

// Color scale for contributions
const CONTRIBUTION_COLORS: Record<string, string> = {
    none: "#53565bff",
    low: "#0c4629ff",
    medium: "#14832cff",
    high: "#39d353",
} as const;

function getColor(count: number): string {
    if (count === 0) return CONTRIBUTION_COLORS.none;
    if (count < 2) return CONTRIBUTION_COLORS.low;
    if (count < 4) return CONTRIBUTION_COLORS.medium;
    return CONTRIBUTION_COLORS.high;
}

export const ContributionSquare = React.memo(function ContributionSquare({
    date,
    count,
    isSelected,
    intensity,
    onSelect,
}: ContributionSquareProps) {
    const displayColor = isSelected ? getColor(intensity) : getColor(count);
    const tooltipText = `${date}: ${count} contributions${isSelected ? ` — selected ×${intensity}` : ""}`;

    return (
        <div className="relative w-5 h-5 group">
            <button
                type="button"
                aria-label={tooltipText}
                aria-pressed={isSelected}
                onClick={() => onSelect(date)}
                className={`w-full h-full rounded cursor-pointer border transition-all duration-200 ease-in-out shadow-sm hover:scale-110 hover:z-10 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                    isSelected
                        ? "border-blue-500 ring-2 ring-blue-300"
                        : "border-transparent hover:border-gray-500"
                }`}
                style={{ background: displayColor }}
            >
                <span className="sr-only">{tooltipText}</span>
            </button>
            {/* Tooltip on hover */}
            <span
                className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 text-xs rounded bg-gray-900 text-white whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus:opacity-100 pointer-events-none z-20 shadow-lg border border-gray-700"
                aria-hidden="true"
            >
                {date}
            </span>
        </div>
    );
});

export { getColor };