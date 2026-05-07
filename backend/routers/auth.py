from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from .. import models, schemas, auth
from ..database import get_db
from ..dependencies import get_current_user

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)

@router.post("/register")
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered.")
    
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(
        email=user.email,
        hashed_password=hashed_password,
        name=user.name,
        main_goal=user.main_goal,
        learning_preference=user.learning_preference
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User successfully registered."}

@router.post("/login", response_model=schemas.Token)
def login_for_access_token(db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "main_goal": current_user.main_goal,
        "learning_preference": current_user.learning_preference
    }

class GoalUpdate(schemas.BaseModel):
    goal: str

@router.put("/me/goal")
def update_user_goal(goal_data: GoalUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.main_goal = goal_data.goal
    db.commit()
    return {"message": "Goal updated successfully"}
