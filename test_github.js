import dotenv from 'dotenv';
import { Octokit } from '@octokit/rest';

// Load environment variables from .env file
dotenv.config();

async function testGitHub() {
  try {
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });

    console.log('Testing GitHub API connection...');
    
    // Parse the repository string
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
    
    // Get repository information
    const { data } = await octokit.repos.get({
      owner,
      repo: repo.replace('.git', '') // Remove .git if present
    });

    console.log('✅ GitHub API connection successful!');
    console.log('Repository:', data.full_name);
    console.log('Description:', data.description);
    console.log('Stars:', data.stargazers_count);
    
  } catch (error) {
    console.error('❌ Error connecting to GitHub API:');
    console.error(error.message);
    process.exit(1);
  }
}

testGitHub(); 