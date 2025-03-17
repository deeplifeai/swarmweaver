import { AIModel } from "@/types/agent";
import { AIService } from "./ai-service";
import { container } from "./di/container";
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

export class OptimizationService {
  private aiService: AIService;

  constructor() {
    this.aiService = container.resolve<AIService>('AIService');
  }

  async optimizePrompt(prompt: string): Promise<string> {
    const systemPrompt = `You are an AI prompt optimization expert. Your task is to analyze and improve the given prompt to make it more effective, clear, and likely to generate better responses. Consider:
1. Clarity and specificity
2. Structure and organization
3. Essential context
4. Constraints and requirements
5. Examples where helpful
6. Proper formatting`;

    try {
      return await this.aiService.getCompletion(
        'anthropic',
        'claude-3-sonnet-20240229',
        systemPrompt,
        prompt,
        {
          temperature: 0.7,
          maxTokens: 2048
        }
      );
    } catch (error) {
      console.error('Error optimizing prompt:', error);
      throw error;
    }
  }

  async analyzePromptQuality(prompt: string): Promise<string> {
    const systemPrompt = `You are a prompt quality analysis expert. Evaluate the given prompt and provide a detailed analysis of its strengths and weaknesses. Consider:
1. Clarity and ambiguity
2. Completeness of context
3. Potential for misinterpretation
4. Effectiveness for intended purpose
5. Areas for improvement`;

    try {
      return await this.aiService.getCompletion(
        'anthropic',
        'claude-3-sonnet-20240229',
        systemPrompt,
        prompt,
        {
          temperature: 0.7,
          maxTokens: 2048
        }
      );
    } catch (error) {
      console.error('Error analyzing prompt quality:', error);
      throw error;
    }
  }

  async shortenPrompt(prompt: string, maxTokens: number): Promise<string> {
    const currentTokens = estimateTokenCount(prompt);
    if (currentTokens <= maxTokens) {
      return prompt;
    }

    const systemPrompt = `You are a prompt optimization expert. Your task is to shorten the given prompt while preserving its essential meaning and requirements. The shortened version should be no more than ${maxTokens} tokens.`;

    try {
      const shortenedPrompt = await this.aiService.getCompletion(
        'anthropic',
        'claude-3-sonnet-20240229',
        systemPrompt,
        prompt,
        {
          temperature: 0.7,
          maxTokens: maxTokens
        }
      );

      if (estimateTokenCount(shortenedPrompt) > maxTokens) {
        throw new Error('Failed to shorten prompt within token limit');
      }

      return shortenedPrompt;
    } catch (error) {
      console.error('Error shortening prompt:', error);
      throw error;
    }
  }

  async shortenSystemPrompt(systemPrompt: string, targetLength: number): Promise<string> {
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

      const shortenedPrompt = await this.aiService.getCompletion(
        'openai',
        'gpt-4-turbo-preview',
        'You are a prompt optimization assistant. Shorten prompts while preserving their functionality.',
        optimizationPrompt,
        {
          temperature: 0.7,
          maxTokens: 2048
        }
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

  async formatOutputAsJson(output: string): Promise<string> {
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

      const jsonOutput = await this.aiService.getCompletion(
        'openai',
        'gpt-4-turbo-preview',
        'You are a JSON formatting assistant. Convert content to well-structured JSON.',
        formattingPrompt,
        {
          temperature: 0.3,
          maxTokens: 2048
        }
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

  async convertToJSON(prompt: string): Promise<object> {
    const systemPrompt = `You are a prompt structure analyzer. Convert the given prompt into a JSON format that captures its key components, requirements, and constraints.`;

    try {
      const jsonOutput = await this.aiService.getCompletion(
        'anthropic',
        'claude-3-sonnet-20240229',
        systemPrompt,
        prompt,
        {
          temperature: 0.3,
          maxTokens: 2048
        }
      );

      return JSON.parse(jsonOutput);
    } catch (error) {
      console.error('Error converting prompt to JSON:', error);
      throw error;
    }
  }

  async expandPrompt(prompt: string): Promise<string> {
    const systemPrompt = `You are a prompt enhancement expert. Expand the given prompt by adding helpful context, examples, and clarifications while maintaining its original intent.`;

    return await this.aiService.getCompletion(
      'anthropic',
      'claude-3-sonnet-20240229',
      systemPrompt,
      prompt,
      {
        temperature: 0.7,
        maxTokens: 2048
      }
    );
  }

  async addExamples(prompt: string): Promise<string> {
    try {
      return await this.aiService.getCompletion(
        'anthropic',
        'claude-3-sonnet-20240229',
        'You are a prompt enhancement expert. Add relevant examples to the given prompt to make it clearer and more effective.',
        prompt,
        {
          temperature: 0.7,
          maxTokens: 2048
        }
      );
    } catch (error) {
      console.error('Error adding examples to prompt:', error);
      throw error;
    }
  }

  async addConstraints(prompt: string): Promise<string> {
    return await this.aiService.getCompletion(
      'anthropic',
      'claude-3-sonnet-20240229',
      'You are a prompt refinement expert. Add appropriate constraints and requirements to the given prompt to make it more precise and effective.',
      prompt,
      {
        temperature: 0.7,
        maxTokens: 2048
      }
    );
  }

  async processWithChunkedStrategy(
    provider: string,
    model: AIModel,
    systemPrompt: string,
    input: string
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
      return this.aiService.getCompletion(
        provider as any,
        model,
        systemPrompt,
        input,
        {
          temperature: 0.7,
          maxTokens: 2048
        }
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
        
        return this.aiService.getCompletion(
          provider as any,
          model,
          systemPrompt,
          chunkPrompt,
          {
            temperature: 0.7,
            maxTokens: 2048
          }
        );
      }));
      
      // If we only have one chunk result, return it directly
      if (results.length === 1) {
        return results[0];
      }
      
      // If we have multiple chunks, create a cohesive response
      const cohesionPrompt = `
I've processed a large input in ${chunks.length} chunks. Below are the outputs for each chunk:

${results.map((result, i) => `--- OUTPUT CHUNK ${i + 1} ---\n${result}`).join('\n\n')}

Create a single cohesive response that integrates all these outputs. Remove any redundancy while preserving all unique information.`;

      console.info('Creating cohesive response from all chunks');
      
      // Use the same model for cohesion processing
      return this.aiService.getCompletion(
        provider as any,
        model,
        systemPrompt,
        cohesionPrompt,
        {
          temperature: 0.7,
          maxTokens: 2048
        }
      );
    } catch (error) {
      console.error('Error in chunked processing:', error);
      throw error;
    }
  }
} 