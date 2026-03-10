import "@testing-library/jest-dom";

// Mock environment variables for tests
process.env.TOKEN = "ghp_test_token_12345";
process.env.GITHUB_USER = "testuser";
process.env.GITHUB_REPO = "test-repo";
process.env.GIT_NAME = "Test User";
process.env.GIT_EMAIL = "test@example.com";