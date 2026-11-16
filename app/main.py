from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine, get_db
from app import models

from pwdlib import PasswordHash

from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

import jwt
import os


# =====================================
# ENVIRONMENT CONFIGURATION
# =====================================

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")

ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
)

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is missing")


# =====================================
# SECURITY SETUP
# =====================================

security = HTTPBearer()
password_hash = PasswordHash.recommended()


# =====================================
# JWT TOKEN CREATION
# =====================================

def create_access_token(data: dict):
    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return encoded_jwt


# =====================================
# JWT TOKEN VERIFICATION
# =====================================

def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("sub")

        if user_id is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid token"
            )

        return user_id

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token has expired"
        )

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )


# =====================================
# GET CURRENT LOGGED-IN USER
# =====================================

def get_current_user(
    user_id: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    db_user = db.query(models.User).filter(
        models.User.id == int(user_id)
    ).first()

    if not db_user:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    if not db_user.is_active:
        raise HTTPException(
            status_code=403,
            detail="User account is inactive"
        )

    return db_user


# =====================================
# ADMIN AUTHORIZATION
# =====================================

def admin_required(
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    return current_user


# =====================================
# FASTAPI APPLICATION
# =====================================

app = FastAPI(
    title="My FastAPI Application",
    description="This is a sample FastAPI application",
    version="1.0.0"
)


# =====================================
# CORS CONFIGURATION
# =====================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://student-management-system-1-lvi6.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================================
# DATABASE TABLE CREATION
# =====================================

Base.metadata.create_all(bind=engine)


# =====================================
# PYDANTIC SCHEMAS
# =====================================

class StudentCreate(BaseModel):
    name: str
    age: int
    class_name: str


class StudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    age: int
    class_name: str


class UserCreate(BaseModel):
    username: str
    email: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


# =====================================
# ROOT ENDPOINT
# =====================================

@app.get("/")
def read_root():
    return {
        "message": "Welcome to My FastAPI Application!"
    }


# =====================================
# GET ALL STUDENTS
# ADMIN ONLY
# =====================================

@app.get("/students", response_model=list[StudentResponse])
def get_students(
    class_name: str | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required)
):
    if class_name:
        return db.query(models.Student).filter(
            models.Student.class_name == class_name
        ).all()

    return db.query(models.Student).all()


# =====================================
# GET STUDENT BY ID
# ADMIN ONLY
# =====================================

@app.get("/students/{student_id}", response_model=StudentResponse)
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required)
):
    db_student = db.query(models.Student).filter(
        models.Student.id == student_id
    ).first()

    if db_student is None:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    return db_student


# =====================================
# CREATE STUDENT
# ADMIN ONLY
# =====================================

@app.post("/students")
def create_student(
    new_student: StudentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required)
):
    db_student = models.Student(
        name=new_student.name,
        age=new_student.age,
        class_name=new_student.class_name
    )

    db.add(db_student)
    db.commit()
    db.refresh(db_student)

    return {
        "message": "Student added successfully",
        "student": {
            "id": db_student.id,
            "name": db_student.name,
            "age": db_student.age,
            "class_name": db_student.class_name
        }
    }


# =====================================
# UPDATE STUDENT
# ADMIN ONLY
# =====================================

@app.put("/students/{student_id}")
def update_student(
    student_id: int,
    updated_data: StudentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required)
):
    db_student = db.query(models.Student).filter(
        models.Student.id == student_id
    ).first()

    if db_student is None:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    db_student.name = updated_data.name
    db_student.age = updated_data.age
    db_student.class_name = updated_data.class_name

    db.commit()
    db.refresh(db_student)

    return {
        "message": "Student updated successfully",
        "student": db_student
    }


# =====================================
# DELETE STUDENT
# ADMIN ONLY
# =====================================

@app.delete("/students/{student_id}")
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required)
):
    db_student = db.query(models.Student).filter(
        models.Student.id == student_id
    ).first()

    if db_student is None:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    db.delete(db_student)
    db.commit()

    return {
        "message": "Student deleted successfully"
    }


# =====================================
# USER REGISTRATION
# PUBLIC ENDPOINT
# =====================================

@app.post("/users")
def create_user(
    new_user: UserCreate,
    db: Session = Depends(get_db)
):
    db_user = models.User(
        username=new_user.username,
        email=new_user.email,
        hashed_password=password_hash.hash(new_user.password)
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return {
        "message": "User created successfully",
        "user": {
            "id": db_user.id,
            "username": db_user.username,
            "email": db_user.email,
            "is_active": db_user.is_active,
            "role": db_user.role
        }
    }


# =====================================
# USER LOGIN
# PUBLIC ENDPOINT
# =====================================

@app.post("/login")
def login_user(
    user_login: UserLogin,
    db: Session = Depends(get_db)
):
    db_user = db.query(models.User).filter(
        models.User.username == user_login.username
    ).first()

    if not db_user:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    if not password_hash.verify(
        user_login.password,
        db_user.hashed_password
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    if not db_user.is_active:
        raise HTTPException(
            status_code=403,
            detail="User account is inactive"
        )

    access_token = create_access_token(
        data={"sub": str(db_user.id)}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


# =====================================
# PROFILE API
# LOGGED-IN USERS ONLY
# =====================================

@app.get("/profile")
def get_profile(
    current_user: models.User = Depends(get_current_user)
):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role
    }