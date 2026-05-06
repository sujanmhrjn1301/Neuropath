from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import Dict, Any

from ..database import get_db
from ..dependencies import get_current_user
from ..models import User, LearningPath, LearningModule, ModuleChatMessage, ConfusionChatMessage, ConfusionNode

router = APIRouter(
    prefix="/api/stats",
    tags=["Stats"]
)

@router.get("/overview")
async def get_stats_overview(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 1. Mastery & Concepts
    paths = db.query(LearningPath).filter(LearningPath.user_id == current_user.id).all()
    
    total_mastered = 0
    total_concepts = 0
    
    for path in paths:
        completed = db.query(LearningModule).filter(
            LearningModule.learning_path_id == path.id,
            LearningModule.status == "completed"
        ).count()
        total = db.query(LearningModule).filter(
            LearningModule.learning_path_id == path.id
        ).count()
        
        total_mastered += completed
        total_concepts += total

    mastery_percent = int((total_mastered / total_concepts) * 100) if total_concepts > 0 else 0

    # 3. Streak Calculation
    # Logic to calculate streak based on message history
    # Join ModuleChatMessage -> LearningModule -> LearningPath to reach user_id
    activity_days = db.query(func.date(ModuleChatMessage.created_at)).join(
        LearningModule, ModuleChatMessage.module_id == LearningModule.id
    ).join(
        LearningPath, LearningModule.learning_path_id == LearningPath.id
    ).filter(
        LearningPath.user_id == current_user.id
    ).distinct().all()
    
    # Flatten and convert to set of dates
    activity_dates = {d[0] for d in activity_days}
    
    # Corrected confusion dates query - use explicit join instead of .has()
    confusion_msg_dates = db.query(func.date(ConfusionChatMessage.created_at))\
        .join(ConfusionNode, ConfusionChatMessage.confusion_node_id == ConfusionNode.id)\
        .filter(ConfusionNode.user_id == current_user.id)\
        .distinct().all()
    
    for d in confusion_msg_dates:
        activity_dates.add(d[0])
    
    streak = 0
    if activity_dates:
        # Convert string dates to date objects if they aren't already
        date_objs = []
        for d in activity_dates:
            if isinstance(d, str):
                date_objs.append(datetime.strptime(d, '%Y-%m-%d').date())
            else:
                date_objs.append(d)
        
        date_objs.sort(reverse=True)
        
        today = datetime.utcnow().date()
        yesterday = today - timedelta(days=1)
        
        if date_objs[0] == today or date_objs[0] == yesterday:
            streak = 1
            for i in range(len(date_objs) - 1):
                if (date_objs[i] - date_objs[i+1]).days == 1:
                    streak += 1
                else:
                    break
    
    # 3. Total Time (Estimate)
    # Heuristic: Each message pair (user -> assistant) represents ~5 minutes of focus time
    total_messages = db.query(ModuleChatMessage)\
        .join(LearningModule)\
        .join(LearningPath)\
        .filter(LearningPath.user_id == current_user.id).count()
        
    total_confusion_messages = db.query(ConfusionChatMessage)\
        .join(ConfusionNode, ConfusionChatMessage.confusion_node_id == ConfusionNode.id)\
        .filter(ConfusionNode.user_id == current_user.id).count()
    
    estimated_minutes = (total_messages + total_confusion_messages) * 2.5 # Average 2.5 mins per message
    estimated_hours = round(estimated_minutes / 60, 1)

    # 4. Recently Completed
    recent_modules = db.query(LearningModule).join(LearningPath).filter(
        LearningPath.user_id == current_user.id,
        LearningModule.status == "completed"
    ).order_by(LearningModule.id.desc()).limit(3).all() # Should ideally use a completed_at timestamp, but we don't have one yet. Using id desc as fallback.

    recently_completed = [
        {
            "title": m.title,
            "date": "Recently", # Since we don't have completed_at yet
            "score": "95%" # Mocked score for now
        }
        for m in recent_modules
    ]

    # 5. Dynamic Pace Calculation
    # Baseline: 1 module every 2 days is the "average" (0.5 mod/day)
    account_age_days = (datetime.utcnow() - current_user.created_at).days
    if account_age_days < 1: account_age_days = 1 # Avoid division by zero
    
    user_pace = total_mastered / account_age_days
    average_pace = 0.5 # Baseline benchmark
    
    if total_mastered == 0:
        pace_comparison = 0 # Just started
    else:
        # Calculate percentage difference from average
        pace_diff = ((user_pace / average_pace) - 1) * 100
        pace_comparison = int(max(-50, min(150, pace_diff))) # Cap between -50% and +150%

    # 6. Achievements Calculation
    achievements = []
    
    # - First Path Achievement
    total_paths = db.query(LearningPath).filter(LearningPath.user_id == current_user.id).count()
    if total_paths > 0:
        achievements.append({
            "id": "first_path",
            "title": "Novice Navigator",
            "sub": "Created your first path",
            "type": "path",
            "color": "#5A72F6"
        })
        
    # - First Module Achievement
    if total_mastered > 0:
        achievements.append({
            "id": "first_module",
            "title": "Deep Diver",
            "sub": "Completed 1st module",
            "type": "module",
            "color": "#10b981"
        })
        
    # - Streak Achievement
    if streak >= 3:
        achievements.append({
            "id": "on_fire",
            "title": "On Fire",
            "sub": f"{streak}-day streak!",
            "type": "streak",
            "color": "#f59e0b"
        })
    elif streak >= 1:
        achievements.append({
            "id": "started",
            "title": "Early Bird",
            "sub": "First session started",
            "type": "streak",
            "color": "#fbbf24"
        })

    # - Concept Master
    if total_mastered >= 5:
        achievements.append({
            "id": "concept_master",
            "title": "Concept Master",
            "sub": "5 concepts mastered",
            "type": "mastery",
            "color": "#8b5cf6"
        })

    # - Scholar (New)
    if total_mastered >= 10:
        achievements.append({
            "id": "scholar",
            "title": "Scholar",
            "sub": "10 modules completed",
            "type": "module",
            "color": "#6366f1"
        })

    # - Polymath (New)
    if total_paths >= 5:
        achievements.append({
            "id": "polymath",
            "title": "Polymath",
            "sub": "5+ active paths",
            "type": "path",
            "color": "#ec4899"
        })

    # - Problem Solver (New)
    # Check resolved confusion nodes
    resolved_confusions = db.query(ConfusionNode).filter(
        ConfusionNode.user_id == current_user.id,
        ConfusionNode.status == "resolved"
    ).count()
    if resolved_confusions > 0:
        achievements.append({
            "id": "problem_solver",
            "title": "Problem Solver",
            "sub": "Resolved first confusion",
            "type": "mastery",
            "color": "#14b8a6"
        })

    # Sort so newest/advanced achievements appear first, then limit to top 3
    achievements.reverse()
    achievements = achievements[:3]

    # 7. Daily Quote Selection (External API with Fallback)
    from ..utils.quotes import get_daily_quote
    daily_quote = get_daily_quote()

    return {
        "mastery_percent": mastery_percent,
        "total_mastered": total_mastered,
        "total_concepts": total_concepts,
        "current_streak": streak,
        "total_hours": estimated_hours,
        "pace_comparison": pace_comparison,
        "recently_completed": recently_completed,
        "achievements": achievements,
        "daily_quote": daily_quote
    }
