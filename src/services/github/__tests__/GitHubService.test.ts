import { GitHubService } from '../GitHubService';
import { GitHubRepository, GitHubPullRequest } from '../../../types/github/GitHubTypes';
import { Octokit } from '@octokit/rest';

// Define mock function types
type MockFunction = jest.Mock<any, any>;

// Mock Octokit
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    git: {
      getRef: jest.fn(),
      createRef: jest.fn(),
    },
    pulls: {
      create: jest.fn(),
      get: jest.fn(),
      merge: jest.fn(),
      createReview: jest.fn(),
    },
  })),
}));

describe('GitHubService', () => {
  let githubService: GitHubService;
  let mockOctokit: jest.Mocked<Octokit>;
  const testRepo: GitHubRepository = {
    owner: 'test-owner',
    repo: 'test-repo',
  };

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Create a new instance of GitHubService for each test
    githubService = new GitHubService('test-token', testRepo);
    mockOctokit = new Octokit() as jest.Mocked<Octokit>;
    (githubService as any).octokit = mockOctokit;
  });

  describe('Branch Management', () => {
    it('should create a new branch successfully', async () => {
      const branchName = 'feature/test-branch';
      const sourceBranch = 'main';
      const mockSourceSha = 'abc123';

      // Mock the source branch reference
      (mockOctokit.git.getRef as unknown as MockFunction).mockResolvedValueOnce({
        data: { object: { sha: mockSourceSha } },
      } as any);

      // Mock branch creation
      (mockOctokit.git.createRef as unknown as MockFunction).mockResolvedValueOnce({
        data: { ref: `refs/heads/${branchName}` },
      } as any);

      const result = await githubService.createBranch(branchName, sourceBranch);

      expect(mockOctokit.git.getRef).toHaveBeenCalledWith({
        owner: testRepo.owner,
        repo: testRepo.repo,
        ref: `heads/${sourceBranch}`,
      });

      expect(mockOctokit.git.createRef).toHaveBeenCalledWith({
        owner: testRepo.owner,
        repo: testRepo.repo,
        ref: `refs/heads/${branchName}`,
        sha: mockSourceSha,
      });

      expect(result).toBeDefined();
      expect(result.ref).toBe(`refs/heads/${branchName}`);
    });

    it('should handle branch creation errors gracefully', async () => {
      const branchName = 'feature/test-branch';
      (mockOctokit.git.getRef as unknown as MockFunction).mockRejectedValueOnce(new Error('Source branch not found'));

      await expect(githubService.createBranch(branchName)).rejects.toThrow('Source branch not found');
    });

    it('should correctly check if a branch exists', async () => {
      const branchName = 'feature/test-branch';
      
      // Test existing branch
      (mockOctokit.git.getRef as unknown as MockFunction).mockResolvedValueOnce({ data: {} } as any);
      const exists = await githubService.branchExists(branchName);
      expect(exists).toBe(true);

      // Test non-existing branch
      const error = new Error('Not Found') as any;
      error.status = 404;
      (mockOctokit.git.getRef as unknown as MockFunction).mockRejectedValueOnce(error);
      const notExists = await githubService.branchExists(branchName);
      expect(notExists).toBe(false);
    });
  });

  describe('Pull Request Management', () => {
    const mockPR: GitHubPullRequest = {
      title: 'Test PR',
      body: 'Test description',
      head: 'feature/test-branch',
      base: 'main',
    };

    it('should create a pull request successfully', async () => {
      const mockResponse = {
        data: {
          number: 1,
          title: mockPR.title,
          html_url: 'https://github.com/test-owner/test-repo/pull/1',
        },
      };

      (mockOctokit.pulls.create as unknown as MockFunction).mockResolvedValueOnce(mockResponse);

      const result = await githubService.createPullRequest(mockPR);

      expect(mockOctokit.pulls.create).toHaveBeenCalledWith({
        owner: testRepo.owner,
        repo: testRepo.repo,
        title: mockPR.title,
        body: mockPR.body,
        head: mockPR.head,
        base: mockPR.base,
        draft: mockPR.draft,
        maintainer_can_modify: mockPR.maintainer_can_modify,
      });

      expect(result).toBeDefined();
      expect(result.number).toBe(1);
      expect(result.html_url).toBeDefined();
    });

    it('should handle pull request creation errors', async () => {
      (mockOctokit.pulls.create as unknown as MockFunction).mockRejectedValueOnce(new Error('Validation failed'));

      await expect(githubService.createPullRequest(mockPR)).rejects.toThrow('Validation failed');
    });

    it('should get pull request details successfully', async () => {
      const prNumber = 1;
      const mockResponse = {
        data: {
          number: prNumber,
          title: mockPR.title,
          state: 'open',
        },
      };

      (mockOctokit.pulls.get as unknown as MockFunction).mockResolvedValueOnce(mockResponse);

      const result = await githubService.getPullRequest(prNumber);

      expect(mockOctokit.pulls.get).toHaveBeenCalledWith({
        owner: testRepo.owner,
        repo: testRepo.repo,
        pull_number: prNumber,
      });

      expect(result).toBeDefined();
      expect(result.number).toBe(prNumber);
      expect(result.state).toBe('open');
    });
  });

  describe('Pull Request Reviews', () => {
    it('should add a review to a pull request successfully', async () => {
      const prNumber = 1;
      const review = {
        body: 'LGTM',
        event: 'APPROVE' as const,
      };

      const mockResponse = {
        data: {
          id: 1,
          body: review.body,
          state: review.event,
        },
      };

      (mockOctokit.pulls.createReview as unknown as MockFunction).mockResolvedValueOnce(mockResponse);

      const result = await githubService.addReviewToPullRequest(prNumber, review);

      expect(mockOctokit.pulls.createReview).toHaveBeenCalledWith({
        owner: testRepo.owner,
        repo: testRepo.repo,
        pull_number: prNumber,
        body: review.body,
        event: review.event,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.state).toBe(review.event);
    });
  });

  describe('Pull Request Merging', () => {
    it('should merge a pull request successfully', async () => {
      const prNumber = 1;
      const commitMessage = 'Merge PR #1';

      const mockResponse = {
        data: {
          merged: true,
          message: commitMessage,
        },
      };

      (mockOctokit.pulls.merge as unknown as MockFunction).mockResolvedValueOnce(mockResponse);

      const result = await githubService.mergePullRequest(prNumber, commitMessage);

      expect(mockOctokit.pulls.merge).toHaveBeenCalledWith({
        owner: testRepo.owner,
        repo: testRepo.repo,
        pull_number: prNumber,
        commit_message: commitMessage,
      });

      expect(result).toBeDefined();
      expect(result.merged).toBe(true);
    });
  });
}); 