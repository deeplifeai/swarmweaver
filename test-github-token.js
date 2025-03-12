// Test script to check if the GitHub token is valid
const { Octokit } = require('@octokit/rest');
require('dotenv').config();

async function testGitHubToken() {
  console.log("Testing GitHub token...");
  
  // Get the token from environment variables
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  
  console.log(`Token type: ${typeof token}`);
  console.log(`Token length: ${token ? token.length : 0}`);
  console.log(`Token starts with: ${token ? token.substring(0, 10) + '...' : 'N/A'}`);
  console.log(`Repository: ${repository}`);
  
  try {
    // Create an Octokit instance with the token
    const octokit = new Octokit({
      auth: token
    });
    
    // Test the token by making a simple API call
    console.log("Making API request to GitHub...");
    let repoPath = repository || '';
    // Remove .git extension if present
    repoPath = repoPath.replace(/\.git$/, '');
    console.log(`Repository (after removing .git): ${repoPath}`);
    
    const [owner, repo] = repoPath.split('/');
    
    if (!owner || !repo) {
      console.error("Invalid repository format. Must be 'owner/repo'");
      return;
    }
    
    console.log(`Owner: ${owner}, Repo: ${repo}`);
    
    const response = await octokit.repos.get({
      owner,
      repo
    });
    
    console.log("GitHub API request successful!");
    console.log(`Repository: ${response.data.full_name}`);
    console.log(`Description: ${response.data.description}`);
    console.log(`Stars: ${response.data.stargazers_count}`);
    console.log("Token is valid and working correctly.");
    
    // Testing the specific Git reference API that's failing
    console.log("\nTesting Git reference API...");
    try {
      const refResponse = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/main` // Assuming main is the default branch
      });
      console.log("✅ Git reference API call successful!");
      console.log(`Ref: ${refResponse.data.ref}`);
      console.log(`SHA: ${refResponse.data.object.sha}`);
    } catch (refError) {
      console.error("❌ Git reference API call failed:");
      console.error(refError.message);
      console.error("This is likely the cause of the createCommit failure");
    }
    
  } catch (error) {
    console.error("GitHub API request failed:", error.message);
    
    if (error.status === 401) {
      console.error("Authentication error: The token is invalid or expired.");
    } else if (error.status === 404) {
      console.error("Not found error: The repository does not exist or the token doesn't have access to it.");
    }
    
    console.error("Full error:", error);
  }
}

testGitHubToken().catch(console.error); 