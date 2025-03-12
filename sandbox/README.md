# SwarmWeaver Sandbox Environment

A testing environment for the SwarmWeaver system that doesn't require actual Slack and GitHub connections. This sandbox allows developers to test and develop the SwarmWeaver system locally without setting up external integrations.

## Features

- **Mock Slack Service**: Simulates Slack messaging with a CLI interface
- **Mock GitHub Service**: Simulates GitHub operations
- **Event Bus**: Facilitates communication between components
- **Agent Simulation**: Simulates agent responses and function calls

## Getting Started

### Installation

1. Navigate to the sandbox directory:
   ```
   cd sandbox
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the sandbox in development mode:
   ```
   npm run dev
   ```

### Usage

Once the sandbox is running, you'll be presented with a CLI interface that simulates Slack:

1. **Send a message to a single agent**:
   ```
   @developer create an issue for the login feature
   ```

2. **Send a message to multiple agents** (use comma to separate mentions):
   ```
   @developer, @projectmanager please create an issue for the login feature
   ```

3. **Mention an agent in context** (only the first @mentioned agent will receive the message):
   ```
   @developer can you work with @projectmanager on creating an issue?
   ```

4. **Switch channels**:
   ```
   channel development
   ```

5. **Exit the sandbox**:
   ```
   exit
   ```

### How Mentions Work

- **Comma-separated mentions**: If you write `@agent1, @agent2`, both agents will receive the message
- **Context mentions**: If you write `@agent1 please talk to @agent2`, only agent1 receives the message

### Available Agents

The sandbox simulates responses from the following agents:
- `developer` - Handles development tasks
- `codereviewer` - Reviews pull requests
- `projectmanager` - Manages project tasks

### Available Commands

The sandbox recognizes these patterns:
- `create an issue` - Creates a GitHub issue
- `create a pull request` - Creates a GitHub pull request
- `review the pull request` - Reviews a GitHub pull request

## Example Interactions

```
@developer create an issue for fixing the login bug

@projectmanager, @developer create a new feature request for dark mode

@codereviewer review the pull request for the navigation component. Perhaps @developer should look at it too.
```

## Architecture

The sandbox consists of these main components:

1. **MockSlackService**: Handles user interaction via the CLI and simulates Slack messaging
2. **MockGitHubService**: Simulates GitHub repository operations
3. **EventBus**: Facilitates communication between services
4. **CLI**: The main entry point that ties everything together

## Development

### Project Structure

```
sandbox/
├── cli/                  # CLI interface
├── mock-services/        # Mock implementations of external services
├── types/                # Type definitions
├── utils/                # Utility functions
├── package.json          # Dependencies and scripts
└── tsconfig.json         # TypeScript configuration
```

### Adding New Features

- To add a new GitHub operation, extend the MockGitHubService
- To add a new agent response pattern, modify the generateSimulatedResponse function

## Testing

The sandbox can be used to test the core business logic of the SwarmWeaver system without relying on actual external services. 