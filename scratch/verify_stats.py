from backend.database import SessionLocal
from backend.models import User, LearningPath, LearningModule, ModuleChatMessage, ConfusionChatMessage, ConfusionNode
from sqlalchemy import func
import json

db = SessionLocal()
try:
    current_user = db.query(User).filter(User.name == 'Sujan Maharjan').first()
    if not current_user:
        print("User not found")
    else:
        print(f"User: {current_user.name} ({current_user.id})")
        
        # 1. Mastery
        paths = db.query(LearningPath).filter(LearningPath.user_id == current_user.id).all()
        total_mastered = 0
        total_concepts = 0
        for path in paths:
            completed = db.query(LearningModule).filter(LearningModule.learning_path_id == path.id, LearningModule.status == 'completed').count()
            total = db.query(LearningModule).filter(LearningModule.learning_path_id == path.id).count()
            total_mastered += completed
            total_concepts += total
        print(f"Mastery: {total_mastered}/{total_concepts}")

        # 2. Activity dates
        activity_days = db.query(func.date(ModuleChatMessage.created_at)).join(
            LearningModule, ModuleChatMessage.module_id == LearningModule.id
        ).join(
            LearningPath, LearningModule.learning_path_id == LearningPath.id
        ).filter(
            LearningPath.user_id == current_user.id
        ).distinct().all()
        activity_dates = {d[0] for d in activity_days}
        
        confusion_msg_dates = db.query(func.date(ConfusionChatMessage.created_at))\
            .join(ConfusionNode, ConfusionChatMessage.confusion_node_id == ConfusionNode.id)\
            .filter(ConfusionNode.user_id == current_user.id)\
            .distinct().all()
        for d in confusion_msg_dates:
            activity_dates.add(d[0])
        print(f"Activity dates: {len(activity_dates)}")

        # 3. Message counts
        total_messages = db.query(ModuleChatMessage).join(LearningModule).join(LearningPath).filter(LearningPath.user_id == current_user.id).count()
        total_confusion_messages = db.query(ConfusionChatMessage).join(ConfusionNode, ConfusionChatMessage.confusion_node_id == ConfusionNode.id).filter(ConfusionNode.user_id == current_user.id).count()
        print(f"Total messages: {total_messages + total_confusion_messages}")

finally:
    db.close()
