import argparse
from backend.database import SessionLocal
from backend.models import User, ModuleChatMessage, LearningModule, LearningPath, ConfusionChatMessage, ConfusionNode
from datetime import datetime, timedelta, timezone

def simulate_inactivity_for_user(user, days):
    db = SessionLocal()
    user_id = user.id
    target_date = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)

    # Backdate user account creation as well
    user.created_at = target_date

    # Clear old notifications so a fresh one can be generated for the demo
    db.query(Notification).filter(Notification.user_id == user_id).delete()

    # Backdate all activity
    module_msgs = db.query(ModuleChatMessage).join(LearningModule).join(LearningPath).filter(LearningPath.user_id == user_id).all()
    for msg in module_msgs:
        msg.created_at = target_date

    confusion_msgs = db.query(ConfusionChatMessage).join(ConfusionNode).filter(ConfusionNode.user_id == user_id).all()
    for msg in confusion_msgs:
        msg.created_at = target_date

    db.commit()
    print(f"\n✅ SUCCESS: Simulated {days} days of inactivity for user '{user.name}'.")
    print(f"⏰ All activity timestamps set back to: {target_date.strftime('%Y-%m-%d %H:%M')}")
    print("✨ Go to the dashboard and refresh to see the effect!\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Simulate user inactivity for NeuroPath demo.")
    parser.add_argument("--days", type=int, help="Number of days of inactivity to simulate.")
    parser.add_argument("--email", type=str, help="Email of the user to simulate.")
    args = parser.parse_args()
    
    days = args.days
    email = args.email
    
    if days is None or email is None:
        print("\n🌟 NeuroPath Demo Mode 🌟")
        if days is None:
            try:
                val = input("Enter the number of days of inactivity to simulate (e.g. 0, 5, 35): ")
                days = int(val)
            except ValueError:
                print("❌ Please enter a valid number.")
                exit(1)
        
        if email is None:
            email = input("Enter User Email (leave blank to pick first user): ")

    db = SessionLocal()
    if email:
        user = db.query(User).filter(User.email == email.strip()).first()
    else:
        user = db.query(User).first()
    
    if not user:
        print(f"❌ No user found matching '{email or 'any'}'")
        exit(1)
            
    simulate_inactivity_for_user(user, days)
