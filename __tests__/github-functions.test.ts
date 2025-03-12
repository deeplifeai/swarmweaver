import { jest } from '@jest/globals';
import { 
  createCommitFunction, 
  createPullRequestFunction, 
  getIssueFunction,
  createBranchFunction
} from '@/services/github/GitHubFunctions';

// Mock the GitHub service
const mockGithubService = {
  branchExists: jest.fn(),
  createBranch: jest.fn(),
  createCommit: jest.fn(),
  createPullRequest: jest.fn(),
  getIssue: jest.fn(),
  getRepository: jest.fn()
};

// Mock the console methods
global.console = {
  ...global.console,
  log: jest.fn(),
  error: jest.fn()
};

// Manually inject the mock
jest.mock('@/services/github/GitHubService', () => ({
  githubService: mockGithubService
}));

describe('GitHub Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createCommitFunction', () => {
    it('should automatically create a branch if it does not exist', async () => {
      // Setup
      mockGithubService.branchExists.mockResolvedValueOnce(false);
      mockGithubService.createBranch.mockResolvedValueOnce({ ref: 'refs/heads/test-branch', object: { sha: 'mocksha' } });
      mockGithubService.createCommit.mockResolvedValueOnce({ sha: 'commit-sha-123' });

      const params = {
        message: 'Test commit',
        files: [{ path: 'test.txt', content: 'test content' }],
        branch: 'test-branch'
      };

      // Act
      const result = await createCommitFunction.handler(params, 'agentId');

      // Assert
      expect(mockGithubService.branchExists).toHaveBeenCalledWith('test-branch');
      expect(mockGithubService.createBranch).toHaveBeenCalledWith('test-branch', 'main');
      expect(mockGithubService.createCommit).toHaveBeenCalledWith({
        message: 'Test commit',
        files: [{ path: 'test.txt', content: 'test content' }],
        branch: 'test-branch'
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('automatically created');
    });

    it('should commit to an existing branch without creating it', async () => {
      // Setup
      mockGithubService.branchExists.mockResolvedValueOnce(true);
      mockGithubService.createCommit.mockResolvedValueOnce({ sha: 'commit-sha-123' });

      const params = {
        message: 'Test commit',
        files: [{ path: 'test.txt', content: 'test content' }],
        branch: 'existing-branch'
      };

      // Act
      const result = await createCommitFunction.handler(params, 'agentId');

      // Assert
      expect(mockGithubService.branchExists).toHaveBeenCalledWith('existing-branch');
      expect(mockGithubService.createBranch).not.toHaveBeenCalled();
      expect(mockGithubService.createCommit).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.message).not.toContain('automatically created');
    });

    it('should return error if branch creation fails', async () => {
      // Setup
      mockGithubService.branchExists.mockResolvedValueOnce(false);
      mockGithubService.createBranch.mockRejectedValueOnce(new Error('Branch creation failed'));

      const params = {
        message: 'Test commit',
        files: [{ path: 'test.txt', content: 'test content' }],
        branch: 'test-branch'
      };

      // Act
      const result = await createCommitFunction.handler(params, 'agentId');

      // Assert
      expect(mockGithubService.branchExists).toHaveBeenCalledWith('test-branch');
      expect(mockGithubService.createBranch).toHaveBeenCalled();
      expect(mockGithubService.createCommit).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toContain('IMPORTANT');
    });
  });

  describe('createPullRequestFunction', () => {
    it('should check if branch exists before creating PR', async () => {
      // Setup
      mockGithubService.branchExists.mockResolvedValueOnce(true);
      mockGithubService.createPullRequest.mockResolvedValueOnce({ 
        number: 123, 
        html_url: 'https://github.com/user/repo/pull/123' 
      });

      const params = {
        title: 'Test PR',
        body: 'Test PR description',
        head: 'feature-branch',
        base: 'main'
      };

      // Act
      const result = await createPullRequestFunction.handler(params, 'agentId');

      // Assert
      expect(mockGithubService.branchExists).toHaveBeenCalledWith('feature-branch');
      expect(mockGithubService.createPullRequest).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.pr_number).toBe(123);
    });

    it('should attempt to create branch if it does not exist', async () => {
      // Setup
      mockGithubService.branchExists.mockResolvedValueOnce(false);
      mockGithubService.createBranch.mockResolvedValueOnce({ 
        ref: 'refs/heads/feature-branch', 
        object: { sha: 'mocksha' } 
      });

      const params = {
        title: 'Test PR',
        body: 'Test PR description',
        head: 'feature-branch',
        base: 'main'
      };

      // Act
      const result = await createPullRequestFunction.handler(params, 'agentId');

      // Assert
      expect(mockGithubService.branchExists).toHaveBeenCalledWith('feature-branch');
      expect(mockGithubService.createBranch).toHaveBeenCalled();
      expect(mockGithubService.createPullRequest).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toContain('CRITICAL WORKFLOW ERROR');
    });
  });

  describe('getIssueFunction', () => {
    it('should retrieve issue information by number', async () => {
      // Setup
      const mockIssue = {
        number: 42,
        title: 'Test Issue',
        body: 'Issue description',
        html_url: 'https://github.com/user/repo/issues/42',
        state: 'open',
        assignees: [],
        labels: []
      };
      mockGithubService.getIssue.mockResolvedValueOnce(mockIssue);

      // Act
      const result = await getIssueFunction.handler({ number: 42 }, 'agentId');

      // Assert
      expect(mockGithubService.getIssue).toHaveBeenCalledWith(42);
      expect(result.success).toBe(true);
      expect(result.number).toBe(42);
      expect(result.title).toBe('Test Issue');
    });

    it('should handle error when retrieving non-existent issue', async () => {
      // Setup
      mockGithubService.getIssue.mockRejectedValueOnce(new Error('Issue not found'));

      // Act
      const result = await getIssueFunction.handler({ number: 999 }, 'agentId');

      // Assert
      expect(mockGithubService.getIssue).toHaveBeenCalledWith(999);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Issue not found');
    });
  });

  describe('createBranchFunction', () => {
    it('should create a branch from a source branch', async () => {
      // Setup
      mockGithubService.createBranch.mockResolvedValueOnce({
        ref: 'refs/heads/new-branch',
        object: { sha: 'mocksha' }
      });

      // Act
      const result = await createBranchFunction.handler({
        name: 'new-branch',
        source: 'develop'
      }, 'agentId');

      // Assert
      expect(mockGithubService.createBranch).toHaveBeenCalledWith('new-branch', 'develop');
      expect(result.success).toBe(true);
      expect(result.message).toContain('new-branch created successfully');
    });

    it('should use main as default source branch', async () => {
      // Setup
      mockGithubService.createBranch.mockResolvedValueOnce({
        ref: 'refs/heads/new-branch',
        object: { sha: 'mocksha' }
      });

      // Act
      const result = await createBranchFunction.handler({
        name: 'new-branch'
      }, 'agentId');

      // Assert
      expect(mockGithubService.createBranch).toHaveBeenCalledWith('new-branch', 'main');
      expect(result.success).toBe(true);
    });
  });
}); 