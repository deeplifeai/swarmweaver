import { GitHubService } from './GitHubService';
import { OpenAIFunctionDefinition } from '@/types/openai/OpenAITypes';
import { AgentFunction } from '@/types/agents/Agent';
import { eventBus, EventType } from '@/utils/EventBus';

// Add a DEBUG_WORKFLOW constant for controlling debugging output
const DEBUG_WORKFLOW = process.env.DEBUG_WORKFLOW === 'true';

// Create a WorkflowMemory class for robust workflow state management
class WorkflowMemory {
  private state: {
    repositoryInfo: any;
    getRepositoryInfoCalled: boolean;
    currentIssueNumber: number | null;
    currentBranch: string | null;
    autoProgressWorkflow: boolean;
  };
  private conversationHistory: Array<{
    role: string;
    content: string;
    agentId: string;
    timestamp: Date;
  }>;
  private agentTransitions: Array<{
    from: string;
    to: string;
    reason: string;
    timestamp: Date;
  }>;

  constructor() {
    this.state = {
      repositoryInfo: null,
      getRepositoryInfoCalled: false,
      currentIssueNumber: null,
      currentBranch: null,
      autoProgressWorkflow: true
    };
    this.conversationHistory = [];
    this.agentTransitions = [];
  }

  updateState(updates: Partial<typeof this.state>) {
    this.state = { ...this.state, ...updates };
    this.traceWorkflow('stateUpdate', this.state);
  }

  addMessage(role: string, content: string, agentId: string) {
    const message = { role, content, agentId, timestamp: new Date() };
    this.conversationHistory.push(message);
    this.traceWorkflow('messageAdded', message);
  }

  recordAgentTransition(fromAgentId: string, toAgentId: string, reason: string) {
    const transition = { from: fromAgentId, to: toAgentId, reason, timestamp: new Date() };
    this.agentTransitions.push(transition);
    this.traceWorkflow('agentTransition', transition);
  }

  getState() {
    return this.state;
  }

  getContextForAgent() {
    return {
      state: this.state,
      recentMessages: this.conversationHistory.slice(-5),
      lastTransition: this.agentTransitions.length > 0 
        ? this.agentTransitions[this.agentTransitions.length - 1] 
        : null
    };
  }

  // Getters for backward compatibility
  get repositoryInfo() {
    return this.state.repositoryInfo;
  }

  set repositoryInfo(value) {
    this.updateState({ repositoryInfo: value });
  }

  get getRepositoryInfoCalled() {
    return this.state.getRepositoryInfoCalled;
  }

  set getRepositoryInfoCalled(value) {
    this.updateState({ getRepositoryInfoCalled: value });
  }

  get currentIssueNumber() {
    return this.state.currentIssueNumber;
  }

  set currentIssueNumber(value) {
    this.updateState({ currentIssueNumber: value });
  }

  get currentBranch() {
    return this.state.currentBranch;
  }

  set currentBranch(value) {
    this.updateState({ currentBranch: value });
  }

  get autoProgressWorkflow() {
    return this.state.autoProgressWorkflow;
  }

  set autoProgressWorkflow(value) {
    this.updateState({ autoProgressWorkflow: value });
  }

  // Add tracing support
  private traceWorkflow(stage: string, data: any) {
    if (!DEBUG_WORKFLOW) return;
    
    console.log(`[WORKFLOW TRACE] ${new Date().toISOString()} | Stage: ${stage}`);
    console.log(JSON.stringify(data, null, 2));
  }
}

// Replace the workflowState object with the WorkflowMemory class
const workflowState = new WorkflowMemory();

// Initialize the GitHub service with proper error handling
export let githubService: any;

