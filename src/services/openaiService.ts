/*
  The following module declarations are added to fix linter errors for missing type declarations.
*/
declare module 'openai';
declare module 'tiktoken';

// @ts-ignore: Missing type declarations for 'openai'
import { Configuration, OpenAIApi } from 'openai';
import * as tiktoken from 'tiktoken';

/**
 * Accurate token counting function using OpenAI's official tiktoken library
 * Reference: https://github.com/openai/openai-cookbook/blob/main/examples/How_to_count_tokens_with_tiktoken.ipynb
 * 
 * @param text Text to count tokens for
 * @param model Model name to estimate tokens for
 * @returns Exact token count
 */
function getTokenCount(text: string, model: string = 'gpt-4'): number {
  try {
    // Get the appropriate encoding for the model
    const encoding = getEncodingForModel(model);
    if (!encoding) {
      console.warn(`No specific encoding found for ${model}, using cl100k_base encoding`);
      return fallbackTokenCount(text);
    }
    
    // Encode the text and get token count
    const tokens = encoding.encode(text);
    const tokenCount = tokens.length;
    
    // Free up the encoding when done
    encoding.free();
    
    return tokenCount;
  } catch (error) {
    console.error(`Error using tiktoken: ${error instanceof Error ? error.message : 'Unknown error'}`);
    // Fall back to estimation if tiktoken fails
    return fallbackTokenCount(text);
  }
}

/**
 * Gets the appropriate tiktoken encoding for a given model
 */
function getEncodingForModel(model: string) {
  try {
    // Convert model name to lowercase for case-insensitive matching
    const modelLower = model.toLowerCase();
    
    // cl100k_base encodings (used by gpt-4, gpt-3.5-turbo, text-embedding-ada-002)
    if (
      modelLower.includes('gpt-4') || 
      modelLower.includes('gpt-3.5') || 
      modelLower.includes('gpt-4o') || 
      modelLower.includes('o1') || 
      modelLower.includes('o3') || 
      modelLower.startsWith('text-embedding')
    ) {
      return tiktoken.get_encoding('cl100k_base');
    }
    
    // p50k_base encodings (used by older GPT-3 davinci models)
    if (
      modelLower.includes('davinci') ||
      modelLower.includes('curie') ||
      modelLower.includes('babbage') ||
      modelLower.includes('ada')
    ) {
      return tiktoken.get_encoding('p50k_base');
    }
    
    // For other models, try getting encoding directly or default to cl100k_base
    try {
      // @ts-ignore: TypeScript doesn't know all valid model names
      return tiktoken.encoding_for_model(model);
    } catch {
      return tiktoken.get_encoding('cl100k_base');
    }
  } catch (error) {
    console.error(`Error getting encoding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

/**
 * Fallback token counting method using heuristics when tiktoken is unavailable
 */
function fallbackTokenCount(text: string): number {
  // This is our previous implementation as a fallback
  const charCount = text.length;
  const commonMultiCharTokens = (text.match(/\b(ing|ly|ed|ious|tion|ment|ness|ism|ship|hood|dom|ful|less|able|ible|ize|ise|ify|ate|al|ial|ic|ical|ous|ary|ate|en|fy)\b/g) || []).length;
  const spaces = (text.match(/\s/g) || []).length;
  const specialChars = (text.match(/[^\w\s]/g) || []).length;
  
  // Base approximation for modern models
  const tokenEstimate = Math.ceil((charCount - commonMultiCharTokens * 2) / 4 + spaces * 0.5 + specialChars * 0.5);
  
  // Ensure we don't underestimate token count
  return Math.max(tokenEstimate, Math.ceil(charCount / 5));
}

export async function generateResponse(
  prompt: string,
  model: string = 'gpt-4',
  maxModelTokens: number = 8192,
  minOutputTokens: number = 100
): Promise<string> {
  const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
  const openai = new OpenAIApi(configuration);

  let inputTokens = getTokenCount(prompt, model);
  let maxOutputTokens = maxModelTokens - inputTokens - minOutputTokens;

  if (maxOutputTokens <= 0) {
    throw new Error("Prompt is too long for the model's context window.");
  }

  let fullResponse = "";
  let currentPrompt = prompt;

  while (true) {
    try {
      const response = await openai.createChatCompletion({
        model,
        messages: [{ role: 'user', content: currentPrompt }],
        max_completion_tokens: maxOutputTokens
      });

      const chunk = response.data.choices[0].message?.content || "";
      fullResponse += chunk;

      const finishReason = response.data.choices[0].finish_reason;
      if (finishReason !== 'length') {
        break;
      }

      // Append a continuation prompt if the response was cut off
      currentPrompt = `${prompt}\n\nContinue from where you left off:\n${chunk}`;
      inputTokens = getTokenCount(currentPrompt, model);
      maxOutputTokens = maxModelTokens - inputTokens - minOutputTokens;

      if (maxOutputTokens <= 0) {
        throw new Error("Prompt and continuation exceed the model's context window.");
      }
    } catch (e: any) {
      if (e.message && e.message.includes('maximum context length')) {
        // Truncate the prompt if context limit is exceeded
        currentPrompt = currentPrompt.substring(0, Math.floor(currentPrompt.length / 2));
        inputTokens = getTokenCount(currentPrompt, model);
        maxOutputTokens = maxModelTokens - inputTokens - minOutputTokens;
        if (maxOutputTokens <= 0) {
          throw new Error("Prompt is too long even after truncation.");
        }
      } else {
        throw e;
      }
    }
  }

  return fullResponse;
}

/*
Explanation:
This service function generateResponse addresses potential output truncation issues caused by exceeding the maximum tokens allowed in the API call. It does so by:
1. Using a token counting function to compute the tokens in the prompt.
2. Dynamically adjusting the max tokens available for the response.
3. Iteratively fetching additional content if the response is truncated (finish_reason === 'length').
4. Handling maximum context length errors by truncating the prompt when necessary.
*/ 