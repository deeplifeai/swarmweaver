import { AIModel } from "@/types/agent";

// Basic token estimation based on character count
// This is a rough approximation - for production, use a proper tokenizer
export function estimateTokenCount(text: string): number {
  // On average, 1 token is roughly 4 characters for English text
  return Math.ceil(text.length / 4);
}

// Get model context window size
export function getModelContextSize(model: AIModel): number {
  // These are approximate context window sizes
  if (typeof model === 'string') {
    if (model.includes('gpt-4-turbo')) return 128000;
    if (model.includes('gpt-4o')) return 128000;
    if (model.includes('gpt-4')) return 8192;
    if (model.includes('gpt-3.5-turbo-16k')) return 16384;
    if (model.includes('gpt-3.5-turbo')) return 4096;
    if (model.includes('claude-3-opus')) return 200000;
    if (model.includes('claude-3-sonnet')) return 200000;
    if (model.includes('claude-3-haiku')) return 200000;
    if (model.includes('claude-2')) return 100000;
    if (model.includes('claude-1')) return 100000;
    if (model.includes('o1')) return 32768;
    if (model.includes('o3')) return 32768;
  }
  // Default for unknown models
  return 4096;
}

// Get maximum allowed completion tokens for a model
export function getMaxCompletionTokens(model: AIModel): number {
  // These are the maximum allowed completion tokens for each model
  if (typeof model === 'string') {
    const modelStr = model.toLowerCase();
    
    // OpenAI models
    if (modelStr.includes('gpt-4-turbo') || modelStr.includes('gpt-4o')) return 3500;
    if (modelStr.includes('gpt-4-32k')) return 8000;
    if (modelStr.includes('gpt-4')) return 3500;
    if (modelStr.includes('gpt-3.5-turbo-16k')) return 3800;
    if (modelStr.includes('gpt-3.5-turbo')) return 1800;
    
    // Anthropic Claude models
    if (modelStr.includes('claude-3-opus')) return 3800;
    if (modelStr.includes('claude-3-sonnet')) return 3800;
    if (modelStr.includes('claude-3-haiku')) return 1800;
    if (modelStr.includes('claude-2')) return 3800;
    if (modelStr.includes('claude-1')) return 3800;
    
    // OpenRouter models
    if (modelStr.includes('o1')) return 8192;
    if (modelStr.includes('o3')) return 8192;
    
    // Perplexity models
    if (modelStr.includes('sonar')) return 4096;
    if (modelStr.includes('pplx')) return 4096;
  }
  
  // Default conservative limit for unknown models
  return 2048;
}

// Calculate max output tokens based on input size and model
export function calculateMaxOutputTokens(
  systemPrompt: string,
  userPrompt: string,
  model: AIModel,
  minOutputTokens: number = 500
): number {
  const modelContextSize = getModelContextSize(model);
  const maxAllowedCompletionTokens = getMaxCompletionTokens(model);
  const estimatedSystemTokens = estimateTokenCount(systemPrompt || '');
  const estimatedUserTokens = estimateTokenCount(userPrompt || '');
  
  // Reserve tokens for system prompt, user input, and minimum expected output
  const reservedTokens = estimatedSystemTokens + estimatedUserTokens;
  
  // For larger prompts, use a more conservative safety margin
  let safetyFactor = 0.8; // Default 80% safety margin
  
  // Apply more conservative limits as prompts get larger to prevent hitting context boundaries
  if (reservedTokens > modelContextSize * 0.5) {
    // If prompt is using more than 50% of context window, reduce output allocation
    safetyFactor = 0.7;
  }
  if (reservedTokens > modelContextSize * 0.7) {
    // If prompt is very large (>70% of context), be even more conservative
    safetyFactor = 0.6;
  }
  
  // Add a small buffer for token counting inaccuracies (tiktoken vs. model's actual counting)
  const tokenCountingBuffer = 100;
  
  // Calculate available tokens for completion with buffer
  const availableTokens = Math.max(0, modelContextSize - reservedTokens - tokenCountingBuffer);
  
  // Use the smaller of:
  // 1. Available tokens in the context (with buffer)
  // 2. Max allowed completion tokens for this model
  // 3. Safety percentage of model context size
  const maxOutputTokens = Math.min(
    availableTokens, 
    maxAllowedCompletionTokens,
    Math.floor(modelContextSize * safetyFactor)
  );
  
  // For very long prompts that leave little room, ensure we have at least some minimal space
  // but don't exceed what's actually available
  const minimumSafeTokens = Math.min(minOutputTokens, Math.max(300, availableTokens * 0.5));
  
  // Ensure we don't return a value less than our calculated minimum, unless the model can't support it
  return Math.max(Math.min(minimumSafeTokens, maxAllowedCompletionTokens), maxOutputTokens);
}

