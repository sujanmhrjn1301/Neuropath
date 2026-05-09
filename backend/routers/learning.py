from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from datetime import datetime

from ..dependencies import get_current_user
from ..database import get_db
from ..models import User, LearningPath, LearningModule, ConfusionNode
from ..schemas import PathGraphResponse, ModuleGraphNode, ConfusionGraphNode

router = APIRouter(prefix="/api/learning-paths", tags=["Learning Paths"])


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class ModuleOut(BaseModel):
    id: str
    module_id: str
    module_type: str
    title: str
    instructional_goal: str | None
    end_condition: str | None
    status: str
    order: int
    learning_path_id: str

    class Config:
        from_attributes = True


class PathSummaryOut(BaseModel):
    id: str
    user_request: str | None
    overall_target: str
    created_at: datetime
    total_modules: int
    completed_modules: int

    class Config:
        from_attributes = True


class PathDetailOut(BaseModel):
    id: str
    user_request: str | None
    overall_target: str
    progression_roadmap: str | None
    global_assessment_rules: str | None
    skill_summary: str | None
    created_at: datetime
    modules: List[ModuleOut]

    class Config:
        from_attributes = True


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("", response_model=List[PathSummaryOut])
def list_learning_paths(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Return all learning paths for the authenticated user, newest first."""
    paths = (
        db.query(LearningPath)
        .filter(LearningPath.user_id == current_user.id)
        .order_by(LearningPath.created_at.desc())
        .all()
    )
    
    results = []
    for p in paths:
        total = len(p.modules)
        completed = sum(1 for m in p.modules if m.status == "completed")
        results.append({
            "id": p.id,
            "user_request": p.user_request,
            "overall_target": p.overall_target,
            "created_at": p.created_at,
            "total_modules": total,
            "completed_modules": completed
        })
    return results


@router.get("/{path_id}", response_model=PathDetailOut)
def get_learning_path(
    path_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Return a single learning path with its modules ordered by position."""
    path = (
        db.query(LearningPath)
        .filter(LearningPath.id == path_id, LearningPath.user_id == current_user.id)
        .first()
    )
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found")
    return path

@router.get("/{path_id}/graph", response_model=PathGraphResponse)
def get_path_graph(
    path_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Fetch the path and verify ownership
    path = db.query(LearningPath).filter(LearningPath.id == path_id, LearningPath.user_id == current_user.id).first()
    if not path:
        raise HTTPException(status_code=404, detail="Path not found")
        
    # 2. Fetch all modules ordered by sequence
    modules = db.query(LearningModule).filter(LearningModule.learning_path_id == path.id).order_by(LearningModule.order).all()
    
    module_nodes = []
    found_first_pending = False
    
    for mod in modules:
        # Calculate dynamic status
        if mod.status == "completed":
            calc_status = "completed"
        elif not found_first_pending:
            calc_status = "unlocked"
            found_first_pending = True
        else:
            calc_status = "locked"
            
        # 3. Fetch all confusions for this specific module
        confusions = db.query(ConfusionNode).filter(ConfusionNode.root_module_id == mod.id).all()
        confusion_nodes = [
            ConfusionGraphNode(
                id=c.id, 
                title=c.title or "Side-Quest", 
                status=c.status,
                parent_confusion_id=c.parent_confusion_id,
                message_count=len(c.chat_messages),
                total_chars=sum(len(msg.content) for msg in c.chat_messages)
            ) for c in confusions
        ]
        
        module_nodes.append(
            ModuleGraphNode(
                id=mod.id,
                title=mod.title,
                order_index=mod.order,
                status=calc_status,
                confusions=confusion_nodes
            )
        )
        
    return PathGraphResponse(
        path_id=path.id,
        title=path.overall_target or "Learning Path",
        modules=module_nodes
    )
