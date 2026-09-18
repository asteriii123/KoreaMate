from typing import Any, Type
import httpx
from pydantic import BaseModel, Field
from crewai.tools import BaseTool
from app.config import settings


class DomainToolInput(BaseModel):
    payload: dict[str, Any] = Field(default_factory=dict)


class NestJsDomainTool(BaseTool):
    """Adapter: CrewAI agents call NestJS domain tools, never Prisma directly."""

    endpoint: str
    name: str
    description: str
    args_schema: Type[BaseModel] = DomainToolInput

    def _run(self, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        body = payload or {}
        response = httpx.post(
            f"{settings.nestjs_tool_api_url}/{self.endpoint}",
            json=body,
            timeout=30,
        )
        response.raise_for_status()
        return response.json()


def domain_tools() -> list[NestJsDomainTool]:
    return [
        NestJsDomainTool(endpoint="search-places", name="search_places", description="搜索并核验旅行地点"),
        NestJsDomainTool(endpoint="get-weather", name="get_weather", description="查询城市和日期的天气"),
        NestJsDomainTool(endpoint="search-flights", name="search_flights", description="查询航班"),
        NestJsDomainTool(endpoint="search-hotels", name="search_hotels", description="查询酒店"),
        NestJsDomainTool(endpoint="translate-text", name="translate_text", description="执行中韩文本翻译"),
        NestJsDomainTool(endpoint="create-trip-version", name="create_trip_plan", description="创建新的行程版本"),
        NestJsDomainTool(endpoint="modify-trip-version", name="modify_trip_plan", description="基于旧版本创建修改后的新行程版本"),
        NestJsDomainTool(endpoint="memory", name="manage_memory", description="读取或更新用户长期偏好"),
        NestJsDomainTool(endpoint="saved-places", name="manage_saved_places", description="查看、收藏或取消收藏地点"),
    ]
