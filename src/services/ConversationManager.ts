import { AIService } from './ai/AIService';
import { OpenAIMessage } from '@/types/openai/OpenAITypes';
import { eventBus, EventType } from '@/services/eventBus';

interface ConversationSummary {
  summary: string;
  lastSummarizedMessageIndex: number;
  lastUpdated: Date;
  // Track failed attempts to avoid endless retries
  failedAttempts: number;
}

/**
 * Handles conversation history with a sliding window approach
 * and periodic summarization to maintain context while controlling token usage
 */
export class ConversationManager {
  private conversations: Record<string, OpenAIMessage[]> = {};
  private summaries: Record<string, ConversationSummary> = {};
  private aiService: AIService;
  
  // Configuration
  private readonly MAX_RECENT_MESSAGES = 20; // Keep last N messages in active window
  private readonly SUMMARIZE_THRESHOLD = 30; // Summarize when exceeding this many messages
  private readonly SUMMARY_REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_RETRY_ATTEMPTS = 3; // Maximum number of retry attempts
  private readonly RETRY_DELAY_MS = 5000; // 5 seconds between retries
  
  constructor(aiService: AIService) {
    this.aiService = aiService;
  }
  
  /**
   * Get conversation history for a specific conversation
   * Includes a summary of older messages if available
   * @param conversationId Conversation identifier
   * @returns Array of conversation messages
   */
  async getConversationHistory(conversationId: string): Promise<OpenAIMessage[]> {
    if (!this.conversations[conversationId]) {
      this.conversations[conversationId] = [];
    }
    
    const messages = this.conversations[conversationId];
    const summary = this.summaries[conversationId];
    
    // If we have recent messages and a summary, prepend the summary
    if (summary && messages.length > 0) {
      // Check if summary is outdated
      const summaryOutdated = 
        Date.now() - summary.lastUpdated.getTime() > this.SUMMARY_REFRESH_INTERVAL_MS;
      
      // If summary is outdated and we have enough messages, regenerate it
      if (summaryOutdated && messages.length > this.SUMMARIZE_THRESHOLD) {
        try {
          await this.generateSummary(conversationId);
        } catch (error) {
          console.error(`Failed to regenerate summary for conversation ${conversationId}:`, error);
          // Continue with existing summary rather than failing
        }
      }
      
      // Return active window with summary context
      const result: OpenAIMessage[] = [
        { role: 'system', content: `Previous conversation summary: ${summary.summary}` },
        ...messages.slice(-this.MAX_RECENT_MESSAGES)
      ];
      
      return result;
    }
    
    // If no summary, just return the active window
    return messages.slice(-this.MAX_RECENT_MESSAGES);
  }
  
