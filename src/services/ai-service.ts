import { AIModel, AIProvider } from '@/types/agent';
import { useAgentStore } from '@/store/agentStore';

export async function generateAgentResponse(
  provider: AIProvider,
  model: AIModel,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const apiKey = useAgentStore.getState().apiKey[provider];
  
  if (!apiKey) {
    throw new Error(`No API key set for ${provider}`);
  }

  try {
    if (provider === 'openai') {
      return await callOpenAI(apiKey, model, systemPrompt, userPrompt);
    } else if (provider === 'perplexity') {
      return await callPerplexity(apiKey, model, systemPrompt, userPrompt);
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }
  } catch (error) {
    console.error('Error generating agent response:', error);
    throw error;
  }
}

async function callOpenAI(
  apiKey: string,
  model: AIModel,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  try {
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
      } else {
        payload.messages.push({ role: 'user', content: userPrompt });
      }
    } else {
      // For other models, use standard system and user messages
      if (systemPrompt) {
        payload.messages.push({ role: 'system', content: systemPrompt });
      }
      payload.messages.push({ role: 'user', content: userPrompt });
    }

    // Add max_completion_tokens for all models
    payload.max_completion_tokens = 1000;

    // Only add temperature for models that support it
    // Reasoning models (o1, o1-mini, o3-mini) don't support temperature
    if (!model.toString().startsWith('o1') && !model.toString().startsWith('o3')) {
      payload.temperature = 0.7;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMessage = 'Unknown error';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || 
                      errorData.error?.code || 
                      `HTTP error ${response.status}`;
      } catch (parseError) {
        errorMessage = `HTTP error ${response.status}: ${response.statusText}`;
      }
      throw new Error(`OpenAI API error: ${errorMessage}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  } catch (error: any) {
    // Handle network errors or other exceptions
    if (error.name === 'AbortError') {
      throw new Error('OpenAI API request timed out');
    }
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      throw new Error('Network error when calling OpenAI API');
    }
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
