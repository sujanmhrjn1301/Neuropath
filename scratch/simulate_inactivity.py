from backend.database import SessionLocal
from backend.models import ModuleChatMessage, LearningModule, LearningPath, ConfusionChatMessage, ConfusionNode
from datetime import datetime, timedelta

db = SessionLocal()
user_id = "ab8badeb-6453-404e-9e98-839e20a8c414"

# Set last active to 5 days ago
target_date = datetime.utcnow() - timedelta(days=5)

# Backdate all messages for this user
module_msgs = db.query(ModuleChatMessage).join(LearningModule).join(LearningPath).filter(LearningPath.user_id == user_id).all()
for msg in module_msgs:
    msg.created_at = target_date

confusion_msgs = db.query(ConfusionChatMessage).join(ConfusionNode).filter(ConfusionNode.user_id == user_id).all()
for msg in confusion_msgs:
    msg.created_at = target_date

db.commit()
print(f"Backdated {len(module_msgs)} module messages and {len(confusion_msgs)} confusion messages to {target_date}")
