import { AIModel, AIProvider } from '@/types/agent';
import { useAgentStore } from '@/store/agentStore';
import { calculateMaxOutputTokens, getMaxCompletionTokens, estimateTokenCount, getModelContextSize } from '@/utils/tokenManager';
import { processWithChunkedStrategy } from './optimizationService';
import { responseCache } from './cacheService';

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

// Helper function to simulate the original API call
async function originalGenerateAgentResponse(provider: string, model: any, systemPrompt: string, query: string): Promise<string> {
  // Don't use the placeholder mock implementation
  // Instead, call the actual API implementation
  
  console.log(`Making real API call to ${provider} with model ${model}`);
  
  // Get the API key from the store
  const apiKey = useAgentStore.getState().apiKey[provider];
  if (!apiKey) {
    throw new Error(`No API key set for ${provider}`);
  }
  
  // Choose the appropriate API call based on provider
  if (provider === 'openai') {
    return callOpenAI(apiKey, model, systemPrompt, query);
  } else if (provider === 'perplexity') {
    return callPerplexity(apiKey, model, systemPrompt, query);
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }
}

// Modified generateAgentResponse with persistent caching using localStorage
export async function generateAgentResponse(provider: string, model: any, systemPrompt: string, query: string): Promise<string> {
  // Create a cache key by stringifying the parameters and encoding them in base64
  const cacheKey = "agent-response-" + btoa(unescape(encodeURIComponent(JSON.stringify({ provider, model, systemPrompt, query }))));
  
  // Add logging to track how many cache hits/misses we're getting
  console.debug(`API Request - Provider: ${provider}, Model: ${model}, System prompt length: ${systemPrompt?.length || 0}, Query length: ${query?.length || 0}`);
  
  // Check if we have a cached response in localStorage
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    // Validate cached response - must be non-empty and not an error
    if (cached.length > 0 && !cached.startsWith('[Error:') && !cached.startsWith('[ERROR::')) {
      console.info("✅ Using cached response for key: " + cacheKey);
      return cached;
    } else {
      console.info("⚠️ Found invalid cached response, ignoring it");
      // Invalid cache, remove it
      localStorage.removeItem(cacheKey);
    }
  }
  
  console.info("❌ Cache miss - making real API call for key: " + cacheKey);
  
  // If not cached, call the original function
  const response = await originalGenerateAgentResponse(provider, model, systemPrompt, query);
  
  // Only cache valid responses
  if (response && response.length > 0 && !response.startsWith('[Error:') && !response.startsWith('[ERROR::')) {
    localStorage.setItem(cacheKey, response);
  }
  
  return response;
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

  let isTryingFallbackParameters = false;

  const tryCall = async (useAlternativeParameter = false) => {
    try {
      // Get the estimated token count of the entire input
      const estimatedSystemTokens = estimateTokenCount(systemPrompt || '');
      const estimatedUserTokens = estimateTokenCount(userPrompt || '');
      const totalEstimatedTokens = estimatedSystemTokens + estimatedUserTokens;
      
      // Get the model's context size
      const modelContextSize = getModelContextSize(model);
      
      // Check if we need to use chunked processing
      // More proactive checks to determine when chunking is needed:
      // 1. If the input is very large (over 10k chars) - as before
      // 2. If the estimated tokens are over 60% of the model's context window
      // 3. If the user prompt is complex (contains lots of code blocks or is very large)
      const useChunking = 
        userPrompt.length > 10000 || 
        totalEstimatedTokens > modelContextSize * 0.6 ||
        (userPrompt.length > 6000 && (userPrompt.includes("```") || userPrompt.includes("code")));
      
      if (useChunking) {
        console.info(`Using chunked processing strategy: Input is large (${userPrompt.length} chars, ~${totalEstimatedTokens} tokens, model context: ${modelContextSize})`);
        return processWithChunkedStrategy('openai', model, systemPrompt, userPrompt, apiKey);
      }

      // Log the request information
      console.info(`Calling OpenAI API with model: ${model}`);
      
      // Calculate appropriate max_tokens based on input size and model
      const maxOutputTokens = calculateMaxOutputTokens(systemPrompt, userPrompt, model);
      const maxAllowedCompletionTokens = getMaxCompletionTokens(model);
      console.info(`Calculated max output tokens: ${maxOutputTokens} (model limit: ${maxAllowedCompletionTokens})`);
      
      // Base payload with required parameters
      const payload: any = {
        model,
        messages: []
      };
      
      // Different models require different parameter names for token limits
      const modelStr = String(model).toLowerCase();
      
      // For OpenAI models, we're removing max_tokens and max_completion_tokens parameters
      // as per the user's request since they're optional
      // We'll still keep tracking the token counts for logging and chunking decisions
      
      // Only add token limits for non-OpenAI models
      if (!modelStr.startsWith('gpt-')) {
        if (useAlternativeParameter) {
          // For non-OpenAI models, we might need to try the alternative parameter
          if (payload.max_tokens) {
            delete payload.max_tokens;
            payload.max_completion_tokens = maxOutputTokens;
            console.info(`Fallback: Switching to 'max_completion_tokens' for model ${model}`);
          } else {
            payload.max_tokens = maxOutputTokens;
            console.info(`Fallback: Switching to 'max_tokens' for model ${model}`);
          }
        } else if (modelStr.includes('claude') || modelStr.includes('perplexity')) {
          payload.max_tokens = maxOutputTokens;
          console.info(`Using 'max_tokens' parameter for model ${model}`);
        }
      } else {
        console.info(`Skipping token limit parameters for OpenAI model ${model} as they're optional`);
      }

      // Handle messages based on model type
      // o1 and o3 models don't support 'system' role
      if (modelStr.startsWith('o1') || modelStr.startsWith('o3')) {
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

      // Check if we should request JSON output format - be more selective to avoid unnecessary use
      const jsonFormatPatterns = [
        'return json',
        'respond in json',
        'output in json',
        'json format',
        'json response',
        'return a json',
        'provide json',
        'as json',
        'json object'
      ];
      
      // Check if any of the patterns are present in the prompts
      const requestsJson = jsonFormatPatterns.some(pattern => {
        const inSystemPrompt = systemPrompt?.toLowerCase().includes(pattern);
        const inUserPrompt = userPrompt.toLowerCase().includes(pattern);
        if (inSystemPrompt || inUserPrompt) {
          console.info(`JSON format detected: found pattern "${pattern}" in ${inSystemPrompt ? 'system prompt' : 'user prompt'}`);
          return true;
        }
        return false;
      });
      
      if (requestsJson) {
        // OpenAI requires the word "json" to be in the messages when using JSON response format
        payload.response_format = { type: "json_object" };
        console.info('Requesting JSON response format');
        
        // Make sure "json" appears in at least one message to satisfy OpenAI's requirement
        const containsJsonWord = payload.messages.some(msg => {
          const contains = msg.content && msg.content.toLowerCase().includes('json');
          if (contains) {
            console.info(`Message with role ${msg.role} already contains the word "json"`);
          }
          return contains;
        });
        
        if (!containsJsonWord) {
          console.info('Adding "json" requirement to the user message to satisfy OpenAI API');
          
          // Find the user message to append to
          const userMsgIndex = payload.messages.findIndex(msg => msg.role === 'user');
          
          if (userMsgIndex >= 0) {
            // Append to existing user message
            payload.messages[userMsgIndex].content += '\n\nPlease provide your response in JSON format.';
          } else if (payload.messages.length > 0) {
            // Append to the last message if no user message found
            payload.messages[payload.messages.length - 1].content += '\n\nPlease provide your response in JSON format.';
          }
        }
      }

      // Only add temperature for models that support it
      // Reasoning models (o1, o1-mini, o3-mini) don't support temperature
      if (!modelStr.startsWith('o1') && !modelStr.startsWith('o3')) {
        payload.temperature = 0.7;
      }

      console.info(`Payload structure: ${JSON.stringify({
        model: payload.model,
        messageCount: payload.messages.length,
        firstMessageRole: payload.messages[0]?.role,
        messageTypes: payload.messages.map(m => m.role).join(','),
        tokenParam: payload.max_tokens ? 'max_tokens' : 'max_completion_tokens',
        tokenValue: payload.max_tokens || payload.max_completion_tokens,
        modelMaxLimit: getMaxCompletionTokens(model),
        estimatedPromptTokens: estimateTokenCount(systemPrompt || '') + estimateTokenCount(userPrompt || ''),
        responseFormat: payload.response_format?.type || 'text'
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
        contentLength: data.choices?.[0]?.message?.content?.length || 0,
        finishReason: data.choices?.[0]?.finish_reason || 'unknown'
      })}`);
      
      // Validate response structure
      if (!data || !data.choices || !data.choices.length) {
        console.error('❌ Invalid response structure from OpenAI:', JSON.stringify(data));
        throw new Error('Invalid response structure from OpenAI API');
      }
      
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        console.error('❌ Empty content in OpenAI response:', JSON.stringify(data.choices[0]));
        
        // Enhanced logging for troubleshooting empty content issues
        console.error('Response debug info:', {
          model,
          finishReason: data.choices[0]?.finish_reason,
          promptLength: (systemPrompt?.length || 0) + (userPrompt?.length || 0), 
          tokensRequested: payload.max_tokens || 'not specified', // Updated to handle missing token parameters
          modelMaxLimit: getMaxCompletionTokens(model),
          tokensAvailable: data.model_context_size || 'unknown',
          promptTokens: data.usage?.prompt_tokens || 'unknown',
          completionTokens: data.usage?.completion_tokens || 'unknown',
          totalTokens: data.usage?.total_tokens || 'unknown'
        });
        
        // Check if it's due to length constraint
        if (data.choices[0]?.finish_reason === 'length') {
          console.warn('Response was truncated due to length constraints. Switching to chunked processing strategy...');
          
          // Directly switch to chunked processing for more reliable handling of complex/long prompts
          console.info('Using chunked processing to handle length constraint issue');
          return processWithChunkedStrategy('openai', model, systemPrompt, userPrompt, apiKey);
          
        } else if (data.choices[0]?.finish_reason === 'content_filter') {
          throw new Error(`The ${model} API returned an empty response due to content filter. Please modify your input and try again.`);
        } else {
          throw new Error(`The ${model} API returned an empty response. Please check your API key and configuration.`);
        }
      }
      
      // Check if content is valid JSON when requested
      if (payload.response_format?.type === 'json_object') {
        try {
          JSON.parse(content);
        } catch (jsonError) {
          console.warn('Response was supposed to be JSON but failed to parse:', jsonError);
        }
      }
      
      return content;
    } catch (error: any) {
      // Handle errors more robustly based on error message content
      if (!isTryingFallbackParameters) {
        // Check for parameter errors
        const errorMsg = error.message || '';
        const isParameterError = errorMsg.includes('Unsupported parameter') || 
                                errorMsg.includes('is not supported with this model');
        
        // Skip parameter fallback logic for OpenAI models since we're removing those parameters
        if (isParameterError && !String(model).toLowerCase().startsWith('gpt-')) {
          console.warn('Parameter error detected. Trying alternative parameter format...');
          isTryingFallbackParameters = true;
          throw new Error(`[Parameter error] ${error.message}. Attempting to use alternative parameter.`);
        }
      }
      
      throw error; // Let the outer catch handle other errors
    }
  };

  try {
    return await tryCall();
  } catch (error: any) {
    // If we got a parameter error and haven't tried the alternative yet, try with the other parameter
    if (!isTryingFallbackParameters) {
      const errorMsg = error.message || '';
      const isParameterError = errorMsg.includes('Unsupported parameter') || 
                              errorMsg.includes('is not supported with this model');
      
      // Skip parameter fallback logic for OpenAI models since we're removing those parameters
      if (isParameterError && !String(model).toLowerCase().startsWith('gpt-')) {
        console.warn('Parameter error detected in outer handler. Trying alternative parameter format...');
        isTryingFallbackParameters = true;
        try {
          return await tryCall(true);
        } catch (fallbackError: any) {
          console.error('Fallback attempt also failed:', fallbackError);
          throw fallbackError; // Propagate the error from the fallback attempt
        }
      }
    }

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
