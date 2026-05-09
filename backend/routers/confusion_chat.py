"""
Confusion Node Chat — SSE streaming tutor for a side-quest clarification session.
POST /api/confusions/{node_id}/chat
"""
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..dependencies import get_current_user
from ..database import get_db
from ..models import User, LearningModule, ConfusionNode, ConfusionChatMessage, ModuleChatMessage
from ..ai_gateway import generate_chat_stream

router = APIRouter(prefix="/api/confusions", tags=["Confusion Chat"])

INIT_TRIGGER = "INIT_CONFUSION_WELCOME"


# ── Request schema ────────────────────────────────────────────────────────────

class ConfusionChatRequest(BaseModel):
    content: str
    provider: str
    injected_response: Optional[str] = None
    debug_mode: bool = False


# ── Resolution tool ───────────────────────────────────────────────────────────

resolve_confusion_tool = {
    "type": "function",
    "function": {
        "name": "resolve_confusion",
        "description": (
            "Call this ONLY when the user has successfully understood the concept. "
            "It closes the side-quest and returns them to their main lesson."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "return_summary": {
                    "type": "string",
                    "description": "A brief summary of what the user learned in this side-quest, injected back into the main lesson history.",
                },
                "closing_encouragement": {
                    "type": "string",
                    "description": "A final encouraging sentence telling them to return to the main lesson.",
                },
            },
            "required": ["return_summary", "closing_encouragement"],
        },
    },
}


# ── Shared ownership guard ────────────────────────────────────────────────────

