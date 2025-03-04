
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
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
      // Using max_completion_tokens instead of max_tokens for newer models
      max_completion_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

async function callPerplexity(
  apiKey: string,
  model: AIModel,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
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
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Perplexity API error: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}
