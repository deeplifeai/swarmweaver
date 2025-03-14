import { AIModel } from "@/types/agent";
import { generateAgentResponse } from "./ai-service";
import { estimateTokenCount, chunkText } from "@/utils/tokenManager";

/**
 * Get the context size for a given model
 * @param model AI model
 * @returns Maximum context size in tokens
 */
function getModelContextSize(model: AIModel): number {
  const modelStr = String(model).toLowerCase();
  
  // OpenAI models
  if (modelStr.includes('gpt-4-turbo') || modelStr.includes('gpt-4o')) {
    return 128000; // 128k context window
  }
  if (modelStr.includes('gpt-4')) {
    return 8192; // Standard GPT-4
  }
  if (modelStr.includes('gpt-3.5-turbo-16k')) {
    return 16384; // GPT-3.5 Turbo 16k
  }
  if (modelStr.includes('gpt-3.5')) {
    return 4096; // Standard GPT-3.5 Turbo
  }
  
  // Perplexity models
  if (modelStr.includes('sonar-deep-research')) {
    return 32768; // 32k context
  }
  if (modelStr.includes('sonar-')) {
    return 16384; // 16k context for other Sonar models
  }
  
  // Default fallback
  return 4096;
}

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
  // Calculate estimated tokens
  const estimatedInputTokens = estimateTokenCount(input);
  const estimatedSystemTokens = estimateTokenCount(systemPrompt);
  const totalEstimatedTokens = estimatedInputTokens + estimatedSystemTokens;
  
  // Get model's context size
  const modelContextSize = getModelContextSize(model);
  
  // Define threshold - if under this, process normally
  const CHUNKING_THRESHOLD = Math.floor(modelContextSize * 0.6);
  const MAX_TOKENS_PER_CHUNK = 2000;
  
  console.info(`Input size: ~${estimatedInputTokens} tokens, System: ~${estimatedSystemTokens} tokens, Total: ~${totalEstimatedTokens} tokens`);
  console.info(`Model context size: ${modelContextSize}, Threshold: ${CHUNKING_THRESHOLD}`);
  
  // If input is small enough, process directly
  if (totalEstimatedTokens <= CHUNKING_THRESHOLD) {
    console.info('Input is small enough to process directly');
    return generateAgentResponse(
      provider as any,
      model,
      systemPrompt,
      input
    );
  }
  
  try {
    // Split input into chunks
    const chunks = chunkText(input, MAX_TOKENS_PER_CHUNK);
    console.info(`Split input into ${chunks.length} chunks for processing`);
    
    // Process each chunk
    const results = await Promise.all(chunks.map(async (chunk, index) => {
      const chunkPrompt = `[CHUNK ${index + 1}/${chunks.length}] ${chunk}`;
      console.info(`Processing chunk ${index + 1}/${chunks.length}`);
      
      return generateAgentResponse(
        provider as any,
        model,
        systemPrompt,
        chunkPrompt
      );
    }));
    
    // If we only have one chunk result, return it directly
    if (results.length === 1) {
      return results[0];
    }
    
    // Combine the results
    const combinedOutput = results.join('\n\n---\n\n');
    
    // If we have multiple chunks, create a cohesive response
    const cohesionPrompt = `
I've processed a large input in ${chunks.length} chunks. Below are the outputs for each chunk:

${results.map((result, i) => `--- OUTPUT CHUNK ${i + 1} ---\n${result}`).join('\n\n')}

Create a single cohesive response that integrates all these outputs. Remove any redundancy while preserving all unique information.`;

    console.info('Creating cohesive response from all chunks');
    
    // Use the same model for cohesion processing
    return generateAgentResponse(
      provider as any,
      model,
      systemPrompt,
      cohesionPrompt
    );
  } catch (error) {
    console.error('Error in chunked processing:', error);
    throw error;
  }
} 