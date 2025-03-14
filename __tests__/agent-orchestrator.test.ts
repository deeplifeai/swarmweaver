import { jest } from '@jest/globals';
import { AgentOrchestrator } from '../src/services/ai/AgentOrchestrator';

// Create mock services
const mockSlackService = {
  sendMessage: jest.fn().mockImplementation(() => Promise.resolve(true))
};

const mockAIService = {
  generateAgentResponse: jest.fn(),
  extractFunctionResults: jest.fn()
};

// Create additional mock services
const mockHandoffMediator = {
  registerOrchestrator: jest.fn(),
  handleAgentHandoff: jest.fn()
};

const mockStateManager = {
  updateState: jest.fn(),
  getState: jest.fn(),
  getCurrentStage: jest.fn()
};

const mockLoopDetector = {
  checkForLoop: jest.fn(),
  recordHandoff: jest.fn()
};

const mockFunctionRegistry = {
  registerFunction: jest.fn(),
  getFunctionByName: jest.fn(),
  getAllFunctions: jest.fn()
};

const mockTokenManager = {
  trackTokens: jest.fn(),
  getConversationTokenCount: jest.fn(),
  pruneConversation: jest.fn()
};

describe('AgentOrchestrator', () => {
  let orchestrator: AgentOrchestrator;

  beforeEach(() => {
    jest.clearAllMocks();
    orchestrator = new AgentOrchestrator(
      mockSlackService as any,
      mockAIService as any,
      mockHandoffMediator as any,
      mockStateManager as any,
      mockLoopDetector as any,
      mockFunctionRegistry as any,
      mockTokenManager as any
    );
    
    // Use TypeScript's private property access hack to access private methods for testing
    // Note: This is generally not recommended in production code, but is useful for testing
  });

  describe('extractIssueNumbers', () => {
    // We need to access the private method for testing
    const testExtractIssueNumbers = (text: string) => {
      return (orchestrator as any).extractIssueNumbers(text);
    };

    it('should extract issue numbers with # prefix', () => {
      const text = 'Please implement #42 and #123';
      const result = testExtractIssueNumbers(text);
      expect(result).toEqual([42, 123]);
    });

    it('should extract issue numbers with "issue" prefix', () => {
      const text = 'Please implement issue 42 and issue #123';
      const result = testExtractIssueNumbers(text);
      expect(result).toEqual([42, 123]);
    });

    it('should handle mixed formats', () => {
      const text = 'Please implement issue 42, #123, and issue #456';
      const result = testExtractIssueNumbers(text);
      expect(result).toEqual([42, 123, 456]);
    });

    it('should return empty array if no issue numbers found', () => {
      const text = 'Please implement this feature';
      const result = testExtractIssueNumbers(text);
      expect(result).toEqual([]);
    });

    it('should handle case insensitivity', () => {
      const text = 'Please implement Issue 42 and ISSUE #123';
      const result = testExtractIssueNumbers(text);
      expect(result).toEqual([42, 123]);
    });

    it('should not extract numbers that are not issue numbers', () => {
      const text = 'Add 42 items and set timeout to 123 seconds';
      const result = testExtractIssueNumbers(text);
      expect(result).toEqual([]);
    });
  });

  describe('processAgentRequest', () => {
    const mockAgent = {
      id: 'test-agent',
      name: 'TestAgent',
      role: 'DEVELOPER',
      avatar: '🤖',
      description: 'Test agent',
      personality: 'Helpful',
      systemPrompt: 'You are a test agent',
      functions: []
    };

    const mockMessage = {
      channel: 'C123',
      replyToMessageId: 'T123',
      content: 'Implement issue #42',
      mentions: ['test-agent']
    };

    const testProcessAgentRequest = async () => {
      return (orchestrator as any).processAgentRequest(mockAgent, mockMessage);
    };

    beforeEach(() => {
      // Register the mock agent
      (orchestrator as any).registerAgent(mockAgent);
      
      // Mock the AI service responses using mockImplementation for better type compatibility
      mockAIService.generateAgentResponse.mockImplementation(() => Promise.resolve({
        response: 'I will help you implement that issue',
        functionCalls: []
      }));
      
      mockAIService.extractFunctionResults.mockImplementation(() => '');
    });

    it('should enhance message with issue number instructions', async () => {
      await testProcessAgentRequest();
      
      // Check if the AI service was called with the enhanced message containing the instruction
      const aiServiceArgs = mockAIService.generateAgentResponse.mock.calls[0];
      expect(aiServiceArgs[0]).toBe(mockAgent);
      expect(aiServiceArgs[1]).toContain('issue #42');
      expect(aiServiceArgs[1]).toContain('IMPORTANT');
      expect(aiServiceArgs[1]).toContain('Remember to first call getRepositoryInfo() and then getIssue');
    });

    it('should send the response back to Slack', async () => {
      await testProcessAgentRequest();
      
      expect(mockSlackService.sendMessage).toHaveBeenCalledWith({
        channel: 'C123',
        text: 'I will help you implement that issue',
        thread_ts: 'T123'
      });
    });
  });
}); 