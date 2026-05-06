import json
import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from ..dependencies import get_current_user
from ..models import User

router = APIRouter(
    prefix="/api/profile",
    tags=["Profile"]
)

# Use a local JSON file for extra metadata to avoid modifying the core database schema
METADATA_FILE = os.path.join(os.path.dirname(__file__), "..", "user_metadata.json")

def load_metadata():
    if not os.path.exists(METADATA_FILE):
        return {}
    try:
        with open(METADATA_FILE, "r") as f:
            return json.load(f)
    except:
        return {}

def save_metadata(data):
    with open(METADATA_FILE, "w") as f:
        json.dump(data, f, indent=4)

class ProfileMetadata(BaseModel):
    role: Optional[str] = "Senior Cognitive Engineer"
    bio: Optional[str] = ""
    avatar_seed: Optional[str] = ""
    course_updates: bool = True
    community_mentions: bool = False
    marketing_research: bool = True
    public_profile: bool = True
    data_anonymization: bool = True

@router.get("/metadata", response_model=ProfileMetadata)
def get_profile_metadata(current_user: User = Depends(get_current_user)):
    """
    Get extra profile metadata (role, bio, avatar, settings) from local storage.
    """
    metadata = load_metadata()
    user_data = metadata.get(current_user.id, {})
    return ProfileMetadata(
        role=user_data.get("role", "Senior Cognitive Engineer"),
        bio=user_data.get("bio", ""),
        avatar_seed=user_data.get("avatar_seed", current_user.email),
        course_updates=user_data.get("course_updates", True),
        community_mentions=user_data.get("community_mentions", False),
        marketing_research=user_data.get("marketing_research", True),
        public_profile=user_data.get("public_profile", True),
        data_anonymization=user_data.get("data_anonymization", True)
    )

@router.post("/metadata", response_model=ProfileMetadata)
def update_profile_metadata(
    data: ProfileMetadata, 
    current_user: User = Depends(get_current_user)
):
    """
    Save extra profile metadata to local storage.
    """
    metadata = load_metadata()
    metadata[current_user.id] = data.dict()
    save_metadata(metadata)
    return data
