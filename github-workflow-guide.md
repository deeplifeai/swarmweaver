# GitHub Workflow Guide

## Issue: Failed GitHub Operations

The error messages you encountered were:

```
Function createCommit was called with {...} and returned: {"success":false,"error":"Not Found - https://docs.github.com/rest/git/refs#get-a-reference"}

Function createPullRequest was called with {...} and returned: {"success":false,"error":"Validation Failed: {\"resource\":\"PullRequest\",\"field\":\"head\",\"code\":\"invalid\"} - https://docs.github.com/rest/pulls/pulls#create-a-pull-request"}
```

These errors occur because you tried to:
1. Create a commit on a branch that doesn't exist
2. Create a pull request for a branch that doesn't exist

## The Correct Workflow Sequence

To successfully perform GitHub operations, you **must** follow this exact sequence:

1. **First**: Create a branch
2. **Second**: Commit to that branch
3. **Third**: Create a pull request from that branch

## Example Code

Here's the correct sequence:

```javascript
// Step 1: First create a branch
const branchResult = await createBranch({
  name: 'your-feature-branch',
  source: 'main'  // Optional source branch (defaults to 'main')
});

// Step 2: Then commit to that branch
const commitResult = await createCommit({
  message: 'Your commit message',
  files: [
    { path: 'file1.js', content: '...' },
    { path: 'file2.js', content: '...' }
  ],
  branch: 'your-feature-branch'  // Must match the branch you created
});

// Step 3: Finally create a pull request
const prResult = await createPullRequest({
  title: 'Your PR Title',
  body: 'Description of your changes...',
  head: 'your-feature-branch',  // Must match the branch you created and committed to
  base: 'main'  // The target branch to merge into
});
```

## Common Mistakes to Avoid

1. **Skipping branch creation**: You cannot commit directly to a non-existent branch
2. **Using different branch names**: Make sure the branch name is consistent across all operations
3. **Wrong sequence**: Attempting to create a PR before committing to a branch
4. **Missing parameters**: Ensure all required parameters are provided

## Troubleshooting

If you get a "Not Found" error for references, it means the branch doesn't exist. Always create the branch first.

If you get a "Validation Failed" error for pull requests, it typically means one of:
- The branch doesn't exist
- The branch name is incorrect
- The branch exists but has no commits

## Testing Your GitHub Token

You can test your GitHub token with:

```bash
node test-github-token.js
```

This will verify your token is valid and has the necessary permissions. 