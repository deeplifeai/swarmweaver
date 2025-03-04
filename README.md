# 🌊 SwarmWeaver

![SwarmWeaver](path/to/logo/image.png)

SwarmWeaver is a powerful visual tool for creating, connecting, and orchestrating AI agent workflows. Build complex multi-agent systems with a simple drag-and-drop interface, allowing you to create sophisticated AI pipelines without writing code.

## ✨ Features

- 🧠 **Visual Agent Canvas**: Drag and drop agents onto a canvas and connect them to create complex workflows
- 🔄 **Agent Orchestration**: Automatically execute agents in the correct order based on dependencies
- 📦 **Agent Library**: Save and reuse your favorite agent configurations
- 🔌 **Multiple AI Providers**: Support for OpenAI and Perplexity AI models
- 💾 **Save & Export**: Save your canvas state and export results in various formats
- 🔒 **Secure Storage**: API keys are stored securely in your browser's local storage

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/swarmweaver.git
   ```

2. Install dependencies:
   ```bash
   yarn
   ```

3. Start the development server:
   ```bash
   yarn dev
   ```

4. Open your browser and navigate to http://localhost:8080

## 🔧 Configuration

### API Keys
SwarmWeaver requires API keys to interact with AI providers:
1. Click on the API Keys button in the sidebar
2. Enter your OpenAI and/or Perplexity API keys
3. Your keys are stored securely in your browser's local storage

## 📖 Usage Guide

### Creating Your First Agent Swarm
1. **Add Agents to Canvas**: Drag agents from the sidebar onto the canvas
2. **Connect Agents**: Click and drag from one agent's output handle to another agent's input handle
3. **Configure Agents**: Click on an agent to configure its system prompt, model, and other settings
4. **Add Input**: Click "Add Input" on an agent to provide initial input
5. **Add Output Box**: Drag an "Output Box" to collect final results
6. **Run Canvas**: Click the "Run Canvas" button to execute your agent swarm

### Example Workflow

In this simple workflow:
The Research Agent gathers information
The Summarization Agent condenses the research
The Output Box displays the final result

## 🏗️ Architecture

SwarmWeaver is built with:
- **React**: Frontend UI framework
- **TypeScript**: Type-safe JavaScript
- **Zustand**: State management
- **@xyflow/react**: Canvas and node visualization
- **Shadcn/UI**: UI components
- **Vite**: Build tool and development server

## 🧩 Core Components

### Canvas
The canvas is where you build your agent workflows. It handles:
- Drag and drop functionality
- Node connections
- Execution flow

### Agent Node
Each agent node represents an AI agent with:
- Input/output handling
- Configuration options
- Execution status

### Agent Store
The central state management system that:
- Stores agent configurations
- Manages canvas state
- Handles execution results
- Secures API keys

## 🔐 Security

SwarmWeaver takes security seriously:
- API keys are encrypted before being stored in local storage
- All processing happens in your browser - no data is sent to our servers
- Only the necessary data is sent to the AI provider APIs

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