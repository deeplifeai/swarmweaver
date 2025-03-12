require('dotenv').config();

// Create a config object manually instead of importing from @/config/config
const config = {
  github: {
    token: process.env.GITHUB_TOKEN,
    repository: process.env.GITHUB_REPOSITORY
  }
};

// Create a simplified GitHub service
const { Octokit } = require('@octokit/rest');

class GitHubService {
  constructor() {
    this.octokit = new Octokit({ auth: config.github.token });
    const repoPath = config.github.repository.replace(/\.git$/, '');
    const [owner, repo] = repoPath.split('/');
    this.defaultRepo = { owner, repo };
  }

  async getRepository() {
    const { owner, repo } = this.defaultRepo;
    const response = await this.octokit.repos.get({ owner, repo });
    return response.data;
  }

  async createIssue(issue) {
    const { owner, repo } = this.defaultRepo;
    const response = await this.octokit.issues.create({
      owner, repo,
      title: issue.title,
      body: issue.body,
      labels: issue.labels
    });
    return response.data;
  }

  async getIssue(issueNumber) {
    const { owner, repo } = this.defaultRepo;
    const response = await this.octokit.issues.get({
      owner, repo,
      issue_number: issueNumber
    });
    return response.data;
  }

  async branchExists(branchName) {
    try {
      const { owner, repo } = this.defaultRepo;
      await this.octokit.git.getRef({
        owner, repo,
        ref: `heads/${branchName}`
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async createBranch(branchName, sourceBranch = 'main') {
    const { owner, repo } = this.defaultRepo;
    console.log(`Creating branch ${branchName} from ${sourceBranch} in ${owner}/${repo}`);
    
    // Get the SHA of the source branch
    const sourceRef = await this.octokit.git.getRef({
      owner, repo,
      ref: `heads/${sourceBranch}`
    });
    
    const sourceSha = sourceRef.data.object.sha;
    
    // Create a new reference (branch)
    const response = await this.octokit.git.createRef({
      owner, repo,
      ref: `refs/heads/${branchName}`,
      sha: sourceSha
    });
    
    return response.data;
  }

  async createCommit(commit) {
    const { owner, repo } = this.defaultRepo;
    const branch = commit.branch || 'main';
    
    // Get the latest commit SHA for the branch
    const refResponse = await this.octokit.git.getRef({
      owner, repo,
      ref: `heads/${branch}`
    });
    const latestCommitSha = refResponse.data.object.sha;
    
    // Get the tree SHA from the latest commit
    const commitResponse = await this.octokit.git.getCommit({
      owner, repo,
      commit_sha: latestCommitSha
    });
    const treeSha = commitResponse.data.tree.sha;
    
    // Create a new tree with the new files
    const newTreeItems = await Promise.all(commit.files.map(async (file) => {
      const blobResponse = await this.octokit.git.createBlob({
        owner, repo,
        content: file.content,
        encoding: 'utf-8'
      });
      
      return {
        path: file.path,
        mode: '100644',
        type: 'blob',
        sha: blobResponse.data.sha
      };
    }));
    
    const newTreeResponse = await this.octokit.git.createTree({
      owner, repo,
      base_tree: treeSha,
      tree: newTreeItems
    });
    
    // Create a new commit
    const newCommitResponse = await this.octokit.git.createCommit({
      owner, repo,
      message: commit.message,
      tree: newTreeResponse.data.sha,
      parents: [latestCommitSha]
    });
    
    // Update the reference to point to the new commit
    await this.octokit.git.updateRef({
      owner, repo,
      ref: `heads/${branch}`,
      sha: newCommitResponse.data.sha
    });
    
    return newCommitResponse.data;
  }

  async createPullRequest(pr) {
    const { owner, repo } = this.defaultRepo;
    const response = await this.octokit.pulls.create({
      owner, repo,
      title: pr.title,
      body: pr.body,
      head: pr.head,
      base: pr.base || 'main',
      draft: pr.draft
    });
    
    return response.data;
  }
}

// Create a GitHub service instance
const githubService = new GitHubService();

// Define function handlers
const getRepositoryInfoFunction = {
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

const createIssueFunction = {
  handler: async (params, agentId) => {
    try {
      const result = await githubService.createIssue({
        title: params.title,
        body: params.body,
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

const getIssueFunction = {
  handler: async (params, agentId) => {
    try {
      const result = await githubService.getIssue(params.number);
      
      return {
        success: true,
        number: result.number,
        title: result.title,
        body: result.body,
        html_url: result.html_url,
        state: result.state,
        assignees: result.assignees,
        labels: result.labels
      };
    } catch (error) {
      console.error(`Error getting issue #${params.number}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};

const createBranchFunction = {
  handler: async (params, agentId) => {
    try {
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

const createCommitFunction = {
  handler: async (params, agentId) => {
    try {
      const result = await githubService.createCommit({
        message: params.message,
        files: params.files.map(file => ({
          path: file.path,
          content: file.content
        })),
        branch: params.branch
      });
      
      return {
        success: true,
        commit_sha: result.sha,
        message: `Commit ${result.sha.substring(0, 7)} created successfully`
      };
    } catch (error) {
      console.error('Error creating commit:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};

const createPullRequestFunction = {
  handler: async (params, agentId) => {
    try {
      const result = await githubService.createPullRequest({
        title: params.title,
        body: params.body,
        head: params.head,
        base: params.base || 'main'
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

// Create an agent ID for testing
const TEST_AGENT_ID = 'TEST_AGENT_001';

// Run the complete workflow sequence
async function runWorkflowSequence() {
  console.log('🚀 Starting GitHub workflow sequence test...');
  console.log(`Using repository: ${config.github.repository}`);
  
  try {
    // Step 1: Get repository info
    console.log('\n📁 Getting repository info...');
    const repoResult = await getRepositoryInfoFunction.handler({}, TEST_AGENT_ID);
    
    if (!repoResult.success) {
      throw new Error(`Failed to get repository info: ${repoResult.error}`);
    }
    
    console.log(`✅ Repository: ${repoResult.repository.full_name}`);
    console.log(`   Description: ${repoResult.repository.description}`);
    console.log(`   Default branch: ${repoResult.repository.default_branch}`);
    
    // Step 2: Create an issue
    console.log('\n🔍 Creating an issue...');
    const issueResult = await createIssueFunction.handler({
      title: 'Test issue for workflow sequence',
      body: 'This is a test issue created to test the GitHub workflow sequence. It should be processed through the entire workflow: issue → branch → commit → PR.',
      labels: ['test', 'workflow']
    }, TEST_AGENT_ID);
    
    if (!issueResult.success) {
      throw new Error(`Failed to create issue: ${issueResult.error}`);
    }
    
    const issueNumber = issueResult.issue_number;
    console.log(`✅ Created issue #${issueNumber}: ${issueResult.url}`);
    
    // Step 3: Get the issue details
    console.log('\n📋 Getting issue details...');
    const getIssueResult = await getIssueFunction.handler({
      number: issueNumber
    }, TEST_AGENT_ID);
    
    if (!getIssueResult.success) {
      throw new Error(`Failed to get issue details: ${getIssueResult.error}`);
    }
    
    console.log(`✅ Retrieved issue #${getIssueResult.number}: ${getIssueResult.title}`);
    
    // Step 4: Create a branch
    const branchName = `test-issue-${issueNumber}`;
    console.log(`\n🔄 Creating branch: ${branchName}...`);
    const branchResult = await createBranchFunction.handler({
      name: branchName,
      source: repoResult.repository.default_branch
    }, TEST_AGENT_ID);
    
    if (!branchResult.success) {
      throw new Error(`Failed to create branch: ${branchResult.error}`);
    }
    
    console.log(`✅ Created branch: ${branchResult.ref}`);
    console.log(`   SHA: ${branchResult.sha}`);
    
    // Step 5: Create a commit with file changes
    console.log('\n✏️ Creating a commit...');
    const commitResult = await createCommitFunction.handler({
      message: `Add test file for issue #${issueNumber}`,
      files: [
        {
          path: 'test-file.js',
          content: `// This is a test file created for issue #${issueNumber}
console.log('Hello from test workflow!');

function testFunction() {
  return 'This function was added as part of the test workflow';
}

module.exports = { testFunction };`
        }
      ],
      branch: branchName
    }, TEST_AGENT_ID);
    
    if (!commitResult.success) {
      throw new Error(`Failed to create commit: ${commitResult.error}`);
    }
    
    console.log(`✅ Created commit: ${commitResult.commit_sha}`);
    console.log(`   Message: ${commitResult.message}`);
    
    // Step 6: Create a pull request
    console.log('\n🔀 Creating a pull request...');
    const prResult = await createPullRequestFunction.handler({
      title: `Fix for issue #${issueNumber}: Add test file`,
      body: `This PR addresses issue #${issueNumber} by adding a test file as requested.\n\nThis PR was created as part of testing the GitHub workflow sequence.`,
      head: branchName,
      base: repoResult.repository.default_branch
    }, TEST_AGENT_ID);
    
    if (!prResult.success) {
      throw new Error(`Failed to create pull request: ${prResult.error}`);
    }
    
    console.log(`✅ Created pull request #${prResult.pr_number}: ${prResult.url}`);
    
    // Success!
    console.log('\n🎉 Workflow sequence completed successfully!');
    console.log('Summary:');
    console.log(`1. Created issue #${issueNumber}`);
    console.log(`2. Retrieved issue details`);
    console.log(`3. Created branch ${branchName}`);
    console.log(`4. Created a commit with file changes`);
    console.log(`5. Created PR #${prResult.pr_number}`);
    
  } catch (error) {
    console.error('❌ Workflow sequence failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the workflow sequence
runWorkflowSequence(); 