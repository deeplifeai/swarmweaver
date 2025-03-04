import { AIModel, AIProvider } from '@/types/agent';
import { useAgentStore } from '@/store/agentStore';

// Add a validation function to check for common input issues
function validateInput(input: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Check if input appears to be truncated
  if (input.endsWith('...') || input.endsWith('…')) {
    issues.push('Input appears to be truncated (ends with ellipsis)');
  }
  
  // Check for input that's too short
  if (input.trim().length < 5) {
    issues.push('Input is too short (less than 5 characters)');
  }
  
  // Check for incomplete JSON or markdown code blocks
  const openCodeBlocks = (input.match(/```[a-z]*\n/g) || []).length;
  const closeCodeBlocks = (input.match(/```\s*\n/g) || []).length;
  if (openCodeBlocks > closeCodeBlocks) {
    issues.push(`Input contains unclosed code blocks (${openCodeBlocks} opening vs ${closeCodeBlocks} closing)`);
  }
  
  // Check for unbalanced parentheses or brackets that might indicate truncation
  const openParens = (input.match(/\(/g) || []).length;
  const closeParens = (input.match(/\)/g) || []).length;
  if (Math.abs(openParens - closeParens) > 2) {
    issues.push(`Input has unbalanced parentheses (${openParens} opening vs ${closeParens} closing)`);
  }
  
  const openBrackets = (input.match(/\{/g) || []).length;
  const closeBrackets = (input.match(/\}/g) || []).length;
  if (Math.abs(openBrackets - closeBrackets) > 2) {
    issues.push(`Input has unbalanced curly braces (${openBrackets} opening vs ${closeBrackets} closing)`);
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

export async function generateAgentResponse(
  provider: AIProvider,
  model: AIModel,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  // Validate input parameters
  if (!provider) {
    console.error('❌ Missing provider in generateAgentResponse');
    throw new Error('AI provider is required');
  }
  if (!model) {
    console.error('❌ Missing model in generateAgentResponse');
    throw new Error('AI model is required');
  }
  if (!userPrompt || userPrompt.trim().length === 0) {
    console.error('❌ Empty userPrompt in generateAgentResponse');
    throw new Error('User prompt cannot be empty');
  }

  // Always get fresh API key directly from the store
  // This ensures we're using the most recently updated key
  const apiKey = useAgentStore.getState().apiKey[provider];
  
  // Debug: Log a masked version of the API key to verify it is correct (avoid showing full key in production)
  console.info(`DEBUG: Retrieved API key for ${provider}: ${apiKey.slice(0, 5)}...${apiKey.slice(-4)}`);

  // If experiencing issues, consider clearing localStorage to remove stale keys:
  // localStorage.removeItem('swarmweaver_api_keys');

  // Validate API key
  if (!apiKey) {
    const errorMessage = `No API key configured for ${provider}`;
    console.error(`❌ ${errorMessage}`);
    return `[Error: ${errorMessage}. Please configure your API key in Settings.]`;
  }
  
  // Check if API key looks valid (basic format check)
  if (provider === 'openai' && !apiKey.startsWith('sk-')) {
    const errorMessage = `Invalid OpenAI API key format (should start with 'sk-')`;
    console.error(`❌ ${errorMessage}`);
    return `[Error: ${errorMessage}. Please check your API key in Settings.]`;
  }
  
  // We'll continue with the request but log the warning
  if (!systemPrompt || systemPrompt.trim().length === 0) {
    console.warn('⚠️ Empty system prompt');
  }

  console.info(`📤 Sending request to ${provider} with model ${model}`);
  console.info(`System prompt length: ${systemPrompt?.length || 0}, User prompt length: ${userPrompt.length}`);
  
  try {
    let response: string;
    // Pass the freshly fetched API key to the provider-specific functions
    if (provider === 'openai') {
      response = await callOpenAI(apiKey, model, systemPrompt, userPrompt);
    } else if (provider === 'perplexity') {
      response = await callPerplexity(apiKey, model, systemPrompt, userPrompt);
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }
    
    // Check if response appears to be truncated or empty
    if (!response || response.trim().length === 0) {
      console.warn('⚠️ API returned empty response');
      console.warn('Provider:', provider, 'Model:', model);
      // Return a fallback message instead of empty string
      return `[Error: The ${provider} API (${model}) returned an empty response. Please check your API key and configuration.]`;
    } else if (response.endsWith('...') || response.endsWith('…')) {
      console.warn('⚠️ API response may be truncated (ends with ellipsis)');
    }
    
    console.info(`📥 Response received (${response.length} characters)`);
    return response;
  } catch (error) {
    console.error('❌ Error generating agent response:', error);
    // Return a more detailed error as the response text
    return `[Error generating response: ${error.message || 'Unknown error'}]`;
  }
}

async function callOpenAI(
  apiKey: string,
  model: AIModel,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  if (!apiKey) {
    console.error('❌ No OpenAI API key provided');
    throw new Error('OpenAI API key is required');
  }

  try {
    // Log the request information
    console.info(`Calling OpenAI API with model: ${model}`);
    
    // Base payload with required parameters
    const payload: any = {
      model,
      messages: []
    };

    // Handle messages based on model type
    // o1 and o3 models don't support 'system' role
    if (model.toString().startsWith('o1') || model.toString().startsWith('o3')) {
      // For o1/o3 models, convert system message to a user message prefix
      if (systemPrompt) {
        payload.messages.push({ 
          role: 'user', 
          content: `${systemPrompt}\n\n${userPrompt}` 
        });
        console.info(`o1/o3 model: Combined system+user prompt length: ${(systemPrompt + userPrompt).length}`);
      } else {
        payload.messages.push({ role: 'user', content: userPrompt });
        console.info(`o1/o3 model: User prompt only (no system prompt), length: ${userPrompt.length}`);
      }
    } else {
      // For other models, use standard system and user messages
      if (systemPrompt) {
        payload.messages.push({ role: 'system', content: systemPrompt });
        console.info(`Standard model: System prompt length: ${systemPrompt.length}`);
      } else {
        console.warn(`Standard model: No system prompt provided!`);
      }
      payload.messages.push({ role: 'user', content: userPrompt });
      console.info(`Standard model: User prompt length: ${userPrompt.length}`);
    }

    // Add max_completion_tokens for all models
    payload.max_completion_tokens = 1000;

    // Only add temperature for models that support it
    // Reasoning models (o1, o1-mini, o3-mini) don't support temperature
    if (!model.toString().startsWith('o1') && !model.toString().startsWith('o3')) {
      payload.temperature = 0.7;
    }

    console.info(`Payload structure: ${JSON.stringify({
      model: payload.model,
      messageCount: payload.messages.length,
      firstMessageRole: payload.messages[0]?.role,
      messageTypes: payload.messages.map(m => m.role).join(',')
    })}`);

    // Log the actual request for debugging
    const reqBody = JSON.stringify(payload);
    console.info(`OpenAI request body preview (first 200 chars): ${reqBody.substring(0, 200)}...`);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: reqBody,
    });

    if (!response.ok) {
      let errorMessage = 'Unknown error';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || 
                      errorData.error?.code || 
                      `HTTP error ${response.status}`;
        console.error('OpenAI API error details:', JSON.stringify(errorData));
      } catch (parseError) {
        errorMessage = `HTTP error ${response.status}: ${response.statusText}`;
      }
      throw new Error(`OpenAI API error: ${errorMessage}`);
    }

    const data = await response.json();
    console.info(`OpenAI API response status: ${response.status}, data structure: ${JSON.stringify({
      id: data.id?.substring(0, 10) || 'missing',
      object: data.object || 'missing',
      model: data.model || 'missing',
      choicesLength: data.choices?.length || 0,
      contentLength: data.choices?.[0]?.message?.content?.length || 0
    })}`);
    
    // Validate response structure
    if (!data || !data.choices || !data.choices.length) {
      console.error('❌ Invalid response structure from OpenAI:', JSON.stringify(data));
      throw new Error('Invalid response structure from OpenAI API');
    }
    
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      console.error('❌ Empty content in OpenAI response:', JSON.stringify(data.choices[0]));
      throw new Error('Empty content in OpenAI response');
    }
    
    return content;
  } catch (error: any) {
    // Handle network errors or other exceptions
    if (error.name === 'AbortError') {
      throw new Error('OpenAI API request timed out');
    }
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      throw new Error('Network error when calling OpenAI API');
    }
    console.error('OpenAI API call failed:', error);
    throw error;
  }
}

async function callPerplexity(
  apiKey: string,
  model: AIModel,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1000, // Perplexity API uses max_tokens
      }),
    });

    if (!response.ok) {
      let errorMessage = 'Unknown error';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || `HTTP error ${response.status}`;
      } catch (parseError) {
        errorMessage = `HTTP error ${response.status}: ${response.statusText}`;
      }
      throw new Error(`Perplexity API error: ${errorMessage}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      throw new Error('Network error when calling Perplexity API');
    }
    throw error;
  }
}