// Intelligent chunking that preserves code blocks, sentences, and paragraphs
export function chunkText(text: string, maxChunkTokens: number): string[] {
  if (estimateTokenCount(text) <= maxChunkTokens) {
    return [text];
  }

  const chunks: string[] = [];
  let currentChunk = '';
  
  // Split by natural boundaries: paragraphs and code blocks
  const blocks = splitIntoBlocks(text);
  
  for (const block of blocks) {
    const blockTokens = estimateTokenCount(block);
    
    // If a single block is too large, we need to split it
    if (blockTokens > maxChunkTokens) {
      // Handle code blocks differently - don't split them if possible
      if (isCodeBlock(block)) {
        // If it's a huge code block, we have to chunk it
        const codeChunks = splitCodeBlock(block, maxChunkTokens);
        for (const codeChunk of codeChunks) {
          chunks.push(codeChunk);
        }
      } else {
        // Text block - split by sentences
        const sentenceChunks = splitTextBlock(block, maxChunkTokens);
        for (const sentenceChunk of sentenceChunks) {
          chunks.push(sentenceChunk);
        }
      }
    } else if (estimateTokenCount(currentChunk + block) > maxChunkTokens) {
      // Current chunk would be too big with this block, start a new one
      chunks.push(currentChunk);
      currentChunk = block;
    } else {
      // Add to current chunk
      currentChunk += (currentChunk ? '\n\n' : '') + block;
    }
  }
  
  // Add the last chunk if it's not empty
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

// Helper to detect if a text block is code
function isCodeBlock(text: string): boolean {
  // Simple detection - more precise detection would require parsing
  const codeIndicators = [
    text.includes('```'),
    text.includes('function '),
    text.includes('class '),
    text.includes('import '),
    text.includes('const '),
    text.includes('let '),
    text.includes('var '),
    text.includes(';') && text.includes('{'),
    /^\s*[{}[\]()=><\/\\|:;]/.test(text)
  ];
  
  return codeIndicators.filter(Boolean).length >= 2;
}

// Split text into blocks (paragraphs and code blocks)
function splitIntoBlocks(text: string): string[] {
  const blocks: string[] = [];
  let inCodeBlock = false;
  let currentBlock = '';
  
  // Split by lines first
  const lines = text.split('\n');
  
  for (const line of lines) {
    // Check for code block delimiters
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      currentBlock += line + '\n';
      
      // If exiting a code block, push it and start a new block
      if (!inCodeBlock) {
        blocks.push(currentBlock);
        currentBlock = '';
      }
    } else {
      // If in a code block, keep appending
      if (inCodeBlock) {
        currentBlock += line + '\n';
      } else {
        // For regular text, check for paragraph breaks
        if (line.trim() === '') {
          if (currentBlock.trim()) {
            blocks.push(currentBlock);
            currentBlock = '';
          }
        } else {
          currentBlock += (currentBlock ? '\n' : '') + line;
        }
      }
    }
  }
  
  // Add any remaining block
  if (currentBlock.trim()) {
    blocks.push(currentBlock);
  }
  
  return blocks;
}

