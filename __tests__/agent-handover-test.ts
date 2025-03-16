import { AgentOrchestrator } from '../src/services/ai/AgentOrchestrator';
import { SlackService } from '../src/services/slack/SlackService';
import { AIService } from '../src/services/ai/AIService';
import { AgentMessage } from '../src/types/agents/Agent';
import { 
  resetWorkflowState, 
  setGitHubService, 
  setCurrentIssueNumber
} from '../src/services/github/GitHubFunctions';
import { agents } from '../src/agents/AgentDefinitions';
import { eventBus, EventType } from '../src/utils/EventBus';

// Mock the SlackService
jest.mock('../src/services/slack/SlackService', () => {
  return {
    SlackService: jest.fn().mockImplementation(() => {
      return {
        sendMessage: jest.fn().mockResolvedValue({}),
      };
    }),
  };
});

// Mock the AIService
jest.mock('../src/services/ai/AIService', () => {
  return {
    AIService: jest.fn().mockImplementation(() => {
      return {
        generateAgentResponse: jest.fn().mockResolvedValue({
          response: 'Mock agent response',
          functionCalls: [
            {
              name: 'getRepositoryInfo',
              arguments: {},
              result: {
                success: true,
                repository: {
                  name: 'test-repo',
                  full_name: 'owner/test-repo',
                  description: 'Test repository',
                  url: 'https://github.com/owner/test-repo',
                  default_branch: 'main',
                  open_issues_count: 5
                }
              }
            }
          ]
        }),
        extractFunctionResults: jest.fn().mockReturnValue('Mock function results with @Developer mention')
      };
    }),
  };
});

// Mock GitHub service
const mockGitHubService = {
  getRepository: jest.fn().mockResolvedValue({
    name: 'test-repo',
    full_name: 'owner/test-repo',
    description: 'Test repository'
  }),
  getIssue: jest.fn().mockResolvedValue({
    number: 1,
    title: 'Test issue',
    body: 'Test issue body'
  }),
  createBranch: jest.fn().mockResolvedValue({
    ref: 'refs/heads/test-branch',
    object: { sha: 'test-sha' }
  }),
  createCommit: jest.fn().mockResolvedValue({
    sha: 'test-commit-sha'
  }),
  createPullRequest: jest.fn().mockResolvedValue({
    number: 1,
    html_url: 'https://github.com/owner/test-repo/pull/1'
  }),
  branchExists: jest.fn().mockResolvedValue(false)
};

// Mock GitHub dependencies
jest.mock('../src/services/github/GitHubFunctions', () => {
  return {
    resetWorkflowState: jest.fn(),
    setGitHubService: jest.fn(),
    setCurrentIssueNumber: jest.fn(),
  };
});

// Create mock agents
const mockAgents = {
  'U08GYV9AU9M': { id: 'U08GYV9AU9M', name: 'ProjectManager', role: 'PROJECT_MANAGER' },
  'DEV001': { id: 'DEV001', name: 'Developer', role: 'DEVELOPER' }
};

// Create mock services for the required parameters
const mockHandoffMediator = { 
  handleAgentHandoff: jest.fn(),
  determineNextAgent: jest.fn().mockImplementation((channel: string, replyTs: string | null, message: any) => {
    // Type the message parameter properly
    if (message && message.mentions && message.mentions.length > 0) {
      return mockAgents[message.mentions[0]];
    }
    return null;
  }),
  // Add missing properties required by HandoffMediator interface
  agentsByRole: {
    DEVELOPER: [mockAgents['DEV001']],
    PROJECT_MANAGER: [mockAgents['U08GYV9AU9M']],
    CODE_REVIEWER: [],
    QA_TESTER: [],
    TECHNICAL_WRITER: [],
    SECURITY_ENGINEER: [],
    DEVOPS_ENGINEER: []
  },
  agents: mockAgents,
  stateManager: { getState: jest.fn().mockResolvedValue(null) },
  initializeAgentsByRole: jest.fn(),
  findAgentByMention: jest.fn(),
  findAgentByKeyword: jest.fn(),
  getAgentForState: jest.fn(),
  recordHandoff: jest.fn()
} as any;

