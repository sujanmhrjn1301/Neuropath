from fastapi import FastAPI
from sqladmin import Admin, ModelView
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from models import User, LearningPath, LearningModule, ModuleChatMessage, ConfusionNode, ConfusionChatMessage

# Create the DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AIEdu Platform")

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi import Request

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print(f"--- 422 VALIDATION ERROR ---")
    print(f"Errors: {exc.errors()}")
    print(f"Body: {exc.body}")
    print(f"----------------------------")
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

# Allow CORS for React frontend (Vite defaults to 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class UserAdmin(ModelView, model=User):
    column_list = [User.id, User.email, User.name, User.main_goal, User.learning_preference, User.created_at]
    form_columns = [User.email, User.hashed_password, User.name, User.main_goal, User.learning_preference]
    column_searchable_list = [User.email, User.name]
    name = "User"
    name_plural = "Users"

class LearningPathAdmin(ModelView, model=LearningPath):
    column_list = [
        LearningPath.id,
        LearningPath.user,           # shows user email via __str__
        LearningPath.overall_target,
        LearningPath.user_request,
        LearningPath.created_at,
    ]
    form_columns = [
        LearningPath.user,            # relationship dropdown instead of raw FK id
        LearningPath.overall_target,
        LearningPath.dataset_configuration,
        LearningPath.progression_roadmap,
        LearningPath.global_assessment_rules,
        LearningPath.user_request,
        LearningPath.user_learning_preferences,
        LearningPath.skill_summary,
    ]
    column_searchable_list = [LearningPath.overall_target, LearningPath.user_request]
    name = "Learning Path"
    name_plural = "Learning Paths"

class LearningModuleAdmin(ModelView, model=LearningModule):
    column_list = [
        LearningModule.id,
        LearningModule.learning_path,   # shows path title via __str__
        LearningModule.order,
        LearningModule.module_type,
        LearningModule.title,
        LearningModule.status,
        LearningModule.handoff_context, # <--- Added here for the table view
    ]
    form_columns = [
        LearningModule.learning_path,   # relationship dropdown instead of raw FK id
        LearningModule.module_id,
        LearningModule.module_type,
        LearningModule.title,
        LearningModule.instructional_goal,
        LearningModule.end_condition,
        LearningModule.status,
        LearningModule.order,
        LearningModule.handoff_context, # <--- Added here for the edit form view
    ]
    column_searchable_list = [LearningModule.title, LearningModule.module_id]
    name = "Learning Module"
    name_plural = "Learning Modules"

class ModuleChatMessageAdmin(ModelView, model=ModuleChatMessage):
    column_list = [
        ModuleChatMessage.id,
        ModuleChatMessage.module,       # shows module title via __str__
        ModuleChatMessage.role,
        ModuleChatMessage.content,
        ModuleChatMessage.created_at,
    ]
    form_columns = [
        ModuleChatMessage.module,       # relationship dropdown
        ModuleChatMessage.role,
        ModuleChatMessage.content,
    ]
    column_searchable_list = [ModuleChatMessage.role, ModuleChatMessage.content]
    column_default_sort = [(ModuleChatMessage.created_at, True)]  # newest first
    name = "Module Chat Message"
    name_plural = "Module Chat Messages"

class ConfusionNodeAdmin(ModelView, model=ConfusionNode):
    column_list = [
        ConfusionNode.id,
        ConfusionNode.root_module,
        ConfusionNode.highlighted_text,
        ConfusionNode.user_query,
        ConfusionNode.status,
        ConfusionNode.created_at,
    ]
    form_columns = [
        ConfusionNode.root_module,
        ConfusionNode.highlighted_text,
        ConfusionNode.user_query,
        ConfusionNode.status,
        ConfusionNode.root_module,
        ConfusionNode.children,
    ]
    column_searchable_list = [ConfusionNode.highlighted_text, ConfusionNode.user_query]
    name = "Confusion Node"
    name_plural = "Confusion Nodes"

class ConfusionChatMessageAdmin(ModelView, model=ConfusionChatMessage):
    column_list = [
        ConfusionChatMessage.id,
        ConfusionChatMessage.confusion_node,
        ConfusionChatMessage.role,
        ConfusionChatMessage.content,
        ConfusionChatMessage.created_at,
    ]
    form_columns = [
        ConfusionChatMessage.confusion_node,
        ConfusionChatMessage.role,
        ConfusionChatMessage.content,
    ]
    column_searchable_list = [ConfusionChatMessage.role, ConfusionChatMessage.content]
    column_default_sort = [(ConfusionChatMessage.created_at, True)]
    name = "Confusion Chat Message"
    name_plural = "Confusion Chat Messages"

admin = Admin(app, engine)
admin.add_view(UserAdmin)
admin.add_view(LearningPathAdmin)
admin.add_view(LearningModuleAdmin)
admin.add_view(ModuleChatMessageAdmin)
admin.add_view(ConfusionNodeAdmin)
admin.add_view(ConfusionChatMessageAdmin)

from .routers import auth, chat, learning, learning_chat, confusion, confusion_chat, recommendations, syllabus, stats, profile_metadata, notifications
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(learning.router)
app.include_router(learning_chat.router)
app.include_router(confusion.router)
app.include_router(confusion_chat.router)
app.include_router(recommendations.router)
app.include_router(syllabus.router)
app.include_router(stats.router)
app.include_router(profile_metadata.router)
app.include_router(notifications.router)

@app.get("/")
def root():
    return {"message": "Welcome to AIEdu API"}
