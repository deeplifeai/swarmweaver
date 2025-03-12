/**
 * Types for GitHub-related entities in the sandbox environment
 */

export interface GitHubRepository {
  owner: string;
  repo: string;
}

export interface GitHubIssue {
  title: string;
  body: string;
  assignees?: string[];
  labels?: string[];
}

export interface GitHubPullRequest {
  title: string;
  body: string;
  head: string;  // Source branch
  base: string;  // Target branch
  draft?: boolean;
}

export interface GitHubCommit {
  message: string;
  files: {
    path: string;
    content: string;
  }[];
}

export interface GitHubReview {
  body: string;
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
  comments?: {
    path: string;
    position: number;
    body: string;
  }[];
}

export interface GitHubBranch {
  name: string;
  sha: string;
  protected: boolean;
}

export interface GitHubLabel {
  name: string;
  color: string;
  description?: string;
}

export interface GitHubMilestone {
  title: string;
  description: string;
  due_on?: string;
  state: 'open' | 'closed';
} 