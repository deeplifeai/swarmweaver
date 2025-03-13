// Set NODE_ENV to test to use the test mocks in GitHubFunctions.ts
process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';

// Define type-safe mock functions using any for the Jest mock typing
const mockBranchExists = jest.fn() as jest.Mock<any>;
const mockCreateBranch = jest.fn() as jest.Mock<any>;
const mockCreateCommit = jest.fn() as jest.Mock<any>;
const mockCreatePullRequest = jest.fn() as jest.Mock<any>;
const mockGetIssue = jest.fn() as jest.Mock<any>;
const mockGetRepository = jest.fn() as jest.Mock<any>;
const mockAddCommentToIssue = jest.fn() as jest.Mock<any>;
const mockCloseIssue = jest.fn() as jest.Mock<any>;
const mockGetPullRequest = jest.fn() as jest.Mock<any>;
const mockAddReviewToPullRequest = jest.fn() as jest.Mock<any>;
const mockMergePullRequest = jest.fn() as jest.Mock<any>;
const mockListIssues = jest.fn() as jest.Mock<any>;

// Create a mock GitHub service
const mockGitHubService = {
  branchExists: mockBranchExists,
  createBranch: mockCreateBranch,
  createCommit: mockCreateCommit,
  createPullRequest: mockCreatePullRequest,
  getIssue: mockGetIssue,
  getRepository: mockGetRepository,
  addCommentToIssue: mockAddCommentToIssue,
  closeIssue: mockCloseIssue,
  getPullRequest: mockGetPullRequest,
  addReviewToPullRequest: mockAddReviewToPullRequest,
  mergePullRequest: mockMergePullRequest,
  listIssues: mockListIssues
};

// Import the functions and the setGitHubService function
import { 
  createCommitFunction,
  createPullRequestFunction,
  createBranchFunction,
  resetWorkflowState,
  setGitHubService
} from '../src/services/github/GitHubFunctions';

// Suppress console output during tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

describe('GitHub Functions', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Reset the workflow state
    resetWorkflowState();
    
    // Set our mock service to be used by the functions
    setGitHubService(mockGitHubService);
    
    // Set default mock implementations
    mockBranchExists.mockResolvedValue(false);
    mockCreateBranch.mockResolvedValue({ ref: 'refs/heads/test-branch', object: { sha: 'mocksha' } });
    mockCreateCommit.mockResolvedValue({ sha: 'commit-sha-123' });
    mockCreatePullRequest.mockResolvedValue({ number: 123, html_url: 'https://github.com/user/repo/pull/123' });
    mockGetIssue.mockResolvedValue({ number: 42, title: 'Test Issue' });
    mockGetRepository.mockResolvedValue({ name: 'test-repo', default_branch: 'main' });
  });

  describe('createCommitFunction', () => {
    it('should automatically create a branch if it does not exist', async () => {
      // Setup
      mockBranchExists.mockResolvedValue(false);

      const params = {
        message: 'Test commit',
        files: [{ path: 'test.txt', content: 'test content' }],
        branch: 'test-branch'
      };

      // Act
      const result = await createCommitFunction.handler(params, 'agentId');

      // Assert
      expect(mockBranchExists).toHaveBeenCalledWith('test-branch');
      expect(mockCreateBranch).toHaveBeenCalledWith('test-branch', 'main');
      expect(mockCreateCommit).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.message).toContain('automatically created');
    });

    it('should commit to an existing branch without creating it', async () => {
      // Setup
      mockBranchExists.mockResolvedValue(true);

      const params = {
        message: 'Test commit',
        files: [{ path: 'test.txt', content: 'test content' }],
        branch: 'existing-branch'
      };

      // Act
      const result = await createCommitFunction.handler(params, 'agentId');

      // Assert
      expect(mockBranchExists).toHaveBeenCalledWith('existing-branch');
      expect(mockCreateBranch).not.toHaveBeenCalled();
      expect(mockCreateCommit).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.message).not.toContain('automatically created');
    });

    it('should return error if branch creation fails', async () => {
      // Setup
      mockBranchExists.mockResolvedValue(false);
      mockCreateBranch.mockRejectedValue(new Error('Branch creation failed'));

      const params = {
        message: 'Test commit',
        files: [{ path: 'test.txt', content: 'test content' }],
        branch: 'test-branch'
      };

      // Act
      const result = await createCommitFunction.handler(params, 'agentId');

      // Assert
      expect(mockBranchExists).toHaveBeenCalledWith('test-branch');
      expect(mockCreateBranch).toHaveBeenCalled();
      expect(mockCreateCommit).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toContain('IMPORTANT');
    });
  });

  describe('createPullRequestFunction', () => {
    it('should check if branch exists before creating PR', async () => {
      // Setup
      mockBranchExists.mockResolvedValue(true);

      const params = {
        title: 'Test PR',
        body: 'Test PR description',
        head: 'feature-branch',
        base: 'main'
      };

      // Act
      const result = await createPullRequestFunction.handler(params, 'agentId');

      // Assert
      expect(mockBranchExists).toHaveBeenCalledWith('feature-branch');
      expect(mockCreatePullRequest).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.pr_number).toBe(123);
    });

    it('should attempt to create branch if it does not exist', async () => {
      // Setup
      mockBranchExists.mockResolvedValue(false);

      const params = {
        title: 'Test PR',
        body: 'Test PR description',
        head: 'feature-branch',
        base: 'main'
      };

      // Act
      const result = await createPullRequestFunction.handler(params, 'agentId');

      // Assert
      expect(mockBranchExists).toHaveBeenCalledWith('feature-branch');
      expect(mockCreateBranch).toHaveBeenCalled();
      expect(mockCreatePullRequest).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toContain('CRITICAL WORKFLOW ERROR');
    });
  });

  describe('createBranchFunction', () => {
    it('should create a branch from a source branch', async () => {
      // Act
      const result = await createBranchFunction.handler({
        name: 'new-branch',
        source: 'develop'
      }, 'agentId');

      // Assert
      expect(mockCreateBranch).toHaveBeenCalledWith('new-branch', 'develop');
      expect(result.success).toBe(true);
      expect(result.message).toContain('new-branch created successfully');
    });

    it('should use main as default source branch', async () => {
      // Act
      const result = await createBranchFunction.handler({
        name: 'new-branch'
      }, 'agentId');

      // Assert
      expect(mockCreateBranch).toHaveBeenCalledWith('new-branch', 'main');
      expect(result.success).toBe(true);
    });
  });
}); 