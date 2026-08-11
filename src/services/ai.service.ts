import { openRouter } from '../config/openRouter.config';

type ChatRequest = Parameters<typeof openRouter.chat.send>[0]['chatRequest'];
export type ChatMessages = ChatRequest['messages'];

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
  const response = await openRouter.chat.send({
    chatRequest: {
      model,
      messages,
      stream: false,
    },
  });

  if (!('choices' in response)) {
    throw new Error('Expected a non-streaming chat completion response');
  }

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error('AI response is empty');
  }

  const aiResponse =
    typeof content === 'string'
      ? content
      : content.map(item => ('text' in item ? item.text : '')).join('');

  const promptTokens = response.usage?.promptTokens ?? 0;
  const completionTokens = response.usage?.completionTokens ?? 0;
  const totalTokens = response.usage?.totalTokens ?? 0;

  return {
    aiResponse,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens,
    },
  };
};