// Split a large code block
function splitCodeBlock(codeBlock: string, maxChunkTokens: number): string[] {
  const chunks: string[] = [];
  let currentChunk = '';
  
  // Try to keep functions together
  const lines = codeBlock.split('\n');
  let currentFunction = '';
  
  for (const line of lines) {
    // If line starts a new function or class
    if (line.includes('function ') || line.includes('class ') || line.includes('const ') && line.includes(' = function')) {
      // If we were building a function and it fits in tokens
      if (currentFunction && estimateTokenCount(currentFunction) <= maxChunkTokens) {
        if (estimateTokenCount(currentChunk + currentFunction) > maxChunkTokens) {
          chunks.push(currentChunk);
          currentChunk = currentFunction;
        } else {
          currentChunk += currentFunction;
        }
      } else if (currentFunction) {
        // Function too big, need to chunk it
        const functionLines = currentFunction.split('\n');
        for (const funcLine of functionLines) {
          if (estimateTokenCount(currentChunk + funcLine + '\n') > maxChunkTokens) {
            chunks.push(currentChunk);
            currentChunk = funcLine + '\n';
          } else {
            currentChunk += funcLine + '\n';
          }
        }
      }
      currentFunction = line + '\n';
    } else {
      currentFunction += line + '\n';
    }
  }
  
  // Handle any remaining code
  if (currentFunction) {
    if (estimateTokenCount(currentChunk + currentFunction) > maxChunkTokens) {
      chunks.push(currentChunk);
      
      // If the function is still too big, split it line by line
      if (estimateTokenCount(currentFunction) > maxChunkTokens) {
        const functionLines = currentFunction.split('\n');
        currentChunk = '';
        
        for (const line of functionLines) {
          if (estimateTokenCount(currentChunk + line + '\n') > maxChunkTokens) {
            chunks.push(currentChunk);
            currentChunk = line + '\n';
          } else {
            currentChunk += line + '\n';
          }
        }
      } else {
        currentChunk = currentFunction;
      }
    } else {
      currentChunk += currentFunction;
    }
  }
  
  // Add the last chunk if it's not empty
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

// Split a text block by sentences
function splitTextBlock(textBlock: string, maxChunkTokens: number): string[] {
  const chunks: string[] = [];
  const sentences = textBlock.match(/[^.!?]+[.!?]+/g) || [textBlock];
  
  let currentChunk = '';
  
  for (const sentence of sentences) {
    const sentenceTokens = estimateTokenCount(sentence);
    
    // If a single sentence is too large, we have to split it by parts
    if (sentenceTokens > maxChunkTokens) {
      // Split very long sentences by phrases/clauses
      const parts = sentence.split(/([,;:])/g);
      let partChunk = '';
      
      for (const part of parts) {
        if (estimateTokenCount(partChunk + part) > maxChunkTokens) {
          chunks.push(partChunk);
          partChunk = part;
        } else {
          partChunk += part;
        }
      }
      
      if (partChunk) {
        chunks.push(partChunk);
      }
    } else if (estimateTokenCount(currentChunk + sentence) > maxChunkTokens) {
      // Current chunk would be too big with this sentence
      chunks.push(currentChunk);
      currentChunk = sentence;
    } else {
      // Add to current chunk
      currentChunk += sentence;
    }
  }
  
  // Add the last chunk if it's not empty
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

// Format combined inputs
export function formatCombinedInputs(inputs: string[]): string {
  if (inputs.length === 0) return '';
  if (inputs.length === 1) return inputs[0];
  
  return inputs
    .filter(input => input && input.trim())
    .map((input, index) => `--- INPUT ${index + 1} ---\n${input}`)
    .join('\n\n');
}

// Process chunked inputs with optimized iterations
export async function processChunkedInput(
  process: (input: string) => Promise<string>,
  input: string,
  maxTokensPerChunk: number
): Promise<string> {
  // If input is small enough, process directly
  if (estimateTokenCount(input) <= maxTokensPerChunk) {
    return process(input);
  }
  
  // Chunk the input
  const chunks = chunkText(input, maxTokensPerChunk);
  let results: string[] = [];
  
  // Process each chunk
  for (const chunk of chunks) {
    const result = await process(chunk);
    results.push(result);
  }
  
  // Combine results
  return results.join('\n\n');
} 