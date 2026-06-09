"""
Migration: Add activated_at column to sessions table
Run once: python migrate_add_activated_at.py
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "intervex.db")

if not os.path.exists(DB_PATH):
    print(f"DB not found at {DB_PATH} — will be created fresh on next server start (no migration needed).")
    exit(0)

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Check if column already exists
cursor.execute("PRAGMA table_info(sessions)")
columns = [row[1] for row in cursor.fetchall()]

if "activated_at" not in columns:
    cursor.execute("ALTER TABLE sessions ADD COLUMN activated_at DATETIME")
    conn.commit()
    print("✅ Column 'activated_at' added to sessions table.")
else:
    print("ℹ️  Column 'activated_at' already exists — nothing to do.")

conn.close()
