#!/bin/bash

# Shell script to run the LangChain integration test

# Load environment variables from .env file if it exists
if [ -f .env ]; then
  echo "Loading environment variables from .env file..."
  export $(grep -v '^#' .env | xargs)
fi

# Check if OPENAI_API_KEY is set
if [ -z "$OPENAI_API_KEY" ]; then
  echo "Error: OPENAI_API_KEY environment variable is not set."
  echo "Please set it in your .env file or export it in your shell."
  exit 1
fi

# Run the test directly with ts-node now that we're using CommonJS
echo "Running LangChain integration test..."
npx ts-node -r tsconfig-paths/register src/scripts/testLangChainIntegration.ts

# Check the exit code
if [ $? -ne 0 ]; then
  echo "Test failed!"
  exit 1
fi

echo "Test completed successfully!"
exit 0 