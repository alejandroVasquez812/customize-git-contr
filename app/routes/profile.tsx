import React from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useNavigate } from "react-router";
import type { Route } from "./+types/profile";
import { Octokit } from "octokit";

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

export async function loader({ params }: Route.LoaderArgs) {

   // Replace with your GitHub username
   const GITHUB_USERNAME = process.env.GITHUB_USER;
    console.log(GITHUB_USERNAME);
   // Replace with your Personal Access Token
    const GITHUB_TOKEN = process.env.TOKEN;

   // The GitHub GraphQL API endpoint
   const API_ENDPOINT = "https://api.github.com/graphql";

   // The GraphQL query to get the contribution calendar
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
  }
`;

   async function getContributionData() {
       try {
           const response = await fetch(API_ENDPOINT, {
               method: "POST",
               headers: {
                   "Content-Type": "application/json",
                   Authorization: `bearer ${GITHUB_TOKEN}`,
               },
               body: JSON.stringify({
                   query: query,
                   variables: {
                       userName: GITHUB_USERNAME,
                   },
               }),
           });

           const data = await response.json();

           if (data.errors) {
               console.error("GraphQL Errors:", data.errors);
               return;
           }

           const contributionCalendar =
               data.data.user.contributionsCollection.contributionCalendar;
           console.log(
               `Total Contributions in the last year: ${contributionCalendar.totalContributions}`
           );
           // Process and display the daily contribution data
           const contributions: Contributions = {
               weeks: contributionCalendar.weeks,
               totalContributions: contributionCalendar.totalContributions,
           };

           return contributions;
       } catch (error) {
           console.error("Failed to fetch data:", error);
       }
   }

   return getContributionData();
}  

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const selectedDates = formData.get("selectedDates");
  console.log("Selected Dates:", selectedDates);
  const octokit = new Octokit({ auth: process.env.TOKEN });
  const owner = process.env.GITHUB_USER || "";
  const repo = process.env.GITHUB_REPO || "";
  console.log("Getting latest commit SHA on main branch...");
  const { data: refData } = await octokit.request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
    owner,
    repo,
    ref: "heads/main",
  });
  const latestCommitSha = refData.object.sha;
  console.log("Latest commit SHA:", latestCommitSha);
  console.log("Getting tree SHA from latest commit...");
  const { data: commitData } = await octokit.request("GET /repos/{owner}/{repo}/git/commits/{commit_sha}", {
    owner,
    repo,
    commit_sha: latestCommitSha,
  });
  let baseTreeSha = commitData.tree.sha;
  console.log("Base tree SHA:", baseTreeSha);
  let parentCommitSha = latestCommitSha;
  for (let date of JSON.parse(selectedDates as string)) {
    console.log(`Processing date: ${date.date}`);
    const blobContent = `Commit for ${date.date}`;
    console.log("Creating blob...");
    const { data: blobData } = await octokit.request("POST /repos/{owner}/{repo}/git/blobs", {
      owner,
      repo,
      content: blobContent,
      encoding: "utf-8",
    });
    console.log("Blob SHA:", blobData.sha);
    console.log("Creating new tree with blob...");
    const { data: newTreeData } = await octokit.request(
        "POST /repos/{owner}/{repo}/git/trees",
        {
            owner,
            repo,
            base_tree: baseTreeSha,
            tree: [
                {
                    path: `contribution.txt`,
                    mode: "100644",
                    type: "blob",
                    sha: blobData.sha,
                },
            ],
        }
    );
    console.log("New tree SHA:", newTreeData.sha);
    console.log("Creating new commit...");
    const { data: newCommitData } = await octokit.request("POST /repos/{owner}/{repo}/git/commits", {
      owner,
      repo,
      message: `Commit for ${date.date}`,
      author: {
        name: process.env.GIT_NAME || "",
        email: process.env.GIT_EMAIL || "",
        date: `${date.date}T12:00:00+00:00`,
      },
      tree: newTreeData.sha,
      parents: [parentCommitSha],
    });
    console.log("New commit SHA:", newCommitData.sha);
    console.log("Updating branch reference to new commit...");
    await octokit.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
      owner,
      repo,
      ref: "heads/main",
      sha: newCommitData.sha,
      force: false,
    });
    // Update baseTreeSha and parentCommitSha for next iteration
    baseTreeSha = newTreeData.sha;
    parentCommitSha = newCommitData.sha;
    console.log(`Finished processing date: ${date.date}`);
  }
  console.log("All selected dates processed.");
  return null;
}

export default function Profile() {
  const contributions = useLoaderData<typeof loader>() || { weeks: [], totalContributions: 0 };
  const weeks: Week[] = contributions.weeks || [];
  const [selectedDates, setSelectedDates] = React.useState<{ date: string; intensity: number }[]>([]);
  let fetcher = useFetcher();
  const navigate = useNavigate();
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetcher.submit(
      { selectedDates: JSON.stringify(selectedDates) },
      { method: "post", action: "/profile" }
    );
  };

  // Color scale for contributions
  function getColor(count: number) {
    if (count === 0) return '#53565bff';
      if (count < 2) return "#0c4629ff";
    if (count < 4) return '#14832cff'; 
    return "#39d353"; // darkest
  }

  // Check if a date is selected
  function isSelected(date: string) {
    return selectedDates.some((d) => d.date === date);
  }

  // Handle tap/click on a square
  function handleSquareClick(date: string) {
    setSelectedDates((prev) => {
      if (prev.some((d) => d.date === date)) {
        // Deselect if already selected
        return prev.filter((d) => d.date !== date);
      } else {
        // Select
        return [...prev, { date, intensity: 1 }];
      }
    });
  }

  // Count total days
  const totalDays = weeks.reduce((acc, week) => acc + week.contributionDays.length, 0);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gradientFrom via-gradientVia to-gradientTo p-10">
      <div className="w-full bg-card backdrop-blur-lg shadow-card rounded-2xl p-8 border border-border relative">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute left-6 top-6 flex items-center gap-2 px-4 py-2 bg-green-400 text-gray-900 font-semibold rounded-lg shadow hover:bg-green-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-300"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
  <h1 className="text-3xl font-extrabold mb-6 text-white tracking-tight text-center font-display">
          GitHub Contributions : {contributions ? contributions.totalContributions : 0} in the last year
        </h1>
  <p className="mb-6 text-lg text-white text-center font-display">
          Click on the squares to select dates and submit your selection.
        </p>
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-2 justify-center">
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-2">
                {week.contributionDays.map((day) => (
                  <div key={day.date} className="relative w-5 h-5 group">
                    <div
                      title={`${day.date}: ${day.contributionCount} contributions`}
                      className={`w-full h-full rounded cursor-pointer border transition-all duration-200 ease-in-out shadow-sm hover:scale-110 hover:z-10 ${isSelected(day.date) ? "border-blue-500 ring-2 ring-blue-300" : "border-transparent"}`}
                      style={{ background: getColor(day.contributionCount) }}
                      onClick={() => handleSquareClick(day.date)}
                    />
                    {/* Tooltip on hover */}
                    <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 text-xs rounded bg-gray-900 text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-20 shadow-lg border border-gray-700">
                      {day.date}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <p className="mt-6 text-lg text-white text-center">
          Total days: <strong className="text-blue-300">{totalDays}</strong>
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col items-center mb-8">
          <button
            type="submit"
            disabled={selectedDates.length === 0}
            className="px-6 py-2 bg-gradient-to-r from-primary-light to-primary-dark text-white font-semibold rounded-lg shadow hover:scale-105 hover:from-primary disabled:opacity-50 disabled:cursor-not-allowed hover:to-primary-dark transition-transform duration-200 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            Submit Selected Dates
          </button>
        </form>
  <div className="mt-8 bg-card rounded-xl p-6 shadow-inner border border-border">
          <h2 className="font-semibold text-white mb-3 text-xl">Selected Dates</h2>
          <pre className="bg-gray-900/80 p-4 rounded-lg text-xs text-green-300 overflow-x-auto">
            {selectedDates.map((d) => d.date).join(", ")}
          </pre>
        </div>
      </div>
    </div>
  );
}
