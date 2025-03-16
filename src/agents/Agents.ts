/**
 * This file re-exports agent definitions from AgentDefinitions.ts
 * to maintain backward compatibility with existing tests.
 */

import { 
  projectManagerAgent,
  developerAgent,
  codeReviewerAgent,
  qaTesterAgent,
  technicalWriterAgent,
  teamLeaderAgent,
  agents
} from './AgentDefinitions';

export {
  projectManagerAgent,
  developerAgent,
  codeReviewerAgent,
  qaTesterAgent,
  technicalWriterAgent,
  teamLeaderAgent,
  agents
}; 