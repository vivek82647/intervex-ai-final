"""
WebSocket Manager - Real-time session monitoring using Socket.IO
Handles: Live student tracking, Anti-cheat alerts, Admin dashboard
"""
import logging
from datetime import datetime
from typing import Dict, Set
import socketio

logger = logging.getLogger(__name__)

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)

active_sessions: Dict[str, Dict] = {}
socket_users: Dict[str, Dict] = {}
admin_watchers: Dict[str, Set[str]] = {}


@sio.event
async def connect(sid, environ, auth):
    logger.info(f"Socket connected: {sid}")


@sio.event
async def disconnect(sid):
    user_info = socket_users.pop(sid, None)
    
    if user_info:
        session_id = user_info.get("session_id")
        role = user_info.get("role")
        
        if role == "student" and session_id:
            student_id = user_info.get("student_id")
            if session_id in active_sessions and student_id in active_sessions[session_id]:
                active_sessions[session_id][student_id]["connected"] = False
                active_sessions[session_id][student_id]["disconnected_at"] = datetime.utcnow().isoformat()
            
            await notify_admins(session_id, "student_disconnected", {
                "student_id": student_id,
                "student_name": user_info.get("student_name"),
                "timestamp": datetime.utcnow().isoformat()
            })
        
        elif role == "admin" and session_id:
            if session_id in admin_watchers:
                admin_watchers[session_id].discard(sid)
    
    logger.info(f"Socket disconnected: {sid}")


@sio.event
async def student_join(sid, data):
    """Student joins a session"""
    session_id = data.get("session_id")
    student_id = data.get("student_id")
    student_name = data.get("student_name")
    attempt_id = data.get("attempt_id")
    ip_address = data.get("ip_address", "Unknown")      # ← NEW: IP from frontend
    user_agent = data.get("user_agent", "")             # ← NEW: device info
    
    if not all([session_id, student_id, student_name]):
        await sio.emit("error", {"message": "Missing required fields"}, to=sid)
        return

    socket_users[sid] = {
        "session_id": session_id,
        "student_id": student_id,
        "student_name": student_name,
        "attempt_id": attempt_id,
        "ip_address": ip_address,
        "user_agent": user_agent,
        "role": "student",
        "joined_at": datetime.utcnow().isoformat()
    }

    if session_id not in active_sessions:
        active_sessions[session_id] = {}
    
    active_sessions[session_id][student_id] = {
        "sid": sid,
        "student_name": student_name,
        "attempt_id": attempt_id,
        "ip_address": ip_address,           # ← NEW
        "user_agent": user_agent,           # ← NEW
        "status": "joined",
        "connected": True,
        "warning_count": 0,
        "progress": 0,
        "joined_at": datetime.utcnow().isoformat(),
        "last_activity": datetime.utcnow().isoformat()
    }

    await sio.enter_room(sid, f"session_{session_id}")
    await sio.emit("join_confirmed", {"session_id": session_id}, to=sid)

    await notify_admins(session_id, "student_joined", {
        "student_id": student_id,
        "student_name": student_name,
        "ip_address": ip_address,           # ← NEW
        "user_agent": user_agent,           # ← NEW
        "timestamp": datetime.utcnow().isoformat()
    })


@sio.event
async def student_progress(sid, data):
    user_info = socket_users.get(sid)
    if not user_info:
        return
    
    session_id = user_info["session_id"]
    student_id = user_info["student_id"]
    
    if session_id in active_sessions and student_id in active_sessions[session_id]:
        active_sessions[session_id][student_id].update({
            "progress": data.get("progress", 0),
            "time_remaining": data.get("time_remaining"),
            "status": data.get("status", "in_progress"),
            "last_activity": datetime.utcnow().isoformat()
        })
    
    await notify_admins(session_id, "student_progress", {
        "student_id": student_id,
        **data
    })


