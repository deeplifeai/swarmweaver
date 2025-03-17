import { GitHubService } from '../GitHubService';
import { Octokit } from '@octokit/rest';

// Mock Octokit module
jest.mock('@octokit/rest', () => {
  return {
    Octokit: jest.fn().mockImplementation(() => ({
      issues: {
        get: jest.fn().mockResolvedValue({
          data: { number: 123, title: 'Test Issue', body: 'Test Body' }
        })
      },
      pulls: {
        get: jest.fn().mockResolvedValue({
          data: { number: 456, title: 'Test PR', body: 'Test PR Body' }
        })
      }
    }))
  };
});

describe('Issue and PR Detection', () => {
  let githubService: GitHubService;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Initialize service
    githubService = new GitHubService('test-token', { owner: 'test-owner', repo: 'test-repo' });
  });

  describe('Issue Number Extraction', () => {
    it('should extract issue numbers in various formats', () => {
      const testCases = [
        { text: 'Working on #123', expected: 123 },
        { text: 'Working on issue 456', expected: 456 },
        { text: 'Working on Issue #789', expected: 789 },
        { text: 'Working on ISSUE 101', expected: 101 },
        { text: 'Working on #123 and #456', expected: 123 }, // Should get first match
        { text: 'Working on issue 123 and issue 456', expected: 123 },
        { text: 'Working on #123 at the end of sentence.', expected: 123 },
        { text: 'Working on issue 123 at the end of sentence.', expected: 123 },
        { text: 'Working on #123, with comma', expected: 123 },
        { text: 'Working on issue 123, with comma', expected: 123 }
      ];

      testCases.forEach(({ text, expected }) => {
        const issuePattern = /(?:issue|#)\s*(\d+)/i;
        const match = text.match(issuePattern);
        expect(match).toBeTruthy();
        expect(parseInt(match[1])).toBe(expected);
      });
    });

    it('should handle mixed format handling', () => {
      const text = 'Working on #123 and issue 456';
      const issuePattern = /(?:issue|#)\s*(\d+)/gi;
      const matches = text.match(issuePattern);
      
      expect(matches).toHaveLength(2);
      expect(matches[0]).toBe('#123');
      expect(matches[1]).toBe('issue 456');
    });

    it('should handle case insensitivity', () => {
      const testCases = [
        { text: 'Working on #123', expected: 123 },
        { text: 'Working on #123', expected: 123 },
        { text: 'Working on ISSUE 123', expected: 123 },
        { text: 'Working on Issue 123', expected: 123 }
      ];

      testCases.forEach(({ text, expected }) => {
        const issuePattern = /(?:issue|#)\s*(\d+)/i;
        const match = text.match(issuePattern);
        expect(match).toBeTruthy();
        expect(parseInt(match[1])).toBe(expected);
      });
    });

    it('should handle edge cases', () => {
      const testCases = [
        { text: 'Working on #123 at the end of sentence.', expected: 123 },
        { text: 'Working on issue 123 at the end of sentence.', expected: 123 },
        { text: 'Working on #123, with comma', expected: 123 },
        { text: 'Working on issue 123, with comma', expected: 123 },
        { text: 'Working on #123!', expected: 123 },
        { text: 'Working on issue 123!', expected: 123 },
        { text: 'Working on #123?', expected: 123 },
        { text: 'Working on issue 123?', expected: 123 }
      ];

      testCases.forEach(({ text, expected }) => {
        const issuePattern = /(?:issue|#)\s*(\d+)/i;
        const match = text.match(issuePattern);
        expect(match).toBeTruthy();
        expect(parseInt(match[1])).toBe(expected);
      });
    });

    it('should not match non-issue numbers', () => {
      const testCases = [
        'Working on #abc',
        'Working on issue abc',
        'Working on #123abc',
        'Working on issue 123abc',
        'Working on abc123',
        'Working on 123abc',
        'Working on #123abc',
        'Working on issue 123abc'
      ];

      testCases.forEach(text => {
        const issuePattern = /\b(?:issue|#)\s*(\d+)\b/i;
        const match = text.match(issuePattern);
        expect(match).toBeFalsy();
      });
    });
  });

  describe('PR Detection', () => {
    it('should extract PR numbers', () => {
      const testCases = [
        { text: 'Working on PR #123', expected: 123 },
        { text: 'Working on pull request 456', expected: 456 },
        { text: 'Working on Pull Request #789', expected: 789 },
        { text: 'Working on PR 101', expected: 101 }
      ];

      testCases.forEach(({ text, expected }) => {
        const prPattern = /(?:PR|pull request)\s*#?(\d+)/i;
        const match = text.match(prPattern);
        expect(match).toBeTruthy();
        expect(parseInt(match[1])).toBe(expected);
      });
    });

    it('should detect PR status', async () => {
      const mockPR = {
        number: 123,
        title: 'Test PR',
        state: 'open',
        html_url: 'https://github.com/test-owner/test-repo/pull/123'
      };

      (githubService as any).octokit.pulls.get.mockResolvedValueOnce({
        data: mockPR
      });

      const result = await githubService.getPullRequest(123);
      expect(result.state).toBe('open');
      expect(result.number).toBe(123);
    });

    it('should handle PR opening and closing', async () => {
      const mockPR = {
        number: 123,
        title: 'Test PR',
        state: 'closed',
        html_url: 'https://github.com/test-owner/test-repo/pull/123'
      };

      (githubService as any).octokit.pulls.get.mockResolvedValueOnce({
        data: mockPR
      });

      const result = await githubService.getPullRequest(123);
      expect(result.state).toBe('closed');
      expect(result.number).toBe(123);
    });

    it('should handle PR errors gracefully', async () => {
      (githubService as any).octokit.pulls.get.mockRejectedValueOnce(
        new Error('PR not found')
      );

      await expect(githubService.getPullRequest(999)).rejects.toThrow('PR not found');
    });
  });

  describe('Integration Tests', () => {
    it('should handle issue and PR references in the same text', () => {
      const text = 'Working on issue #123 and PR #456';
      
      // Extract issue number
      const issuePattern = /(?:issue|#)\s*(\d+)/i;
      const issueMatch = text.match(issuePattern);
      expect(issueMatch).toBeTruthy();
      expect(parseInt(issueMatch[1])).toBe(123);

      // Extract PR number
      const prPattern = /(?:PR|pull request)\s*#?(\d+)/i;
      const prMatch = text.match(prPattern);
      expect(prMatch).toBeTruthy();
      expect(parseInt(prMatch[1])).toBe(456);
    });

    it('should handle multiple references in a conversation', async () => {
      const messages = [
        'I found issue #123',
        'PR #456 is ready for review',
        'Let me check issue 123',
        'PR 456 needs some changes',
        'Issue #123 is fixed'
      ];

      const issueNumbers = messages
        .map(msg => msg.match(/\b(?:issue|#)\s*(\d+)\b/i)?.[1])
        .filter((value): value is string => value !== undefined)
        .map(Number)
        .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates

      const prNumbers = messages
        .map(msg => msg.match(/\b(?:PR|pull request)\s*#?(\d+)\b/i)?.[1])
        .filter((value): value is string => value !== undefined)
        .map(Number)
        .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates

      expect(issueNumbers).toEqual([123]);
      expect(prNumbers).toEqual([456]);
    });
  });
}); 