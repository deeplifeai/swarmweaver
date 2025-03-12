"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.maskToken = maskToken;
exports.hashString = hashString;
exports.isValidGitHubToken = isValidGitHubToken;
exports.isValidSlackToken = isValidSlackToken;
exports.isValidOpenAIKey = isValidOpenAIKey;
exports.isSafeUrl = isSafeUrl;
var crypto = __importStar(require("crypto"));
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
function maskToken(token, visibleStart, visibleEnd) {
    if (visibleStart === void 0) { visibleStart = 4; }
    if (visibleEnd === void 0) { visibleEnd = 4; }
    if (!token)
        return '';
    if (token.length <= visibleStart + visibleEnd)
        return token;
    var start = token.substring(0, visibleStart);
    var end = token.substring(token.length - visibleEnd);
    var masked = '*'.repeat(Math.min(10, token.length - (visibleStart + visibleEnd)));
    return "".concat(start).concat(masked).concat(end);
}
/**
 * Hash a string using SHA-256 algorithm
 * @param input String to hash
 * @returns Hashed string
 */
function hashString(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
}
/**
 * Validate a GitHub token format
 * @param token GitHub token to validate
 * @returns True if the token has a valid format
 */
function isValidGitHubToken(token) {
    // GitHub tokens can be:
    // 1. 40 hex characters 
    // 2. Start with 'ghp_', 'gho_', or 'ghs_' followed by 36 characters
    // 3. Start with 'github_pat_' followed by alphanumeric characters
    return /^gh[ops]_[A-Za-z0-9_]{36}$/.test(token) || 
           /^[a-f0-9]{40}$/.test(token) || 
           /^github_pat_[A-Za-z0-9_]+$/.test(token);
}
/**
 * Validate a Slack token format
 * @param token Slack token to validate
 * @param type Type of token (bot, signing, app)
 * @returns True if the token has a valid format
 */
function isValidSlackToken(token, type) {
    if (!token)
        return false;
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
function isValidOpenAIKey(apiKey) {
    // OpenAI API keys start with 'sk-' followed by a base64 string
    return apiKey.startsWith('sk-') && apiKey.length > 20;
}
/**
 * Check if a URL is safe (not pointing to a potentially malicious domain)
 * @param url URL to check
 * @param allowedDomains List of allowed domains
 * @returns True if the URL points to an allowed domain
 */
function isSafeUrl(url, allowedDomains) {
    if (allowedDomains === void 0) { allowedDomains = ['github.com', 'api.github.com', 'slack.com', 'api.slack.com']; }
    try {
        var urlObj_1 = new URL(url);
        return allowedDomains.some(function (domain) { return urlObj_1.hostname === domain || urlObj_1.hostname.endsWith(".".concat(domain)); });
    }
    catch (error) {
        return false;
    }
}
