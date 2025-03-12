import { GitHubService } from './GitHubService';
import { OpenAIFunctionDefinition } from '@/types/openai/OpenAITypes';
import { AgentFunction } from '@/types/agents/Agent';
import { config } from '@/config/config';

// Initialize the GitHub service
const githubService = new GitHubService();

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
      const result = await githubService.createPullRequest({
        title: params.title,
        body: params.body,
        head: params.head,
        base: params.base,
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
      return {
        success: false,
        error: error.message
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
      console.log(`Agent ${agentId} is creating a commit with message: ${params.message}`);
      
      const result = await githubService.createCommit({
        message: params.message,
        files: params.files.map((file: any) => ({
          path: file.path,
          content: file.content
        })),
        branch: params.branch
      });
      
      console.log(`Commit created successfully: ${result.sha.substring(0, 7)}`);
      return {
        success: true,
        commit_sha: result.sha,
        message: `Commit ${result.sha.substring(0, 7)} created successfully`
      };
    } catch (error) {
      console.error('Error creating commit:', error);
      
      // Check if the error message indicates an empty repository
      if (error.message && error.message.includes('Git Repository is empty')) {
        console.log('Repository is empty. This should be handled automatically by GitHubService.');
      }
      
      return {
        success: false,
        error: error.message
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
  description: 'Gets information about the GitHub repository',
  parameters: {},
  handler: async (params, agentId) => {
    try {
      const result = await githubService.getRepository();
      
      return {
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
        }
      };
    } catch (error) {
      console.error('Error getting repository info:', error);
      return {
        success: false,
        error: error.message
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

// Export all GitHub functions
export const githubFunctions: AgentFunction[] = [
  createIssueFunction,
  createPullRequestFunction,
  createCommitFunction,
  createReviewFunction,
  getRepositoryInfoFunction,
  createBranchFunction
];

// Export function definitions for OpenAI
export const githubFunctionDefinitions: OpenAIFunctionDefinition[] = githubFunctions.map(func => ({
  name: func.name,
  description: func.description,
  parameters: {
    type: 'object',
    properties: func.parameters,
    required: Object.keys(func.parameters).filter(key => 
      !['draft', 'assignees', 'labels', 'branch', 'comments'].includes(key)
    )
  }
})); 