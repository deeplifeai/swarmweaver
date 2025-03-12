const { cwd } = require('process');
console.log('Current directory:', cwd());
require('dotenv').config();
console.log('GitHub Token:', process.env.GITHUB_TOKEN ? 'Token exists' : 'No token found');
console.log('GitHub Repository:', process.env.GITHUB_REPOSITORY || 'No repository set');

const { Octokit } = require('@octokit/rest');
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function testWorkflow() {
  try {
    const repository = process.env.GITHUB_REPOSITORY || '';
    const [owner, repo] = repository.replace(/\.git$/, '').split('/');
    
    console.log('Creating branch...');
    try {
      await octokit.git.createRef({
        owner,
        repo,
        ref: 'refs/heads/add-server-location-endpoint',
        sha: (await octokit.git.getRef({ owner, repo, ref: 'heads/main' })).data.object.sha
      });
      console.log('Branch created successfully');
    } catch (branchError) {
      console.error('Branch creation error:', branchError.message);
      // Branch might already exist, try using it
      console.log('Trying to use existing branch...');
    }
    
    console.log('Done');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testWorkflow(); 