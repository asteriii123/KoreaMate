from pydantic import BaseModel, Field


class AgentServiceSettings(BaseModel):
    nestjs_tool_api_url: str = Field(default="http://localhost:3000/internal/agent-tools")
    model_name: str = Field(default="gpt-4o-mini")
    max_steps: int = Field(default=12, ge=1, le=50)


settings = AgentServiceSettings()