  /**
   * Update conversation with new messages
   * @param conversationId Conversation identifier
   * @param userMessage User message content
   * @param assistantMessage Assistant message content
   */
  async updateConversationHistory(
    conversationId: string,
    userMessage: string,
    assistantMessage: string
  ): Promise<void> {
    if (!this.conversations[conversationId]) {
      this.conversations[conversationId] = [];
    }
    
    // Add new messages
    this.conversations[conversationId].push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: assistantMessage }
    );
    
    // Check if we need to summarize older messages
    if (this.conversations[conversationId].length > this.SUMMARIZE_THRESHOLD) {
      try {
        await this.generateSummary(conversationId);
      } catch (error) {
        console.error(`Failed to generate summary for conversation ${conversationId}:`, error);
        // Emit an event about the summarization failure
        eventBus.emit(EventType.ERROR, {
          source: 'ConversationManager',
          error,
          message: `Failed to generate conversation summary for ${conversationId}`
        });
      }
    }
  }
  
  /**
   * Generate a summary of older messages in the conversation with retry logic
   * @param conversationId Conversation identifier
   */
  private async generateSummary(conversationId: string): Promise<void> {
    const messages = this.conversations[conversationId];
    if (!messages || messages.length <= this.MAX_RECENT_MESSAGES) {
      return;
    }
    
    // Determine which messages to summarize
    const lastSummary = this.summaries[conversationId];
    const startIndex = lastSummary ? lastSummary.lastSummarizedMessageIndex + 1 : 0;
    const endIndex = messages.length - this.MAX_RECENT_MESSAGES;
    
    // If there are no new messages to summarize, skip
    if (startIndex >= endIndex) {
      return;
    }
    
    // If we've had too many failed attempts recently, wait before trying again
    if (lastSummary && lastSummary.failedAttempts >= this.MAX_RETRY_ATTEMPTS) {
      const timeSinceLastAttempt = Date.now() - lastSummary.lastUpdated.getTime();
      if (timeSinceLastAttempt < this.SUMMARY_REFRESH_INTERVAL_MS) {
        console.log(`Skipping summarization for ${conversationId} due to multiple recent failures`);
        return;
      } else {
        // Reset failed attempts counter after cooling off period
        lastSummary.failedAttempts = 0;
      }
    }
    
    const messagesToSummarize = messages.slice(startIndex, endIndex);
    
    // Prepare previous summary if available
    let initialContext = "";
    if (lastSummary) {
      initialContext = `Previous summary: ${lastSummary.summary}\n\n`;
    }
    
    // Format messages for summarization
    const formattedMessages = messagesToSummarize
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n\n');
    
    // Create prompt for summarization
    const prompt = `
${initialContext}Please create a concise summary of the following conversation that captures:
1. Key topics discussed
2. Important decisions or conclusions
3. Any action items or next steps

Do not include specific details like code snippets, URLs, or sensitive information.
Format the summary as a paragraph of no more than 200 words.

CONVERSATION TO SUMMARIZE:
${formattedMessages}

SUMMARY:`;

    // Implement retry logic
    let attemptsRemaining = this.MAX_RETRY_ATTEMPTS;
    let lastError = null;
    
    while (attemptsRemaining > 0) {
      try {
        // Use a model optimized for summarization
        const summaryText = await this.aiService.generateText(
          'openai',
          'gpt-3.5-turbo',
          'You are a helpful assistant that creates accurate, concise summaries of conversations.',
          prompt
        );
        
        // Store the new summary
        this.summaries[conversationId] = {
          summary: summaryText,
          lastSummarizedMessageIndex: endIndex - 1,
          lastUpdated: new Date(),
          failedAttempts: 0 // Reset failed attempts on success
        };
        
        console.info(`Generated conversation summary for conversation ${conversationId}, summarized ${messagesToSummarize.length} messages`);
        return; // Success - exit the retry loop
      } catch (error) {
        lastError = error;
        attemptsRemaining--;
        
        // Increment failed attempts counter for the conversation
        if (this.summaries[conversationId]) {
          this.summaries[conversationId].failedAttempts = 
            (this.summaries[conversationId].failedAttempts || 0) + 1;
          this.summaries[conversationId].lastUpdated = new Date();
        } else {
          this.summaries[conversationId] = {
            summary: "Summary generation failed.",
            lastSummarizedMessageIndex: -1,
            lastUpdated: new Date(),
            failedAttempts: 1
          };
        }
        
        console.warn(`Summarization attempt ${this.MAX_RETRY_ATTEMPTS - attemptsRemaining} of ${this.MAX_RETRY_ATTEMPTS} failed for conversation ${conversationId}`);
        
        if (attemptsRemaining > 0) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS));
        }
      }
    }
    
    // All retries failed
    console.error(`Failed to generate summary for conversation ${conversationId} after ${this.MAX_RETRY_ATTEMPTS} attempts`, lastError);
    
    // Emit event for monitoring/alerting
    eventBus.emit(EventType.ERROR, {
      source: 'ConversationManager',
      error: lastError,
      message: `Failed to generate conversation summary for ${conversationId} after ${this.MAX_RETRY_ATTEMPTS} attempts`
    });
  }
  
  /**
   * Reset a conversation's history
   * @param conversationId Conversation identifier
   */
  resetConversation(conversationId: string): void {
    delete this.conversations[conversationId];
    delete this.summaries[conversationId];
  }
  
  /**
   * Get statistics about conversations being managed
   */
  getStats(): { conversations: number, totalMessages: number, summaries: number } {
    const conversationCount = Object.keys(this.conversations).length;
    let totalMessages = 0;
    
    for (const conversation of Object.values(this.conversations)) {
      totalMessages += conversation.length;
    }
    
    return {
      conversations: conversationCount,
      totalMessages,
      summaries: Object.keys(this.summaries).length
    };
  }
  
  /**
   * Force re-summarize a conversation's history
   * @param conversationId Conversation identifier
   */
  async forceSummarize(conversationId: string): Promise<boolean> {
    try {
      await this.generateSummary(conversationId);
      return true;
    } catch (error) {
      console.error(`Failed to force summarize conversation ${conversationId}:`, error);
      return false;
    }
  }
} 