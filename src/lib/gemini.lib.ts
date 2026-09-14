import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

import { env } from '../config/env.config';

import { updateChatSummary, updateChatTokens } from '../repositories/chat.repository';
import { getMessagesForSummary } from '../repositories/message.repository';
import { incrementUserTotalTokenUsage } from '../repositories/user.repository';

import { generateAIResponse, type ChatMessages } from '../services/ai.service';
import { getChatByIdService } from '../services/chat.service';

import { getTokenUsage, incrementTokenUsage } from './token-usage.lib';

import type { Chat } from '../types/chat.types';
import type { Message } from '../types/message.types';

const SUMMARY_CHUNK_SIZE = 10;

const SYSTEM_PROMPT = `
Role: Highly capable, accurate AI assistant.

Execution Rules:
1. Accuracy First: Never guess or hallucinate. If context is insufficient or confidence is low, state "I am unsure based on the available information."
2. Code Requests: Provide functional, modern, clean, and bug-free code with brief comments explaining key logic.
3. Explanations: Format responses using headers and short bullet points. Explain concepts directly and plainly.
4. Tone: Professional, direct, and concise. Omit introductory/concluding conversational fluff.
`;

const SUMMARY_SYSTEM_PROMPT = `
Summarize the conversation accurately.

Keep:
- Important context
- User goals
- Important decisions
- Relevant technical details
- Unresolved questions

Do not:
- Add information that was not present
- Remove important context
- Answer unresolved questions
- Include unnecessary conversational details
`;

// Build the message history and system instructions for the AI request.
export const buildMessagesForAI = ({
  chat,
  oldMessages,
  currentMessage,
}: {
  chat: Chat;
  oldMessages: Message[];
  currentMessage: string;
}): ChatMessages => {
  const systemContent = chat.summary?.trim()
    ? `${SYSTEM_PROMPT}\n\nPrevious conversation summary:\n${chat.summary}`
    : SYSTEM_PROMPT;

  const messages: ChatMessages = [new SystemMessage(systemContent)];

  for (const msg of oldMessages) {
    if (msg.role === 'user') {
      messages.push(new HumanMessage(msg.content));
    } else if (msg.role === 'assistant') {
      messages.push(new AIMessage(msg.content));
    }
  }

  messages.push(new HumanMessage(currentMessage));

  return messages;
};

// Generate and store a new conversation summary when enough messages are unsummarized.
export const updateSummaryIfNeeded = async (chatId: string, userId: string): Promise<void> => {
  const tokenUsage = await getTokenUsage(userId);

  if (tokenUsage >= env.TOKEN_LIMIT) {
    return;
  }

  const chat = await getChatByIdService(chatId, userId);

  if (!chat) {
    return;
  }

  const unsummarizedCount = chat.message_count - chat.summarized_till_message_number;

  if (unsummarizedCount < SUMMARY_CHUNK_SIZE) {
    return;
  }

  const messagesToSummarize = await getMessagesForSummary(
    chat.id,
    chat.summarized_till_message_number,
    SUMMARY_CHUNK_SIZE
  );

  if (messagesToSummarize.length === 0) {
    return;
  }

  const summaryMessages: ChatMessages = [
    new SystemMessage(SUMMARY_SYSTEM_PROMPT),
    new HumanMessage(`Previous summary: ${chat.summary || 'No previous summary yet.'}`),
  ];

  for (const msg of messagesToSummarize) {
    if (msg.role === 'user') {
      summaryMessages.push(new HumanMessage(msg.content));
    } else if (msg.role === 'assistant') {
      summaryMessages.push(new AIMessage(msg.content));
    }
  }

  summaryMessages.push(new HumanMessage('Summarize the above conversation.'));

  // Generate the summary using the same chat model.
  const { aiResponse, usage } = await generateAIResponse({
    model: chat.model,
    messages: summaryMessages,
  });

  const summarizedTillMessageNumber =
    chat.summarized_till_message_number + messagesToSummarize.length;

  // Store the generated summary and update the summary position.
  await updateChatSummary(chat.id, aiResponse, summarizedTillMessageNumber);

  // Add summary-generation tokens to the chat usage.
  await updateChatTokens(chat.id, usage);

  // Add summary-generation tokens to the current Redis token window.
  await incrementTokenUsage(chat.user_id, usage.totalTokens);

  // Add summary-generation tokens to the user's lifetime PostgreSQL usage.
  await incrementUserTotalTokenUsage(chat.user_id, usage.totalTokens);
};
