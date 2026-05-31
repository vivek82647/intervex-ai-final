"""
Apne existing backend/app/core/config.py mein yeh fields ADD karo Settings class mein:

class Settings(BaseSettings):
    # ... existing fields ...

    # Gmail OTP Configuration
    GMAIL_USER: str = ""           # aapka Gmail: example@gmail.com
    GMAIL_APP_PASSWORD: str = ""   # Gmail App Password (16 characters)

    # OTP Settings
    OTP_EXPIRE_MINUTES: int = 10


IMPORTANT — Gmail App Password kaise banayein:
============================================
1. Gmail account mein jao → Settings → Security
2. "2-Step Verification" ON karo (zaruri hai)
3. Phir "App passwords" search karo
4. "Select app" → "Other (Custom name)" → "INTERVEX" type karo
5. Generate karo — 16 character ka password milega
6. Woh password GMAIL_APP_PASSWORD mein daalo

backend/.env mein add karo:
===========================
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
"""

# Yeh sirf instructions file hai, actual code config.py mein add karo
print("Config additions - README only")
