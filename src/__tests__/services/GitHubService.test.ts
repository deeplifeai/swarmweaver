import { GitHubService } from '@/services/github/GitHubService';
import { Octokit } from '@octokit/rest';

// Mock Octokit module
jest.mock('@octokit/rest', () => {
  return {
    Octokit: jest.fn().mockImplementation(() => ({
      issues: {
        create: jest.fn().mockResolvedValue({
          data: { number: 123, html_url: 'https://github.com/owner/repo/issues/123' }
        }),
        get: jest.fn().mockResolvedValue({
          data: { number: 123, title: 'Test Issue', body: 'Test Body' }
        })
      },
      pulls: {
        create: jest.fn().mockResolvedValue({
          data: { number: 456, html_url: 'https://github.com/owner/repo/pull/456' }
        }),
        get: jest.fn().mockResolvedValue({
          data: { number: 456, title: 'Test PR', body: 'Test PR Body' }
        }),
        createReview: jest.fn().mockResolvedValue({
          data: { id: 789, body: 'LGTM' }
        })
      },
      git: {
        getRef: jest.fn().mockResolvedValue({
          data: { object: { sha: 'abc123' } }
        }),
        getCommit: jest.fn().mockResolvedValue({
          data: { tree: { sha: 'def456' } }
        }),
        createBlob: jest.fn().mockResolvedValue({
          data: { sha: 'blob789' }
        }),
        createTree: jest.fn().mockResolvedValue({
          data: { sha: 'tree101112' }
        }),
        createCommit: jest.fn().mockResolvedValue({
          data: { sha: 'commit131415' }
        }),
        updateRef: jest.fn().mockResolvedValue({
          data: { ref: 'heads/main', object: { sha: 'commit131415' } }
        })
      },
      repos: {
        get: jest.fn().mockResolvedValue({
          data: {
            name: 'repo',
            full_name: 'owner/repo',
            description: 'Test repo',
            html_url: 'https://github.com/owner/repo',
            default_branch: 'main',
            open_issues_count: 5,
            forks_count: 2,
            stargazers_count: 10,
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-06-01T00:00:00Z'
          }
        })
      }
    }))
  };
});

// Mock config
jest.mock('@/config/config', () => ({
  config: {
    github: {
      token: 'mock-token',
      repository: 'owner/repo'
    }
  }
}));

describe('GitHubService', () => {
  let githubService: GitHubService;
  let mockOctokit: jest.Mocked<Octokit>;

  beforeEach(() => {
    jest.clearAllMocks();
    githubService = new GitHubService();
    mockOctokit = new Octokit() as jest.Mocked<Octokit>;
  });

  describe('createIssue', () => {
    it('should create an issue successfully', async () => {
      const issue = {
        title: 'Test Issue',
        body: 'This is a test issue',
        assignees: ['user1'],
        labels: ['bug']
      };

      const result = await githubService.createIssue(issue);

      expect(result).toEqual({
        number: 123,
        html_url: 'https://github.com/owner/repo/issues/123'
      });
    });
  });

  describe('getIssue', () => {
    it('should get an issue by number', async () => {
      const result = await githubService.getIssue(123);

      expect(result).toEqual({
        number: 123,
        title: 'Test Issue',
        body: 'Test Body'
      });
    });
  });

  describe('createPullRequest', () => {
    it('should create a pull request successfully', async () => {
      const pr = {
        title: 'Test PR',
        body: 'This is a test PR',
        head: 'feature-branch',
        base: 'main',
        draft: false
      };

      const result = await githubService.createPullRequest(pr);

      expect(result).toEqual({
        number: 456,
        html_url: 'https://github.com/owner/repo/pull/456'
      });
    });
  });

  describe('createCommit', () => {
    it('should create a commit successfully', async () => {
      const commit = {
        message: 'Test commit',
        files: [
          {
            path: 'test.txt',
            content: 'Test content'
          }
        ]
      };

      const result = await githubService.createCommit(commit);

      expect(result).toEqual({
        sha: 'commit131415'
      });
    });
  });

  describe('getRepository', () => {
    it('should get repository info', async () => {
      const result = await githubService.getRepository();

      expect(result).toEqual({
        name: 'repo',
        full_name: 'owner/repo',
        description: 'Test repo',
        html_url: 'https://github.com/owner/repo',
        default_branch: 'main',
        open_issues_count: 5,
        forks_count: 2,
        stargazers_count: 10,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-06-01T00:00:00Z'
      });
    });
  });
}); 