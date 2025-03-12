import { Octokit } from '@octokit/rest';
import { 
  GitHubIssue, 
  GitHubPullRequest, 
  GitHubCommit, 
  GitHubReview,
  GitHubRepository 
} from '@/types/github/GitHubTypes';
import { config } from '@/config/config';

export class GitHubService {
  private octokit: Octokit;
  private defaultRepo: GitHubRepository;

  constructor(token?: string, defaultRepo?: GitHubRepository) {
    const authToken = token || config.github.token;
    this.octokit = new Octokit({
      auth: authToken
    });

    if (defaultRepo) {
      this.defaultRepo = defaultRepo;
    } else {
      let repoPath = config.github.repository || '';
      repoPath = repoPath.replace(/\.git$/, '');
      const [owner, repo] = repoPath.split('/');
      this.defaultRepo = { owner, repo };
    }
  }

  // Issues
  async createIssue(issue: GitHubIssue, repository?: GitHubRepository): Promise<any> {
    const { owner, repo } = repository || this.defaultRepo;
    
    try {
      const response = await this.octokit.issues.create({
        owner,
        repo,
        title: issue.title,
        body: issue.body,
        assignees: issue.assignees,
        labels: issue.labels,
        milestone: issue.milestone
      });
      
      return response.data;
    } catch (error) {
      console.error('Error creating issue:', error);
      throw error;
    }
  }

  async getIssue(issueNumber: number, repository?: GitHubRepository): Promise<any> {
    const { owner, repo } = repository || this.defaultRepo;
    
    try {
      const response = await this.octokit.issues.get({
        owner,
        repo,
        issue_number: issueNumber
      });
      
      return response.data;
    } catch (error) {
      console.error(`Error getting issue #${issueNumber}:`, error);
      throw error;
    }
  }

  // Pull Requests
  async createPullRequest(pr: GitHubPullRequest, repository?: GitHubRepository): Promise<any> {
    const { owner, repo } = repository || this.defaultRepo;
    
    try {
      const response = await this.octokit.pulls.create({
        owner,
        repo,
        title: pr.title,
        body: pr.body,
        head: pr.head,
        base: pr.base,
        draft: pr.draft,
        maintainer_can_modify: pr.maintainer_can_modify
      });
      
      return response.data;
    } catch (error) {
      console.error('Error creating pull request:', error);
      throw error;
    }
  }

  async getPullRequest(prNumber: number, repository?: GitHubRepository): Promise<any> {
    const { owner, repo } = repository || this.defaultRepo;
    
    try {
      const response = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber
      });
      
      return response.data;
    } catch (error) {
      console.error(`Error getting PR #${prNumber}:`, error);
      throw error;
    }
  }

  async createReview(prNumber: number, review: GitHubReview, repository?: GitHubRepository): Promise<any> {
    const { owner, repo } = repository || this.defaultRepo;
    
    try {
      const response = await this.octokit.pulls.createReview({
        owner,
        repo,
        pull_number: prNumber,
        body: review.body,
        event: review.event,
        comments: review.comments
      });
      
      return response.data;
    } catch (error) {
      console.error(`Error creating review for PR #${prNumber}:`, error);
      throw error;
    }
  }

  // Commits
  async createCommit(commit: GitHubCommit, repository?: GitHubRepository): Promise<any> {
    const { owner, repo } = repository || this.defaultRepo;
    const branch = commit.branch || 'main';
    
    try {
      // Get the latest commit SHA for the branch
      try {
        const refResponse = await this.octokit.git.getRef({
          owner,
          repo,
          ref: `heads/${branch}`
        });
        const latestCommitSha = refResponse.data.object.sha;
        
        // Get the tree SHA from the latest commit
        const commitResponse = await this.octokit.git.getCommit({
          owner,
          repo,
          commit_sha: latestCommitSha
        });
        const treeSha = commitResponse.data.tree.sha;
        
        // Create a new tree with the new files
        const newTreeItems = await Promise.all(commit.files.map(async (file) => {
          const blobResponse = await this.octokit.git.createBlob({
            owner,
            repo,
            content: file.content,
            encoding: 'utf-8'
          });
          
          return {
            path: file.path,
            mode: '100644' as "100644", // Standard file mode
            type: 'blob' as "blob",
            sha: blobResponse.data.sha
          };
        }));
        
        const newTreeResponse = await this.octokit.git.createTree({
          owner,
          repo,
          base_tree: treeSha,
          tree: newTreeItems
        });
        
        // Create a new commit
        const newCommitResponse = await this.octokit.git.createCommit({
          owner,
          repo,
          message: commit.message,
          tree: newTreeResponse.data.sha,
          parents: [latestCommitSha]
        });
        
        // Update the reference to point to the new commit
        await this.octokit.git.updateRef({
          owner,
          repo,
          ref: `heads/${branch}`,
          sha: newCommitResponse.data.sha
        });
        
        return newCommitResponse.data;
      } catch (error) {
        // Check if the error is because the repository is empty
        if (error.message && error.message.includes('Git Repository is empty')) {
          console.log(`Repository ${owner}/${repo} is empty. Initializing with README...`);
          
          // Initialize the repository and then retry the commit
          await this.initializeEmptyRepository(repository);
          
          // Retry the commit after initialization
          return this.createCommit(commit, repository);
        } else {
          // If it's a different error, rethrow it
          throw error;
        }
      }
    } catch (error) {
      console.error('Error creating commit:', error);
      throw error;
    }
  }

  // New method to initialize an empty repository
  async initializeEmptyRepository(repository?: GitHubRepository): Promise<any> {
    const { owner, repo } = repository || this.defaultRepo;
    
    try {
      console.log(`Initializing empty repository: ${owner}/${repo}`);
      
      // Create a README.md file in the repository
      const content = `# ${repo}
      
This is a repository for the SwarmWeaver project.

## About

This repository was automatically initialized by the SwarmWeaver system.
`;
      
      // Encode content to Base64
      const contentEncoded = Buffer.from(content).toString('base64');
      
      // Create the file in the repository
      const response = await this.octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: 'README.md',
        message: 'Initial commit: Add README',
        content: contentEncoded,
        branch: 'main'
      });
      
      console.log(`Repository ${owner}/${repo} initialized successfully!`);
      return response.data;
    } catch (error) {
      console.error(`Error initializing repository ${owner}/${repo}:`, error);
      throw error;
    }
  }

  // Create a new branch
  async createBranch(branchName: string, sourceBranch: string = 'main', repository?: GitHubRepository): Promise<any> {
    const { owner, repo } = repository || this.defaultRepo;
    
    try {
      console.log(`Creating branch ${branchName} from ${sourceBranch} in ${owner}/${repo}`);
      
      // Get the SHA of the source branch
      const sourceRef = await this.octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${sourceBranch}`
      });
      
      const sourceSha = sourceRef.data.object.sha;
      
      // Create a new reference (branch)
      const response = await this.octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha: sourceSha
      });
      
      console.log(`Branch ${branchName} created successfully in ${owner}/${repo}`);
      return response.data;
    } catch (error) {
      console.error(`Error creating branch ${branchName} in ${owner}/${repo}:`, error);
      throw error;
    }
  }

  // Repositories
  async getRepository(repository?: GitHubRepository): Promise<any> {
    const { owner, repo } = repository || this.defaultRepo;
    
    try {
      const response = await this.octokit.repos.get({
        owner,
        repo
      });
      
      return response.data;
    } catch (error) {
      console.error(`Error getting repository ${owner}/${repo}:`, error);
      throw error;
    }
  }
} 