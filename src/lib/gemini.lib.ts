import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

import { updateChatSummary, updateChatTokens } from '../repositories/chat.repository';
import { getMessagesForSummary } from '../repositories/message.repository';
import {
  findUserById,
  incrementUserTokenUsage,
  resetUserTokenUsage,
} from '../repositories/user.repository';
import { generateAIResponse, type ChatMessages } from '../services/ai.service';
import { getChatByIdService } from '../services/chat.service';
import type { Chat, ChatTokenUsage } from '../types/chat.types';
import type { Message } from '../types/message.types';
import type { User } from '../types/user.types';

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

//* Build the message history and system instructions for the AI request
export const buildMessagesForAI = ({
  chat,
  oldMessages,
  currentMessage,
}: {
  chat: Chat;
  oldMessages: Message[];
  currentMessage: string;
}): ChatMessages => {
  const messages: ChatMessages = [new SystemMessage(SYSTEM_PROMPT)];
  if (chat.summary && chat.summary.trim() !== '') {
    messages.push(new SystemMessage(`Previous conversation summary:\n${chat.summary}`));
  }

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

//* Reset the user's token usage when the current usage period has expired
export async function resetUsageIfNeeded(user: User): Promise<void> {
  const now = new Date();

  if (now > user.reset_at) {
    const resetAt = new Date(Date.now() + 5 * 60 * 60 * 1000);

    await resetUserTokenUsage(user.id, resetAt);

    user.token_used = 0;
    user.reset_at = resetAt;
  }
}

//* Check whether the user has reached their token usage limit
export function hasTokenLimitReached(user: User): boolean {
  return user.token_used >= user.token_limit;
}

//* Add the consumed tokens to the user's current and total usage
export async function addUserTokenUsage(user: User, totalTokens: number): Promise<void> {
  await incrementUserTokenUsage(user.id, totalTokens);
}

//* Add the prompt, completion, and total token usage to the chat
export const addChatTokenUsage = async (chat: Chat, usage: ChatTokenUsage) => {
  await updateChatTokens(chat.id, usage);
};

//* Update the chat summary and tokens
export const updateSummaryIfNeeded = async (chatId: string, userId: string) => {
  const chat = await getChatByIdService(chatId, userId);
  if (!chat) return;

  const unsummarizedCount = chat.message_count - chat.summarized_till_message_number;

  if (unsummarizedCount < SUMMARY_CHUNK_SIZE) {
    return;
  }

  const messagesToSummarize = await getMessagesForSummary(
    chat.id,
    chat.summarized_till_message_number,
    SUMMARY_CHUNK_SIZE
  );

  if (messagesToSummarize.length === 0) return;

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

  const { aiResponse, usage } = await generateAIResponse({
    model: chat.model,
    messages: summaryMessages,
  });

  const summarizedTillMessageNumber =
    chat.summarized_till_message_number + messagesToSummarize.length;

  await updateChatSummary(chat.id, aiResponse, summarizedTillMessageNumber);

  await updateChatTokens(chat.id, usage);

  const user = await findUserById(chat.user_id);

  if (user) {
    await incrementUserTokenUsage(user.id, usage.totalTokens);
  }
};
