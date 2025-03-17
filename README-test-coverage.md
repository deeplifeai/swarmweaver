# Test Coverage Documentation

This document outlines the test coverage for the SwarmWeaver project. The tests were implemented using Jest and covered various aspects of the application's functionality.

## Test Categories

### 1. GitHub Integration Tests
- Branch Management
  - Automatic branch creation when non-existent
  - Handling existing branches
  - Error handling for branch creation failures
- Pull Request Management
  - PR creation with proper branch verification
  - PR metadata validation
- Commit Management
  - Commit creation with file changes
  - Commit message handling

### 2. Agent System Tests
- Agent ID Generation
  - Environment-specific ID generation (test, production, development)
  - Role-based ID prefixes
- Agent Store Management
  - Agent addition and updates
  - Agent state persistence
  - API key management
- Agent reference handling
  - Agents properly refer follow-up tasks to the proper downstream agent
  - Agents picked up when they are being addressed by other agents or users

### 3. AI Service Tests
- Response Generation
  - Caching mechanism
  - API integration
  - Error handling
- Function Registration
  - Function registration and execution
  - Parameter validation
- Text Generation
  - LangChain integration
  - Provider-specific handling
  - Messages properly routed between agents

### 4. Error Handling Tests
- Error Types
  - Network errors
  - API errors
  - Validation errors
  - Authentication errors
- Retry Mechanism
  - Successful retries
  - Maximum retry attempts
  - Retryable vs non-retryable errors
  - Backoff strategy

### 5. Issue and PR Detection Tests
- Issue Number Extraction
  - Various formats (#123, issue 123)
  - Mixed format handling
  - Case insensitivity
  - Edge cases (end of sentence, non-issue numbers)
- PR Extraction
  - Number
  - Status
  - Opening and closing