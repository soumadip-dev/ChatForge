import { createGeminiModel } from '../config/gemini.config';
import { BaseMessage } from '@langchain/core/messages';

export type ChatMessages = BaseMessage[];

interface GenerateAIResponseParams {
  model: string;
  messages: ChatMessages;
}

interface GenerateAIResponseResult {
  aiResponse: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export const generateAIResponse = async ({
  model,
  messages,
}: GenerateAIResponseParams): Promise<GenerateAIResponseResult> => {
  const gemini = createGeminiModel(model);

  const response = await gemini.invoke(messages);

  const aiResponse =
    typeof response.content === 'string'
      ? response.content
      : response.content.map(item => ('text' in item ? item.text : '')).join('');

  if (!aiResponse) {
    throw new Error('AI response is empty');
  }

  const usageMetadata = response.usage_metadata;

  const promptTokens = usageMetadata?.input_tokens ?? 0;
  const completionTokens = usageMetadata?.output_tokens ?? 0;
  const totalTokens = usageMetadata?.total_tokens ?? 0;

  return {
    aiResponse,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens,
    },
  };
};
