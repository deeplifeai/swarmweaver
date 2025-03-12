import { 
  GitHubIssue, 
  GitHubPullRequest, 
  GitHubCommit, 
  GitHubReview,
  GitHubRepository 
} from '../types/GitHubTypes';
import chalk from 'chalk';

/**
 * MockGitHubService - Simulates GitHub operations for testing
 * without requiring an actual GitHub connection
 */
export class MockGitHubService {
  private repository: GitHubRepository;
  private issues: any[] = [];
  private pullRequests: any[] = [];
  private commits: any[] = [];
  private lastIssueNumber = 0;
  private lastPRNumber = 0;
  
  constructor(repository?: GitHubRepository) {
    this.repository = repository || {
      owner: 'mock-owner',
      repo: 'mock-repo'
    };
    
    console.log(chalk.cyan('🤖 MockGitHubService initialized'));
    console.log(chalk.gray(`Connected to repository: ${this.repository.owner}/${this.repository.repo}`));
    
    // Initialize with some test data
    this.seedTestData();
  }
  
  /**
   * Seed some test data for the mock repository
   */
  private seedTestData() {
    // Add a few issues
    this.issues = [
      { 
        number: ++this.lastIssueNumber, 
        title: 'Implement user authentication', 
        body: 'We need to add user auth with OAuth and JWT',
        html_url: this.generateIssueUrl(this.lastIssueNumber),
        state: 'open',
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString() // 2 days ago
      },
      { 
        number: ++this.lastIssueNumber, 
        title: 'Fix navigation menu on mobile', 
        body: 'The menu is not responsive on small screens',
        html_url: this.generateIssueUrl(this.lastIssueNumber),
        state: 'open',
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() // 1 day ago
      }
    ];
    
    // Add a pull request
    this.pullRequests = [
      {
        number: ++this.lastPRNumber,
        title: 'Implement dark mode',
        body: 'Adds support for dark mode using CSS variables',
        html_url: this.generatePrUrl(this.lastPRNumber),
        head: 'feature-dark-mode',
        base: 'main',
        state: 'open',
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString() // 12 hours ago
      }
    ];
  }
  
  /**
   * Generate a mock issue URL
   */
  private generateIssueUrl(issueNumber: number): string {
    return `https://github.com/${this.repository.owner}/${this.repository.repo}/issues/${issueNumber}`;
  }
  
  /**
   * Generate a mock PR URL
   */
  private generatePrUrl(prNumber: number): string {
    return `https://github.com/${this.repository.owner}/${this.repository.repo}/pull/${prNumber}`;
  }
  
  // Issues
  async createIssue(issue: GitHubIssue, repository?: GitHubRepository): Promise<any> {
    const issueNumber = ++this.lastIssueNumber;
    const newIssue = {
      number: issueNumber,
      title: issue.title,
      body: issue.body,
      assignees: issue.assignees || [],
      labels: issue.labels || [],
      state: 'open',
      html_url: this.generateIssueUrl(issueNumber),
      created_at: new Date().toISOString()
    };
    
    this.issues.push(newIssue);
    
    console.log(chalk.gray(`[GitHub] Issue created: #${issueNumber} - ${issue.title}`));
    
    return newIssue;
  }
  
  async getIssue(issueNumber: number, repository?: GitHubRepository): Promise<any> {
    const issue = this.issues.find(i => i.number === issueNumber);
    
    if (!issue) {
      throw new Error(`Issue #${issueNumber} not found`);
    }
    
    return issue;
  }
  
  // Pull Requests
  async createPullRequest(pr: GitHubPullRequest, repository?: GitHubRepository): Promise<any> {
    const prNumber = ++this.lastPRNumber;
    const newPR = {
      number: prNumber,
      title: pr.title,
      body: pr.body,
      head: pr.head,
      base: pr.base,
      state: 'open',
      draft: pr.draft || false,
      html_url: this.generatePrUrl(prNumber),
      created_at: new Date().toISOString()
    };
    
    this.pullRequests.push(newPR);
    
    console.log(chalk.gray(`[GitHub] Pull request created: #${prNumber} - ${pr.title}`));
    
    return newPR;
  }
  
  async getPullRequest(prNumber: number, repository?: GitHubRepository): Promise<any> {
    const pr = this.pullRequests.find(p => p.number === prNumber);
    
    if (!pr) {
      throw new Error(`Pull request #${prNumber} not found`);
    }
    
    return pr;
  }
  
  async createReview(prNumber: number, review: GitHubReview, repository?: GitHubRepository): Promise<any> {
    const pr = await this.getPullRequest(prNumber);
    
    const newReview = {
      id: Math.floor(Math.random() * 1000),
      body: review.body,
      state: review.event.toLowerCase(),
      commit_id: `mock-commit-${Date.now()}`,
      user: {
        login: 'mock-reviewer'
      },
      submitted_at: new Date().toISOString()
    };
    
    console.log(chalk.gray(`[GitHub] Review created for PR #${prNumber}: ${review.event}`));
    
    return newReview;
  }
  
  // Commits
  async createCommit(commit: GitHubCommit, repository?: GitHubRepository): Promise<any> {
    const sha = `mock-sha-${Date.now().toString(16)}`;
    const newCommit = {
      sha,
      message: commit.message,
      files: commit.files,
      author: {
        name: 'Mock User',
        email: 'mock@example.com',
        date: new Date().toISOString()
      },
      html_url: `https://github.com/${this.repository.owner}/${this.repository.repo}/commit/${sha}`
    };
    
    this.commits.push(newCommit);
    
    console.log(chalk.gray(`[GitHub] Commit created: ${sha.substring(0, 7)} - ${commit.message.split('\n')[0]}`));
    
    return newCommit;
  }
  
  // Repositories
  async getRepository(repository?: GitHubRepository): Promise<any> {
    const repo = repository || this.repository;
    
    return {
      name: repo.repo,
      full_name: `${repo.owner}/${repo.repo}`,
      description: 'A mock repository for testing',
      html_url: `https://github.com/${repo.owner}/${repo.repo}`,
      default_branch: 'main',
      open_issues_count: this.issues.filter(i => i.state === 'open').length,
      forks_count: 5,
      stargazers_count: 10,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: new Date().toISOString()
    };
  }
} 