callOpenAI = async (
  model: string,
  messages: any[],
  temperature: number,
  maxTokens: number,
  topP: number,
  frequencyPenalty: number,
  presencePenalty: number
) => {
  try {
    // Determine which token parameter to use based on model name
    // Models starting with 'o' (like o3-mini) or containing 'gpt-4o' use max_completion_tokens
    // Models starting with 'gpt' use max_tokens
    const tokenParam = model.startsWith('o') || model.includes('gpt-4o')
      ? { max_completion_tokens: maxTokens }
      : { max_tokens: maxTokens };

    const requestBody: any = {
      model: model,
      messages: messages,
      temperature: temperature,
      ...tokenParam,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
    };

    // ... existing code ...
  } catch (error) {
    // ... existing code ...
    // Remove the retry logic since we're handling the parameter choice deterministically
    // ... existing code ...
  }
}; 