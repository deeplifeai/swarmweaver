require('dotenv').config();
const { Octokit } = require('@octokit/rest');

async function testCommitAndPR() {
  try {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    const repository = process.env.GITHUB_REPOSITORY || '';
    const [owner, repo] = repository.replace(/\.git$/, '').split('/');
    const branch = 'add-server-location-endpoint';

    console.log(`Testing with repository: ${owner}/${repo}, branch: ${branch}`);

    // 1. Get the latest commit on the branch
    console.log('Getting reference...');
    const refResponse = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`
    });
    console.log('Reference:', refResponse.data.ref);
    const latestCommitSha = refResponse.data.object.sha;
    console.log('Latest commit SHA:', latestCommitSha);

    // 2. Get the tree from the latest commit
    console.log('Getting commit...');
    const commitResponse = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: latestCommitSha
    });
    const treeSha = commitResponse.data.tree.sha;
    console.log('Tree SHA:', treeSha);

    // 3. Create blobs for the new files
    console.log('Creating blobs...');
    const files = [
      {
        path: 'server.js',
        content: `const express = require('express');
const app = express();

// Static location used for demonstration purposes
const SERVER_LOCATION = "Mountain View, CA, USA";

// Endpoint to return the current server location
app.get('/api/server-location', (req, res) => {
    res.json({ location: SERVER_LOCATION });
});

module.exports = app;`
      },
      {
        path: 'test/server.test.js',
        content: `const request = require('supertest');
const app = require('../server');
const { expect } = require('chai');

describe('GET /api/server-location', () => {
    it('should return the server location', (done) => {
        request(app)
            .get('/api/server-location')
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
                if (err) return done(err);
                expect(res.body).to.have.property('location', "Mountain View, CA, USA");
                done();
            });
    });
});`
      }
    ];

    const blobPromises = files.map(async (file) => {
      const blobResponse = await octokit.git.createBlob({
        owner,
        repo,
        content: file.content,
        encoding: 'utf-8'
      });
      console.log(`Blob created for ${file.path}:`, blobResponse.data.sha);
      return {
        path: file.path,
        mode: '100644',
        type: 'blob',
        sha: blobResponse.data.sha
      };
    });

    const treeItems = await Promise.all(blobPromises);

    // 4. Create a new tree
    console.log('Creating tree...');
    const newTreeResponse = await octokit.git.createTree({
      owner,
      repo,
      base_tree: treeSha,
      tree: treeItems
    });
    console.log('New tree SHA:', newTreeResponse.data.sha);

    // 5. Create a new commit
    console.log('Creating commit...');
    const newCommitResponse = await octokit.git.createCommit({
      owner,
      repo,
      message: 'Add API endpoint to return current server location',
      tree: newTreeResponse.data.sha,
      parents: [latestCommitSha]
    });
    console.log('New commit SHA:', newCommitResponse.data.sha);

    // 6. Update the reference
    console.log('Updating reference...');
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommitResponse.data.sha
    });
    console.log('Reference updated');

    // 7. Create a pull request
    console.log('Creating pull request...');
    const prResponse = await octokit.pulls.create({
      owner,
      repo,
      title: 'Add API Endpoint for Server Location',
      body: 'This pull request adds a new API endpoint that returns the server location in JSON format. The server location is statically set to "Mountain View, CA, USA" for demonstration purposes.',
      head: branch,
      base: 'main'
    });
    console.log('Pull request created:', prResponse.data.html_url);

    console.log('Done');
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testCommitAndPR(); 