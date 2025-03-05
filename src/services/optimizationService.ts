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
  const MAX_CHUNK_CHARS = 6000; // Adjust based on your models
  
  // If input is small enough, process directly
  if (input.length <= MAX_CHUNK_CHARS) {
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
    const chunks: string[] = [];
    let remaining = input;
    
    while (remaining.length > 0) {
      // Find a natural breaking point
      let breakPoint = MAX_CHUNK_CHARS;
      if (remaining.length > MAX_CHUNK_CHARS) {
        // Look for paragraph breaks
        const paragraphBreak = remaining.lastIndexOf('\n\n', MAX_CHUNK_CHARS);
        if (paragraphBreak > MAX_CHUNK_CHARS * 0.5) {
          breakPoint = paragraphBreak + 2;
        } else {
          // Look for sentence breaks
          const sentenceBreak = Math.max(
            remaining.lastIndexOf('. ', MAX_CHUNK_CHARS),
            remaining.lastIndexOf('! ', MAX_CHUNK_CHARS),
            remaining.lastIndexOf('? ', MAX_CHUNK_CHARS)
          );
          if (sentenceBreak > MAX_CHUNK_CHARS * 0.5) {
            breakPoint = sentenceBreak + 2;
          }
        }
      } else {
        breakPoint = remaining.length;
      }
      
      chunks.push(remaining.substring(0, breakPoint));
      remaining = remaining.substring(breakPoint);
    }
    
    console.info(`Split input into ${chunks.length} chunks for processing`);
    
    // Process chunks in parallel for efficiency
    const results = await Promise.all(
      chunks.map((chunk, index) => {
        const chunkPrompt = `${chunkingInstruction}\n\nCHUNK ${index + 1} OF ${chunks.length}:\n${chunk}`;
        
        // We use generateAgentResponse to handle the actual API calls
        // This ensures consistent error handling and parameter selection
        return generateAgentResponse(
          provider as any,
          model,
          optimizedPrompt,
          chunkPrompt
        );
      })
    );
    
    // Combine the results
    const combinedOutput = results.join('\n\n---\n\n');
    
    // If we have multiple chunks, try to use GPT-4o to create a cohesive output
    if (chunks.length > 1) {
      try {
        const cohesionPrompt = `
You have processed multiple chunks of a large input. Below are your outputs for each chunk:

${results.map((result, i) => `--- OUTPUT CHUNK ${i + 1} ---\n${result}`).join('\n\n')}

Create a single cohesive response that properly integrates all these outputs. Ensure there is no redundancy or repetition while preserving all unique information and insights. The final response should flow naturally as if it was generated from the complete input at once.`;

        // Always use standard OpenAI model for coherence processing
        const cohesiveOutput = await generateAgentResponse(
          'openai',
          'gpt-4o' as AIModel,
          optimizedPrompt,
          cohesionPrompt
        );
        
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