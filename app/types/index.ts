/**
 * Shared type definitions for the GitHub Contributions application
 */

// Contribution calendar types
export interface ContributionDay {
    date: string;
    contributionCount: number;
}

export interface Week {
    contributionDays: ContributionDay[];
}

export interface Contributions {
    weeks: Week[];
    totalContributions: number;
}

// Selected date with intensity for custom commits
export interface SelectedDate {
    date: string;
    intensity: number;
}

// Loader result types
export type LoaderResult = 
    | { ok: false; error: string }
    | Contributions;

// Action result types
export interface ActionResult {
    ok: boolean;
    message?: string;
    error?: string;
}

// Stream event types for SSE
export interface ProgressEvent {
    type: "progress";
    current: number;
    total: number;
    date: string;
}

export interface DoneEvent {
    type: "done";
    message: string;
}

export interface ErrorEvent {
    type: "error";
    error: string;
}

export type StreamEvent = ProgressEvent | DoneEvent | ErrorEvent;

// Type guards
export function isErrorResponse(
    result: LoaderResult
): result is { ok: false; error: string } {
    return "error" in result && !("weeks" in result);
}

export function isContributions(
    result: LoaderResult
): result is Contributions {
    return "weeks" in result && "totalContributions" in result;
}

// Validation helper for SelectedDate array
export function isValidSelectedDate(obj: unknown): obj is SelectedDate {
    if (typeof obj !== "object" || obj === null) return false;
    const candidate = obj as Record<string, unknown>;
    return (
        typeof candidate.date === "string" &&
        typeof candidate.intensity === "number" &&
        candidate.intensity >= 1 &&
        candidate.intensity <= 4 &&
        isValidDateString(candidate.date)
    );
}

export function isValidDateString(date: string): boolean {
    // Check ISO 8601 date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) return false;
    
    const parsedDate = new Date(date);
    return !isNaN(parsedDate.getTime());
}

export function validateSelectedDates(data: unknown): SelectedDate[] {
    if (!Array.isArray(data)) {
        throw new Error("Invalid data: expected an array");
    }
    
    const invalidItems = data.filter(item => !isValidSelectedDate(item));
    if (invalidItems.length > 0) {
        throw new Error(
            `Invalid date entries: ${JSON.stringify(invalidItems)}`
        );
    }
    
    return data as SelectedDate[];
}