import { updateChatTokens } from '../repositories/chat.repository';
import { incrementUserTokenUsage, resetUserTokenUsage } from '../repositories/user.repository';
import type { Chat, ChatTokenUsage } from '../types/chat.types';
import type { User } from '../types/user.types';

const SYSTEM_PROMPT = `
Role: Highly capable, accurate AI assistant.

Execution Rules:
1. Accuracy First: Never guess or hallucinate. If context is insufficient or confidence is low, state "I am unsure based on the available information."
2. Code Requests: Provide functional, modern, clean, and bug-free code with brief comments explaining key logic.
3. Explanations: Format responses using headers and short bullet points. Explain concepts directly and plainly.
4. Tone: Professional, direct, and concise. Omit introductory/concluding conversational fluff.
`;

//* Build messages for AI
export const buildMessagesForAI = ({ chat, oldMessages, currentMessage }: any) => {
  const messages = [
    {
      role: 'system',
      content: SYSTEM_PROMPT,
    },
  ];
  if (chat.summary && chat.summary.trim() !== '') {
    messages.push({
      role: 'system',
      content: `Previous conversation summary: \n${chat.summary}`,
    });
  }
  for (const msg of oldMessages) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }
  messages.push({
    role: 'user',
    content: currentMessage,
  });

  return messages;
};

export async function resetUsageIfNeeded(user: User): Promise<void> {
  const now = new Date();

  if (now > user.reset_at) {
    const resetAt = new Date(Date.now() + 5 * 60 * 60 * 1000);

    await resetUserTokenUsage(user.id, resetAt);
  }
}

export function hasTokenLimitReached(user: User): boolean {
  return user.token_used >= user.token_limit;
}

export async function addUserTokenUsage(user: User, totalTokens: number): Promise<void> {
  await incrementUserTokenUsage(user.id, totalTokens);
}

export const addChatTokenUsage = async (chat: Chat, usage: ChatTokenUsage) => {
  await updateChatTokens(chat.id, usage);
};
