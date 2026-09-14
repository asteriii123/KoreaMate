import { ConversationScreen } from "../../components/conversation/conversation-screen";

export default function TravelPage() {
  return (
    <ConversationScreen
      mode="TRAVEL"
      title="旅行规划"
      heading="想去韩国怎么玩？"
      description="一句话告诉我时间、人数或想做的事，剩下的交给我。"
      placeholder="例如：10月和朋友去首尔5天…"
    />
  );
}