def _get_authorized_confusion(node_id: str, current_user: User, db: Session) -> ConfusionNode:
    node = db.query(ConfusionNode).get(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Confusion node not found")
    if node.root_module.learning_path.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return node


# ── POST /{node_id}/chat ──────────────────────────────────────────────────────

@router.post("/{node_id}/chat")
async def confusion_chat(
    node_id: str,
    request: ConfusionChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Stream a Clarification Tutor response for a confusion side-quest.
    Uses the same JSON-envelope SSE format as the main module chat.
    """
    node: ConfusionNode = _get_authorized_confusion(node_id, current_user, db)
    root_module: LearningModule = node.root_module

    # ── Build the contextual system prompt ────────────────────────────────────
    knowledge_summary = current_user.knowledge_summary or "No profile available."
    
    base_prompt = f"""You are a Clarification AI.
# GLOBAL PROFILE: {knowledge_summary}
# MACRO GOAL: {root_module.instructional_goal}
# LOCAL CONTEXT: "{node.local_context_block}"
# MICRO-CONFUSION: The user highlighted '{node.highlighted_text}' and asked: '{node.user_query}'.
Your ONLY job is to explain this specific highlighted concept. Connect it back to the macro goal so they know why it matters."""

    if request.debug_mode:
        confusion_prompt = base_prompt + """
# SYSTEM OVERRIDE: DEVELOPER DEBUG MODE ACTIVE
You are now in Developer Debug Mode. 
1. DO NOT teach or explain. 
2. IMMEDIATELY execute the `resolve_confusion` tool to bypass this side-quest.
3. Hallucinate realistic synthetic data for `return_summary` and `closing_encouragement`.
"""
    else:
        confusion_prompt = base_prompt + """
# CONVERSATIONAL PACING RULES (CRITICAL)
You are a patient, conversational tutor. You MUST NOT explain everything at once and immediately close the chat.

1. **Step 1: Initial Explanation & Example:** In your first message, explain the highlighted concept simply. Give ONE concrete, relatable example.
2. **Step 2: Check for Understanding:** End your first message with a question asking the user to apply the concept or solve a tiny problem. STOP TYPING. 
3. **Step 3: Wait:** DO NOT call the `resolve_confusion` tool in your first message under any circumstances. You must wait for the user to reply.
4. **Step 4: Resolution:** ONLY execute the `resolve_confusion` tool AFTER the user has replied and demonstrated they understand by correctly answering your question. 

# GUARDRAILS
- **FORBIDDEN:** DO NOT resolve the confusion just because the user says "thanks", "I get it", or "understood". They MUST answer your assessment question to prove they actually understand.
- **FORBIDDEN:** "Skip" or "Bypass" requests are disabled. This is ONLY allowed in Developer Debug Mode, which is currently **INACTIVE**.
- Keep messages short (max 2-3 paragraphs).
- If the user is still confused, try explaining it a different way before checking again.
"""

    is_init = request.content.strip() == INIT_TRIGGER

    if is_init:
        # ── Idempotency guard ─────────────────────────────────────────────────
        already_has_messages = (
            db.query(ConfusionChatMessage)
            .filter(ConfusionChatMessage.confusion_node_id == node.id)
            .first()
        )
        if already_has_messages:
            async def empty_stream():
                return
                yield
            return StreamingResponse(empty_stream(), media_type="text/event-stream")

        # System prompt only — AI generates an unprompted contextual welcome
        messages = [{"role": "system", "content": confusion_prompt}]
    else:
        # ── Persist user message ──────────────────────────────────────────────
        db.add(ConfusionChatMessage(
            confusion_node_id=node.id,
            role="user",
            content=request.content,
        ))
        db.commit()

        # ── Build full history ────────────────────────────────────────────────
        history = (
            db.query(ConfusionChatMessage)
            .filter(ConfusionChatMessage.confusion_node_id == node.id)
            .order_by(ConfusionChatMessage.created_at)
            .all()
        )
        messages = [{"role": "system", "content": confusion_prompt}] + [
            {"role": msg.role, "content": msg.content} for msg in history
        ]

    # ── SSE event generator ───────────────────────────────────────────────────
    async def event_generator():
        full_ai_response = ""
        text_persisted = False

        try:
            async for event in generate_chat_stream(
                messages=messages,
                provider=request.provider,
                injected_response=request.injected_response,
                tools=[resolve_confusion_tool],
            ):
                if event["type"] == "content":
                    full_ai_response += event["data"]
                    yield f"data: {json.dumps({'text': event['data']})}\n\n"

                elif event["type"] == "tool_call":
                    if event["name"] == "resolve_confusion":
                        try:
                            args = json.loads(event["arguments"])
                            encouragement = args.get("closing_encouragement", "Great work! Return to your lesson.")
                            return_summary = args.get("return_summary", "Side-quest completed.")
                        except json.JSONDecodeError:
                            encouragement = "Great work! Return to your lesson."
                            return_summary = "Side-quest completed."

                        try:
                            # Persist pre-resolution AI text if any
                            if full_ai_response.strip():
                                db.add(ConfusionChatMessage(
                                    confusion_node_id=node.id,
                                    role="assistant",
                                    content=full_ai_response,
                                ))
                                text_persisted = True

                            # Persist closing encouragement as its own turn
                            db.add(ConfusionChatMessage(
                                confusion_node_id=node.id,
                                role="assistant",
                                content=encouragement,
                            ))

                            # Mark node as resolved
                            node.status = "resolved"

                            # Inject return_summary into parent history
                            system_msg = f"Side-quest was resolved [/confusion/{node.id}]"
                            if node.parent_confusion_id:
                                db.add(ConfusionChatMessage(
                                    confusion_node_id=node.parent_confusion_id,
                                    role="system",
                                    content=system_msg
                                ))
                            else:
                                db.add(ModuleChatMessage(
                                    module_id=node.root_module_id,
                                    role="system",
                                    content=system_msg
                                ))

                            db.commit()

                            # Stream the closing message then the resolution signal
                            yield f"data: {json.dumps({'text': encouragement})}\n\n"
                            yield f"data: {json.dumps({'status': 'resolved', 'parent_id': node.parent_confusion_id})}\n\n"

                        except Exception as e:
                            db.rollback()
                            yield f"data: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"
                        return

                elif event["type"] == "error":
                    yield f"data: {json.dumps({'status': 'error', 'message': event['data']})}\n\n"

        finally:
            # Persist AI response if stream ended without tool call
            if full_ai_response.strip() and not text_persisted:
                db.add(ConfusionChatMessage(
                    confusion_node_id=node.id,
                    role="assistant",
                    content=full_ai_response,
                ))
                db.commit()

    return StreamingResponse(event_generator(), media_type="text/event-stream")
