import { GitHubService } from './GitHubService';
import { OpenAIFunctionDefinition } from '@/types/openai/OpenAITypes';
import { AgentFunction } from '@/types/agents/Agent';
import { config } from '@/config/config';

// Create a workflow state to track function calls
const workflowState = {
  repositoryInfo: null,
  getRepositoryInfoCalled: false,
  currentIssueNumber: null,
  currentBranch: null,
  autoProgressWorkflow: true
};

// Initialize the GitHub service with proper error handling
let githubService: GitHubService;

try {
  githubService = new GitHubService();
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

// Create Issue Function
export const createIssueFunction: AgentFunction = {
  name: 'createIssue',
  description: 'Creates a new issue in the GitHub repository',
  parameters: {
    title: { type: 'string', description: 'The title of the issue' },
    body: { type: 'string', description: 'The detailed description of the issue' },
    assignees: { type: 'array', description: 'Optional list of GitHub usernames to assign to the issue' },
    labels: { type: 'array', description: 'Optional list of labels to apply to the issue' }
  },
  handler: async (params, agentId) => {
    try {
      // Filter out agent role names from assignees that might not be valid GitHub usernames
      // This includes common role names used within SwarmWeaver
      let assignees = params.assignees;
      const agentRoleNames = ['Developer', 'ProjectManager', 'CodeReviewer', 'QATester', 'TechnicalWriter'];
      
      // If all assignees are agent role names, set to undefined to avoid GitHub API validation errors
      if (assignees && assignees.length > 0) {
        const validAssignees = assignees.filter(name => !agentRoleNames.includes(name));
        
        // If we've filtered out all assignees, set to undefined
        assignees = validAssignees.length > 0 ? validAssignees : undefined;
      }
      
      const result = await githubService.createIssue({
        title: params.title,
        body: params.body,
        assignees: assignees,
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
        error: error.message
      };
    }
  }
};

// Create Pull Request Function
export const createPullRequestFunction: AgentFunction = {
  name: 'createPullRequest',
  description: 'Creates a new pull request in the GitHub repository',
  parameters: {
    title: { type: 'string', description: 'The title of the pull request' },
    body: { type: 'string', description: 'The detailed description of the pull request' },
    head: { type: 'string', description: 'The name of the branch where your changes are implemented' },
    base: { type: 'string', description: 'The name of the branch you want the changes pulled into' },
    draft: { type: 'boolean', description: 'Optional flag to indicate if the pull request is a draft' }
  },
  handler: async (params, agentId) => {
    try {
      console.log(`Agent ${agentId} is creating a pull request from ${params.head} to ${params.base || 'main'}`);
      
      // First check if the head branch exists
      const branchExists = await githubService.branchExists(params.head);
      if (!branchExists) {
        console.error(`Branch ${params.head} does not exist for PR creation`);
        
        // Try to create the branch automatically, though this likely won't help without commits
        try {
          console.log(`Attempting to create branch ${params.head} automatically...`);
          await githubService.createBranch(params.head, 'main');
          console.log(`Branch ${params.head} created, but it has no commits. You need to commit changes to it.`);
          
          return {
            success: false,
            error: `⚠️ CRITICAL WORKFLOW ERROR: Branch '${params.head}' was created but has no commits. 
You MUST follow this exact workflow:
1. First create a branch with createBranch({name: "${params.head}"})
2. Then commit your changes with createCommit({files: [...], branch: "${params.head}"})
3. Only then create a PR with createPullRequest`
          };
        } catch (branchError) {
          return {
            success: false,
            error: `⚠️ CRITICAL WORKFLOW ERROR: Branch '${params.head}' doesn't exist. 
You MUST follow this exact workflow:
1. First create a branch with createBranch({name: "${params.head}"})
2. Then commit your changes with createCommit({files: [...], branch: "${params.head}"})
3. Only then create a PR with createPullRequest`
          };
        }
      }
      
      // If we made it here, the branch exists, so create the PR
      const result = await githubService.createPullRequest({
        title: params.title,
        body: params.body,
        head: params.head,
        base: params.base || 'main',
        draft: params.draft
      });
      
      return {
        success: true,
        pr_number: result.number,
        url: result.html_url,
        message: `Pull request #${result.number} created successfully`
      };
    } catch (error) {
      console.error('Error creating pull request:', error);
      
      // Make the error message more helpful
      let errorMessage = error.message;
      if (error.message && error.message.includes('Validation Failed') && error.message.includes('head')) {
        errorMessage = `⚠️ CRITICAL WORKFLOW ERROR: Invalid branch name '${params.head}'. 
You MUST follow this exact workflow:
1. First create a branch with createBranch({name: "${params.head}"})
2. Then commit your changes with createCommit({files: [...], branch: "${params.head}"})
3. Only then create a PR with createPullRequest`;
      }
      
      return {
        success: false,
        error: errorMessage
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
        
        // If we created the branch automatically, add that to the success message
        if (!branchExists && branchName !== 'main') {
          return {
            success: true,
            commit_sha: result.sha,
            message: `Branch ${branchName} was automatically created and commit ${result.sha.substring(0, 7)} was added successfully`
          };
        } else {
          return {
            success: true,
            commit_sha: result.sha,
            message: `Commit ${result.sha.substring(0, 7)} created successfully`
          };
        }
      } catch (commitError) {
        console.error('Error creating commit:', commitError);
        
        // If we still get an error after creating the branch, provide a more specific error message
        if (!branchExists && branchName !== 'main') {
          return {
            success: false,
            error: `❌ Failed to commit to newly created branch ${branchName}. Error: ${commitError.message}`
          };
        } else {
          return {
            success: false,
            error: commitError.message
          };
        }
      }
    } catch (error) {
      console.error('Error in createCommit function:', error);
      
      // Check if the error message indicates an empty repository
      if (error.message && error.message.includes('Git Repository is empty')) {
        console.log('Repository is empty. This should be handled automatically by GitHubService.');
      }
      
      return {
        success: false,
        error: `Error handling commit: ${error.message}. Please follow the workflow: 1) createBranch 2) createCommit 3) createPullRequest`
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
      description: 'Optional array of comments to make on the pull request' 
    }
  },
  handler: async (params, agentId) => {
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
        error: error.message
      };
    }
  }
};

// Get Repository Info Function
export const getRepositoryInfoFunction: AgentFunction = {
  name: 'getRepositoryInfo',
  description: 'Gets information about the GitHub repository. This must be called first before accessing issues or creating branches.',
  parameters: {},
  handler: async (params, agentId) => {
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
          const issueResult = await getIssueFunction.handler({ number: issueNumber }, agentId);
          
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
        error: error.message,
        workflow_hint: "Please check your GitHub token and repository configuration in the .env file."
      };
    }
  }
};

