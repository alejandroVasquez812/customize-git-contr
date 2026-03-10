import React, { useCallback, useMemo, useState } from "react";
import { useLoaderData, useNavigate } from "react-router";
import type { Route } from "./+types/profile";
import { validateEnv } from "../utils/env";
import {
    type Contributions,
    type Week,
    type SelectedDate,
    type ActionResult,
    type StreamEvent,
    isErrorResponse,
    isContributions,
} from "../types";
import {
    ContributionSquare,
    getColor,
    ConfirmationDialog,
    ProgressBar,
} from "../components";

// Constants
const LOADER_TIMEOUT_MS = 30000;
const MAX_INTENSITY = 4;

export async function loader(_args: Route.LoaderArgs) {
    async function getContributionData(): Promise<
        { ok: false; error: string } | Contributions
    > {
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
                    Authorization: `Bearer ${env.TOKEN}`,
                },
                body: JSON.stringify({
                    query,
                    variables: { userName: env.GITHUB_USER },
                }),
            });

            const data = await response.json();

            if (data.errors || data.status === 401) {
                console.error("GitHub API errors:", data.errors);
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
                weeks: calendar.weeks,
                totalContributions: calendar.totalContributions,
            };
        } catch (error) {
            console.error("Failed to fetch GitHub contributions:", error);
            return {
                ok: false as const,
                error: "Failed to reach GitHub API. Check your network and token.",
            };
        }
    }

    // Add loading state with timeout
    const result = await Promise.race([
        getContributionData(),
        new Promise<never>((_, reject) => {
            setTimeout(
                () => reject(new Error("Request timed out")),
                LOADER_TIMEOUT_MS,
            );
        }),
    ]);

    return result;
}

