import { AgentRole, Agent, AgentMessage } from '@/types/agents/Agent';
import { generateAgentId } from '../AgentDefinitions';
import { HandoffMediator } from '@/services/agents/HandoffMediator';
import { useAgentStore } from '@/store/agentStore';
import { AIProvider, AIModel } from '@/types/agent';
import { WorkflowState, WorkflowStateManager } from '@/services/state/WorkflowStateManager';

// Mock environment variables
process.env.NODE_ENV = 'test';

describe('Agent System', () => {
  describe('Agent ID Generation', () => {
    it('should generate consistent IDs based on roles', () => {
      // Test each role
      expect(generateAgentId(AgentRole.PROJECT_MANAGER)).toBe('U08GYV9AU9M');
      expect(generateAgentId(AgentRole.DEVELOPER)).toBe('DEV001');
      expect(generateAgentId(AgentRole.CODE_REVIEWER)).toBe('CR001');
      expect(generateAgentId(AgentRole.QA_TESTER)).toBe('QA001');
      expect(generateAgentId(AgentRole.TECHNICAL_WRITER)).toBe('TW001');
      expect(generateAgentId(AgentRole.TEAM_LEADER)).toBe('TL001');
    });

    it('should use legacy IDs in test environment', () => {
      process.env.NODE_ENV = 'test';
      expect(generateAgentId(AgentRole.PROJECT_MANAGER)).toBe('U08GYV9AU9M');
    });

    it('should use role-based prefixes in non-test environment', () => {
      process.env.NODE_ENV = 'production';
      expect(generateAgentId(AgentRole.DEVELOPER)).toBe('DEV001');
      process.env.NODE_ENV = 'test'; // Reset for other tests
    });
  });

  describe('Agent Store Management', () => {
    beforeEach(() => {
      // Clear the store before each test
      const store = useAgentStore.getState();
      store.clearAgents();
    });

    it('should add agents to the store', () => {
      const store = useAgentStore.getState();
      const agent = {
        name: 'Test Agent',
        systemPrompt: 'Test prompt',
        provider: 'openai' as AIProvider,
        model: 'gpt-4' as AIModel,
        color: '#000000',
      };

      store.addAgent(agent);
      const agents = useAgentStore.getState().agents;
      expect(agents).toHaveLength(1);
      expect(agents[0].name).toBe('Test Agent');
    });

    it('should update existing agents', () => {
      const store = useAgentStore.getState();
      const agent = {
        name: 'Test Agent',
        systemPrompt: 'Test prompt',
        provider: 'openai' as AIProvider,
        model: 'gpt-4' as AIModel,
        color: '#000000',
      };

      store.addAgent(agent);
      const agents = useAgentStore.getState().agents;
      const agentId = agents[0].id;

      store.updateAgent(agentId, { name: 'Updated Agent' });
      const updatedAgents = useAgentStore.getState().agents;
      expect(updatedAgents[0].name).toBe('Updated Agent');
    });

    it('should remove agents from the store', () => {
      const store = useAgentStore.getState();
      const agent = {
        name: 'Test Agent',
        systemPrompt: 'Test prompt',
        provider: 'openai' as AIProvider,
        model: 'gpt-4' as AIModel,
        color: '#000000',
      };

      store.addAgent(agent);
      const agents = useAgentStore.getState().agents;
      const agentId = agents[0].id;

      store.removeAgent(agentId);
      expect(useAgentStore.getState().agents).toHaveLength(0);
    });

    it('should handle API key management', () => {
      const store = useAgentStore.getState();
      const testKey = 'test-api-key';

      store.setApiKey('openai', testKey);
      expect(useAgentStore.getState().apiKey.openai).toBe(testKey);
    });
  });

  describe('Agent Reference Handling', () => {
    let handoffMediator: HandoffMediator;

    beforeEach(() => {
      // Initialize with a complete set of mock agents
      const mockAgents = {
        'dev1': {
          id: 'dev1',
          name: 'Developer 1',
          role: AgentRole.DEVELOPER,
          description: 'Test Developer',
          personality: 'Professional',
          systemPrompt: 'You are a developer',
          functions: [],
        } as Agent,
        'cr1': {
          id: 'cr1',
          name: 'Code Reviewer 1',
          role: AgentRole.CODE_REVIEWER,
          description: 'Test Code Reviewer',
          personality: 'Detail-oriented',
          systemPrompt: 'You are a code reviewer',
          functions: [],
        } as Agent,
        'pm1': {
          id: 'pm1',
          name: 'Project Manager 1',
          role: AgentRole.PROJECT_MANAGER,
          description: 'Test Project Manager',
          personality: 'Organized',
          systemPrompt: 'You are a project manager',
          functions: [],
        } as Agent,
        'qa1': {
          id: 'qa1',
          name: 'QA Tester 1',
          role: AgentRole.QA_TESTER,
          description: 'Test QA Tester',
          personality: 'Thorough',
          systemPrompt: 'You are a QA tester',
          functions: [],
        } as Agent,
      };

      const mockStateManager = {
        getState: jest.fn(),
        setState: jest.fn(),
        storage: new Map(),
        getConversationKey: jest.fn(),
        resetState: jest.fn(),
        canTransition: jest.fn(),
        getAvailableTransitions: jest.fn(),
      } as unknown as WorkflowStateManager;

      handoffMediator = new HandoffMediator(mockAgents, mockStateManager);
    });

    describe('State-based Handoffs', () => {
      it('should handoff to developer for code committed state', async () => {
        const state = {
          stage: 'code_committed' as const,
          issueNumber: 1,
          branchName: 'feature/test',
        };

        const agent = await handoffMediator.getAgentForState(state);
        expect(agent?.role).toBe(AgentRole.DEVELOPER);
        expect(agent?.id).toBe('dev1');
      });

      it('should handoff to code reviewer for PR created state', async () => {
        const state = {
          stage: 'pr_created' as const,
          issueNumber: 1,
          branchName: 'feature/test',
          prNumber: 1,
        };

        const agent = await handoffMediator.getAgentForState(state);
        expect(agent?.role).toBe(AgentRole.CODE_REVIEWER);
        expect(agent?.id).toBe('cr1');
      });

      it('should handoff to project manager for PR merged state', async () => {
        const state = {
          stage: 'pr_merged' as const,
          issueNumber: 1,
          branchName: 'feature/test',
          prNumber: 1,
        };

        const agent = await handoffMediator.getAgentForState(state);
        expect(agent?.role).toBe(AgentRole.PROJECT_MANAGER);
        expect(agent?.id).toBe('pm1');
      });
    });

    describe('Message-based Handoffs', () => {
      it('should handoff based on explicit @ mentions', async () => {
        const message: AgentMessage = {
          id: 'msg1',
          timestamp: new Date().toISOString(),
          agentId: 'user1',
          content: 'Hey @Developer 1, can you help with this bug?',
          channel: 'channel1',
          mentions: ['dev1'],
        };

        const agent = await handoffMediator.determineNextAgent('channel1', null, message);
        expect(agent?.role).toBe(AgentRole.DEVELOPER);
        expect(agent?.id).toBe('dev1');
      });

      it('should handoff based on role-specific keywords', async () => {
        const message: AgentMessage = {
          id: 'msg2',
          timestamp: new Date().toISOString(),
          agentId: 'user1',
          content: 'We need to review this pull request',
          channel: 'channel1',
          mentions: [],
        };

        const agent = await handoffMediator.determineNextAgent('channel1', null, message);
        expect(agent?.role).toBe(AgentRole.CODE_REVIEWER);
        expect(agent?.id).toBe('cr1');
      });

      it('should handle ambiguous prompts by prioritizing explicit mentions', async () => {
        const message: AgentMessage = {
          id: 'msg3',
          timestamp: new Date().toISOString(),
          agentId: 'user1',
          content: 'Hey @Developer 1, we need to review this code and test it',
          channel: 'channel1',
          mentions: ['dev1'],
        };

        const agent = await handoffMediator.determineNextAgent('channel1', null, message);
        expect(agent?.role).toBe(AgentRole.DEVELOPER);
        expect(agent?.id).toBe('dev1');
      });

      it('should handle multiple role keywords by using the first match', async () => {
        const message: AgentMessage = {
          id: 'msg4',
          timestamp: new Date().toISOString(),
          agentId: 'user1',
          content: 'We need to test this code and review it',
          channel: 'channel1',
          mentions: [],
        };

        const agent = await handoffMediator.determineNextAgent('channel1', null, message);
        expect(agent?.role).toBe(AgentRole.DEVELOPER);
        expect(agent?.id).toBe('dev1');
      });

      it('should handle messages with no clear handoff target', async () => {
        const message: AgentMessage = {
          id: 'msg5',
          timestamp: new Date().toISOString(),
          agentId: 'user1',
          content: 'Hello everyone, how is it going?',
          channel: 'channel1',
          mentions: [],
        };

        const agent = await handoffMediator.determineNextAgent('channel1', null, message);
        expect(agent).toBeNull();
      });
    });

    describe('Load Balancing', () => {
      it('should distribute work among agents of the same role', async () => {
        // Add another developer to test load balancing
        const mockAgents = {
          ...handoffMediator['agents'],
          'dev2': {
            id: 'dev2',
            name: 'Developer 2',
            role: AgentRole.DEVELOPER,
            description: 'Test Developer 2',
            personality: 'Professional',
            systemPrompt: 'You are a developer',
            functions: [],
          } as Agent,
        };

        handoffMediator = new HandoffMediator(mockAgents, handoffMediator['stateManager']);

        // First request should go to dev1
        const message1: AgentMessage = {
          id: 'msg6',
          timestamp: new Date().toISOString(),
          agentId: 'user1',
          content: 'Hey @Developer 1, can you help with this bug?',
          channel: 'channel1',
          mentions: ['dev1'],
        };
        const agent1 = await handoffMediator.determineNextAgent('channel1', null, message1);
        expect(agent1?.id).toBe('dev1');

        // Mark dev1 as busy
        handoffMediator.markAgentBusy('dev1');

        // Second request should go to dev2
        const message2: AgentMessage = {
          id: 'msg7',
          timestamp: new Date().toISOString(),
          agentId: 'user1',
          content: 'Hey @Developer 2, can you help with this bug?',
          channel: 'channel1',
          mentions: ['dev2'],
        };
        const agent2 = await handoffMediator.determineNextAgent('channel1', null, message2);
        expect(agent2?.id).toBe('dev2');
      });

      it('should handle unavailable agents gracefully', async () => {
        // Mark all developers as busy
        handoffMediator.setAgentAvailability('dev1', false);

        const message: AgentMessage = {
          id: 'msg8',
          timestamp: new Date().toISOString(),
          agentId: 'user1',
          content: 'We need to fix this bug',
          channel: 'channel1',
          mentions: [],
        };

        const agent = await handoffMediator.determineNextAgent('channel1', null, message);
        expect(agent).toBeNull();
      });
    });
  });
}); 