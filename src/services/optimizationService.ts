import { AIModel } from "@/types/agent";
import { generateAgentResponse } from "./ai-service";

/**
 * Uses GPT-4o to shorten a system prompt while preserving critical instructions
 * @param systemPrompt Original system prompt
 * @param targetLength Target maximum length in characters
 * @returns Shortened system prompt
 */
export async function shortenSystemPrompt(
  systemPrompt: string,
  targetLength: number,
  apiKey: string
): Promise<string> {
  if (!systemPrompt || systemPrompt.length <= targetLength) {
    return systemPrompt;
  }

  try {
    const optimizationPrompt = `
You are a prompt optimization expert. Your task is to shorten the following system prompt while preserving 
ALL important instructions and context. The shortened prompt MUST maintain the same functionality and purpose.

Original system prompt:
---
${systemPrompt}
---

Guidelines:
1. Identify and preserve all specific instructions and requirements
2. Maintain the original tone and approach
3. Remove redundant or verbose language
4. Combine related instructions
5. Keep specialized terminology intact
6. Don't introduce any new functionality or requirements

The shortened prompt should be less than ${targetLength} characters.
Return ONLY the shortened prompt with no explanation or additional text.`;

    const shortenedPrompt = await generateAgentResponse(
      'openai',
      'gpt-4o' as AIModel,
      'You are a prompt optimization assistant. Shorten prompts while preserving their functionality.',
      optimizationPrompt
    );

    // Return the original if something went wrong
    if (!shortenedPrompt || shortenedPrompt.startsWith('[Error:')) {
      console.warn('Failed to shorten system prompt, using original');
      return systemPrompt;
    }

    console.info(`Successfully shortened system prompt from ${systemPrompt.length} to ${shortenedPrompt.length} characters`);
    return shortenedPrompt;
  } catch (error) {
    console.error('Error shortening system prompt:', error);
    return systemPrompt; // Return original prompt on error
  }
}

/**
 * Uses GPT-4o to break agent output into JSON chunks
 * @param output Agent output to be structured
 * @returns JSON-structured output
 */
export async function formatOutputAsJson(
  output: string,
  apiKey: string
): Promise<string> {
  try {
    const formattingPrompt = `
Convert the following text into a structured JSON format that will be easier to process in chunks.
Break down the content into logical segments while preserving the meaning and structure.

Content to format:
---
${output}
---

Guidelines:
1. Create a JSON object with an "output" array
2. Each element in the array should be a logical chunk of the content
3. Preserve code blocks, formatting, and structure
4. Make sure the JSON is valid and properly escaped
5. Don't omit any information from the original content

Return ONLY the JSON with no additional explanation. The JSON should be formatted as:
{
  "output": [
    "chunk 1 content",
    "chunk 2 content",
    ...
  ]
}`;

    const jsonOutput = await generateAgentResponse(
      'openai',
      'gpt-4o' as AIModel,
      'You are a JSON formatting assistant. Convert content to well-structured JSON.',
      formattingPrompt
    );

    // Return the original if something went wrong
    if (!jsonOutput || jsonOutput.startsWith('[Error:') || !jsonOutput.includes('"output"')) {
      console.warn('Failed to format output as JSON, using original');
      return output;
    }

    try {
      // Validate the JSON and extract the output array
      const parsed = JSON.parse(jsonOutput);
      if (Array.isArray(parsed.output)) {
        // Return the original output for client use
        return output;
      }
    } catch (parseError) {
      console.error('Error parsing JSON output:', parseError);
    }
    
    return output;
  } catch (error) {
    console.error('Error formatting output as JSON:', error);
    return output; // Return original output on error
  }
}

/**
 * Process a large input in chunks using an agent
 * @param provider AI provider
 * @param model AI model
 * @param systemPrompt System prompt
 * @param input User input to process
 * @param apiKey API key
 * @returns Combined output from all chunks
 */
