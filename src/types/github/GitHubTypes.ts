export interface GitHubIssue {
  title: string;
  body: string;
  assignees?: string[]; // Optional - used only for tracking in the system, not passed to GitHub API
  labels?: string[];
  milestone?: number;
}

export interface GitHubPullRequest {
  title: string;
  body: string;
  head: string;
  base: string;
  draft?: boolean;
  maintainer_can_modify?: boolean;
}

export interface GitHubReviewComment {
  body: string;
  path: string;
  position: number;
  commit_id: string;
}

export interface GitHubCommit {
  message: string;
  files: Array<{
    path: string;
    content: string;
  }>;
  branch?: string;
}

export interface GitHubRepository {
  owner: string;
  repo: string;
}

export interface GitHubReview {
  body: string;
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
  comments?: GitHubReviewComment[];
} 