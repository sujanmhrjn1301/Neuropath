from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import os
import json
from openai import AsyncOpenAI
from sqlalchemy.orm import Session
from typing import List

from ..dependencies import get_current_user
from ..database import get_db
from ..models import User, LearningModule, LearningPath

router = APIRouter(prefix="/api/recommendations", tags=["Recommendations"])

# ── Request / Response schemas ─────────────────────────────────────────────

class RecommendationRequest(BaseModel):
    use_deepseek: bool = True  # Toggle for testing

class RecommendationItem(BaseModel):
    title: str
    type: str  # "Project" or "Topic"
    description: str
    market_demand_facts: str  # Realistic data/facts on why this is relevant
    goal_alignment: str  # How it specifically helps their knowledge summary/goal

class RecommendationResponse(BaseModel):
    recommendations: List[RecommendationItem]


# ── POST /generate ─────────────────────────────────────────────────────────

@router.post("/generate", response_model=RecommendationResponse)
async def generate_recommendations(
    request: RecommendationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate next steps (Project/Course) based on the user's goal and knowledge.
    Uses either DeepSeek or OpenRouter (Perplexity) based on the request flag.
    """
    goal = current_user.main_goal or "Not specified"
    knowledge_summary = current_user.knowledge_summary or "No knowledge summary available."

    recent_modules = (
        db.query(LearningModule)
        .join(LearningPath)
        .filter(LearningPath.user_id == current_user.id)
        .filter(LearningModule.status == "completed")
        .order_by(LearningPath.created_at.desc(), LearningModule.order.desc())
        .limit(10)
        .all()
    )

    if recent_modules:
        formatted_recent_paths = "\n".join([f"- {m.title}" for m in recent_modules])
    else:
        formatted_recent_paths = "No prior modules completed yet. Suggest beginner-friendly entry points."

    system_prompt = f"""You are an Expert Technical Mentor and Career Strategist.
# USER PROFILE
Goal: {goal}
Knowledge Summary: {knowledge_summary}
Recent Learning History:
{formatted_recent_paths}

# OBJECTIVE
Analyze their recent learning history, knowledge summary, and goal. Suggest 6 highly specific next steps to advance their skills:
1. Three practical **Projects** they should build (varying complexity).
2. Three theoretical **Topics/Skills** they need to study next.

# STRICT VENDOR-NEUTRAL GUARDRAIL
You are strictly forbidden from recommending, mentioning, or promoting ANY third-party companies, educational platforms, bootcamps, or specific certifications (e.g., DO NOT mention Coursera, Udemy, edX, Pluralsight, AWS Certifications, etc.). 
You must only recommend the raw skills, frameworks, or concepts they need to learn. 

# OUTPUT FORMAT
You must output valid JSON matching this schema:
{{
    "recommendations": [
        {{
            "title": "Name of the project or specific skill",
            "type": "Project", // Must be exactly "Project" or "Topic"
            "description": "A deep explanation of what this is.",
            "market_demand_facts": "Realistic data/facts on why this skill/project is in demand right now.",
            "goal_alignment": "Exactly how this bridges the gap between their current knowledge and their ultimate goal."
        }}
    ]
}}
"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": "Please generate my next career/learning recommendations in JSON format."}
    ]

    try:
        if request.use_deepseek:
            api_key = os.getenv("DEEPSEEK_API_KEY")
            if not api_key:
                raise HTTPException(status_code=500, detail="DEEPSEEK_API_KEY not set")
            client = AsyncOpenAI(api_key=api_key, base_url="https://api.deepseek.com")
            model = "deepseek-chat"
            
            response = await client.chat.completions.create(
                model=model,
                messages=messages,
                response_format={"type": "json_object"},
            )
        else:
            api_key = os.getenv("OPENROUTER_API_KEY")
            if not api_key:
                raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY not set")
            client = AsyncOpenAI(api_key=api_key, base_url="https://openrouter.ai/api/v1")
            model = "perplexity/llama-3.1-sonar-large-128k-online"
            
            # OpenRouter JSON mode instructions
            response = await client.chat.completions.create(
                model=model,
                messages=messages,
                response_format={"type": "json_object"},
            )

        content = response.choices[0].message.content
        
        # Strip potential markdown formatting if the model still wraps it
        if content.startswith("```json"):
            content = content[7:]
        if content.endswith("```"):
            content = content[:-3]
            
        data = json.loads(content.strip())
        return RecommendationResponse(**data)

    except json.JSONDecodeError as e:
        print("JSON Decode Error. Raw response:", content)
        raise HTTPException(status_code=500, detail=f"LLM returned invalid JSON: {str(e)}")
    except Exception as e:
        print("Error generating recommendations:", e)
        raise HTTPException(status_code=500, detail=f"Error generating recommendations: {str(e)}")
