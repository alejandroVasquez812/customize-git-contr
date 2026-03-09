import React from "react";
import { useLoaderData, useRevalidator } from "react-router";
import { useNavigate } from "react-router";
import type { Route } from "./+types/profile";
type Week = {
    contributionDays: {
        date: string;
        contributionCount: number;
    }[];
};

type Contributions = {
    weeks: Week[];
    totalContributions: number;
};

type ActionResult = { ok: boolean; message?: string; error?: string };

type ProgressEvent = { type: "progress"; current: number; total: number; date: string };
type DoneEvent = { type: "done"; message: string };
type ErrorEvent = { type: "error"; error: string };
type StreamEvent = ProgressEvent | DoneEvent | ErrorEvent;

function validateEnv() {
    const required = {
        TOKEN: process.env.TOKEN,
        GITHUB_USER: process.env.GITHUB_USER,
        GITHUB_REPO: process.env.GITHUB_REPO,
        GIT_NAME: process.env.GIT_NAME,
        GIT_EMAIL: process.env.GIT_EMAIL,
    };
    const missing = Object.entries(required)
        .filter(([, v]) => !v)
        .map(([k]) => k);
    if (missing.length > 0)
        throw new Error(
            `Missing required environment variables: ${missing.join(", ")}`,
        );
    return required as Record<keyof typeof required, string>;
}

export async function loader({}: Route.LoaderArgs) {
    async function getContributionData() {
        try {
            const env = validateEnv();
            const API_ENDPOINT = "https://api.github.com/graphql";
            const query = `
            query($userName: String!) {
                user(login: $userName) {
                    contributionsCollection {
                        contributionCalendar {
                        totalContributions
                         weeks {
                            contributionDays {
                            date
                            contributionCount
                            }
                        }
                        }
                    }
                 }
            }`;
            const response = await fetch(API_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `bearer ${env.TOKEN}`,
                },
                body: JSON.stringify({
                    query,
                    variables: { userName: env.GITHUB_USER },
                }),
            });

            const data = await response.json();

            if (data.errors || data.status === 401) {
                return {
                    ok: false as const,
                    error: "GitHub API returned errors. Check your token and username.",
                };
            }

            const calendar =
                data?.data?.user?.contributionsCollection?.contributionCalendar;
            if (!calendar) {
                return {
                    ok: false as const,
                    error: "No contribution data found for this user.",
                };
            }

            return {
                ok: true as const,
                data: {
                    weeks: calendar.weeks,
                    totalContributions: calendar.totalContributions,
                } as Contributions,
            };
        } catch (error) {
            return {
                ok: false as const,
                error: "Failed to reach GitHub API. Check your network and token.",
            };
        }
    }

    return getContributionData();
}