describe('Agent Handover and Workflow Tests', () => {
  let orchestrator: AgentOrchestrator;
  let slackService: SlackService;
  let aiService: AIService;
  let sentMessages: any[] = [];
  
  beforeEach(() => {
    jest.clearAllMocks();
    resetWorkflowState();
    setGitHubService(mockGitHubService);
    
    // Create mock services
    slackService = new SlackService();
    aiService = new AIService();
    
    // Create mock services for the required parameters
    const mockStateManager = { getWorkflowState: jest.fn(), updateWorkflowState: jest.fn() } as any;
    const mockLoopDetector = {
      checkForLoop: jest.fn(),
      recordHandoff: jest.fn(),
      recordAction: jest.fn().mockReturnValue(false)
    } as any;
    const mockFunctionRegistry = { registerFunction: jest.fn(), getFunctions: jest.fn() } as any;
    
    // Create orchestrator
    orchestrator = new AgentOrchestrator(
      slackService, 
      aiService,
      mockHandoffMediator,
      mockStateManager,
      mockLoopDetector,
      mockFunctionRegistry
    );
    
    // Register agents
    agents.forEach(agent => orchestrator.registerAgent(agent));
    
    // Track sent messages
    sentMessages = [];
    (slackService.sendMessage as jest.Mock).mockImplementation((message) => {
      sentMessages.push(message);
      return Promise.resolve({});
    });
    
    // Mock AIService to include mentions in responses for testing handover
    (aiService.generateAgentResponse as jest.Mock).mockImplementation(async (agent, message, history) => {
      // Simulate different responses based on agent role
      if (agent.role === 'PROJECT_MANAGER') {
        return {
          response: 'I created an issue for you. @Developer please implement this.',
          functionCalls: [
            {
              name: 'createIssue',
              arguments: { title: 'Test Issue', body: 'Test description' },
              result: { success: true, issue_number: 1, url: 'https://github.com/owner/test-repo/issues/1' }
            }
          ]
        };
      } else if (agent.role === 'DEVELOPER') {
        return {
          response: 'I will implement this issue. First, let me get the repository information.',
          functionCalls: [
            {
              name: 'getRepositoryInfo',
              arguments: {},
              result: {
                success: true,
                repository: {
                  name: 'test-repo',
                  full_name: 'owner/test-repo',
                  description: 'Test repository',
                  default_branch: 'main',
                  open_issues_count: 5
                }
              }
            }
          ]
        };
      } else if (agent.role === 'CODE_REVIEWER') {
        return {
          response: 'I have reviewed the PR and it looks good. @ProjectManager, this is ready to merge.',
          functionCalls: [
            {
              name: 'createReview',
              arguments: { pull_number: 1, event: 'APPROVE', body: 'LGTM!' },
              result: { success: true }
            }
          ]
        };
      }
      
      // Default response for other agents
      return {
        response: `${agent.name} responding to: ${message.substring(0, 50)}...`,
        functionCalls: []
      };
    });
    
    // Mock the extractFunctionResults to include @mentions
    (aiService.extractFunctionResults as jest.Mock).mockImplementation((functionCalls) => {
      const call = functionCalls[0];
      
      if (call?.name === 'createIssue') {
        return `✅ Created GitHub issue #${call.result.issue_number}: "${call.arguments.title}"\n📎 ${call.result.url}\n\n@Developer Please implement this issue following the workflow steps.`;
      } else if (call?.name === 'getRepositoryInfo') {
        return `📁 GitHub repository info for test-repo\n\n@Developer Next, get the issue details using getIssue()`;
      } else if (call?.name === 'createReview') {
        return `✅ Created GitHub review with status: ${call.arguments.event}\n\n@ProjectManager This PR has been approved and is ready to be merged.`;
      }
      
      return 'Function results';
    });
  });
  
  test('Project Manager to Developer handover flow works', async () => {
    // Initial user message to Project Manager
    const initialMessage: AgentMessage = {
      id: 'msg1',
      timestamp: new Date().toISOString(),
      agentId: 'user123',
      content: 'Create a new issue for implementing a login feature',
      channel: 'C123',
      mentions: ['U08GYV9AU9M'], // Project Manager ID
      replyToMessageId: undefined
    };
    
    // Process the message
    await orchestrator.handleMessage(initialMessage);
    
    // Verify Project Manager received the message and sent a response
    expect(slackService.sendMessage).toHaveBeenCalledTimes(1);
    expect(sentMessages[0].text).toContain('@Developer');
    
    // Create a mock response message that includes @Developer mention
    const botResponseMessage: AgentMessage = {
      id: 'msg2',
      timestamp: new Date().toISOString(),
      agentId: 'B08GYV992H5', // Bot ID
      content: sentMessages[0].text, // Use the actual response text
      channel: 'C123',
      mentions: ['DEV001'], // Developer ID
      replyToMessageId: undefined
    };
    
    // Reset sent messages and mock
    sentMessages = [];
    jest.clearAllMocks(); // Clear all mocks including sendMessage call count
    
    // Process the bot response message with mention
    await orchestrator.handleMessage(botResponseMessage);
    
    // Verify Developer received the message and sent a response
    expect(slackService.sendMessage).toHaveBeenCalledTimes(1);
    expect(aiService.generateAgentResponse).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'DEVELOPER' }),
      expect.any(String),
      expect.any(Array)
    );
    
    // The Developer's response should be what we get from our mock
    expect(sentMessages[0].text).toContain('I will implement this issue');
    
    // Validate that the workflow state was updated
    expect(mockGitHubService.getRepository).not.toHaveBeenCalled(); // Not actually called in our test since we're mocking
  });
  
  test('Message with GitHub issue number sets the workflow state', async () => {
    // Set up a message that mentions an issue number
    const message: AgentMessage = {
      id: 'msg3',
      timestamp: new Date().toISOString(),
      agentId: 'user123',
      content: '@Developer Please implement issue #42',
      channel: 'C123',
      mentions: ['DEV001'], // Developer ID
      replyToMessageId: undefined
    };
    
    // Process the message
    await orchestrator.handleMessage(message);
    
    // Check that the issue number was extracted and set in the workflow state
    // Note: We'd need to expose workflowState or add a getter to test this properly
    expect(setCurrentIssueNumber).toHaveBeenCalledWith(42);
    
    // Verify Developer received the message
    expect(aiService.generateAgentResponse).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'DEVELOPER' }),
      expect.stringContaining('issue #42'),
      expect.any(Array)
    );
  });

  test('Handover via keyword detection works', async () => {
    // Message with no explicit @mentions but keywords that suggest Developer
    const message: AgentMessage = {
      id: 'msg4',
      timestamp: new Date().toISOString(),
      agentId: 'user123',
      content: 'I need to fix a bug in the login code',
      channel: 'C123',
      mentions: [], // No explicit mentions
      replyToMessageId: undefined
    };
    
    // Mock the handover determination to return Developer based on keywords
    // This is handled by our AgentHandover class which looks for keywords like 'bug'
    
    // Process the message
    await orchestrator.handleMessage(message);
    
    // Check if handover to Developer happened based on keywords
    const developerInvoked = (aiService.generateAgentResponse as jest.Mock).mock.calls.some(
      call => call[0].role === 'DEVELOPER'
    );
    
    // If our keyword detection is working, the Developer should have been invoked
    expect(developerInvoked).toBe(true);
  });
}); 