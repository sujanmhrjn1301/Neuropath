from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from openai import AsyncOpenAI
import os
import json

from ..schemas import SyllabusGenerateRequest
from ..dependencies import get_current_user
from ..database import get_db
from ..models import User, LearningPath, LearningModule
from ..ai_gateway import fetch_market_research, DEEPSEEK_API_KEY

router = APIRouter(prefix="/api/syllabus", tags=["Syllabus"])

@router.post("/generate")
async def generate_syllabus(
    request: SyllabusGenerateRequest, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Phase 1: Fetch Market Research
    market_research_data = await fetch_market_research(
        goal=request.goal, 
        location=request.location, 
        use_openrouter=request.use_openrouter
    )
    
    # 2. Phase 2: Generate the Syllabus
    system_prompt = f"""You are an Expert Curriculum Designer.
The user wants to achieve this goal: {request.goal}.

# LIVE MARKET RESEARCH
You MUST base your curriculum directly on the following real-world market demands and skills:
{market_research_data}

# OBJECTIVE
Design a highly structured, step-by-step syllabus.
The final path must be highly specific, cohesive, and contain no more than 10 modules. 
If it is a coding topic, create a cohesive underlying project that spans across the modules.
The final module MUST be a capstone project.

# OUTPUT FORMAT
You MUST return valid JSON exactly matching this schema:
{{
  "user_profile": {{
    "user_request": "{request.goal}",
    "user_learning_preferences": "Not specified",
    "skill_summary": "Beginner",
    "user_goal": "{request.goal}"
  }},
  "main_workflow": {{
    "overall_target": "The ultimate project or goal of this specific path.",
    "dataset_configuration": {{}},
    "progression_roadmap": ["Phase 1", "Phase 2"],
    "global_assessment_rules": "How to assess"
  }},
  "learning_path": [
    {{
      "id": "unique_module_id",
      "module_type": "lesson",  // "lesson" or "project". The final node MUST be "project"
      "title": "Module Title",
      "instructional_goal": "What the user will learn",
      "end_condition": "How the module is considered complete",
      "status": "locked" // first module can be "unlocked", others "locked"
    }}
  ]
}}
"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": "Please generate my custom syllabus in JSON format based on the market research."}
    ]

    client = AsyncOpenAI(api_key=DEEPSEEK_API_KEY, base_url="https://api.deepseek.com")
    
    try:
        response = await client.chat.completions.create(
            model="deepseek-chat",
            messages=messages,
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content
        if content.startswith("```json"):
            content = content[7:]
        if content.endswith("```"):
            content = content[:-3]
            
        syllabus_data = json.loads(content.strip())
        
        # Save to DB
        user_profile = syllabus_data.get("user_profile", {})
        main_workflow = syllabus_data.get("main_workflow", {})
        modules_data = syllabus_data.get("learning_path", [])
        
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
                status=mod.get("status", "locked") if idx > 0 else "unlocked",
                order=idx,
            ))
            
        db.commit()
        db.refresh(new_path)
        
        return {"status": "success", "path_id": new_path.id, "data": syllabus_data}
        
    except json.JSONDecodeError as e:
        db.rollback()
        print("JSON Decode Error:", content)
        raise HTTPException(status_code=500, detail="LLM returned invalid JSON.")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
