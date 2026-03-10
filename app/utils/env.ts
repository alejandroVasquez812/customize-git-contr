/**
 * Centralized environment variable validation utility
 * All routes should import and use this function instead of duplicating validation logic
 */

export interface EnvVars {
    TOKEN: string;
    GITHUB_USER: string;
    GITHUB_REPO: string;
    GIT_NAME: string;
    GIT_EMAIL: string;
}

const REQUIRED_ENV_VARS = [
    'TOKEN',
    'GITHUB_USER',
    'GITHUB_REPO',
    'GIT_NAME',
    'GIT_EMAIL',
] as const;

type EnvVarKey = typeof REQUIRED_ENV_VARS[number];

/**
 * Validates that all required environment variables are set and non-empty
 * @returns Validated environment variables object
 * @throws Error if any required variables are missing or empty
 */
export function validateEnv(): EnvVars {
    const env = process.env as Record<string, string | undefined>;
    
    const missing: EnvVarKey[] = [];
    const empty: EnvVarKey[] = [];
    
    for (const key of REQUIRED_ENV_VARS) {
        if (!env[key]) {
            missing.push(key);
        } else if (env[key]!.trim() === '') {
            empty.push(key);
        }
    }
    
    const errors: string[] = [];
    
    if (missing.length > 0) {
        errors.push(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    if (empty.length > 0) {
        errors.push(`Empty environment variables: ${empty.join(', ')}`);
    }
    
    if (errors.length > 0) {
        throw new Error(errors.join('. '));
    }
    
    return {
        TOKEN: env.TOKEN!.trim(),
        GITHUB_USER: env.GITHUB_USER!.trim(),
        GITHUB_REPO: env.GITHUB_REPO!.trim(),
        GIT_NAME: env.GIT_NAME!.trim(),
        GIT_EMAIL: env.GIT_EMAIL!.trim(),
    };
}

/**
 * Validates email format for GIT_EMAIL
 * @param email Email address to validate
 * @returns true if valid email format
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validates that the GitHub token has the expected format
 * @param token GitHub Personal Access Token
 * @returns true if token appears valid
 */
export function isValidGitHubToken(token: string): boolean {
    // GitHub tokens start with ghp_, gho_, ghu_, ghs_, or ghr_
    const tokenPrefixes = ['ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_'];
    return tokenPrefixes.some(prefix => token.startsWith(prefix));
}

/**
 * Validates environment variables with additional format checks
 * @returns Validated environment variables object
 * @throws Error if validation fails
 */
export function validateEnvWithFormatChecks(): EnvVars {
    const env = validateEnv();
    
    const warnings: string[] = [];
    
    if (!isValidEmail(env.GIT_EMAIL)) {
        warnings.push(`GIT_EMAIL "${env.GIT_EMAIL}" may not be a valid email address`);
    }
    
    if (!isValidGitHubToken(env.TOKEN)) {
        warnings.push(`TOKEN does not appear to be a valid GitHub Personal Access Token`);
    }
    
    // Log warnings in development
    if (warnings.length > 0 && import.meta.env.DEV) {
        console.warn('Environment variable warnings:', warnings.join('; '));
    }
    
    return env;
}