@sio.event
async def anti_cheat_warning(sid, data):
    user_info = socket_users.get(sid)
    if not user_info:
        return
    
    session_id = user_info["session_id"]
    student_id = user_info["student_id"]
    warning_type = data.get("type")
    
    if session_id in active_sessions and student_id in active_sessions[session_id]:
        student = active_sessions[session_id][student_id]
        student["warning_count"] = student.get("warning_count", 0) + 1
        warning_count = student["warning_count"]
        
        warning_data = {
            "student_id": student_id,
            "student_name": user_info["student_name"],
            "ip_address": user_info.get("ip_address", "Unknown"),   # ← NEW
            "type": warning_type,
            "count": warning_count,
            "details": data.get("details", {}),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await notify_admins(session_id, "anti_cheat_alert", warning_data)
        
        max_warnings = data.get("max_warnings", 3)
        
        if warning_count == 1:
            await sio.emit("warning_issued", {
                "level": "warning",
                "count": warning_count,
                "message": f"⚠️ Warning: {warning_type.replace('_', ' ').title()} detected. This is your 1st warning.",
                "max_warnings": max_warnings
            }, to=sid)
        elif warning_count == 2:
            await sio.emit("warning_issued", {
                "level": "final_warning",
                "count": warning_count,
                "message": f"🚨 Final Warning: {warning_type.replace('_', ' ').title()} detected again. One more violation will terminate your session!",
                "max_warnings": max_warnings
            }, to=sid)
        elif warning_count >= max_warnings:
            active_sessions[session_id][student_id]["status"] = "terminated"
            await sio.emit("session_terminated", {
                "reason": f"Terminated due to repeated violations: {warning_type.replace('_', ' ')}",
                "warning_count": warning_count
            }, to=sid)
            await notify_admins(session_id, "student_terminated", {
                **warning_data,
                "reason": "Maximum warnings exceeded"
            })


@sio.event
async def student_submitted(sid, data):
    user_info = socket_users.get(sid)
    if not user_info:
        return
    
    session_id = user_info["session_id"]
    student_id = user_info["student_id"]
    
    if session_id in active_sessions and student_id in active_sessions[session_id]:
        active_sessions[session_id][student_id].update({
            "status": "submitted",
            "submitted_at": datetime.utcnow().isoformat(),
            "progress": 100
        })
    
    await notify_admins(session_id, "student_submitted", {
        "student_id": student_id,
        "student_name": user_info["student_name"],
        "score": data.get("score"),
        "timestamp": datetime.utcnow().isoformat()
    })


@sio.event
async def admin_watch(sid, data):
    session_id = data.get("session_id")
    admin_id = data.get("admin_id")
    
    if not session_id:
        return

    socket_users[sid] = {
        "session_id": session_id,
        "admin_id": admin_id,
        "role": "admin"
    }

    if session_id not in admin_watchers:
        admin_watchers[session_id] = set()
    admin_watchers[session_id].add(sid)

    await sio.enter_room(sid, f"admin_{session_id}")

    session_data = active_sessions.get(session_id, {})
    students_snapshot = [
        {
            "student_id": sid_,
            **{k: v for k, v in info.items() if k != "sid"}
        }
        for sid_, info in session_data.items()
    ]
    
    await sio.emit("session_snapshot", {
        "session_id": session_id,
        "students": students_snapshot,
        "total": len(students_snapshot)
    }, to=sid)


@sio.event
async def admin_terminate_student(sid, data):
    session_id = data.get("session_id")
    student_id = data.get("student_id")
    reason = data.get("reason", "Terminated by admin")
    
    if session_id in active_sessions and student_id in active_sessions[session_id]:
        student_sid = active_sessions[session_id][student_id].get("sid")
        if student_sid:
            await sio.emit("session_terminated", {
                "reason": reason,
                "terminated_by": "admin"
            }, to=student_sid)
        active_sessions[session_id][student_id]["status"] = "terminated"


async def notify_admins(session_id: str, event: str, data: dict):
    watchers = admin_watchers.get(session_id, set())
    if watchers:
        await sio.emit(event, data, room=f"admin_{session_id}")
