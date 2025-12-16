import { GoogleGenAI, Chat } from "@google/genai";

const SYSTEM_INSTRUCTION = `你是一位拥有10年经验的资深电商数据分析师和产品经理。
你被嵌入在一个名为“生鲜智能BI”的仪表盘工具中。
你的能力包括：
1. 分析销售趋势、转化率和库存周转率。
2. 提供日报、周报和月报。
3. 诊断销售下滑原因并提出营销策略建议。
4. 深入分析特定商品的表现。

回答要求：
- 使用中文回答。
- 态度专业、简洁，基于数据说话。
- 使用要点（Bullet points）提高可读性。
- 如果用户询问屏幕上的数据，请基于标准的电商指标（GMV, UV, PV, CVR, 退款率等）进行分析。
- 涉及到金额时使用人民币符号 (¥)。
- 可以使用Markdown格式化回答。
`;

export const createChatSession = (): Chat => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });
};

export const sendMessageStream = async (chat: Chat, message: string) => {
  try {
    return await chat.sendMessageStream({ message });
  } catch (error) {
    console.error("Error sending message to Gemini:", error);
    throw error;
  }
};