// Get Issue Function
export const getIssueFunction: AgentFunction = {
  name: 'getIssue',
  description: 'Gets information about a specific GitHub issue by number. Requires getRepositoryInfo to be called first.',
  parameters: {
    number: { type: 'number', description: 'The issue number to retrieve' }
  },
  handler: async (params, agentId) => {
    try {
      console.log(`Agent ${agentId} is retrieving issue #${params.number}`);
      
      // Check if getRepositoryInfo was called first
      if (!workflowState.getRepositoryInfoCalled) {
        return {
          success: false,
          error: "Repository information not loaded",
          workflow_hint: "You must first call getRepositoryInfo() before getting issue details."
        };
      }
      
      // Validate issue number
      if (!params.number || isNaN(params.number) || params.number < 1) {
        return {
          success: false,
          error: `Invalid issue number: ${params.number}. Issue numbers must be positive integers.`,
          workflow_hint: "Check that you're providing a valid issue number."
        };
      }
      
      const result = await githubService.getIssue(params.number);
      
      console.log(`Successfully retrieved issue #${params.number}: ${result.title}`);
      
      // Set the current issue number in the workflow state
      workflowState.currentIssueNumber = params.number;
      
      // Check if this is issue #3 and provide specific implementation guidance
      let implementationGuide = "";
      let nextSteps = `Next step: Create a branch using createBranch({name: "feature-issue-${result.number}"})`;
      
      if (params.number === 3) {
        implementationGuide = `
Implementation guide for issue #3:
1. Create a branch named "feature-issue-3"
2. Implement the requested feature as described in the issue
3. Commit your changes with a descriptive message
4. Create a pull request to merge your changes into the main branch

For this specific issue, you should:
- Create helper functions to handle the specified requirements
- Make sure to add appropriate error handling
- Include tests if needed
- Follow the coding style of the existing codebase
`;
        
        nextSteps = `
IMPORTANT NEXT STEPS:
1. Call createBranch({name: "feature-issue-3"})
2. Then implement the code changes with createCommit()
3. Finally create a pull request with createPullRequest()
`;
      }
      
      return {
        success: true,
        number: result.number,
        title: result.title,
        body: result.body,
        html_url: result.html_url,
        state: result.state,
        assignees: result.assignees,
        labels: result.labels,
        implementation_guide: implementationGuide,
        workflow_hint: nextSteps
      };
    } catch (error) {
      console.error(`Error getting issue #${params.number}:`, error);
      
      // Enhanced error handling with more specific guidance
      let errorMessage = error.message;
      let workflowHint = "First make sure the issue exists. Try using listIssues() to see available issues.";
      
      if (error.status === 404) {
        errorMessage = `Issue #${params.number} not found in the repository.`;
        workflowHint = "Check the issue number and make sure it exists in this repository. Use listIssues() to see available issues.";
      } else if (error.status === 401 || error.status === 403) {
        errorMessage = "Authentication error - Unable to access the repository.";
        workflowHint = "Ensure your GitHub token has proper permissions to access this repository.";
      } else if (error.message.includes("Not Found")) {
        errorMessage = "Repository or issue not found.";
        workflowHint = "Check that your repository exists and that you have access to it.";
      }
      
      // Try to list available issues to help the agent
      let issuesList;
      try {
        const issues = await githubService.listIssues({ state: 'all', per_page: 5 });
        const validIssues = issues.map(issue => `#${issue.number}: ${issue.title}`);
        issuesList = validIssues.length > 0 
          ? "Available issues: " + validIssues.join(", ")
          : "No issues found in this repository.";
      } catch (listError) {
        issuesList = "Unable to list available issues: " + listError.message;
      }
      
      return {
        success: false,
        error: errorMessage,
        available_issues: issuesList,
        workflow_hint: workflowHint
      };
    }
  }
};

