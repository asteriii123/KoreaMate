from fastapi import FastAPI
from app.flows.unified_conversation_flow import UnifiedConversationFlow
from app.schemas.conversation import AgentRunRequest, AgentRunResponse

app = FastAPI(title="KoreaMate CrewAI Agent Service", version="0.1.0")
flow = UnifiedConversationFlow()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "crewai-agent"}


@app.post("/agent/runs", response_model=AgentRunResponse)
def run_agent(request: AgentRunRequest) -> AgentRunResponse:
    return flow.run(request)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.api.server:app", host="0.0.0.0", port=8010, reload=False)
