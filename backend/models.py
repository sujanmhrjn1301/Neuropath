import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    name = Column(String, nullable=False)
    main_goal = Column(String, nullable=True)
    learning_preference = Column(String, nullable=True)
    knowledge_summary = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    learning_paths = relationship("LearningPath", back_populates="user", cascade="all, delete-orphan")

    def __str__(self):
        return f"{self.email} ({self.name})"


class LearningPath(Base):
    __tablename__ = "learning_paths"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)

    # main_workflow fields
    overall_target = Column(String, nullable=False)
    # Stored as JSON strings (SQLite has no native JSON type)
    dataset_configuration = Column(String, nullable=True)   # JSON string
    progression_roadmap = Column(String, nullable=True)     # JSON string (array of phase names)
    global_assessment_rules = Column(String, nullable=True)

    # user_profile snapshot
    user_request = Column(String, nullable=True)
    user_learning_preferences = Column(String, nullable=True)
    skill_summary = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="learning_paths")
    modules = relationship("LearningModule", back_populates="learning_path",
                           cascade="all, delete-orphan", order_by="LearningModule.order")

    def __str__(self):
        return self.overall_target or self.id


class LearningModule(Base):
    __tablename__ = "learning_modules"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    learning_path_id = Column(String, ForeignKey("learning_paths.id"), nullable=False, index=True)

    # Matches the generate_learning_path tool schema
    module_id = Column(String, nullable=False)          # e.g. "py_basics_001"
    module_type = Column(String, nullable=False)        # "lesson" or "project"
    title = Column(String, nullable=False)
    instructional_goal = Column(String, nullable=True)
    end_condition = Column(String, nullable=True)
    status = Column(String, nullable=False, default="locked")  # "unlocked" | "locked" | "completed"
    order = Column(Integer, nullable=False, default=0)
    handoff_context = Column(String, nullable=True)  # Notes injected from the previous module's AI tutor

    learning_path = relationship("LearningPath", back_populates="modules")
    chat_messages = relationship("ModuleChatMessage", back_populates="module",
                                 cascade="all, delete-orphan", order_by="ModuleChatMessage.created_at")

    def __str__(self):
        return f"{self.title} [{self.module_type}]"


class ModuleChatMessage(Base):
    __tablename__ = "module_chat_messages"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    module_id = Column(String, ForeignKey("learning_modules.id"), nullable=False, index=True)
    role = Column(String, nullable=False)    # "user" | "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    module = relationship("LearningModule", back_populates="chat_messages")


class ConfusionNode(Base):
    __tablename__ = "confusion_nodes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    root_module_id = Column(String, ForeignKey("learning_modules.id"), nullable=False, index=True)
    parent_confusion_id = Column(String, ForeignKey("confusion_nodes.id"), nullable=True)

    highlighted_text = Column(String, nullable=False)
    local_context_block = Column(String, nullable=True)
    user_query = Column(String, nullable=False)
    title = Column(String, nullable=True)
    current_depth = Column(Integer, default=1)
    
    status = Column(String, nullable=False, default="active")  # "active" | "resolved"
    created_at = Column(DateTime, default=datetime.utcnow)

    root_module = relationship("LearningModule", foreign_keys=[root_module_id])
    # Recursive children
    children = relationship("ConfusionNode", backref=backref("parent", remote_side="ConfusionNode.id"))
    chat_messages = relationship("ConfusionChatMessage", back_populates="confusion_node",
                                  cascade="all, delete-orphan", order_by="ConfusionChatMessage.created_at")

    def __str__(self):
        snippet = self.highlighted_text[:40] + "…" if len(self.highlighted_text) > 40 else self.highlighted_text
        return f'"{snippet}" [{self.status}]'


class ConfusionChatMessage(Base):
    __tablename__ = "confusion_chat_messages"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    confusion_node_id = Column(String, ForeignKey("confusion_nodes.id"), nullable=False, index=True)
    role = Column(String, nullable=False)    # "user" | "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    confusion_node = relationship("ConfusionNode", back_populates="chat_messages")

    def __str__(self):
        return f"[{self.role}] {self.content[:50]}"
