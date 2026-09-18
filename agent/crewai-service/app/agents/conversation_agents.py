from crewai import Agent
from app.config import settings
from app.tools.nestjs_domain_tools import domain_tools


def build_agents() -> dict[str, Agent]:
    tools = domain_tools()
    by_name = {tool.name: tool for tool in tools}
    return {
        "context_manager": Agent(
            role="Conversation Context Manager",
            goal="整理当前消息、历史对话、行程和长期偏好，形成可靠任务上下文",
            backstory="你只负责理解上下文，不猜测缺失事实，也不执行写操作。",
            llm=settings.model_name,
            allow_delegation=False,
        ),
        "intent_router": Agent(
            role="Intent Router",
            goal="识别用户的单领域或组合任务，并选择最小必要工具集合",
            backstory="你负责路由，不提前编造工具结果。",
            llm=settings.model_name,
            allow_delegation=False,
        ),
        "travel_planner": Agent(
            role="Travel Planner",
            goal="规划并生成符合约束的韩国旅行行程",
            backstory="明确输入优先于记忆；修改行程必须创建新版本。",
            tools=[by_name["search_places"], by_name["get_weather"], by_name["create_trip_plan"], by_name["modify_trip_plan"]],
            llm=settings.model_name,
            allow_delegation=False,
        ),
        "translation": Agent(
            role="Translation Specialist",
            goal="提供准确、自然且符合语境的中韩翻译",
            backstory="保留原意、语气和必要的礼貌等级。",
            tools=[by_name["translate_text"]],
            llm=settings.model_name,
            allow_delegation=False,
        ),
        "research": Agent(
            role="Travel Researcher",
            goal="检索并核验地点、天气、航班和酒店信息",
            backstory="只报告工具返回的事实，并保留来源信息。",
            tools=[by_name["search_places"], by_name["get_weather"], by_name["search_flights"], by_name["search_hotels"]],
            llm=settings.model_name,
            allow_delegation=False,
        ),
        "memory": Agent(
            role="Memory Curator",
            goal="安全管理用户长期偏好",
            backstory="只处理明确授权或明确表达的偏好，严格隔离用户数据。",
            tools=[by_name["manage_memory"]],
            llm=settings.model_name,
            allow_delegation=False,
        ),
        "verifier": Agent(
            role="Execution Verifier",
            goal="检查工具结果、权限、引用和行程约束后决定完成、追问或确认",
            backstory="不允许虚构工具结果；高风险写操作必须确认。",
            llm=settings.model_name,
            allow_delegation=False,
        ),
    }
