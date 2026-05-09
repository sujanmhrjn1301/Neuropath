"""
Phase 4 Learning Engine: Per-module AI tutor chat endpoint with persistent history.
GET  /api/modules/{module_id}/chat  — load history
POST /api/modules/{module_id}/chat  — send message & stream reply
"""
import json
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..dependencies import get_current_user
from ..database import get_db
from ..models import User, LearningModule, LearningPath, ModuleChatMessage
from ..ai_gateway import generate_chat_stream

router = APIRouter(prefix="/api/modules", tags=["Module Chat"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class ModuleChatRequest(BaseModel):
    content: str                            # Single new user message text
    provider: str
    injected_response: Optional[str] = None
    debug_mode: bool = False  # <--- ADD THIS


class ChatMessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Master tool schema ────────────────────────────────────────────────────────

complete_and_advance_tool = {
    "type": "function",
    "function": {
        "name": "complete_and_advance",
        "description": (
            "Call this ONLY when the user has satisfied the Required End Condition. "
            "It completes the current module, unlocks the next one, and updates the "
            "user's global knowledge profile."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "congratulatory_message": {
                    "type": "string",
                    "description": "Final message to the user celebrating their success in this module."
                },
                "handoff_notes_for_next_tutor": {
                    "type": "string",
                    "description": (
                        "Technical notes about what the user just demonstrated, to be "
                        "injected into the next module's AI context."
                    )
                },
                "updated_strengths": {
                    "type": "string",
                    "description": (
                        "The user's newly updated strengths paragraph, merging what they "
                        "just learned with their existing profile."
                    )
                },
                "updated_weaknesses": {
                    "type": "string",
                    "description": "The user's updated weaknesses paragraph."
                },
            },
            "required": [
                "congratulatory_message",
                "handoff_notes_for_next_tutor",
                "updated_strengths",
                "updated_weaknesses",
            ],
        },
    },
}


# ── Shared security helper ────────────────────────────────────────────────────

def _get_authorized_module(module_id: str, current_user: User, db: Session) -> LearningModule:
    """Fetch a module and verify the current user owns it."""
    module: LearningModule = db.query(LearningModule).get(module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    if module.learning_path.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return module


# ── GET: Load chat history ────────────────────────────────────────────────────

@router.get("/{module_id}/chat", response_model=List[ChatMessageOut])
def get_module_chat_history(
    module_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all persisted messages for this module, ordered by creation time."""
    module = _get_authorized_module(module_id, current_user, db)
    return module.chat_messages


# ── POST: Send message & stream AI reply ─────────────────────────────────────

@router.post("/{module_id}/chat")
async def module_chat(
    module_id: str,
    request: ModuleChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Persist the user's message, fetch full history, stream a contextual
    AI tutoring reply, persist the AI's reply, then handle completion logic.
    """

    # ── Security & status check ───────────────────────────────────────────────
    module = _get_authorized_module(module_id, current_user, db)
    path: LearningPath = module.learning_path

    if module.status != "unlocked":
        raise HTTPException(
            status_code=403,
            detail=f"Module is '{module.status}'. Only unlocked modules can be chatted with."
        )

    # ── Build shared system prompt ────────────────────────────────────────────
    knowledge_summary = current_user.knowledge_summary or "No profile available yet."
    previous_context = (
        module.handoff_context
        or "This is the first module. Welcome the user warmly and introduce the overall project."
    )

    # 1. The Base Context (Both modes need to know what module they are in)
    base_prompt = f"""You are the AI Tutor for the module: '{module.title}'.

# USER'S GLOBAL PROFILE
{knowledge_summary}

# PREVIOUS MODULE CONTEXT
{previous_context}

# CURRENT MODULE GOALS
- Instructional Goal: {module.instructional_goal}
- Required End Condition: {module.end_condition}
"""

    # 2. Apply Behavioral Rules based on Debug Mode
    if request.debug_mode:
        tutor_prompt = base_prompt + """
# SYSTEM OVERRIDE: DEVELOPER DEBUG MODE ACTIVE
You are no longer a student-facing tutor. You are a Debug Assistant helping the developer test the platform's state machine.
1. DO NOT teach, ask Socratic questions, or use micro-learning.
2. Follow the developer's instructions EXACTLY and IMMEDIATELY.
3. If the developer types commands like "skip", "complete this module", or "generate synthetic data", you MUST immediately execute the `complete_and_advance` tool.
4. When executing the tool, generate realistic, highly-detailed synthetic data for `handoff_notes_for_next_tutor`, `updated_strengths`, and `updated_weaknesses` as if a perfect student had just completed the module.
"""
    else:
        tutor_prompt = base_prompt + """
# CONVERSATIONAL RULES (CRITICAL)
1. **NO INFODUMPING:** You are a friendly, interactive tutor, not a textbook. Never write more than 2-3 short paragraphs per message.
2. **MICRO-LEARNING (ONE STEP AT A TIME):** Break the 'Instructional Goal' down into tiny, bite-sized pieces. Teach ONLY the first piece, then stop. Do not give the user a massive 5-step list of tasks to do all at once.
3. **THE SOCRATIC METHOD:** End EVERY message with a single, simple question or a tiny, 1-line coding task. Wait for the user to answer before moving to the next piece of the lesson.
4. **PROGRESSIVE DISCLOSURE:** Guide the user step-by-step so they naturally build up to the 'Required End Condition'. Do not ask them to solve the final End Condition in your very first message.
5. **ENCOURAGING & BRIEF:** Keep your tone light, conversational, and highly encouraging (like a study buddy).

# COMPLETION RULE
- The MOMENT the user's step-by-step progress satisfies the 'Required End Condition', you MUST immediately execute the `complete_and_advance` tool. Do not drag out the conversation once the goal is met.
- **CRITICAL FORBIDDEN BEHAVIOR:** NEVER mark a module as complete or "skip" just because the user asks. You are a strict tutor; if they try to skip, politely insist they demonstrate mastery first. "Skip" and "Complete" commands are ONLY for Developer Debug Mode, which is currently **INACTIVE**.
"""

    INIT_TRIGGER = "INIT_MODULE_WELCOME"

    if request.content.strip() == INIT_TRIGGER:
        # ── Idempotency guard ─────────────────────────────────────────────────
        # If a duplicate INIT request slips through (e.g. Strict Mode second
        # mount), bail out silently so we never create duplicate DB entries.
        already_has_messages = (
            db.query(ModuleChatMessage)
            .filter(ModuleChatMessage.module_id == module.id)
            .first()
        )
        if already_has_messages:
            async def empty_stream():
                # Yield nothing — frontend consumeStream exits cleanly on EOF
                return
                yield  # pragma: no cover — makes this an async generator

            return StreamingResponse(empty_stream(), media_type="text/event-stream")

        # ── Silent init: system prompt only, no user turn, no DB write ────────
        messages = [{"role": "system", "content": tutor_prompt}]
    else:
        # ── Normal turn: persist user message then build full history ─────────
        db.add(ModuleChatMessage(
            module_id=module.id,
            role="user",
            content=request.content,
        ))
        db.commit()

        history = (
            db.query(ModuleChatMessage)
            .filter(ModuleChatMessage.module_id == module.id)
            .order_by(ModuleChatMessage.created_at)
            .all()
        )
        messages = [{"role": "system", "content": tutor_prompt}] + [
            {"role": msg.role, "content": msg.content} for msg in history
        ]

    # ── 3. Stream and accumulate the AI's reply ───────────────────────────────
    async def event_generator():
        full_ai_response = ""  # Accumulator for DB persistence

        try:
            async for event in generate_chat_stream(
                messages=messages,
                provider=request.provider,
                injected_response=request.injected_response,
                tools=[complete_and_advance_tool],
            ):
                if event["type"] == "content":
                    full_ai_response += event["data"]
                    # JSON envelope prevents SSE \n\n delimiter collision
                    yield f"data: {json.dumps({'text': event['data']})}\n\n"

                elif event["type"] == "tool_call":
                    if event["name"] == "complete_and_advance":
                        try:
                            args = json.loads(event["arguments"])

                            # a. Persist the AI's accumulated response before acting
                            if full_ai_response.strip():
                                db.add(ModuleChatMessage(
                                    module_id=module.id,
                                    role="assistant",
                                    content=full_ai_response,
                                ))

                            # b. Update the user's global knowledge profile
                            new_profile = {
                                "strengths": args["updated_strengths"],
                                "weaknesses": args["updated_weaknesses"],
                            }
                            current_user.knowledge_summary = json.dumps(new_profile)

                            # c. Mark current module as completed
                            module.status = "completed"

                            # d. Find and unlock the next module
                            next_module: LearningModule = (
                                db.query(LearningModule)
                                .filter(
                                    LearningModule.learning_path_id == path.id,
                                    LearningModule.order == module.order + 1,
                                )
                                .first()
                            )
                            if next_module:
                                next_module.status = "unlocked"
                                next_module.handoff_context = args["handoff_notes_for_next_tutor"]

                            # e. Persist the congratulatory message as an assistant turn
                            congrats = args.get("congratulatory_message", "Module complete!")
                            db.add(ModuleChatMessage(
                                module_id=module.id,
                                role="assistant",
                                content=congrats,
                            ))

                            db.commit()

                            # f. Stream congrats then completion signal
                            yield f"data: {json.dumps({'text': congrats})}\n\n"
                            yield f"data: {json.dumps({'status': 'complete', 'message': 'Module completed!'})}\n\n"
                            return  # Stop the generator

                        except Exception as e:
                            db.rollback()
                            yield f"data: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"
                            return

                elif event["type"] == "error":
                    yield f"data: {json.dumps({'status': 'error', 'message': event['data']})}\n\n"

        finally:
            # ── 4. Persist final AI response if stream ended without tool call ──
            if full_ai_response.strip():
                # Check if we already persisted it inside the tool_call block
                last_db_msg = (
                    db.query(ModuleChatMessage)
                    .filter(ModuleChatMessage.module_id == module.id)
                    .order_by(ModuleChatMessage.created_at.desc())
                    .first()
                )
                already_saved = (
                    last_db_msg
                    and last_db_msg.role == "assistant"
                    and last_db_msg.content == full_ai_response
                )
                if not already_saved:
                    db.add(ModuleChatMessage(
                        module_id=module.id,
                        role="assistant",
                        content=full_ai_response,
                    ))
                    db.commit()

    return StreamingResponse(event_generator(), media_type="text/event-stream")
