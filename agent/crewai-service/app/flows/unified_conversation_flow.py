from typing import Any
from crewai import Crew, Process, Task
from app.agents.conversation_agents import build_agents
from app.schemas.conversation import AgentRunRequest, AgentRunResponse


class UnifiedConversationFlow:
    """Small first vertical slice; domain tools and Flow state are explicit and resumable."""

    def __init__(self) -> None:
        self.agents = build_agents()

    def run(self, request: AgentRunRequest) -> AgentRunResponse:
        context_task = Task(
            description=(
                "整理以下统一对话任务，输出结构化上下文和缺失信息判断。\n"
                f"当前消息：{request.message}\n历史：{request.recent_messages}\n"
                f"需求：{request.requirements}\n当前行程：{request.previous_plan}"
            ),
            expected_output="JSON context summary with intent candidates and missing fields",
            agent=self.agents["context_manager"],
        )
        route_task = Task(
            description="根据上下文选择旅行、翻译、检索、记忆或组合任务，并说明所需工具。",
            expected_output="JSON route with selected specialist and required tools",
            agent=self.agents["intent_router"],
            context=[context_task],
        )
        verifier_task = Task(
            description="核验执行结果；如果缺少必要信息只提出一个问题，高风险写操作必须请求确认。",
            expected_output="A concise final answer, one question, or confirmation request",
            agent=self.agents["verifier"],
            context=[context_task, route_task],
        )
        crew = Crew(
            agents=list(self.agents.values()),
            tasks=[context_task, route_task, verifier_task],
            process=Process.sequential,
            verbose=False,
        )
        result: Any = crew.kickoff()
        return AgentRunResponse(status="completed", reply=str(result), trace=[])
