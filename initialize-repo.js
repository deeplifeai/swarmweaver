// Script to initialize an empty GitHub repository with a README file
const { Octokit } = require('@octokit/rest');
require('dotenv').config();

async function initializeRepository() {
  console.log("Initializing empty repository...");
  
  // Get the token and repository from environment variables
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  
  if (!token || !repository) {
    console.error("Missing GitHub token or repository in environment variables");
    process.exit(1);
  }
  
  // Remove .git extension if present
  const repoPath = repository.replace(/\.git$/, '');
  const [owner, repo] = repoPath.split('/');
  
  if (!owner || !repo) {
    console.error("Invalid repository format. Must be 'owner/repo'");
    process.exit(1);
  }
  
  console.log(`Initializing repository: ${owner}/${repo}`);
  
  try {
    // Create an Octokit instance with the token
    const octokit = new Octokit({
      auth: token
    });
    
    // Check if the repository exists
    try {
      await octokit.repos.get({
        owner,
        repo
      });
      console.log("Repository exists, proceeding with initialization...");
    } catch (error) {
      console.error("Repository does not exist or is not accessible:", error.message);
      process.exit(1);
    }
    
    // Create a README.md file in the repository
    const content = `# ${repo}
    
This is a test repository for the SwarmWeaver project.

## About

This repository contains code for testing the SwarmWeaver agent system.
`;
    
    // Encode content to Base64
    const contentEncoded = Buffer.from(content).toString('base64');
    
    // Create the file in the repository
    const response = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: 'README.md',
      message: 'Initial commit: Add README',
      content: contentEncoded,
      branch: 'main'
    });
    
    console.log("✅ Repository initialized successfully!");
    console.log(`Commit SHA: ${response.data.commit.sha}`);
    console.log(`README.md created at: ${response.data.content.html_url}`);
    
  } catch (error) {
    console.error("Error initializing repository:", error.message);
    console.error("Full error:", error);
  }
}

initializeRepository().catch(console.error); 