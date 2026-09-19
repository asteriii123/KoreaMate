from typing import Any
from crewai import Crew, Process, Task
from app.agents.conversation_agents import build_agents
from app.schemas.conversation import AgentRunRequest, AgentRunResponse
from app.config import settings


class UnifiedConversationFlow:
    """Small first vertical slice; domain tools and Flow state are explicit and resumable."""

    def __init__(self) -> None:
        self.agents = build_agents()

    def run(self, request: AgentRunRequest) -> AgentRunResponse:
        if settings.dry_run:
            return AgentRunResponse(
                status="completed",
                reply=f"[dry-run] 已接收任务：{request.message}",
                trace=[{"kind": "flow", "name": "unified_conversation", "status": "dry-run"}],
            )
        context_task = Task(
            description=(
                "整理以下统一对话任务，输出结构化上下文和缺失信息判断。\n"
                f"当前消息：{request.message}\n历史：{request.recent_messages}\n"
                f"需求：{request.requirements}\n当前行程：{request.previous_plan}"
            ),
            expected_output="JSON context summary with intent candidates and missing fields",
            agent=self.agents["context_manager"],
        )
        execution_task = Task(
            description=(
                "基于上下文完成用户请求。你是协作管理者，必须把任务委派给合适的专家 Agent，"
                "让专家调用所需工具并根据工具结果继续推进。缺少关键资料时只提出一个问题；"
                "涉及地点、餐厅、景点、天气、航班或酒店时必须调用对应工具，不得凭空声称工具不可用；"
                "涉及写入、删除或修改行程时先请求确认。最终输出面向用户的中文答复，并保留结构化结果。"
                "只输出给用户看的简洁结论：最多 3-5 条，包含名称、区域和一句特色；不要输出思考过程、工具说明、授权请求、免责声明、Markdown 表格或内部策略。"
            ),
            expected_output="A concise Chinese answer, one question, or a confirmation request with factual tool results",
            agent=self.agents["verifier"],
            context=[context_task],
        )
        crew = Crew(
            agents=[agent for name, agent in self.agents.items() if name != "intent_router"],
            tasks=[context_task, execution_task],
            process=Process.hierarchical,
            manager_agent=self.agents["intent_router"],
            verbose=False,
        )
        result: Any = crew.kickoff()
        return AgentRunResponse(
            status="completed",
            reply=str(result),
            trace=[
                {"kind": "flow", "name": "unified_conversation", "status": "completed"},
                {"kind": "crew", "process": "hierarchical", "status": "completed"},
            ],
        )