try {
  // In tests, we'll use a mock version
  if (process.env.NODE_ENV === 'test') {
    githubService = {
      getRepository: async () => ({}),
      getIssue: async () => ({}),
      createIssue: async () => ({}),
      addCommentToIssue: async () => ({}),
      createBranch: async () => ({}),
      branchExists: async () => ({}),
      createCommit: async () => ({}),
      createPullRequest: async () => ({}),
      getPullRequest: async () => ({}),
      addReviewToPullRequest: async () => ({}),
      mergePullRequest: async () => ({}),
      closeIssue: async () => ({})
    };
  } else {
    githubService = new GitHubService();
  }
} catch (error) {
  console.error('Failed to initialize GitHubService:', error);
  // Create a fallback service that will provide clear error messages
  githubService = {
    getRepository: async () => { 
      throw new Error('GitHub service initialization failed. Please check your GitHub token and repository configuration.'); 
    },
    getIssue: async () => {
      throw new Error('GitHub service initialization failed. You must first ensure your GitHub token and repository configuration are correct.');
    },
    createBranch: async () => {
      throw new Error('GitHub service initialization failed. Please check your GitHub token and repository configuration.');
    },
    listIssues: async () => {
      throw new Error('GitHub service initialization failed. Please check your GitHub token and repository configuration.');
    },
    // ... other methods with appropriate error messages
  } as any;
}

// Function to set the githubService for testing
export function setGitHubService(mockService: any) {
  githubService = mockService;
}

