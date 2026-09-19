import { ConversationDecisionSchema, type ConversationDecision } from "@koreamate/contracts";

export function parseConversationDecision(value: unknown): ConversationDecision {
  return ConversationDecisionSchema.parse(value);
}

export function fallbackConversationDecision(text: string): ConversationDecision {
  const normalized = text.trim();
  const planning = /(规划|安排|生成.*行程|重新规划|加进.*行程|加入.*行程)/u.test(normalized);
  const translation = /(翻译|怎么说|韩语|韩文|发音|读法)/u.test(normalized);
  if (translation) return { kind: "translation", action: "translate_text", reply: null, parameters: {} };
  if (planning) return { kind: "travel", action: "create_plan", reply: null, parameters: {} };
  if (/(推荐|好吃|景点|值得去|附近)/u.test(normalized)) return { kind: "travel", action: "recommend_places", reply: "我可以按城市、兴趣和预算给你推荐地点。你想先看哪个城市？", parameters: {} };
  return { kind: "travel", action: "ask_requirement", reply: "你想去韩国哪个城市？", parameters: { field: "destination" } };
}
