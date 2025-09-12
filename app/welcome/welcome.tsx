
export function Welcome() {
  return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gradientFrom via-gradientVia to-gradientTo p-10">
          <div className="w-full max-w-xl bg-card backdrop-blur-lg shadow-card rounded-2xl p-8 border border-border relative">
              <h1 className="text-3xl font-extrabold mb-6 text-white tracking-tight text-center font-display">
                  Welcome to your GitHub Contributions Viewer!
              </h1>
              <p className="mb-6 text-lg text-white text-center font-display">
                  Visualize your GitHub contributions from the last year.
                  <br />
                  You can add more contribution squares to any date you want,
                  creating custom pixels with images or text.
                  <br />
                  <span className="block mt-2">
                      Start by visiting your profile to explore and customize
                      your contribution graph.
                  </span>
              </p>
              <div className="flex flex-col items-center mb-8">
                  <a
                      href="/profile"
                      className="px-6 py-2 bg-gradient-to-r from-primary-light to-primary-dark text-white font-semibold rounded-lg shadow hover:scale-105 hover:from-primary disabled:opacity-50 disabled:cursor-not-allowed hover:to-primary-dark transition-transform duration-200 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                      Go to Profile
                  </a>
              </div>
              <h3 className="font-semibold text-white mb-2">
                  Be sure you set up the following variables in your .env file:
              </h3>
              <div className="mt-8 bg-card rounded-xl p-6 shadow-inner border border-border">
                  <ul className="space-y-2">
                      <li className="text-white">
                          <strong>GITHUB_USER</strong>: Your GitHub username
                          (e.g., <code>githubUser</code>)
                      </li>
                      <li className="text-white">
                          <strong>TOKEN</strong>: Your GitHub Personal Access
                          Token (e.g., <code>ghp_XXXXXXXXXXXXXXXXXXXX</code>)
                      </li>
                      <li className="text-white">
                          <strong>GITHUB_REPO</strong>: The repository you want
                          to modify (e.g., <code>repo</code>)
                      </li>
                      <li className="text-white">
                          <strong>GIT_NAME</strong>: Name for commits (e.g.,
                          <code>Your Name</code>)
                      </li>
                      <li className="text-white">
                          <strong>GIT_EMAIL</strong>: Email for author commits
                          (e.g.,
                          <code>you@example.com</code>)
                      </li>
                  </ul>
              </div>
              <div className="mt-8 flex flex-col justify-center space-x-4">
                  <p className="text-white self-center mb-4">
                      Repository permissions for the Personal Access Token:
                  </p>
                  <ul className="list-disc list-inside text-white bg-card rounded-xl p-6 shadow-inner border border-border">
                      <li>Read access to metadata</li>
                      <li>Read and Write access to code</li>
                  </ul>
              </div>
          </div>
      </div>
  );
}