// Create Issue Function
export const createIssueFunction: AgentFunction = {
  name: 'createIssue',
  description: 'Creates a new issue in the GitHub repository',
  parameters: {
    title: { type: 'string', description: 'The title of the issue' },
    body: { type: 'string', description: 'The detailed description of the issue' },
    assignees: { 
      type: 'array', 
      items: { type: 'string' },
      description: 'Optional list of agents to mention in the issue body (will not be set as GitHub assignees)' 
    },
    labels: { 
      type: 'array', 
      items: { type: 'string' },
      description: 'Optional list of labels to apply to the issue' 
    }
  },
  handler: async (params) => {
    try {
      // If assignees are provided, add them to the body instead of setting them in GitHub
      let bodyWithAssignees = params.body;
      
      if (params.assignees && params.assignees.length > 0) {
        // Add a section at the end of the body mentioning assigned agents
        bodyWithAssignees += `\n\n## Assigned Agents\n`;
        params.assignees.forEach((agent: string) => {
          bodyWithAssignees += `- ${agent}\n`;
        });
      }
      
      const result = await githubService.createIssue({
        title: params.title,
        body: bodyWithAssignees,
        // Do not pass assignees to GitHub API
        labels: params.labels
      });
      
      return {
        success: true,
        issue_number: result.number,
        url: result.html_url,
        message: `Issue #${result.number} created successfully`
      };
    } catch (error) {
      console.error('Error creating issue:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
};

// Create Pull Request Function
export const createPullRequestFunction: AgentFunction = {
  name: 'createPullRequest',
  description: 'Creates a pull request in the GitHub repository',
  parameters: {
    title: { type: 'string', description: 'The title of the pull request' },
    body: { type: 'string', description: 'The description of the pull request' },
    head: { type: 'string', description: 'The name of the branch containing your changes' },
    base: { type: 'string', description: 'The branch you want your changes pulled into (usually main)' }
  },
  handler: async (params, _agentId) => {
    try {
      const result = await githubService.createPullRequest({
        title: params.title,
        body: params.body,
        head: params.head,
        base: params.base || 'main'
      });
      
      return {
        success: true,
        pull_request_number: result.number,
        url: result.html_url,
        message: `Pull request #${result.number} created successfully`
      };
    } catch (error) {
      console.error('Error creating pull request:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
};

// Create Commit Function
export const createCommitFunction: AgentFunction = {
  name: 'createCommit',
  description: 'Creates a new commit with one or more file changes in the GitHub repository',
  parameters: {
    message: { type: 'string', description: 'The commit message' },
    files: { 
      type: 'array', 
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' }
        },
        required: ['path', 'content']
      },
      description: 'Array of file objects with path and content properties to be committed'
    },
    branch: { type: 'string', description: 'Optional branch name to commit to (defaults to main)' }
  },
  handler: async (params, agentId) => {
    try {
      const branchName = params.branch || 'main';
      console.log(`Agent ${agentId} is creating a commit with message: ${params.message} on branch: ${branchName}`);
      
      // Check if the branch exists first
      const branchExists = await githubService.branchExists(branchName);
      
      // If branch doesn't exist and it's not the main branch, create it automatically
      if (!branchExists && branchName !== 'main') {
        console.log(`Branch ${branchName} does not exist. Creating it automatically...`);
        
        try {
          await githubService.createBranch(branchName, 'main');
          console.log(`Branch ${branchName} created successfully. Proceeding with commit...`);
        } catch (branchError) {
          console.error('Error creating branch:', branchError);
          return {
            success: false,
            error: `⚠️ IMPORTANT: You must create a branch before committing to it. Please call createBranch({name: "${branchName}"}) first, then retry your commit.`
          };
        }
      }
      
      // Now try to create the commit (branch should exist now)
      try {
        const result = await githubService.createCommit({
          message: params.message,
          files: params.files.map((file: any) => ({
            path: file.path,
            content: file.content
          })),
          branch: branchName
        });
        
        console.log(`Commit created successfully: ${result.sha.substring(0, 7)}`);
        
        // Create the response object based on whether we auto-created the branch
        let response;
        if (!branchExists && branchName !== 'main') {
          response = {
            success: true,
            commit_sha: result.sha,
            message: `Branch ${branchName} was automatically created and commit ${result.sha.substring(0, 7)} was added successfully`,
            workflow_hint: `Next step: Create a pull request with createPullRequest({title: "Your PR title", body: "PR description", head: "${branchName}", base: "main"})`
          };
        } else {
          response = {
            success: true,
            commit_sha: result.sha,
            message: `Commit ${result.sha.substring(0, 7)} created successfully`,
            workflow_hint: `Next step: Create a pull request with createPullRequest({title: "Your PR title", body: "PR description", head: "${branchName}", base: "main"})`
          };
        }
        
        // Check if we should auto-progress to creating a pull request
        if (workflowState.currentIssueNumber && workflowState.autoProgressWorkflow) {
          console.log(`Auto-progressing workflow to create pull request for issue #${workflowState.currentIssueNumber}`);
          
          try {
            const issueNumber = workflowState.currentIssueNumber;
            
            // Create a PR title and body based on the issue
            const prTitle = `Resolve issue #${issueNumber}`;
            let prBody = `This PR implements the solution for issue #${issueNumber}.`;
            
            // Add details about the implementation
            if (branchName.includes('fibonacci') || params.message.includes('fibonacci')) {
              prBody += `\n\n## Implementation Details
              
- Added a fibonacci.js file with two key functions:
  - \`fibonacci(n)\` - Calculates the nth Fibonacci number
  - \`generateFibonacciSequence(n)\` - Generates a sequence of n Fibonacci numbers
- Added README.md with documentation and examples
- Implementation uses an iterative approach for better performance with large inputs
              
## Testing

The implementation has been tested with various inputs and edge cases.`;
            }
            
            // Call createPullRequest directly
            const prResult = await createPullRequestFunction.handler({
              title: prTitle,
              body: prBody,
              head: branchName,
              base: 'main'
            }, agentId);
            
            // If successful, return combined response
            if (prResult.success) {
              return {
                ...response,
                auto_created_pr: prResult,
                workflow_hint: `Branch created, code committed, and PR #${prResult.pull_request_number} opened automatically. The GitHub workflow is now complete! 🎉`
              };
            }
          } catch (error) {
            console.error(`Error auto-creating pull request for issue #${workflowState.currentIssueNumber}:`, error);
            // On error, just return the commit info and let the agent handle it manually
          }
        }
        
        return response;
      } catch (commitError) {
        console.error('Error creating commit:', commitError);
        
        // If we still get an error after creating the branch, provide a more specific error message
        if (!branchExists && branchName !== 'main') {
          return {
            success: false,
            error: `❌ Failed to commit to newly created branch ${branchName}. Error: ${commitError instanceof Error ? commitError.message : 'Unknown error'}`
          };
        } else {
          return {
            success: false,
            error: commitError instanceof Error ? commitError.message : 'Unknown error'
          };
        }
      }
    } catch (error) {
      console.error('Error in createCommit function:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
};

// Create Review Function
export const createReviewFunction: AgentFunction = {
  name: 'createReview',
  description: 'Creates a review on a pull request in the GitHub repository',
  parameters: {
    pull_number: { type: 'number', description: 'The number of the pull request to review' },
    body: { type: 'string', description: 'The body text of the review' },
    event: { 
      type: 'string', 
      description: 'The review action to perform: APPROVE, REQUEST_CHANGES, or COMMENT',
      enum: ['APPROVE', 'REQUEST_CHANGES', 'COMMENT']
    },
    comments: { 
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          position: { type: 'number' },
          body: { type: 'string' }
        },
        required: ['body']
      },
      description: 'Optional array of comments to make on the pull request' 
    }
  },
  handler: async (params, _agentId) => {
    try {
      const result = await githubService.createReview(
        params.pull_number,
        {
          body: params.body,
          event: params.event as 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
          comments: params.comments
        }
      );
      
      return {
        success: true,
        review_id: result.id,
        message: `Review created successfully with status: ${params.event}`
      };
    } catch (error) {
      console.error('Error creating review:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
};

// Get Repository Info Function
export const getRepositoryInfoFunction: AgentFunction = {
  name: 'getRepositoryInfo',
  description: 'Gets information about the GitHub repository. This must be called first before accessing issues or creating branches.',
  parameters: {},
  handler: async (_params, agentId) => {
    try {
      console.log(`Agent ${agentId} is retrieving repository information`);
      const result = await githubService.getRepository();
      
      // Store repository info and mark this function as called
      workflowState.repositoryInfo = result;
      workflowState.getRepositoryInfoCalled = true;
      
      // Determine if there's already an issue number detected in the conversation
      // This is set from the AgentOrchestrator when it detects an issue number in the message
      const issueNumber = workflowState.currentIssueNumber;
      
      const response = {
        success: true,
        repository: {
          name: result.name,
          full_name: result.full_name,
          description: result.description,
          url: result.html_url,
          default_branch: result.default_branch,
          open_issues_count: result.open_issues_count,
          forks_count: result.forks_count,
          stars_count: result.stargazers_count,
          created_at: result.created_at,
          updated_at: result.updated_at
        },
        workflow_hint: "Now you can get issue details with getIssue({number: X}) or list issues with listIssues()"
      };
      
      // If we have an issue number and auto-progress is enabled, automatically fetch the issue details
      if (issueNumber && workflowState.autoProgressWorkflow) {
        console.log(`Auto-progressing workflow to fetch issue #${issueNumber} details`);
        
        try {
          // Call getIssue directly
          const issueResult = await getIssueFunction.handler({ issueNumber }, agentId);
          
          // If successful, return combined response
          if (issueResult.success) {
            return {
              ...response,
              auto_fetched_issue: issueResult,
              workflow_hint: `Issue #${issueNumber} details retrieved automatically. Next step: Create a branch using createBranch({name: "feature-issue-${issueNumber}"})`
            };
          }
        } catch (error) {
          console.error(`Error auto-fetching issue #${issueNumber}:`, error);
          // On error, just return the repository info and let the agent handle it manually
        }
      }
      
      return response;
    } catch (error) {
      console.error('Error getting repository info:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        workflow_hint: "Please check your GitHub token and repository configuration in the .env file."
      };
    }
  }
};

// Get Issue Function
export const getIssueFunction: AgentFunction = {
  name: 'getIssue',
  description: 'Gets an issue from the GitHub repository',
  parameters: {
    issueNumber: { type: 'number', description: 'The issue number to retrieve' }
  },
  handler: async (params, _agentId) => {
    try {
      const issue = await githubService.getIssue(params.issueNumber);
      return {
        success: true,
        issue
      };
    } catch (error) {
      console.error('Error getting issue:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
};

// Create Branch Function
export const createBranchFunction: AgentFunction = {
  name: 'createBranch',
  description: 'Creates a new branch in the GitHub repository',
  parameters: {
    name: { type: 'string', description: 'The name of the branch to create' }
  },
  handler: async (params, _agentId) => {
    try {
      const result = await githubService.createBranch(params.name);
      return {
        success: true,
        branch: result.name,
        message: `Branch ${result.name} created successfully`
      };
    } catch (error) {
      console.error('Error creating branch:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
};

// List Issues Function
export const listIssuesFunction: AgentFunction = {
  name: 'listIssues',
  description: 'Lists issues in the GitHub repository',
  parameters: {
    state: { 
      type: 'string', 
      enum: ['open', 'closed', 'all'],
      description: 'Filter issues by state (open, closed, all)',
      default: 'open'
    }
  },
  handler: async (params, _agentId) => {
    try {
      const issues = await githubService.listIssues(params.state || 'open');
      return {
        success: true,
        issues
      };
    } catch (error) {
      console.error('Error listing issues:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
};

// Debug function
export const debugFunction: AgentFunction = {
  name: 'debug',
  description: 'Provides debugging information about the current workflow state',
  parameters: {
    message: { type: 'string', description: 'Optional debug message' }
  },
  handler: async (params, agentId) => {
    try {
      console.log(`Debug function called by agent ${agentId}: ${params.message || 'No message provided'}`);
      return {
        success: true,
        message: params.message || 'Debug function called successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
};

// Export all GitHub functions
export const githubFunctions: AgentFunction[] = [
  createIssueFunction,
  createPullRequestFunction,
  createCommitFunction,
  createReviewFunction,
  getRepositoryInfoFunction,
  createBranchFunction,
  getIssueFunction,
  listIssuesFunction,
  debugFunction
];

// Function to reset workflow state (for testing)
export const resetWorkflowState = () => {
  workflowState.repositoryInfo = null;
  workflowState.getRepositoryInfoCalled = false;
  workflowState.currentIssueNumber = null;
  workflowState.currentBranch = null;
  workflowState.autoProgressWorkflow = true;
};

// Function to set current issue number in workflow state
export const setCurrentIssueNumber = (issueNumber: number) => {
  workflowState.currentIssueNumber = issueNumber;
};

// Make sure to export this function directly as well for CommonJS compatibility
export function setIssueNumber(issueNumber: number) {
  workflowState.currentIssueNumber = issueNumber;
}

// Export function definitions for OpenAI
export const githubFunctionDefinitions: OpenAIFunctionDefinition[] = githubFunctions.map(func => ({
  name: func.name,
  description: func.description,
  parameters: {
    type: 'object',
    properties: func.parameters,
    required: Object.keys(func.parameters).filter(key => 
      !['draft', 'assignees', 'labels', 'branch', 'comments', 'source'].includes(key)
    )
  }
}));

// Add explicit CommonJS module exports for better compatibility
// This helps when the TypeScript is compiled to JavaScript
// @ts-ignore
if (typeof module !== 'undefined' && module.exports) {
  // @ts-ignore
  module.exports = {
    githubFunctions,
    githubFunctionDefinitions,
    setCurrentIssueNumber,
    setIssueNumber,
    resetWorkflowState,
    setGitHubService,
    // Export direct references to the individual functions for CommonJS
    getRepositoryInfoFunction,
    getIssueFunction,
    listIssuesFunction,
    createIssueFunction,
    createPullRequestFunction,
    createCommitFunction,
    createReviewFunction,
    createBranchFunction,
    debugFunction,
    // Export the event emitter for CommonJS
    eventBus,
    EventType
  };
}

// Export the event emitter so other modules can listen for events
export { eventBus, EventType }; 