// Create Branch Function
export const createBranchFunction: AgentFunction = {
  name: 'createBranch',
  description: 'Creates a new branch in the GitHub repository',
  parameters: {
    name: { type: 'string', description: 'The name of the new branch' },
    source: { type: 'string', description: 'Optional source branch to create from (defaults to main)' }
  },
  handler: async (params, agentId) => {
    try {
      console.log(`Agent ${agentId} is creating branch: ${params.name}`);
      
      const result = await githubService.createBranch(
        params.name,
        params.source || 'main'
      );
      
      return {
        success: true,
        ref: result.ref,
        sha: result.object.sha,
        message: `Branch ${params.name} created successfully`
      };
    } catch (error) {
      console.error('Error creating branch:', error);
      return {
        success: false,
        error: error.message
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
  handler: async (params, agentId) => {
    try {
      console.log(`Agent ${agentId} is listing issues with state: ${params.state || 'open'}`);
      
      const options = {
        state: params.state || 'open',
        per_page: 10
      };
      
      const issues = await githubService.listIssues(options);
      
      return {
        success: true,
        total_count: issues.length,
        issues: issues.map(issue => ({
          number: issue.number,
          title: issue.title,
          state: issue.state,
          html_url: issue.html_url
        }))
      };
    } catch (error) {
      console.error('Error listing issues:', error);
      return {
        success: false,
        error: error.message
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
    console.log(`Debug function called by agent ${agentId}: ${params.message || 'No message provided'}`);
    
    return {
      success: true,
      message: params.message || 'Debug function called',
      workflow_state: {
        repositoryInfoLoaded: workflowState.getRepositoryInfoCalled
      },
      workflow_reminder: 'Remember to follow the exact workflow: 1) getRepositoryInfo, 2) getIssue or listIssues, 3) createBranch, 4) createCommit, 5) createPullRequest',
      timestamp: new Date().toISOString()
    };
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