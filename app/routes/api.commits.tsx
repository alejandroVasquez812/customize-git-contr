import { Octokit } from "octokit";
import type { Route } from "./+types/api.commits";
import { validateEnv } from "../utils/env";
import {
    type SelectedDate,
    type StreamEvent,
    validateSelectedDates,
    isValidDateString,
} from "../types";

// Rate limit configuration for GitHub API
const RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_RETRY_DELAY_MS = 1000;
const MAX_DATES_PER_REQUEST = 100;
const MAX_COMMITS_PER_DATE = 4;

interface RetryOptions {
    maxRetries?: number;
    retryDelayMs?: number;
}

/**
 * Executes an operation with exponential backoff retry logic
 */
async function withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {},
): Promise<T> {
    const {
        maxRetries = RATE_LIMIT_RETRIES,
        retryDelayMs = RATE_LIMIT_RETRY_DELAY_MS,
    } = options;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError =
                error instanceof Error ? error : new Error(String(error));

            // Don't retry on client errors (4xx)
            if (isClientError(error)) {
                throw error;
            }

            if (attempt < maxRetries) {
                const delayMs = retryDelayMs * Math.pow(2, attempt);
                console.warn(
                    `Attempt ${attempt + 1} failed. Retrying in ${delayMs}ms...`,
                    { error: lastError.message },
                );
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }
    }

    throw new Error(`Max retries exceeded. Last error: ${lastError?.message}`);
}

/**
 * Checks if an error is a client error (4xx) that shouldn't be retried
 */
function isClientError(error: unknown): boolean {
    if (error && typeof error === "object" && "status" in error) {
        const status = (error as { status: number }).status;
        return status >= 400 && status < 500;
    }
    return false;
}

/**
 * Validates that dates are not in the future and have valid format
 */
function validateDatesForCommits(dates: SelectedDate[]): {
    valid: boolean;
    error?: string;
} {
    const today = new Date().toISOString().slice(0, 10);

    // Check for invalid date formats
    const invalidFormats = dates.filter((d) => !isValidDateString(d.date));
    if (invalidFormats.length > 0) {
        return {
            valid: false,
            error: `Invalid date format: ${invalidFormats.map((d) => d.date).join(", ")}. Expected YYYY-MM-DD.`,
        };
    }

    // Check for future dates
    const futureDates = dates.filter((d) => d.date > today);
    if (futureDates.length > 0) {
        return {
            valid: false,
            error: `Cannot create commits for future dates: ${futureDates.map((d) => d.date).join(", ")}`,
        };
    }

    // Check intensity bounds
    const invalidIntensity = dates.filter(
        (d) => d.intensity < 1 || d.intensity > MAX_COMMITS_PER_DATE,
    );
    if (invalidIntensity.length > 0) {
        return {
            valid: false,
            error: `Invalid intensity values (must be 1-${MAX_COMMITS_PER_DATE}): ${invalidIntensity.map((d) => `${d.date}(${d.intensity})`).join(", ")}`,
        };
    }

    return { valid: true };
}

