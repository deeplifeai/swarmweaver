/**
 * @jest-environment node
 * @jest-environment-options {"skipEnvCheck": true}
 * 
 * This is a utility file for creating mock HandoffMediator instances for tests.
 * It is not a test file itself.
 */

import { Agent, AgentMessage, AgentRegistry, AgentRole } from '../../src/types/agents/Agent';
import { WorkflowState, WorkflowStateManager } from '../../src/services/state/WorkflowStateManager';
import { HandoffMediator } from '../../src/services/agents/HandoffMediator';

/**
 * Creates a properly mocked HandoffMediator that conforms to the refactored implementation
 * @param customMethods Optional overrides for specific methods
 * @param mockAgents Mock agent registry to use
 * @param mockStateManager Mock state manager to use
 * @returns A properly structured HandoffMediator mock
 */
export function createMockHandoffMediator(
  customMethods: Partial<Record<keyof HandoffMediator, jest.Mock>> = {},
  mockAgents: AgentRegistry = {},
  mockStateManager: Partial<WorkflowStateManager> = {}
): HandoffMediator {
  // Create a real instance with mocked dependencies
  const mediator = new HandoffMediator(
    mockAgents, 
    mockStateManager as WorkflowStateManager
  );
  
  // Spy on and mock the PUBLIC methods we want to override
  jest.spyOn(mediator, 'determineNextAgent').mockImplementation(
    customMethods.determineNextAgent || ((channelId: string, threadTs: string | null, message: AgentMessage): Promise<Agent | null> => {
      // Default implementation that returns the first mentioned agent
      if (message.mentions && message.mentions.length > 0) {
        return Promise.resolve(mockAgents[message.mentions[0]] as Agent || null);
      }
      return Promise.resolve(null);
    })
  );
  
  jest.spyOn(mediator, 'recordHandoff').mockImplementation(
    customMethods.recordHandoff || ((fromAgentId: string, toAgentId: string, channelId: string, threadTs: string | null, reason: string) => {
      return Promise.resolve();
    })
  );
  
  jest.spyOn(mediator, 'markAgentBusy').mockImplementation(
    customMethods.markAgentBusy || jest.fn()
  );
  
  jest.spyOn(mediator, 'markAgentAvailable').mockImplementation(
    customMethods.markAgentAvailable || jest.fn()
  );
  
  jest.spyOn(mediator, 'setAgentAvailability').mockImplementation(
    customMethods.setAgentAvailability || jest.fn()
  );
  
  jest.spyOn(mediator, 'isAgentAvailable').mockImplementation(
    customMethods.isAgentAvailable || (() => true)
  );
  
  jest.spyOn(mediator, 'getAgentStats').mockImplementation(
    customMethods.getAgentStats || (() => ({}))
  );
  
  return mediator;
} 