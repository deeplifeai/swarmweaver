# 🌊 SwarmWeaver

SwarmWeaver is a powerful application that enables AI agents to communicate via Slack channels while performing critical GitHub functions, creating a seamless development ecosystem for your team.

## ✨ Features

- 🤖 **AI Agent Teams**: Define specialized agents with distinct roles, personalities, and responsibilities
- 🔀 **Inter-Agent Communication**: Agents can address each other using @name mention syntax
- 🔧 **GitHub Integration**: Create issues, commit code, manage pull requests, and conduct code reviews
- 💬 **Slack Integration**: Communicate with AI agents in your team's Slack channels
- 🧠 **OpenAI Function Calling**: Leverage OpenAI's advanced tool definition format for GitHub operations
- 🔒 **Secure Token Management**: Protect sensitive credentials with proper security measures
- 🏜️ **Sandbox Environment**: Test the system without requiring real Slack or GitHub connections

## �� Available Agents

SwarmWeaver comes with the following pre-configured agents:

1. **ProjectManager**: Oversees the development process, creates and assigns tasks, tracks progress
2. **Developer**: Implements features, fixes bugs, writes clean code, creates pull requests
3. **CodeReviewer**: Evaluates code quality, identifies issues, provides constructive feedback
4. **QATester**: Verifies functionality, finds bugs, ensures the product meets requirements
5. **TechnicalWriter**: Creates documentation, user guides, and API references

Each agent has a distinct personality and set of responsibilities, making them effective at their specific roles.

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- A Slack workspace with admin privileges
- A GitHub repository with appropriate access rights

### Installation

#### Option 1: Local Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/swarmweaver.git
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   
   Edit the `.env` file and provide your API keys and configuration settings:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `SLACK_BOT_TOKEN`: Your Slack bot token (xoxb-...)
   - `SLACK_SIGNING_SECRET`: Your Slack signing secret
   - `SLACK_APP_TOKEN`: Your Slack app token (xapp-...)
   - `GITHUB_TOKEN`: Your GitHub personal access token
   - `GITHUB_REPOSITORY`: The target repository (format: owner/repo)

4. Start the application:
   ```bash
   npm start
   ```

#### Option 2: Docker Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/swarmweaver.git
   cd swarmweaver
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   
   Edit the `.env` file with your API keys as described above.

3. Build and start the Docker container:
   ```bash
   docker-compose up -d
   ```

4. View logs:
   ```bash
   docker-compose logs -f
   ```

## 🔧 Slack App Setup

1. Create a new Slack app at https://api.slack.com/apps
2. Add the following OAuth scopes:
   - `app_mentions:read`
   - `channels:history`
   - `chat:write`
   - `groups:history`
   - `im:history`
   - `mpim:history`
3. Enable Socket Mode
4. Install the app to your workspace
5. Copy the Bot Token, Signing Secret, and App Token to your `.env` file

## 📖 Usage Guide

### Interacting with Agents

To interact with an agent, mention them in a Slack channel where the bot is present:

```
@ProjectManager Can you create a new issue for adding user authentication?
```

You can also send a message to multiple agents at once by separating their mentions with a comma:

```
@ProjectManager, @Developer can you both work on the authentication issue?
```

When you mention multiple agents without a comma, only the first mentioned agent will receive the message:

```
@ProjectManager please assign @Developer to work on the authentication issue
```

Agents can also mention each other and collaborate:

```
@Developer I've created issue #42 for implementing user authentication. Can you take a look?
```

### GitHub Operations

Agents can perform various GitHub operations through natural language requests:

- **Create Issues**: `@ProjectManager Please create an issue for adding dark mode support`
- **Submit PRs**: `@Developer Please create a PR for the feature branch to main`
- **Review Code**: `@CodeReviewer Can you review PR #15?`
- **Commit Code**: `@Developer Commit this fix to the bugfix branch` (with code snippet)

## 🏗️ Architecture

SwarmWeaver consists of three core components:

1. **Slack Integration Layer**: Handles messaging and user interaction through the Slack Bolt framework
2. **AI Orchestration Layer**: Manages agent intelligence and coordination using OpenAI's function calling capabilities
3. **GitHub Integration Layer**: Executes repository operations via the Octokit SDK

This layered architecture ensures clean separation of concerns and allows for extensibility.

## 🔒 Security

SwarmWeaver takes security seriously:

- All API tokens are stored in environment variables, not hardcoded
- Slack messages are verified using the signing secret
- GitHub operations use scoped access tokens
- Token validation prevents malformed or incorrect tokens
- URL validation ensures only trusted domains are accessed
- Sensitive information is masked in logs

## 🧪 Testing

SwarmWeaver includes a test suite to ensure components work as expected:

```bash
# Run tests
npm test

# Run tests with coverage
npm test -- --coverage
```

## 🏜️ Sandbox Environment

SwarmWeaver includes a sandbox environment that allows you to test the system without setting up real Slack and GitHub connections. This is useful for development, testing, and demonstrations.

### Running the Sandbox

1. Navigate to the sandbox directory:
   ```bash
   cd sandbox
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the sandbox:
   ```bash
   npm run dev
   ```

The sandbox provides:
- A mock Slack service with a command-line interface
- A mock GitHub service that simulates repository operations
- Simulated agent responses to test interactions

### Using the Sandbox

Once running, you can interact with agents using the CLI:

```
@developer create an issue for the login feature
```

See the [Sandbox README](./sandbox/README.md) for more details.

## 🐳 Docker Support

SwarmWeaver includes Docker support for easy deployment:

- Use `docker-compose up -d` to start the application in a container
- The application runs on port 3000 by default (configurable in docker-compose.yml)
- Logs are persisted to the ./logs directory

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- React Flow for the flow visualization
- Shadcn/UI for the beautiful UI components
- OpenAI and Perplexity for their AI APIs