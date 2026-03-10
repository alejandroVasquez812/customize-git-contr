import { describe, it, expect } from "vitest";
import {
    isErrorResponse,
    isContributions,
    isValidDateString,
    isValidSelectedDate,
    validateSelectedDates,
    type LoaderResult,
    type Contributions,
} from "../types";

describe("Type Guards", () => {
    describe("isErrorResponse", () => {
        it("should return true for error responses", () => {
            const errorResult: LoaderResult = { ok: false, error: "Test error" };
            expect(isErrorResponse(errorResult)).toBe(true);
        });

        it("should return false for contributions data", () => {
            const contributionsResult: Contributions = {
                weeks: [{ contributionDays: [{ date: "2024-01-01", contributionCount: 5 }] }],
                totalContributions: 5,
            };
            expect(isErrorResponse(contributionsResult)).toBe(false);
        });
    });

    describe("isContributions", () => {
        it("should return true for contributions data", () => {
            const contributionsResult: Contributions = {
                weeks: [{ contributionDays: [{ date: "2024-01-01", contributionCount: 5 }] }],
                totalContributions: 5,
            };
            expect(isContributions(contributionsResult)).toBe(true);
        });

        it("should return false for error responses", () => {
            const errorResult: LoaderResult = { ok: false, error: "Test error" };
            expect(isContributions(errorResult)).toBe(false);
        });
    });
});

describe("Validation Helpers", () => {
    describe("isValidDateString", () => {
        it("should return true for valid ISO 8601 dates", () => {
            expect(isValidDateString("2024-01-01")).toBe(true);
            expect(isValidDateString("2024-12-31")).toBe(true);
            expect(isValidDateString("2020-02-29")).toBe(true); // Leap year
        });

        it("should return false for invalid date formats", () => {
            expect(isValidDateString("2024/01/01")).toBe(false);
            expect(isValidDateString("01-01-2024")).toBe(false);
            expect(isValidDateString("2024-1-1")).toBe(false);
            expect(isValidDateString("2024-13-01")).toBe(false); // Invalid month
            expect(isValidDateString("2024-01-32")).toBe(false); // Invalid day
            expect(isValidDateString("not-a-date")).toBe(false);
            expect(isValidDateString("")).toBe(false);
        });
    });

    describe("isValidSelectedDate", () => {
        it("should return true for valid selected dates", () => {
            expect(isValidSelectedDate({ date: "2024-01-01", intensity: 1 })).toBe(true);
            expect(isValidSelectedDate({ date: "2024-01-01", intensity: 4 })).toBe(true);
        });

        it("should return false for invalid intensity values", () => {
            expect(isValidSelectedDate({ date: "2024-01-01", intensity: 0 })).toBe(false);
            expect(isValidSelectedDate({ date: "2024-01-01", intensity: 5 })).toBe(false);
            expect(isValidSelectedDate({ date: "2024-01-01", intensity: -1 })).toBe(false);
        });

        it("should return false for invalid date formats", () => {
            expect(isValidSelectedDate({ date: "invalid", intensity: 1 })).toBe(false);
            expect(isValidSelectedDate({ date: "2024/01/01", intensity: 1 })).toBe(false);
        });

        it("should return false for non-objects", () => {
            expect(isValidSelectedDate(null)).toBe(false);
            expect(isValidSelectedDate(undefined)).toBe(false);
            expect(isValidSelectedDate("string")).toBe(false);
            expect(isValidSelectedDate(123)).toBe(false);
        });
    });

    describe("validateSelectedDates", () => {
        it("should return validated array for valid input", () => {
            const input = [
                { date: "2024-01-01", intensity: 1 },
                { date: "2024-01-02", intensity: 2 },
            ];
            const result = validateSelectedDates(input);
            expect(result).toEqual(input);
        });

        it("should throw error for non-array input", () => {
            expect(() => validateSelectedDates("not an array")).toThrow(
                "Invalid data: expected an array"
            );
            expect(() => validateSelectedDates(null)).toThrow();
        });

        it("should throw error for invalid date entries", () => {
            const input = [
                { date: "2024-01-01", intensity: 1 },
                { date: "invalid", intensity: 1 },
            ];
            expect(() => validateSelectedDates(input)).toThrow("Invalid date entries");
        });

        it("should throw error for invalid intensity values", () => {
            const input = [
                { date: "2024-01-01", intensity: 10 },
            ];
            expect(() => validateSelectedDates(input)).toThrow("Invalid date entries");
        });
    });
});