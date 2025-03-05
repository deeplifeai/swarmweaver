/*
  The following module declarations are added to fix linter errors for missing type declarations.
*/
declare module 'openai';
declare module 'gpt-3-encoder';

// @ts-ignore: Missing type declarations for 'openai'
import { Configuration, OpenAIApi } from 'openai';
// @ts-ignore: Missing type declarations for 'gpt-3-encoder'
import { encode } from 'gpt-3-encoder';

function getTokenCount(text: string, model: string = 'gpt-4'): number {
  // This uses the gpt-3-encoder to count tokens. Adjust if necessary for your model.
  return encode(text).length;
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