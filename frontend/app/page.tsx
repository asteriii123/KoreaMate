import { ConversationScreen } from "../components/conversation/conversation-screen";

export default function HomePage() {
  return (
    <ConversationScreen initialWelcome mode="UNIFIED" title="KoreaMate" heading="想去韩国怎么玩？" description="旅行规划、韩语翻译和临时问题都可以直接说，我会自己判断下一步。" placeholder="告诉我你想去哪里，或者直接发来一句韩语…" />
  );
}
