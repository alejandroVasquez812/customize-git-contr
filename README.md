
# GitHub Contributions Viewer

Visualize your GitHub contributions from the last year. Add more contribution squares to any date, creating custom pixels with images or text.

## Features

- View your GitHub contribution graph
- Add custom contribution squares to any date
- Personalize your contribution graph

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/alejandroVasquez812/customize-git-contr.git
cd customize-git-contr
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up your `.env` file

Create a `.env` file in the root directory and add the following variables:

```env
GITHUB_USER=your_github_username
TOKEN=your_github_personal_access_token
GITHUB_REPO=repo_to_modify
GIT_NAME=Your Name
GIT_EMAIL=you@example.com
```

#### Example

```env
GITHUB_USER=githubUser
TOKEN=ghp_XXXXXXXXXXXXXXXXXXXX
GITHUB_REPO=repo
GIT_NAME=Your Name
GIT_EMAIL=you@example.com
```

### 4. Run the development server

```bash
npm run dev
```

Visit `http://localhost:3000` in your browser.

## Permissions Required

Your GitHub Personal Access Token must have:

- Read access to metadata
- Read and Write access to code

## Usage

Start by visiting your profile to explore and customize your contribution graph. You can add more contribution squares to any date you want, creating custom visuals.

## License

MIT
