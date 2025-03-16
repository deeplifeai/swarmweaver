import { AgentRole } from '../src/types/agents/Agent';
import { developerAgent, codeReviewerAgent } from '../src/agents/AgentDefinitions';
import { handleMessage, handleGitHubResponse } from '../src/agents/MessageHandler';

// Mock the messaging system
jest.mock('../src/services/slack/SlackService', () => ({
  sendMessage: jest.fn(),
  mentionUser: jest.fn((userId) => `<@${userId}>`)
}));

describe('Agent Workflow Handoff Tests', () => {
  const slackService = require('../src/services/slack/SlackService');
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Developer to CodeReviewer handoff', () => {
    it('should hand off to CodeReviewer after successful PR creation', async () => {
      // Mock successful PR creation response
      const mockPrResponse = {
        functionName: 'createPullRequest',
        success: true,
        data: {
          html_url: 'https://github.com/org/repo/pull/123',
          number: 123
        }
      };
      
      // Simulate handling a GitHub response for PR creation
      await handleGitHubResponse(
        mockPrResponse,
        'CHANNEL123',
        'THREAD123',
        developerAgent.id
      );
      
      // Check that the developer handed off to code reviewer
      const messages = slackService.sendMessage.mock.calls;
      
      // Verify the handoff message was sent
      expect(messages.length).toBeGreaterThan(0);
      
      // Find if any message mentions the CodeReviewer
      const handoffMessage = messages.some(call => 
        call[0].text.includes(`<@${codeReviewerAgent.id}>`) && 
        call[0].text.includes('review this PR')
      );
      
      expect(handoffMessage).toBe(true);
    });

    it('should hand off to CodeReviewer if PR already exists', async () => {
      // Mock PR already exists error response
      const mockPrExistsError = {
        functionName: 'createPullRequest',
        success: false,
        error: 'Validation Failed: {"resource":"PullRequest","code":"custom","message":"A pull request already exists for org:feature-branch."}'
      };
      
      // Simulate handling a GitHub response for PR creation that failed due to existing PR
      await handleGitHubResponse(
        mockPrExistsError,
        'CHANNEL123',
        'THREAD123',
        developerAgent.id
      );
      
      // Check that developer recognized PR exists and handed off
      const messages = slackService.sendMessage.mock.calls;
      
      // Verify the handoff message was sent
      expect(messages.length).toBeGreaterThan(0);
      
      // Find if any message mentions the CodeReviewer in response to PR already existing
      const handoffMessage = messages.some(call => 
        call[0].text.includes(`<@${codeReviewerAgent.id}>`) && 
        call[0].text.includes('already exists')
      );
      
      expect(handoffMessage).toBe(true);
    });
    
    it('should redirect to CodeReviewer if Developer is mentioned after PR creation', async () => {
      // First, set up the workflow state by handling a successful PR creation
      const mockPrResponse = {
        functionName: 'createPullRequest',
        success: true,
        data: {
          html_url: 'https://github.com/org/repo/pull/123',
          number: 123
        }
      };
      
      await handleGitHubResponse(
        mockPrResponse,
        'CHANNEL123',
        'THREAD123',
        developerAgent.id
      );
      
      // Clear previous messages
      jest.clearAllMocks();
      
      // Now simulate Developer being mentioned again in the same thread
      await handleMessage({
        text: 'Can you make some changes to this PR?',
        userId: 'USER123',
        channelId: 'CHANNEL123',
        ts: '123456790',
        mentions: [developerAgent.id],
        threadTs: 'THREAD123'
      });
      
      // Check that system redirected to CodeReviewer
      const messages = slackService.sendMessage.mock.calls;
      
      // Verify a message was sent
      expect(messages.length).toBeGreaterThan(0);
      
      // Find if any message mentions redirecting to CodeReviewer
      const redirectMessage = messages.some(call => 
        call[0].text.includes(`<@${codeReviewerAgent.id}>`) && 
        call[0].text.includes('pull request has already been created')
      );
      
      expect(redirectMessage).toBe(true);
    });
  });
}); 