export async function action({ request }: Route.ActionArgs) {
    const encoder = new TextEncoder();

    function send(
        controller: ReadableStreamDefaultController,
        data: StreamEvent,
    ) {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
    }

    const stream = new ReadableStream({
        async start(controller) {
            try {
                const env = validateEnv();
                const formData = await request.formData();
                const rawDates = formData.get("selectedDates");
                
                if (!rawDates || typeof rawDates !== "string") {
                    send(controller, {
                        type: "error",
                        error: "No dates were submitted.",
                    });
                    controller.close();
                    return;
                }

                // Parse and validate dates
                let parsedDates: SelectedDate[];
                try {
                    const rawData = JSON.parse(rawDates);
                    parsedDates = validateSelectedDates(rawData);
                } catch (parseError) {
                    const message =
                        parseError instanceof Error
                            ? parseError.message
                            : "Invalid date data format";
                    send(controller, {
                        type: "error",
                        error: message,
                    });
                    controller.close();
                    return;
                }

                // Check request limits
                if (parsedDates.length > MAX_DATES_PER_REQUEST) {
                    send(controller, {
                        type: "error",
                        error: `Too many dates selected (${parsedDates.length}). Maximum allowed: ${MAX_DATES_PER_REQUEST}`,
                    });
                    controller.close();
                    return;
                }

                // Validate dates for commits
                const dateValidation = validateDatesForCommits(parsedDates);
                if (!dateValidation.valid) {
                    send(controller, {
                        type: "error",
                        error: dateValidation.error!,
                    });
                    controller.close();
                    return;
                }

                const totalCommits = parsedDates.reduce(
                    (sum, d) => sum + d.intensity,
                    0,
                );
                let completedCommits = 0;

                // Create Octokit instance with retry configuration
                const octokit = new Octokit({
                    auth: env.TOKEN,
                    userAgent: "github-contributions-viewer/1.0",
                });

                const owner = env.GITHUB_USER;
                const repo = env.GITHUB_REPO;

                // Get the latest commit ref with retry for rate limiting
                let latestCommitResponse;
                try {
                    latestCommitResponse = await withRetry(() =>
                        octokit.request(
                            "GET /repos/{owner}/{repo}/git/ref/{ref}",
                            {
                                owner,
                                repo,
                                ref: "heads/main",
                            },
                        ),
                    );
                } catch (error) {
                    console.error("Failed to get latest commit:", error);
                    send(controller, {
                        type: "error",
                        error: "Failed to access repository. Check that the repository exists and you have write access.",
                    });
                    controller.close();
                    return;
                }

                // Parse the commit object from the ref response
                const commitData = latestCommitResponse.data.object;

                let baseTreeSha: string;
                let parentCommitSha: string;

                if (commitData) {
                    baseTreeSha = commitData.sha;
                    parentCommitSha = commitData.sha;
                } else {
                    send(controller, {
                        type: "error",
                        error: "Failed to retrieve latest commit from repository",
                    });
                    controller.close();
                    return;
                }

                for (const dateEntry of parsedDates) {
                    for (let i = 0; i < dateEntry.intensity; i++) {
                        try {
                            // Create blob with retry
                            const blobData = await withRetry(() =>
                                octokit.request(
                                    "POST /repos/{owner}/{repo}/git/blobs",
                                    {
                                        owner,
                                        repo,
                                        content: `Commit ${i + 1} for ${dateEntry.date}`,
                                        encoding: "utf-8",
                                    },
                                ),
                            );

                            // Create tree with retry - using replaceTree optimization
                            const newTreeResponse = await withRetry(() =>
                                octokit.request(
                                    "POST /repos/{owner}/{repo}/git/trees",
                                    {
                                        owner,
                                        repo,
                                        base_tree: baseTreeSha,
                                        tree: [
                                            {
                                                path: "contribution.txt",
                                                mode: "100644",
                                                type: "blob",
                                                sha: blobData.data.sha,
                                            },
                                        ],
                                    },
                                ),
                            );

                            // Create commit with retry
                            const newCommitResponse = await withRetry(() =>
                                octokit.request(
                                    "POST /repos/{owner}/{repo}/git/commits",
                                    {
                                        owner,
                                        repo,
                                        message: `Commit for ${dateEntry.date}`,
                                        author: {
                                            name: env.GIT_NAME,
                                            email: env.GIT_EMAIL,
                                            date: `${dateEntry.date}T12:00:00+00:00`,
                                        },
                                        tree: newTreeResponse.data.sha,
                                        parents: [parentCommitSha],
                                    },
                                ),
                            );

                            baseTreeSha = newTreeResponse.data.sha;
                            parentCommitSha = newCommitResponse.data.sha;
                            completedCommits++;

                            send(controller, {
                                type: "progress",
                                current: completedCommits,
                                total: totalCommits,
                                date: dateEntry.date,
                            });
                        } catch (commitError) {
                            console.error(
                                `Failed to create commit for ${dateEntry.date}:`,
                                commitError,
                            );
                            send(controller, {
                                type: "error",
                                error: `Failed to create commit ${i + 1} for ${dateEntry.date}. ${commitError instanceof Error ? commitError.message : "Unknown error"}`,
                            });
                            controller.close();
                            return;
                        }
                    }
                }

                // Update ref with retry
                try {
                    await withRetry(() =>
                        octokit.request(
                            "PATCH /repos/{owner}/{repo}/git/refs/{ref}",
                            {
                                owner,
                                repo,
                                ref: "heads/main",
                                sha: parentCommitSha,
                                force: false,
                            },
                        ),
                    );
                } catch (refError) {
                    console.error("Failed to update ref:", refError);
                    send(controller, {
                        type: "error",
                        error: "Commits created but failed to update branch reference. Check branch protection settings.",
                    });
                    controller.close();
                    return;
                }

                send(controller, {
                    type: "done",
                    message: `Created ${totalCommits} commit${totalCommits !== 1 ? "s" : ""} across ${parsedDates.length} date${parsedDates.length !== 1 ? "s" : ""}.`,
                });
            } catch (error) {
                console.error("Unexpected error in commits action:", error);
                send(controller, {
                    type: "error",
                    error: error instanceof Error 
                        ? error.message 
                        : "Failed to create commits. Check your repository access and rate limits.",
                });
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "application/x-ndjson",
            "Cache-Control": "no-cache",
            "X-Content-Type-Options": "nosniff",
        },
    });
}
