import * as crypto from 'crypto';

/**
 * Security utilities for handling sensitive information like API tokens
 */

/**
 * Mask a token to only show its first and last few characters
 * @param token The token to mask
 * @param visibleStart Number of characters to show at the start
 * @param visibleEnd Number of characters to show at the end
 * @returns Masked token string
 */
export function maskToken(token: string, visibleStart = 4, visibleEnd = 4): string {
  if (!token) return '';
  if (token.length <= visibleStart + visibleEnd) return token;

  const start = token.substring(0, visibleStart);
  const end = token.substring(token.length - visibleEnd);
  const masked = '*'.repeat(Math.min(10, token.length - (visibleStart + visibleEnd)));

  return `${start}${masked}${end}`;
}

/**
 * Hash a string using SHA-256 algorithm
 * @param input String to hash
 * @returns Hashed string
 */
export function hashString(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Validate a GitHub token format
 * @param token GitHub token to validate
 * @returns True if the token has a valid format
 */
export function isValidGitHubToken(token: string): boolean {
  // GitHub tokens are 40 hex characters or start with 'ghp_', 'gho_', or 'ghs_' followed by 36 characters
  return /^gh[ops]_[A-Za-z0-9_]{36}$/.test(token) || /^[a-f0-9]{40}$/.test(token);
}

/**
 * Validate a Slack token format
 * @param token Slack token to validate
 * @param type Type of token (bot, signing, app)
 * @returns True if the token has a valid format
 */
export function isValidSlackToken(token: string, type: 'bot' | 'signing' | 'app'): boolean {
  if (!token) return false;
  
  switch (type) {
    case 'bot':
      return token.startsWith('xoxb-');
    case 'app':
      return token.startsWith('xapp-');
    case 'signing':
      // Signing secrets are 32-character hex strings
      return /^[a-f0-9]{32}$/.test(token);
    default:
      return false;
  }
}

/**
 * Validate an OpenAI API key format
 * @param apiKey OpenAI API key to validate
 * @returns True if the API key has a valid format
 */
export function isValidOpenAIKey(apiKey: string): boolean {
  // OpenAI API keys start with 'sk-' followed by a base64 string
  return apiKey.startsWith('sk-') && apiKey.length > 20;
}

/**
 * Check if a URL is safe (not pointing to a potentially malicious domain)
 * @param url URL to check
 * @param allowedDomains List of allowed domains
 * @returns True if the URL points to an allowed domain
 */
export function isSafeUrl(url: string, allowedDomains: string[] = ['github.com', 'api.github.com', 'slack.com', 'api.slack.com']): boolean {
  try {
    const urlObj = new URL(url);
    return allowedDomains.some(domain => urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`));
  } catch (error) {
    return false;
  }
} 