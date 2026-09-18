import os
from pydantic import BaseModel, Field


class AgentServiceSettings(BaseModel):
    nestjs_tool_api_url: str = Field(default_factory=lambda: os.getenv("NESTJS_TOOL_API_URL", "http://127.0.0.1:3100/api/v1/internal/agent-tools"))
    model_name: str = Field(default_factory=lambda: os.getenv("CREWAI_MODEL_NAME", "gpt-4o-mini"))
    max_steps: int = Field(default=12, ge=1, le=50)
    dry_run: bool = Field(default_factory=lambda: os.getenv("AGENT_DRY_RUN", "false").lower() == "true")


settings = AgentServiceSettings()
