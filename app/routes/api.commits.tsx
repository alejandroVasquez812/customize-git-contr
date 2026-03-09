import { Octokit } from "octokit";
import type { Route } from "./+types/api.commits";

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

export async function action({ request }: Route.ActionArgs) {
    const encoder = new TextEncoder();

    function send(controller: ReadableStreamDefaultController, data: object) {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
    }

    const stream = new ReadableStream({
        async start(controller) {
            try {
                const env = validateEnv();
                const formData = await request.formData();
                const rawDates = formData.get("selectedDates");
                if (!rawDates || typeof rawDates !== "string") {
                    send(controller, { type: "error", error: "No dates were submitted." });
                    controller.close();
                    return;
                }
                const parsedDates: { date: string; intensity: number }[] = JSON.parse(rawDates);

                const today = new Date().toISOString().slice(0, 10);
                const futureDates = parsedDates.filter((d) => d.date > today);
                if (futureDates.length > 0) {
                    send(controller, {
                        type: "error",
                        error: `Cannot create commits for future dates: ${futureDates.map((d) => d.date).join(", ")}`,
                    });
                    controller.close();
                    return;
                }

                const totalCommits = parsedDates.reduce((sum, d) => sum + (d.intensity ?? 1), 0);
                let completedCommits = 0;

                const octokit = new Octokit({ auth: env.TOKEN });
                const owner = env.GITHUB_USER;
                const repo = env.GITHUB_REPO;

                const { data: refData } = await octokit.request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
                    owner, repo, ref: "heads/main",
                });
                const { data: commitData } = await octokit.request("GET /repos/{owner}/{repo}/git/commits/{commit_sha}", {
                    owner, repo, commit_sha: refData.object.sha,
                });
                let baseTreeSha = commitData.tree.sha;
                let parentCommitSha = refData.object.sha;

                for (const dateEntry of parsedDates) {
                    const commitCount = dateEntry.intensity ?? 1;
                    for (let i = 0; i < commitCount; i++) {
                        const { data: blobData } = await octokit.request("POST /repos/{owner}/{repo}/git/blobs", {
                            owner, repo, content: `Commit ${i + 1} for ${dateEntry.date}`, encoding: "utf-8",
                        });
                        const { data: newTreeData } = await octokit.request("POST /repos/{owner}/{repo}/git/trees", {
                            owner, repo, base_tree: baseTreeSha,
                            tree: [{ path: "contribution.txt", mode: "100644", type: "blob", sha: blobData.sha }],
                        });
                        const { data: newCommitData } = await octokit.request("POST /repos/{owner}/{repo}/git/commits", {
                            owner, repo,
                            message: `Commit for ${dateEntry.date}`,
                            author: { name: env.GIT_NAME, email: env.GIT_EMAIL, date: `${dateEntry.date}T12:00:00+00:00` },
                            tree: newTreeData.sha,
                            parents: [parentCommitSha],
                        });
                        baseTreeSha = newTreeData.sha;
                        parentCommitSha = newCommitData.sha;
                        completedCommits++;

                        send(controller, {
                            type: "progress",
                            current: completedCommits,
                            total: totalCommits,
                            date: dateEntry.date,
                        });
                    }
                }

                await octokit.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
                    owner, repo, ref: "heads/main", sha: parentCommitSha, force: false,
                });

                send(controller, {
                    type: "done",
                    message: `Created ${totalCommits} commit${totalCommits !== 1 ? "s" : ""} across ${parsedDates.length} date${parsedDates.length !== 1 ? "s" : ""}.`,
                });
            } catch {
                send(controller, { type: "error", error: "Failed to create commits. Check your repository access." });
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
