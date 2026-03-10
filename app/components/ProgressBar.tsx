import { useMemo } from "react";

interface ProgressBarProps {
    current: number;
    total: number;
    date: string;
}

export function ProgressBar({ current, total, date }: ProgressBarProps) {
    const percentage = useMemo(() => (current / total) * 100, [current, total]);

    return (
        <div
            className="mt-4 px-4 py-3 rounded-lg bg-gray-800 border border-border text-sm text-center"
            role="progressbar"
            aria-valuenow={current}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label={`Creating commits: ${current} of ${total}`}
        >
            <div className="text-gray-300 mb-2">
                Commit {current} of {total} — {date}
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}