export default function Profile() {
    const loaderResult = useLoaderData<typeof loader>();
    const loaderError =
        loaderResult && !loaderResult.ok ? loaderResult.error : null;
    const contributions = loaderResult?.ok
        ? loaderResult.data
        : { weeks: [], totalContributions: 0 };
    const weeks: Week[] = contributions.weeks || [];

    const [selectedDates, setSelectedDates] = React.useState<
        { date: string; intensity: number }[]
    >([]);
    const [showConfirm, setShowConfirm] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [progress, setProgress] = React.useState<{ current: number; total: number; date: string } | null>(null);
    const [actionResult, setActionResult] = React.useState<ActionResult | undefined>(undefined);
    const navigate = useNavigate();
    const { revalidate } = useRevalidator();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setShowConfirm(true);
    };

    const handleConfirm = async () => {
        setShowConfirm(false);
        setIsSubmitting(true);
        setProgress(null);
        setActionResult(undefined);

        try {
            const formData = new FormData();
            formData.set("selectedDates", JSON.stringify(selectedDates));

            const response = await fetch("/api/commits", { method: "POST", body: formData });
            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop()!;
                for (const line of lines) {
                    if (!line.trim()) continue;
                    const event: StreamEvent = JSON.parse(line);
                    if (event.type === "progress") {
                        setProgress({ current: event.current, total: event.total, date: event.date });
                    } else if (event.type === "done") {
                        setActionResult({ ok: true, message: event.message });
                        setSelectedDates([]);
                        revalidate();
                    } else if (event.type === "error") {
                        setActionResult({ ok: false, error: event.error });
                    }
                }
            }
        } catch {
            setActionResult({ ok: false, error: "Network error. Please try again." });
        } finally {
            setIsSubmitting(false);
            setProgress(null);
        }
    };

    // Color scale for contributions
    function getColor(count: number) {
        if (count === 0) return "#53565bff";
        if (count < 2) return "#0c4629ff";
        if (count < 4) return "#14832cff";
        return "#39d353";
    }

    // Check if a date is selected
    function isSelected(date: string) {
        return selectedDates.some((d) => d.date === date);
    }

    // Handle tap/click on a square — cycles intensity 1→2→3→4→deselect
    function handleSquareClick(date: string) {
        setSelectedDates((prev) => {
            const existing = prev.find((d) => d.date === date);
            if (!existing) return [...prev, { date, intensity: 1 }];
            if (existing.intensity >= 4)
                return prev.filter((d) => d.date !== date);
            return prev.map((d) =>
                d.date === date ? { ...d, intensity: d.intensity + 1 } : d,
            );
        });
    }

    // Count total days
    const totalDays = weeks.reduce(
        (acc, week) => acc + week.contributionDays.length,
        0,
    );

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gradientFrom via-gradientVia to-gradientTo p-10">
            <div className="w-full bg-card backdrop-blur-lg shadow-card rounded-2xl p-8 border border-border relative">
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="absolute left-6 top-6 flex items-center gap-2 px-4 py-2 bg-green-400 text-gray-900 font-semibold rounded-lg shadow hover:bg-green-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-300"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="w-5 h-5"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.75 19.5L8.25 12l7.5-7.5"
                        />
                    </svg>
                    Back
                </button>
                <h1 className="text-3xl font-extrabold mb-6 text-white tracking-tight text-center font-display">
                    GitHub Contributions :{" "}
                    {contributions ? contributions.totalContributions : 0} in
                    the last year
                </h1>
                <p className="mb-4 text-lg text-white text-center font-display">
                    Click squares to select dates. Click again to increase
                    intensity (1–4 commits). Click at max to deselect.
                </p>

                {loaderError && (
                    <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/60 border border-red-500 text-red-300 text-sm text-center">
                        {loaderError}
                    </div>
                )}

                {/* Intensity legend */}
                <div className="flex items-center gap-3 justify-center mb-4 text-sm text-gray-400">
                    <span>Less</span>
                    {[0, 1, 2, 4].map((level) => (
                        <div
                            key={level}
                            className="w-4 h-4 rounded"
                            style={{ background: getColor(level) }}
                            title={
                                level === 0 ? "No commits" : `${level}+ commits`
                            }
                        />
                    ))}
                    <span>More</span>
                    <span className="ml-4 text-xs text-gray-500">
                        Click to cycle intensity
                    </span>
                </div>

                <div className="overflow-x-auto pb-4">
                    <div className="flex gap-2 justify-center">
                        {weeks.map((week, wIdx) => (
                            <div key={wIdx} className="flex flex-col gap-2">
                                {week.contributionDays.map((day) => {
                                    const selectedEntry = selectedDates.find(
                                        (d) => d.date === day.date,
                                    );
                                    const displayColor = selectedEntry
                                        ? getColor(selectedEntry.intensity)
                                        : getColor(day.contributionCount);
                                    return (
                                        <div
                                            key={day.date}
                                            className="relative w-5 h-5 group"
                                        >
                                            <div
                                                title={`${day.date}: ${day.contributionCount} contributions${selectedEntry ? ` — selected ×${selectedEntry.intensity}` : ""}`}
                                                className={`w-full h-full rounded cursor-pointer border transition-all duration-200 ease-in-out shadow-sm hover:scale-110 hover:z-10 ${isSelected(day.date) ? "border-blue-500 ring-2 ring-blue-300" : "border-transparent"}`}
                                                style={{
                                                    background: displayColor,
                                                }}
                                                onClick={() =>
                                                    handleSquareClick(day.date)
                                                }
                                            />
                                            {/* Tooltip on hover */}
                                            <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 text-xs rounded bg-gray-900 text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-20 shadow-lg border border-gray-700">
                                                {day.date}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>

                <p className="mt-6 text-lg text-white text-center">
                    Total days:{" "}
                    <strong className="text-blue-300">{totalDays}</strong>
                </p>

                {/* Confirmation dialog */}
                {showConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                        <div className="bg-gray-900 border border-border rounded-2xl p-8 shadow-card max-w-sm w-full text-center">
                            <h2 className="text-xl font-bold text-white mb-3">
                                Confirm Submission
                            </h2>
                            <p className="text-gray-300 mb-6">
                                This will create backdated commits for{" "}
                                <strong className="text-white">
                                    {selectedDates.length}
                                </strong>{" "}
                                date(s). This cannot be undone.
                            </p>
                            <div className="flex gap-4 justify-center">
                                <button
                                    onClick={() => setShowConfirm(false)}
                                    className="px-5 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    className="px-5 py-2 rounded-lg bg-gradient-to-r from-primary-light to-primary-dark text-white font-semibold hover:scale-105 transition-transform"
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <form
                    onSubmit={handleSubmit}
                    className="flex flex-col items-center mb-4 mt-6"
                >
                    <button
                        type="submit"
                        disabled={selectedDates.length === 0 || isSubmitting}
                        className="px-6 py-2 bg-gradient-to-r from-primary-light to-primary-dark text-white font-semibold rounded-lg shadow hover:scale-105 hover:from-primary disabled:opacity-50 disabled:cursor-not-allowed hover:to-primary-dark transition-transform duration-200 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        {isSubmitting
                            ? "Creating commits…"
                            : "Submit Selected Dates"}
                    </button>
                </form>

                {isSubmitting && (
                    <div className="mt-4 px-4 py-3 rounded-lg bg-gray-800 border border-border text-sm text-center">
                        <div className="text-gray-300 mb-2">
                            {progress
                                ? `Commit ${progress.current} of ${progress.total} — ${progress.date}`
                                : "Preparing…"}
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: progress ? `${(progress.current / progress.total) * 100}%` : "0%" }}
                            />
                        </div>
                    </div>
                )}

                {!isSubmitting && actionResult && (
                    <div
                        className={`mb-6 px-4 py-3 rounded-lg text-sm text-center border ${
                            actionResult.ok
                                ? "bg-green-900/60 border-green-500 text-green-300"
                                : "bg-red-900/60 border-red-500 text-red-300"
                        }`}
                    >
                        {actionResult.ok
                            ? actionResult.message
                            : actionResult.error}
                    </div>
                )}

                <div className="mt-2 bg-card rounded-xl p-6 shadow-inner border border-border">
                    <h2 className="font-semibold text-white mb-3 text-xl">
                        Selected Dates
                    </h2>
                    <pre className="bg-gray-900/80 p-4 rounded-lg text-xs text-green-300 overflow-x-auto">
                        {selectedDates
                            .map((d) => `${d.date} (×${d.intensity})`)
                            .join(", ")}
                    </pre>
                </div>
            </div>
        </div>
    );
}