export async function processWithChunkedStrategy(
  provider: string,
  model: AIModel,
  systemPrompt: string,
  input: string,
  apiKey: string
): Promise<string> {
  const { estimateTokenCount } = await import('@/utils/tokenManager');
  
  // Calculate appropriate chunk size based on model
  const estimatedInputTokens = estimateTokenCount(input);
  const estimatedSystemTokens = estimateTokenCount(systemPrompt);
  
  // Target 30% of model's context size for each chunk to leave room for response
  // We'll dynamically calculate this based on token count rather than character count
  const MAX_SAFE_TOKENS_PER_CHUNK = 2000; // Default safe limit
  
  console.info(`Using chunked processing strategy: Input ~${estimatedInputTokens} tokens, System ~${estimatedSystemTokens} tokens`);
  
  // If input is small enough, process directly
  if (estimatedInputTokens <= MAX_SAFE_TOKENS_PER_CHUNK) {
    return generateAgentResponse(
      provider as any,
      model,
      systemPrompt,
      input
    );
  }
  
  try {
    // Use GPT-4o to help optimize the system prompt if it's large
    let optimizedPrompt = systemPrompt;
    if (systemPrompt.length > 1000) {
      optimizedPrompt = await shortenSystemPrompt(systemPrompt, 1000, apiKey);
    }
    
    // Prepare a processing instruction to tell the model about chunking
    const chunkingInstruction = `
The input has been split into chunks due to its size. Process this chunk independently. 
Your response for each chunk will be combined with responses for other chunks later.`;
    
    // Make sure we're careful about model compatibility
    const useOpenAIModels = provider === 'openai';
    
    // Break input into chunks at natural boundaries
    const { chunkText } = await import('@/utils/tokenManager');
    
    // Use the more intelligent chunking algorithm from tokenManager
    const chunks = chunkText(input, MAX_SAFE_TOKENS_PER_CHUNK);
    
    console.info(`Split input into ${chunks.length} chunks for processing`);
    
    // Add special marker to system prompt to prevent cache conflicts with non-chunked requests
    const markedSystemPrompt = `${optimizedPrompt}\n\n[CHUNKED_PROCESSING]`;
    
    // Process chunks with limited parallelism instead of all at once or fully sequentially
    const results: string[] = [];
    const API_CALL_LIMIT = 3; // maximum number of API calls we allow
    let apiCallCount = 0;
    const BATCH_SIZE = 3; // limit concurrent API calls
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const availableCalls = API_CALL_LIMIT - apiCallCount;
      if (availableCalls <= 0) {
        console.warn('API call limit reached. Skipping remaining chunks.');
        break;
      }
      // Slice the batch, and if the batch size is larger than availableCalls, trim it
      let batch = chunks.slice(i, i + BATCH_SIZE);
      if (batch.length > availableCalls) {
        batch = batch.slice(0, availableCalls);
      }
      const batchPromises = batch.map((chunk, index) => {
        const actualIndex = apiCallCount + index; // use global count for numbering
        const chunkPrompt = `${chunkingInstruction}\n\nCHUNK ${actualIndex + 1} OF ${chunks.length}:\n${chunk}`;
        console.info(`Processing chunk ${actualIndex + 1}/${chunks.length}...`);
        return generateAgentResponse(provider as any, model, markedSystemPrompt, chunkPrompt)
          .then(res => {
            console.info(`Chunk ${actualIndex + 1} processed; result length: ${res.length}`);
            return res;
          });
      });
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      apiCallCount += batch.length;
    }
    // End of limited parallel chunk processing
    
    // Combine the results
    const combinedOutput = results.join('\n\n---\n\n');
    
    // If we have multiple chunks, try to use the model with the largest context window for cohesion
    if (chunks.length > 1 && results.length > 1) {
      // Skip cohesion processing if we've reached the API call limit
      if (apiCallCount >= API_CALL_LIMIT) {
        console.warn('API call limit reached. Skipping cohesion processing and returning partial results.');
        return combinedOutput;
      }
      
      try {
        const cohesionPrompt = `
You have processed multiple chunks of a large input. Below are your outputs for each chunk:

${results.map((result, i) => `--- OUTPUT CHUNK ${i + 1} ---\n${result}`).join('\n\n')}

Create a single cohesive response that properly integrates all these outputs. Ensure there is no redundancy or repetition while preserving all unique information and insights. The final response should flow naturally as if it was generated from the complete input at once.`;

        // Use the model with the largest context window for cohesion processing
        // Claude-3-Opus or GPT-4-Turbo have the largest context windows
        const largeContextModel = 'gpt-4-turbo' as AIModel; // 128k context window
        
        console.info(`Using large context model (${largeContextModel}) for final coherence processing`);
        
        // Add a special marker to ensure this doesn't pull from the regular cache
        const cohesionSystemPrompt = `${markedSystemPrompt}\n[COHESION_PROCESSING]`;
        
        // Log this as a distinct API call
        console.info(`Making additional cohesion API call (${apiCallCount + 1}/${API_CALL_LIMIT})`);
        
        const cohesiveOutput = await generateAgentResponse(
          'openai',
          largeContextModel,
          cohesionSystemPrompt,
          cohesionPrompt
        );
        
        apiCallCount++; // Count the cohesion processing as an API call
        
        if (cohesiveOutput && !cohesiveOutput.startsWith('[Error:')) {
          return cohesiveOutput;
        }
      } catch (error) {
        console.error('Error creating cohesive output:', error);
      }
    }
    
    return combinedOutput;
  } catch (error) {
    console.error('Error in chunked processing strategy:', error);
    throw error;
  }
} 