from typing import Any, Literal
from pydantic import BaseModel, Field


class AgentRunRequest(BaseModel):
    run_id: str
    conversation_id: str
    job_id: str
    user_id: str | None = None
    guest_id: str | None = None
    message: str
    attachments: list[dict[str, Any]] = Field(default_factory=list)
    recent_messages: list[dict[str, str]] = Field(default_factory=list)
    requirements: dict[str, Any] | None = None
    previous_plan: dict[str, Any] | None = None


class AgentRunResponse(BaseModel):
    status: Literal["completed", "question", "confirmation", "failed"]
    reply: str | None = None
    pending_action: dict[str, Any] | None = None
    trace: list[dict[str, Any]] = Field(default_factory=list)
