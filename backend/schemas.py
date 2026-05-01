from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

class UserBase(BaseModel):
    name: str
    email: str
    main_goal: Optional[str] = None
    learning_preference: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class SyllabusGenerateRequest(BaseModel):
    goal: str
    location: str = "Nepal"  # Defaulting to user's location
    use_openrouter: bool = False  # False = Gemini Fallback, True = Perplexity Research

class ConfusionGraphNode(BaseModel):
    id: str
    title: str
    status: str
    parent_confusion_id: Optional[str] = None

class ModuleGraphNode(BaseModel):
    id: str
    title: str
    order_index: int
    status: str
    confusions: List[ConfusionGraphNode]

class PathGraphResponse(BaseModel):
    path_id: str
    title: str
    modules: List[ModuleGraphNode]
