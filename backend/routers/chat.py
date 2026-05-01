import json
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..dependencies import get_current_user
from ..database import get_db
from ..models import User, LearningPath, LearningModule
from ..ai_gateway import generate_chat_stream

router = APIRouter(
    prefix="/api/chat",
    tags=["Chat"]
)

@router.get("/knowledge-summary")
async def get_knowledge_summary(current_user: User = Depends(get_current_user)):
    """Returns the current user's knowledge summary for display on the dashboard."""
    if not current_user.knowledge_summary:
        return {"knowledge_summary": None}
    try:
        return {"knowledge_summary": json.loads(current_user.knowledge_summary)}
    except Exception:
        return {"knowledge_summary": None}

class ChatRequest(BaseModel):
    messages: List[Dict[str, Any]]
    provider: str
    injected_response: Optional[str] = None
    debug_mode: bool = False
    use_openrouter: bool = False

research_market_tool = {
    "type": "function",
    "function": {
        "name": "research_market_demands",
        "description": "Searches the live internet for current market trends, job requirements, and industry shifts related to the user's goal. Use this BEFORE generating a learning path to ensure the syllabus is aligned with real-world demands.",
        "parameters": {
            "type": "object",
            "properties": {
                "search_query": {
                    "type": "string",
                    "description": "A highly specific query detailing the user's goal and current knowledge to find exact market requirements."
                }
            },
            "required": ["search_query"]
        }
    }
}

ASSESSOR_SYSTEM_PROMPT = """
You are the Lead Syllabus Architect for NeuroPath. Your sole objective is to assess the user's current technical knowledge deeply but efficiently, so we can build highly personalized learning paths later.

# RULES OF ENGAGEMENT
1. **Dynamic Depth (5 to 8 Turns):** You must ask enough questions to get a solid technical baseline, but DO NOT exceed 8 conversational turns. Respect the user's time.
2. **Conversational, Yet Dense:** You may ask up to 2 or 3 closely related questions in a single message. CRITICAL FORMATTING: You MUST use standard markdown newlines. Absolutely DO NOT use HTML tags like <br> or <br/> for spacing. Use actual carriage returns/newlines. If you ask multiple questions, you MUST format them as a numbered list (1., 2., 3.). You MUST place two full line breaks (\n\n) between each question so they are visually separated. NEVER combine them into a single inline paragraph. Example:
"First question?

1. Second question?

2. Third question?"
3. **Probing, Not Trivia:** Do not ask them to write code or define terms. Ask about their practical experience, scale, and frameworks. 
4. **Adaptive Pacing:** If the user gives highly detailed, multi-paragraph answers, you can assess them faster and end the assessment sooner. If they give one-word answers, gently probe deeper.
5. **The Blank Slate Protocol (CRITICAL):** If the user claims they know absolutely nothing or are uncooperative, DO NOT immediately execute the tool. Gently coax them for 2 to 3 turns to find adjacent skills (e.g., "No problem! Have you ever used complex Excel formulas, or maybe tinkered with a basic website?"). If they still yield zero technical data after 3 attempts, end the chat and execute the tool.
6. **The End Condition:** Once you have a comprehensive understanding of their known concepts and their critical knowledge gaps (or if you hit the turn limits), you MUST stop asking questions.
7. **Tool Execution:** To end the session, you MUST execute the `update_knowledge_summary` tool. Pass in the detailed data you have gathered.
8. **Final Message:** After (or alongside) calling the tool, provide a single, brief concluding sentence like: "Excellent, I have a clear picture of your skills now. Your knowledge profile is updated, and we are ready to start building your path!" Do not ask any follow-up questions after this.
9. **Goal-Oriented Probing (CRITICAL):** You MUST tailor your questions specifically to the user's ULTIMATE LEARNING GOAL provided in the context below. Do not ask generic programming questions if they are irrelevant to their stated goal. Every question should be laser-focused on what they need to know to achieve that goal.
10. **Narrative Summaries (CRITICAL):** When executing the `update_knowledge_summary` tool, you MUST write detailed, 3-4 sentence narrative paragraphs for both `strengths` and `weaknesses`. Do NOT use bullet points, arrays, or short lists. Write in prose, as a Senior Engineer would summarize a colleague's technical profile in a written review.

# TONE
Professional, encouraging, and highly analytical. You are a Senior Staff Engineer evaluating a new team member's capabilities—be thorough, but respectful of their time.
"""

