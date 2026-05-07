from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
import asyncio
from typing import List, Optional
import os
import json
from openai import AsyncOpenAI
from pydantic import BaseModel

from ..database import get_db
from ..dependencies import get_current_user
from ..models import User, LearningPath, LearningModule, ModuleChatMessage, ConfusionChatMessage, ConfusionNode, Notification

router = APIRouter(
    prefix="/api/notifications",
    tags=["Notifications"]
)

async def generate_motivation(client, current_user, db, now):
    try:
        # Check if already exists for today
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        existing = db.query(Notification).filter(
            Notification.user_id == current_user.id,
            Notification.type == "motivation",
            Notification.created_at >= today_start
        ).first()
        if existing: return None

        motivation_prompt = f"Generate a short, professional, and inspiring motivational quote (1 sentence) for a user learning about: {current_user.main_goal or 'their goals'}. JSON: {{ 'message': '...', 'emoji': '...' }}"
        response = await client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "system", "content": "You are a professional coach."}, {"role": "user", "content": motivation_prompt}],
            response_format={"type": "json_object"},
            timeout=15.0
        )
        data = json.loads(response.choices[0].message.content)
        new_notif = Notification(
            user_id=current_user.id,
            type="motivation",
            title="Daily Motivation ✨",
            content=f"{data['message']} {data['emoji']}",
            created_at=now
        )
        db.add(new_notif)
        db.commit()
        return new_notif
    except Exception as e:
        print(f"Motivation Error: {e}")
        return None

async def generate_nudge(client, current_user, db, inactivity_days, history, last_active, now):
    try:
        # Check if already nudged for this specific gap
        existing = db.query(Notification).filter(
            Notification.user_id == current_user.id,
            Notification.type == "recommendation",
            Notification.created_at > last_active
        ).first()
        if existing: return None

        persona = "devoted companion" if inactivity_days >= 30 else "professional coach"
        title = "NeuroPath Misses You... ❤️" if inactivity_days >= 30 else "Ready to continue? 📚"
        prompt = f"User away for {inactivity_days} days. History: {history}. Goal: {current_user.main_goal}. Role: {persona}. Suggest next topic. JSON: {{'title': '...', 'hook': '...', 'reason': '...'}}"
        
        response = await client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "system", "content": f"You are a {persona}."}, {"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            timeout=15.0
        )
        rec = json.loads(response.choices[0].message.content)
        new_nudge = Notification(
            user_id=current_user.id,
            type="recommendation",
            title=title,
            content=f"{rec['hook']} How about diving into {rec['title']}?",
            recommendation_data=json.dumps({"title": rec['title'], "description": rec['reason']}),
            created_at=now
        )
        db.add(new_nudge)
        db.commit()
        return new_nudge
    except Exception as e:
        print(f"Nudge Error: {e}")
        return None

@router.get("")
async def get_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    api_key = os.getenv("DEEPSEEK_API_KEY")
    now = datetime.utcnow()
    
    # 1. Fetch latest activity
    last_module_msg = db.query(func.max(ModuleChatMessage.created_at)).join(LearningModule).join(LearningPath).filter(LearningPath.user_id == current_user.id).scalar()
    last_confusion_msg = db.query(func.max(ConfusionChatMessage.created_at)).join(ConfusionNode).filter(ConfusionNode.user_id == current_user.id).scalar()
    last_active = max(last_module_msg or current_user.created_at, last_confusion_msg or current_user.created_at, current_user.created_at)
    
    inactivity_period = now - last_active
    
    # 2. Trigger background generation if needed (in parallel)
    if api_key:
        client = AsyncOpenAI(api_key=api_key, base_url="https://api.deepseek.com")
        tasks = [generate_motivation(client, current_user, db, now)]
        if inactivity_period.days >= 3:
            recent_modules = db.query(LearningModule).join(LearningPath).filter(LearningPath.user_id == current_user.id, LearningModule.status == "completed").order_by(LearningModule.created_at.desc()).limit(10).all()
            history = "\n".join([f"- {m.title}" for m in recent_modules]) if recent_modules else "No history yet."
            tasks.append(generate_nudge(client, current_user, db, inactivity_period.days, history, last_active, now))
        
        await asyncio.gather(*tasks)

    # 3. Return all unread from DB
    all_notifs = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).order_by(Notification.created_at.desc()).all()

    return [{
        "id": n.id,
        "type": n.type,
        "title": n.title,
        "content": n.content,
        "recommendation": json.loads(n.recommendation_data) if n.recommendation_data else None,
        "created_at": n.created_at.isoformat()
    } for n in all_notifs]

@router.post("/clear")
async def clear_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.user_id == current_user.id).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read"}