export default function Profile() {
    const loaderResult = useLoaderData<typeof loader>();

    // Handle loader errors
    const loaderError = isErrorResponse(loaderResult)
        ? loaderResult.error
        : null;
    const contributions = isContributions(loaderResult)
        ? loaderResult
        : undefined;

    // Optimistic contributions: applied immediately after a successful submit
    // so the calendar reflects new commits without waiting for the GitHub API
    // propagation delay on revalidation.
    const [optimisticContributions, setOptimisticContributions] = useState<
        Contributions | undefined
    >(undefined);

    const displayContributions = optimisticContributions ?? contributions;
    const weeks: Week[] = displayContributions?.weeks || [];

    // State
    const [selectedDates, setSelectedDates] = useState<SelectedDate[]>([]);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [progress, setProgress] = useState<{
        current: number;
        total: number;
        date: string;
    } | null>(null);
    const [actionResult, setActionResult] = useState<ActionResult | undefined>(
        undefined,
    );

    const navigate = useNavigate();

    // Memoized handlers
    const handleSquareClick = useCallback((date: string) => {
        setSelectedDates((prev) => {
            const existing = prev.find((d) => d.date === date);
            if (!existing) return [...prev, { date, intensity: 1 }];
            if (existing.intensity >= MAX_INTENSITY) {
                return prev.filter((d) => d.date !== date);
            }
            return prev.map((d) =>
                d.date === date ? { ...d, intensity: d.intensity + 1 } : d,
            );
        });
    }, []);

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        setShowConfirm(true);
    }, []);

    const handleConfirm = useCallback(async () => {
        setShowConfirm(false);
        setIsSubmitting(true);
        setProgress(null);
        setActionResult(undefined);

        // Capture current selected dates for the optimistic update
        const submittedDates = selectedDates;

        try {
            const formData = new FormData();
            formData.set("selectedDates", JSON.stringify(submittedDates));

            const response = await fetch("/api/commits", {
                method: "POST",
                body: formData,
            });

            if (!response.body) {
                throw new Error("No response body");
            }

            const reader = response.body.getReader();
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
                    try {
                        const event: StreamEvent = JSON.parse(line);
                        if (event.type === "progress") {
                            setProgress({
                                current: event.current,
                                total: event.total,
                                date: event.date,
                            });
                        } else if (event.type === "done") {
                            // Apply optimistic update so the calendar immediately
                            // reflects the new commits (GitHub API has propagation delay).
                            setOptimisticContributions((prev) => {
                                const base = prev ?? contributions;
                                if (!base) return prev;
                                const addedTotal = submittedDates.reduce(
                                    (sum, d) => sum + d.intensity,
                                    0,
                                );
                                return {
                                    totalContributions:
                                        base.totalContributions + addedTotal,
                                    weeks: base.weeks.map((week) => ({
                                        ...week,
                                        contributionDays:
                                            week.contributionDays.map((day) => {
                                                const submitted =
                                                    submittedDates.find(
                                                        (d) =>
                                                            d.date === day.date,
                                                    );
                                                return submitted
                                                    ? {
                                                          ...day,
                                                          contributionCount:
                                                              day.contributionCount +
                                                              submitted.intensity,
                                                      }
                                                    : day;
                                            }),
                                    })),
                                };
                            });
                            setActionResult({
                                ok: true,
                                message: event.message,
                            });
                            setSelectedDates([]);
                        } else if (event.type === "error") {
                            setActionResult({ ok: false, error: event.error });
                        }
                    } catch (parseError) {
                        console.error(
                            "Failed to parse stream event:",
                            parseError,
                            line,
                        );
                    }
                }
            }
        } catch (error) {
            console.error("Submit error:", error);
            setActionResult({
                ok: false,
                error: "Network error. Please try again.",
            });
        } finally {
            setIsSubmitting(false);
            setProgress(null);
        }
    }, [selectedDates, contributions]);

    const handleCancel = useCallback(() => {
        setShowConfirm(false);
    }, []);

    const handleBack = useCallback(() => {
        navigate(-1);
    }, [navigate]);

    // Memoized values
    const totalDays = useMemo(
        () =>
            weeks.reduce((acc, week) => acc + week.contributionDays.length, 0),
        [weeks],
    );

    const selectedDatesText = useMemo(
        () =>
            selectedDates.map((d) => `${d.date} (×${d.intensity})`).join(", "),
        [selectedDates],
    );

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gradientFrom via-gradientVia to-gradientTo p-10">
            <div className="w-full bg-card backdrop-blur-lg shadow-card rounded-2xl p-8 border border-border relative">
                <button
                    type="button"
                    onClick={handleBack}
                    className="absolute left-6 top-6 flex items-center gap-2 px-4 py-2 bg-green-400 text-gray-900 font-semibold rounded-lg shadow hover:bg-green-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-300"
                    aria-label="Go back"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="w-5 h-5"
                        aria-hidden="true"
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
                    {displayContributions
                        ? displayContributions.totalContributions
                        : 0}{" "}
                    in the last year
                </h1>

                <p className="mb-4 text-lg text-white text-center font-display">
                    Click squares to select dates. Click again to increase
                    intensity (1–4 commits). Click at max to deselect.
                </p>

                {loaderError && (
                    <div
                        className="mb-4 px-4 py-3 rounded-lg bg-red-900/60 border border-red-500 text-red-300 text-sm text-center"
                        role="alert"
                    >
                        {loaderError}
                    </div>
                )}

                {/* Intensity legend */}
                <div
                    className="flex items-center gap-3 justify-center mb-4 text-sm text-gray-400"
                    role="img"
                    aria-label="Contribution intensity legend"
                >
                    <span>Less</span>
                    {[0, 1, 2, 4].map((level) => (
                        <div
                            key={level}
                            className="w-4 h-4 rounded"
                            style={{ background: getColor(level) }}
                            title={
                                level === 0 ? "No commits" : `${level}+ commits`
                            }
                            aria-hidden="true"
                        />
                    ))}
                    <span>More</span>
                    <span className="ml-4 text-xs text-gray-500">
                        Click to cycle intensity
                    </span>
                </div>

                <div className="overflow-x-auto pb-4">
                    <div
                        className="flex gap-2 justify-center"
                        role="grid"
                        aria-label="GitHub contribution calendar"
                    >
                        {weeks.map((week, wIdx) => (
                            <div
                                key={wIdx}
                                className="flex flex-col gap-2"
                                role="column"
                            >
                                {week.contributionDays.map((day) => {
                                    const selectedEntry = selectedDates.find(
                                        (d) => d.date === day.date,
                                    );
                                    return (
                                        <ContributionSquare
                                            key={day.date}
                                            date={day.date}
                                            count={day.contributionCount}
                                            isSelected={!!selectedEntry}
                                            intensity={
                                                selectedEntry?.intensity ?? 0
                                            }
                                            onSelect={handleSquareClick}
                                        />
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

                <ConfirmationDialog
                    isOpen={showConfirm}
                    selectedCount={selectedDates.length}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                />

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

                {isSubmitting && progress && (
                    <ProgressBar
                        current={progress.current}
                        total={progress.total}
                        date={progress.date}
                    />
                )}

                {!isSubmitting && actionResult && (
                    <div
                        className={`mb-6 px-4 py-3 rounded-lg text-sm text-center border ${
                            actionResult.ok
                                ? "bg-green-900/60 border-green-500 text-green-300"
                                : "bg-red-900/60 border-red-500 text-red-300"
                        }`}
                        role="alert"
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
                    {selectedDates.length > 0 ? (
                        <pre className="bg-gray-900/80 p-4 rounded-lg text-xs text-green-300 overflow-x-auto">
                            {selectedDatesText}
                        </pre>
                    ) : (
                        <p className="text-gray-400 text-sm">
                            No dates selected
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
