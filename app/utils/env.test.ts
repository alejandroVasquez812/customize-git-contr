import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    validateEnv,
    isValidEmail,
    isValidGitHubToken,
} from "../utils/env";

describe("Environment Validation", () => {
    describe("validateEnv", () => {
        it("should return validated environment variables", () => {
            const result = validateEnv();
            expect(result).toEqual({
                TOKEN: "ghp_test_token_12345",
                GITHUB_USER: "testuser",
                GITHUB_REPO: "test-repo",
                GIT_NAME: "Test User",
                GIT_EMAIL: "test@example.com",
            });
        });

        it("should throw error for missing environment variables", () => {
            const originalToken = process.env.TOKEN;
            delete process.env.TOKEN;

            expect(() => validateEnv()).toThrow(
                "Missing required environment variables: TOKEN"
            );

            process.env.TOKEN = originalToken;
        });

        it("should throw error for empty environment variables", () => {
            const originalToken = process.env.TOKEN;
            process.env.TOKEN = "   ";

            expect(() => validateEnv()).toThrow(
                "Empty environment variables: TOKEN"
            );

            process.env.TOKEN = originalToken;
        });

        it("should trim whitespace from values", () => {
            const originalUser = process.env.GITHUB_USER;
            process.env.GITHUB_USER = "  testuser  ";

            const result = validateEnv();
            expect(result.GITHUB_USER).toBe("testuser");

            process.env.GITHUB_USER = originalUser;
        });
    });

    describe("isValidEmail", () => {
        it("should return true for valid email addresses", () => {
            expect(isValidEmail("test@example.com")).toBe(true);
            expect(isValidEmail("user.name@domain.org")).toBe(true);
            expect(isValidEmail("user+tag@example.co.uk")).toBe(true);
        });

        it("should return false for invalid email addresses", () => {
            expect(isValidEmail("invalid")).toBe(false);
            expect(isValidEmail("invalid@")).toBe(false);
            expect(isValidEmail("@invalid.com")).toBe(false);
            expect(isValidEmail("invalid@.com")).toBe(false);
            expect(isValidEmail("")).toBe(false);
        });
    });

    describe("isValidGitHubToken", () => {
        it("should return true for valid GitHub token prefixes", () => {
            expect(isValidGitHubToken("ghp_test123")).toBe(true);
            expect(isValidGitHubToken("gho_test123")).toBe(true);
            expect(isValidGitHubToken("ghu_test123")).toBe(true);
            expect(isValidGitHubToken("ghs_test123")).toBe(true);
            expect(isValidGitHubToken("ghr_test123")).toBe(true);
        });

        it("should return false for invalid token formats", () => {
            expect(isValidGitHubToken("invalid_token")).toBe(false);
            expect(isValidGitHubToken("abc_test123")).toBe(false);
            expect(isValidGitHubToken("")).toBe(false);
        });
    });
});