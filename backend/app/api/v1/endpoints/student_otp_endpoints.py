"""
Add these endpoints to the existing students.py module.

Student test start karne se pehle OTP verify karna hoga.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from ..core.database import get_db
from ..services.otp_service import create_otp, verify_otp

# (Apne existing router ke saath merge karo)
router = APIRouter(prefix="/students", tags=["students"])


class StudentOTPRequest(BaseModel):
    name: str
    email: EmailStr
    roll_number: str = None
    session_id: int


class StudentOTPVerify(BaseModel):
    email: EmailStr
    otp: str
    session_id: int
    name: str
    roll_number: str = None


@router.post("/request-test-otp")
def request_test_otp(data: StudentOTPRequest, db: Session = Depends(get_db)):
    """
    Student test join - Step 1:
    Receive student details and send an OTP.
    """
    try:
        create_otp(db, data.email, purpose="test")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "message": f"An OTP was sent to {data.email}. Enter it before starting the test.",
        "email": data.email
    }


@router.post("/verify-test-otp")
def verify_test_otp(data: StudentOTPVerify, db: Session = Depends(get_db)):
    """
    Student test join - Step 2:
    OTP verify karo, test access do.
    """
    if not verify_otp(db, data.email, data.otp, "test"):
        raise HTTPException(status_code=400, detail="The OTP is incorrect or has expired")

    # Verified! Frontend ko signal do ke test start kar sakte hain
    return {
        "verified": True,
        "message": "Email verify ho gayi. Test ab shuru ho sakta hai.",
        "student_info": {
            "name": data.name,
            "email": data.email,
            "roll_number": data.roll_number,
            "session_id": data.session_id
        }
    }
