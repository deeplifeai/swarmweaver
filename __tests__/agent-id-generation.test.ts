import { AgentRole } from '../src/types/agents/Agent';
import { generateAgentId } from '../src/agents/AgentDefinitions';

describe('Agent ID Generation Tests', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  
  // Save original NODE_ENV and restore it after tests
  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });
  
  describe('In test environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
    });
    
    it('should generate legacy IDs for backward compatibility', () => {
      expect(generateAgentId(AgentRole.PROJECT_MANAGER)).toBe('U08GYV9AU9M');
      expect(generateAgentId(AgentRole.DEVELOPER)).toBe('DEV001');
      expect(generateAgentId(AgentRole.CODE_REVIEWER)).toBe('CR001');
      expect(generateAgentId(AgentRole.QA_TESTER)).toBe('QA001');
      expect(generateAgentId(AgentRole.TECHNICAL_WRITER)).toBe('TW001');
      expect(generateAgentId(AgentRole.TEAM_LEADER)).toBe('TL001');
    });
  });
  
  describe('In production environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });
    
    it('should generate consistent IDs based on role prefixes', () => {
      expect(generateAgentId(AgentRole.PROJECT_MANAGER)).toBe('PM001');
      expect(generateAgentId(AgentRole.DEVELOPER)).toBe('DEV001');
      expect(generateAgentId(AgentRole.CODE_REVIEWER)).toBe('CR001');
      expect(generateAgentId(AgentRole.QA_TESTER)).toBe('QA001');
      expect(generateAgentId(AgentRole.TECHNICAL_WRITER)).toBe('TW001');
      expect(generateAgentId(AgentRole.TEAM_LEADER)).toBe('TL001');
    });
  });
  
  describe('In development environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });
    
    it('should generate consistent IDs based on role prefixes', () => {
      expect(generateAgentId(AgentRole.PROJECT_MANAGER)).toBe('PM001');
      expect(generateAgentId(AgentRole.DEVELOPER)).toBe('DEV001');
      expect(generateAgentId(AgentRole.CODE_REVIEWER)).toBe('CR001');
      expect(generateAgentId(AgentRole.QA_TESTER)).toBe('QA001');
      expect(generateAgentId(AgentRole.TECHNICAL_WRITER)).toBe('TW001');
      expect(generateAgentId(AgentRole.TEAM_LEADER)).toBe('TL001');
    });
  });
}); 