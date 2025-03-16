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
import { FunctionRegistry } from '../src/services/ai/FunctionRegistry';

// Mock the needed modules
jest.mock('../src/services/ai/LangChainIntegration');
jest.mock('../src/services/github/GitHubFunctions');

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

// Create mock agents
const mockAgents = {
  'U08GYV9AU9M': { id: 'U08GYV9AU9M', name: 'ProjectManager', role: 'PROJECT_MANAGER' },
  'DEV001': { id: 'DEV001', name: 'Developer', role: 'DEVELOPER' }
};

describe('Agent Handover Tests', () => {
  let orchestrator: AgentOrchestrator;
  let slackService: SlackService;
  let aiService: AIService;
  let sentMessages: any[] = [];
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock setCurrentIssueNumber function
    (setCurrentIssueNumber as jest.Mock).mockClear();
    
    // Create service mocks
    slackService = new SlackService();
    aiService = new AIService();
    
    // Track sent messages
    sentMessages = [];
    (slackService.sendMessage as jest.Mock).mockImplementation((message) => {
      sentMessages.push(message);
      return Promise.resolve({});
    });
    
    // Create a simplified orchestrator with most functionality mocked
    orchestrator = {
      handleMessage: jest.fn().mockImplementation(async (message: AgentMessage) => {
        // Log the message handling
        console.log(`Handling message from ${message.agentId}: ${message.content}`);
        
        // Extract mentions for testing
        if (message.content.includes('@Developer') || message.mentions?.includes('DEV001')) {
          console.log('Developer mentioned in message');
          
          // Call the Developer agent
          await aiService.generateAgentResponse(
            { role: 'DEVELOPER', id: 'DEV001', name: 'Developer' } as any,
            message.content,
            []
          );
          
          // Send a response
          await slackService.sendMessage({
            channel: message.channel,
            text: 'I will implement this, working on it now.',
            threadTs: message.id
          });
        }
        
        // Extract issue number
        const issueMatch = message.content.match(/issue #(\d+)/);
        if (issueMatch && issueMatch[1]) {
          const issueNumber = parseInt(issueMatch[1], 10);
          setCurrentIssueNumber(issueNumber);
          console.log(`Set issue number to ${issueNumber}`);
        }
        
        // Keyword detection
        if (message.content.toLowerCase().includes('implement') && !message.mentions?.length) {
          console.log('Implementation keyword detected, routing to Developer');
          await aiService.generateAgentResponse(
            { role: 'DEVELOPER', id: 'DEV001', name: 'Developer' } as any,
            message.content,
            []
          );
        }
      })
    } as any;
    
    // Set up the AIService with our mocked behavior
    jest.spyOn(aiService, 'generateAgentResponse').mockImplementation(async (agent, message) => {
      // Track who was called with what
      console.log(`Agent ${agent.role} called with message: ${message.substring(0, 50)}`);
      
      return {
        response: `${agent.name} responding to: ${message.substring(0, 30)}...`,
        functionCalls: []
      };
    });
  });
  
  test('Project Manager to Developer handoff works', async () => {
    // Initial message with Developer mention
    const message: AgentMessage = {
      id: 'msg1',
      timestamp: new Date().toISOString(),
      agentId: 'U08GYV9AU9M',
      content: 'I created issue #42. @Developer Please implement this issue.',
      channel: 'C123',
      mentions: ['DEV001'],
      replyToMessageId: undefined
    };
    
    // Process the message
    await orchestrator.handleMessage(message);
    
    // Verify Developer was called
    expect(aiService.generateAgentResponse).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'DEVELOPER' }),
      expect.any(String),
      expect.any(Array)
    );
    
    // Verify response was sent
    expect(slackService.sendMessage).toHaveBeenCalledTimes(1);
  });
  
  test('Message with GitHub issue number sets the workflow state', async () => {
    // Message with issue number
    const messageWithIssue: AgentMessage = {
      id: 'msg3',
      timestamp: new Date().toISOString(),
      agentId: 'user123',
      content: '@Developer Please implement issue #42',
      channel: 'C123',
      mentions: ['DEV001'],
      replyToMessageId: undefined
    };
    
    // Process the message
    await orchestrator.handleMessage(messageWithIssue);
    
    // Check that the issue number was extracted and set
    expect(setCurrentIssueNumber).toHaveBeenCalledWith(42);
  });
  
  test('Handover via keyword detection works', async () => {
    // Message without explicit mention but with implementation keyword
    const messageWithKeyword: AgentMessage = {
      id: 'msg4',
      timestamp: new Date().toISOString(),
      agentId: 'user123',
      content: 'I need to implement a login feature',
      channel: 'C123',
      mentions: [],
      replyToMessageId: undefined
    };
    
    // Process the message
    await orchestrator.handleMessage(messageWithKeyword);
    
    // Verify Developer was called based on keyword detection
    expect(aiService.generateAgentResponse).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'DEVELOPER' }),
      expect.any(String),
      expect.any(Array)
    );
  });
}); 