knowledge_tool = {
    "type": "function",
    "function": {
        "name": "update_knowledge_summary",
        "description": "Outputs the newly synthesized and merged narrative knowledge profile, completely replacing the old one with this updated version.",
        "parameters": {
            "type": "object",
            "properties": {
                "strengths": {
                    "type": "string",
                    "description": "A well-written, professional paragraph (3-4 sentences) summarizing the user's validated skills and practical experience levels."
                },
                "weaknesses": {
                    "type": "string",
                    "description": "A private paragraph outlining their knowledge gaps and areas requiring focused study to achieve their main goal."
                }
            },
            "required": ["strengths", "weaknesses"]
        }
    }
}

@router.post("/knowledge-setup")
async def chat_knowledge_setup(request: ChatRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    
    # Build dynamic context with user goal and existing knowledge profile
    goal = current_user.main_goal or "Not specified"
    dynamic_context = f"THE USER'S ULTIMATE LEARNING GOAL: {goal}\n"

    if current_user.knowledge_summary:
        dynamic_context += (
            f"CURRENT KNOWLEDGE PROFILE: {current_user.knowledge_summary}\n"
            "INSTRUCTION: The user already possesses these skills. Your job is to assess their NEW skills "
            "from this conversation and MERGE them with the existing profile. If they learn specific "
            "sub-topics, condense them into broader categories (e.g., if the old profile has "
            "'Python variables, loops' and they just learned 'functions', update the new summary to simply "
            "say 'Python Basics Foundation').\n"
        )
    else:
        dynamic_context += "CURRENT KNOWLEDGE PROFILE: Blank Slate. This is a new user.\n"

    # Combine the dynamic context with the base system prompt
    full_system_prompt = dynamic_context + "\n" + ASSESSOR_SYSTEM_PROMPT

    # Inject as the first system message
    messages = [{"role": "system", "content": full_system_prompt}] + request.messages

    async def event_generator():
        with open("debug.txt", "a") as debug_file:
            debug_file.write("\n\n--- NEW STREAM ---\n")
            async for event in generate_chat_stream(
                messages=messages,
                provider=request.provider,
                injected_response=request.injected_response,
                tools=[knowledge_tool]
            ):
                if event["type"] == "content":
                    safe_data = json.dumps({"text": event["data"]})
                    debug_file.write(event["data"])  # Keep debug file working
                    debug_file.flush()
                    yield f"data: {safe_data}\n\n"
                elif event["type"] == "tool_call":
                    if event["name"] == "update_knowledge_summary":
                        try:
                            args = json.loads(event["arguments"])
                            current_user.knowledge_summary = json.dumps(args)
                            db.commit()
                            yield 'data: {"status": "complete", "message": "Knowledge Summary Updated!"}\n\n'
                        except Exception as e:
                            yield f'data: {{"status": "error", "message": "Failed to parse tool arguments: {str(e)}"}}\n\n'
                elif event["type"] == "error":
                    yield f"data: {event['data']}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.post("/generate-path")
async def chat_generate_path(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Phase 3: Syllabus Architect streaming endpoint. Saves generated path to DB."""

    goal = current_user.main_goal or "Not specified"
    knowledge = current_user.knowledge_summary or "No profile yet."
    dynamic_context = (
        f"User's Main Goal: {goal}\n"
        f"User's Current Knowledge Profile: {knowledge}\n"
    )

    # 1. Dynamic Stack Selection
    if request.use_openrouter:
        active_provider = "openrouter"
        active_tools = [generate_learning_path_tool, research_market_tool]
        research_directive = "You have access to the `research_market_demands` tool. Once you understand the user's goal, you MUST use this tool to search the live web for current industry requirements BEFORE you use the `generate_learning_path` tool."
    else:
        active_provider = "deepseek"
        active_tools = [generate_learning_path_tool]
        research_directive = "Rely purely on your internal knowledge base to assess the user and generate the syllabus. You do not have access to live web search."

    base_prompt = f"""You are the Lead Curriculum Architect for NeuroPath. A user has clicked "Learn Something New" and told you what they want to learn. Your job is to assess their readiness, pitch a custom syllabus, and upon their approval, generate a strict JSON learning path.

# TOOL DIRECTIVE
{research_directive}

# SYLLABUS CONSTRAINTS (ALWAYS APPLY)
1. **Module Constraints:** The final generated path must be highly specific, cohesive, and contain no more than 10 modules. If it is a coding topic, create a cohesive underlying project (like a consistent dataset or app) that spans across the modules so it feels like a real-world workflow.
2. **The Capstone Requirement:** The final module in your generated syllabus MUST always be a hands-on mini-project. It should not introduce new theory. Instead, it must require the user to combine the skills learned in the preceding modules into a single, cohesive deliverable. It must be simple, achievable, but highly practical.
"""

    if request.debug_mode:
        system_prompt = base_prompt + """
# SYSTEM OVERRIDE: DEVELOPER DEBUG MODE ACTIVE
You are operating in God Mode to assist the developer in testing the platform.
1. DO NOT ask the user any questions to gauge their experience level or preferences.
2. DO NOT engage in conversational back-and-forth.
3. IMMEDIATELY execute the `generate_learning_path` tool. 
4. CRITICAL: NEVER output the JSON syllabus as text in the chat. You MUST ONLY output it via the `generate_learning_path` tool.
"""
    else:
        system_prompt = base_prompt + """
# STANDARD BEHAVIORAL RULES
1. **The Readiness Check (Don't Rush):** Compare what they want to learn against their Current Knowledge Profile. If they lack critical prerequisites, you MUST pivot. Gently explain the gap and propose building a foundation first.
2. **The Q&A Phase:** If their request is broad, ask up to 3-5 targeted technical questions to figure out exactly where they should start.
3. **The Pitch & Justification:** Propose a high-level outline (Max 10 modules). Explain why this specific path is perfect for them.
4. **The Consent Gate:** End your pitch by explicitly asking for their approval. (e.g., "How does this outline look to you? Are we ready to build it?")
5. **Tool Execution (CRITICAL):** DO NOT execute the `generate_learning_path` tool until the user explicitly agrees to your proposed outline (e.g., they say "Yes", "Looks good", "Let's do it").
6. **NO RAW JSON (MANDATORY):** Absolutely NEVER output the JSON learning path as text in the chat. You MUST ONLY deliver the final syllabus by calling the `generate_learning_path` tool. If you output raw JSON in the chat, the system will fail.
"""

    full_system_prompt = dynamic_context + "\n" + system_prompt
    messages = [{"role": "system", "content": full_system_prompt}] + request.messages

    async def event_generator():
        current_messages = list(messages)
        while True:
            called_internal_tool = False
            async for event in generate_chat_stream(
                messages=current_messages,
                provider=active_provider,
                injected_response=request.injected_response,
                tools=active_tools
            ):
                if event["type"] == "content":
                    safe_data = json.dumps({"text": event["data"]})
                    yield f"data: {safe_data}\n\n"

                elif event["type"] == "tool_call":
                    if event["name"] == "research_market_demands":
                        called_internal_tool = True
                        search_query = json.loads(event["arguments"]).get("search_query")
                        
                        yield f'data: {{"text": "\\n\\n*[Researching live market demands...]*\\n\\n"}}\n\n'
                        
                        from openai import AsyncOpenAI
                        from ..ai_gateway import OPENROUTER_API_KEY
                        client = AsyncOpenAI(api_key=OPENROUTER_API_KEY, base_url="https://openrouter.ai/api/v1")
                        
                        try:
                            resp = await client.chat.completions.create(
                                model="perplexity/llama-3-sonar-large-32k-online",
                                messages=[{"role": "user", "content": "You are an expert industry analyst. Return a concise summary of current market demands, required tools, and paradigm shifts based on the user's query: " + str(search_query)}]
                            )
                            market_data = resp.choices[0].message.content
                        except Exception as e:
                            market_data = f"Research failed: {str(e)}"
                            
                        current_messages.append({
                            "role": "assistant",
                            "content": None,
                            "tool_calls": [{
                                "id": "call_research",
                                "type": "function",
                                "function": {
                                    "name": "research_market_demands",
                                    "arguments": event["arguments"]
                                }
                            }]
                        })
                        current_messages.append({
                            "tool_call_id": "call_research",
                            "role": "tool",
                            "name": "research_market_demands",
                            "content": market_data
                        })
                        break # Break inner loop, continue while True to let model respond

                    elif event["name"] == "generate_learning_path":
                        try:
                            args = json.loads(event["arguments"])

                            user_profile = args.get("user_profile", {})
                            main_workflow = args.get("main_workflow", {})
                            modules_data = args.get("learning_path", [])

                            new_path = LearningPath(
                                user_id=current_user.id,
                                overall_target=main_workflow.get("overall_target", ""),
                                dataset_configuration=json.dumps(main_workflow.get("dataset_configuration")) if main_workflow.get("dataset_configuration") else None,
                                progression_roadmap=json.dumps(main_workflow.get("progression_roadmap", [])),
                                global_assessment_rules=main_workflow.get("global_assessment_rules"),
                                user_request=user_profile.get("user_request"),
                                user_learning_preferences=user_profile.get("user_learning_preferences"),
                                skill_summary=user_profile.get("skill_summary"),
                            )
                            db.add(new_path)
                            db.flush()

                            for idx, mod in enumerate(modules_data):
                                db.add(LearningModule(
                                    learning_path_id=new_path.id,
                                    module_id=mod.get("id", f"module_{idx+1}"),
                                    module_type=mod.get("module_type", "lesson"),
                                    title=mod.get("title", ""),
                                    instructional_goal=mod.get("instructional_goal"),
                                    end_condition=mod.get("end_condition"),
                                    status=mod.get("status", "locked"),
                                    order=idx,
                                ))

                            db.commit()
                            yield f'data: {{"status": "complete", "message": "Syllabus generated successfully!", "path_id": "{new_path.id}"}}\n\n'
                            return # End the stream

                        except Exception as e:
                            db.rollback()
                            yield f'data: {{"status": "error", "message": "Failed to save learning path: {str(e)}"}}\n\n'
                            return

                elif event["type"] == "error":
                    yield f"data: {event['data']}\n\n"
                    return
            
            if not called_internal_tool:
                break # Exit if the model just talked and didn't call research

    return StreamingResponse(event_generator(), media_type="text/event-stream")


generate_learning_path_tool = {
    "type": "function",
    "function": {
        "name": "generate_learning_path",
        "description": "Generates the final, highly detailed JSON syllabus state machine once the user has approved the learning path.",
        "parameters": {
            "type": "object",
            "properties": {
                "user_profile": {
                    "type": "object",
                    "properties": {
                        "user_request": {"type": "string", "description": "What the user explicitly asked to learn."},
                        "user_learning_preferences": {"type": "string"},
                        "skill_summary": {"type": "string", "description": "Brief summary of their current related skills."},
                        "user_goal": {"type": "string"}
                    },
                    "required": ["user_request", "user_learning_preferences", "skill_summary", "user_goal"]
                },
                "main_workflow": {
                    "type": "object",
                    "properties": {
                        "overall_target": {"type": "string", "description": "The ultimate project or goal of this specific path."},
                        "dataset_configuration": {
                            "type": "object",
                            "description": "Optional. If this is a data/coding path, define a consistent dataset/project environment to use across all modules.",
                            "properties": {
                                "name": {"type": "string"},
                                "context": {"type": "string"},
                                "columns": {"type": "array", "items": {"type": "string"}},
                                "purposeful_imperfections": {"type": "string"},
                                "restrictions": {"type": "string"}
                            }
                        },
                        "progression_roadmap": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "High-level names of the phases."
                        },
                        "global_assessment_rules": {"type": "string"}
                    },
                    "required": ["overall_target", "progression_roadmap", "global_assessment_rules"]
                },
                "learning_path": {
                    "type": "array",
                    "description": "The sequential modules. Maximum 10 items. The final item MUST be a capstone project.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string", "description": "Unique identifier, e.g., py_basics_001"},
                            "module_type": {
                                "type": "string", 
                                "enum": ["lesson", "project"], 
                                "description": "Standard learning nodes are 'lesson'. The final capstone node MUST be 'project'."
                            },
                            "title": {"type": "string"},
                            "instructional_goal": {"type": "string", "description": "What the AI tutor must teach or guide the user to build."},
                            "end_condition": {"type": "string", "description": "The exact criteria or code the user must produce to pass this node."},
                            "status": {"type": "string", "enum": ["unlocked", "locked"], "description": "Node 1 should be unlocked, the rest locked."}
                        },
                        "required": ["id", "module_type", "title", "instructional_goal", "end_condition", "status"]
                    }
                }
            },
            "required": ["user_profile", "main_workflow", "learning_path"]
        }
    }
}
