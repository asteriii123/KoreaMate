import { ConversationScreen } from "../../components/conversation/conversation-screen";

export default function TranslatePage() {
  return (
    <ConversationScreen
      mode="TRANSLATION"
      title="AI 韩语翻译"
      heading="想说什么？"
      description="输入中文或韩文，我会判断语言并给出适合当前场景的表达。"
      placeholder="输入需要翻译的内容…"
    />
  );
}
