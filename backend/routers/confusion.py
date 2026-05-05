"""
Confusion Node Architecture — Spawn endpoint.
POST /api/confusions/start
GET  /api/confusions/unresolved/{module_id}
GET  /api/confusions/{node_id}
GET  /api/confusions/{node_id}/chat
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Union
from datetime import datetime

from ..dependencies import get_current_user
from ..database import get_db
from ..models import User, LearningModule, LearningPath, ConfusionNode, ConfusionChatMessage, ModuleChatMessage

router = APIRouter(prefix="/api/confusions", tags=["Confusion Nodes"])


# ── Request / Response schemas ─────────────────────────────────────────────

class StartConfusionRequest(BaseModel):
    root_module_id: str
    parent_confusion_id: Optional[str] = None
    message_id: Union[int, str]
    highlighted_text: str
    user_query: str


class ConfusionNodeOut(BaseModel):
    id: str
    root_module_id: str
    parent_confusion_id: Optional[str]
    highlighted_text: str
    user_query: str
    title: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ConfusionMessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Helpers ────────────────────────────────────────────────────────────────

def _get_authorized_confusion(node_id: str, current_user: User, db: Session) -> ConfusionNode:
    node = db.query(ConfusionNode).get(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Confusion node not found")
    # Ownership: trace back to the module's learning path
    module: LearningModule = node.root_module
    if module.learning_path.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return node


# ── POST /start — create a new confusion node ──────────────────────────────

@router.post("/start", response_model=ConfusionNodeOut, status_code=201)
def spawn_confusion(
    request: StartConfusionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a confusion side-quest from a highlighted text snippet.
    Returns the new node id so the frontend can route to /confusion/{id}/chat.
    """
    # Verify module ownership
    module: LearningModule = db.query(LearningModule).get(request.root_module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    if module.learning_path.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Validate optional parent confusion belongs to same module
    new_depth = 1
    if request.parent_confusion_id:
        parent = db.query(ConfusionNode).get(request.parent_confusion_id)
        if not parent or parent.root_module_id != request.root_module_id:
            raise HTTPException(status_code=400, detail="Invalid parent confusion node")
        new_depth = parent.current_depth + 1

    # Fetch context block
    msg_content = ""
    if request.parent_confusion_id:
        msg = db.query(ConfusionChatMessage).get(request.message_id)
        if msg: msg_content = msg.content
    else:
        msg = db.query(ModuleChatMessage).get(request.message_id)
        if msg: msg_content = msg.content
    
    local_context = ""
    if msg_content and request.highlighted_text in msg_content:
        idx = msg_content.find(request.highlighted_text)
        start_idx = max(0, idx - 250)
        end_idx = min(len(msg_content), idx + len(request.highlighted_text) + 250)
        local_context = msg_content[start_idx:end_idx]
    else:
        # Fallback if somehow not found exactly
        local_context = request.highlighted_text

    # Generate quick title
    title = " ".join(request.highlighted_text.split()[:4])
    if len(request.highlighted_text.split()) > 4:
        title += "..."

    node = ConfusionNode(
        user_id=current_user.id,
        root_module_id=request.root_module_id,
        parent_confusion_id=request.parent_confusion_id,
        highlighted_text=request.highlighted_text,
        local_context_block=local_context,
        user_query=request.user_query,
        title=title,
        current_depth=new_depth
    )
    db.add(node)
    db.flush() 

    # Insert a link in the main module chat history
    if not request.parent_confusion_id:
        placeholder = ModuleChatMessage(
            module_id=request.root_module_id,
            role="side_quest",
            content=f"Side-quest was created [/confusion/{node.id}]",
            confusion_node_id=node.id
        )
        db.add(placeholder)

    db.commit()
    db.refresh(node)
    return node


# ── GET /unresolved/{module_id} — check for active side-quest ─────────────
# NOTE: This MUST be declared before /{node_id} to avoid FastAPI routing conflicts.

@router.get("/unresolved/{module_id}", response_model=Optional[ConfusionNodeOut])
def get_unresolved_confusion(
    module_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Check if there's an active (unresolved) side-quest for this module.
    Returns the node if found, else null. Used to block the main lesson chat.
    """
    node = db.query(ConfusionNode).filter(
        ConfusionNode.root_module_id == module_id,
        ConfusionNode.user_id == current_user.id,
        ConfusionNode.status == "active"
    ).first()
    return node


# ── GET /{node_id} — fetch node metadata ──────────────────────────────────

@router.get("/{node_id}", response_model=ConfusionNodeOut)
def get_confusion_node(
    node_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_authorized_confusion(node_id, current_user, db)


# ── GET /{node_id}/chat — fetch chat history ──────────────────────────────

@router.get("/{node_id}/chat", response_model=List[ConfusionMessageOut])
def get_confusion_chat_history(
    node_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    node = _get_authorized_confusion(node_id, current_user, db)
    return node.chat_messages
