"""
PostgreSQL-based Memory System for Gyanika
Replaces LightRAG with PostgreSQL for conversation storage and retrieval
"""

import os
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
from typing import Optional, List, Dict

logger = logging.getLogger(__name__)

# PostgreSQL connection configuration
DB_CONFIG = {
    "host": os.getenv("POSTGRES_HOST", "localhost"),
    "port": int(os.getenv("POSTGRES_PORT", "5432")),
    "database": os.getenv("POSTGRES_DB", "gyanika_db"),
    "user": os.getenv("POSTGRES_USER", "gyanika"),
    "password": os.getenv("POSTGRES_PASSWORD", "gyanika_secret_2024"),
}


def get_db_connection():
    """Get a database connection"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return None


class PostgresMemory:
    """PostgreSQL-based memory for conversation storage and retrieval"""
    
    def __init__(self, user_id: str, user_name: str = None):
        self.user_id = user_id
        self.user_name = user_name or user_id
        self.current_conversation_id = None
        self.short_term_memory: List[Dict] = []
        self._cached_memories = None  # Cache to avoid repeated DB calls
        self._cache_timestamp = None
        
        # Initialize - ensure user exists and start conversation
        self._ensure_user_exists()
        self._start_conversation()
        
    def _ensure_user_exists(self):
        """Ensure user exists in database, create if not"""
        conn = get_db_connection()
        if not conn:
            logger.error("❌ No database connection")
            return
            
        try:
            with conn.cursor() as cur:
                # First try to find user by username (most common case from agent)
                cur.execute("SELECT id FROM users WHERE username = %s", (self.user_id,))
                result = cur.fetchone()
                
                if result:
                    self.db_user_id = result[0]
                    logger.info(f"✅ Found existing user: {self.user_id} -> {self.db_user_id}")
                else:
                    # Try to find by email
                    cur.execute("SELECT id FROM users WHERE email = %s", (self.user_id,))
                    result = cur.fetchone()
                    
                    if result:
                        self.db_user_id = result[0]
                        logger.info(f"✅ Found user by email: {self.user_id} -> {self.db_user_id}")
                    else:
                        # Try UUID match
                        try:
                            cur.execute("SELECT id FROM users WHERE id::text = %s", (self.user_id,))
                            result = cur.fetchone()
                            if result:
                                self.db_user_id = result[0]
                                logger.info(f"✅ Found user by UUID: {self.user_id}")
                        except:
                            pass
                        
                        if not result:
                            # Create a new user entry for agent-only users
                            cur.execute("""
                                INSERT INTO users (username, email, password_hash, full_name, is_verified)
                                VALUES (%s, %s, crypt('agent_user', gen_salt('bf', 10)), %s, TRUE)
                                RETURNING id
                            """, (self.user_id, f"{self.user_id}@gyanika.local", self.user_name))
                            result = cur.fetchone()
                            self.db_user_id = result[0] if result else None
                            logger.info(f"🆕 Created new user: {self.user_id} -> {self.db_user_id}")
                    
                conn.commit()
                logger.info(f"📊 User DB ID: {self.db_user_id}")
        except Exception as e:
            logger.error(f"Error ensuring user exists: {e}")
            import traceback
            traceback.print_exc()
            conn.rollback()
            self.db_user_id = None
        finally:
            conn.close()
    
    def _start_conversation(self):
        """Start a new conversation session"""
        conn = get_db_connection()
        if not conn or not self.db_user_id:
            return
            
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO conversations (user_id, room_name, started_at)
                    VALUES (%s, %s, CURRENT_TIMESTAMP)
                    RETURNING id
                """, (self.db_user_id, f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"))
                result = cur.fetchone()
                self.current_conversation_id = result[0] if result else None
                conn.commit()
                logger.info(f"📝 Started conversation: {self.current_conversation_id}")
        except Exception as e:
            logger.error(f"Error starting conversation: {e}")
            conn.rollback()
        finally:
            conn.close()
    
    def add_message(self, role: str, content: str):
        """Add a message to the current conversation"""
        conn = get_db_connection()
        if not conn or not self.current_conversation_id:
            return
            
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO messages (conversation_id, role, content)
                    VALUES (%s, %s, %s)
                """, (self.current_conversation_id, role, content))
                conn.commit()
                logger.debug(f"💾 Saved {role} message")
        except Exception as e:
            logger.error(f"Error saving message: {e}")
            conn.rollback()
        finally:
            conn.close()
    
    def add_to_short_term(self, user_msg: str, agent_msg: str):
        """Add conversation turn to short-term and long-term memory"""
        # Add to short-term (in-memory)
        self.short_term_memory.append({
            "user": user_msg,
            "agent": agent_msg,
            "timestamp": datetime.now().isoformat()
        })
        
        # Keep only last 5 turns in short-term (reduced from 10)
        if len(self.short_term_memory) > 5:
            self.short_term_memory = self.short_term_memory[-5:]
        
        # Save to PostgreSQL
        self.add_message("user", user_msg)
        self.add_message("assistant", agent_msg)
        
        # Clear cache when new messages added
        self._cached_memories = None
        
        logger.info(f"💾 Conversation saved to PostgreSQL for {self.user_name}")
    
    def get_recent_messages(self, limit: int = 20) -> List[Dict]:
        """Get recent messages from current conversation"""
        conn = get_db_connection()
        if not conn or not self.current_conversation_id:
            return []
            
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT role, content, created_at
                    FROM messages
                    WHERE conversation_id = %s
                    ORDER BY created_at DESC
                    LIMIT %s
                """, (self.current_conversation_id, limit))
                return list(reversed(cur.fetchall()))
        except Exception as e:
            logger.error(f"Error fetching recent messages: {e}")
            return []
        finally:
            conn.close()
    
    def recall_memories(self, query: str = None, limit: int = 20) -> str:
        """Recall past conversations for this user - OPTIMIZED with caching"""
        # Return cached memories if available (cache for entire session)
        if self._cached_memories is not None:
            return self._cached_memories
        
        conn = get_db_connection()
        if not conn:
            logger.error("❌ No database connection for recall")
            return ""
            
        if not self.db_user_id:
            logger.warning(f"⚠️ No db_user_id set for {self.user_id}")
            return ""
            
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Get count (for logging only)
                cur.execute("""
                    SELECT COUNT(*) as cnt FROM conversations WHERE user_id = %s
                """, (self.db_user_id,))
                count_result = cur.fetchone()
                total_convs = count_result['cnt'] if count_result else 0
                logger.info(f"📊 Total conversations for user {self.db_user_id}: {total_convs}")
                
                # Get past messages - REDUCED from 100 to 30 for performance
                current_conv_id = self.current_conversation_id or '00000000-0000-0000-0000-000000000000'
                
                cur.execute("""
                    SELECT m.role, m.content, m.created_at, c.started_at as session_start
                    FROM messages m
                    JOIN conversations c ON m.conversation_id = c.id
                    WHERE c.user_id = %s
                    AND c.id != %s
                    ORDER BY m.created_at DESC
                    LIMIT 30
                """, (self.db_user_id, current_conv_id))
                
                past_messages = cur.fetchall()
                
                if not past_messages:
                    logger.info(f"🆕 No past messages found for user {self.user_name}")
                    self._cached_memories = ""
                    return ""
                
                logger.info(f"🧠 Found {len(past_messages)} past messages for {self.user_name}")
                
                # Format memories - REDUCED, keep it brief
                memory_text = f"## Brief History with {self.user_name}\n\n"
                
                # Reverse to show oldest first, take only last 10 messages
                past_messages = list(reversed(past_messages))[-10:]
                
                for msg in past_messages:
                    role = "User" if msg['role'] == 'user' else "Gyanika"
                    # Truncate content more aggressively
                    content = msg['content'][:100] + "..." if len(msg['content']) > 100 else msg['content']
                    memory_text += f"- **{role}**: {content}\n"
                
                # Cache the result
                self._cached_memories = memory_text
                return memory_text
                
        except Exception as e:
            logger.error(f"Error recalling memories: {e}")
            import traceback
            traceback.print_exc()
            return ""
        finally:
            conn.close()
    
    def get_learning_progress(self, subject: str = None) -> List[Dict]:
        """Get user's learning progress"""
        conn = get_db_connection()
        if not conn or not self.db_user_id:
            return []
            
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                if subject:
                    cur.execute("""
                        SELECT subject, topic, proficiency_level, last_practiced_at, notes
                        FROM learning_progress
                        WHERE user_id = %s AND subject ILIKE %s
                        ORDER BY last_practiced_at DESC
                    """, (self.db_user_id, f"%{subject}%"))
                else:
                    cur.execute("""
                        SELECT subject, topic, proficiency_level, last_practiced_at, notes
                        FROM learning_progress
                        WHERE user_id = %s
                        ORDER BY last_practiced_at DESC
                        LIMIT 20
                    """, (self.db_user_id,))
                return cur.fetchall()
        except Exception as e:
            logger.error(f"Error fetching learning progress: {e}")
            return []
        finally:
            conn.close()
    
    def update_learning_progress(self, subject: str, topic: str, proficiency: int, notes: str = None):
        """Update or insert learning progress"""
        conn = get_db_connection()
        if not conn or not self.db_user_id:
            return
            
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO learning_progress (user_id, subject, topic, proficiency_level, notes, last_practiced_at)
                    VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                    ON CONFLICT (user_id, subject, topic) 
                    DO UPDATE SET 
                        proficiency_level = EXCLUDED.proficiency_level,
                        notes = COALESCE(EXCLUDED.notes, learning_progress.notes),
                        last_practiced_at = CURRENT_TIMESTAMP
                """, (self.db_user_id, subject, topic, proficiency, notes))
                conn.commit()
                logger.info(f"📊 Updated learning progress: {subject}/{topic} = {proficiency}%")
        except Exception as e:
            logger.error(f"Error updating learning progress: {e}")
            conn.rollback()
        finally:
            conn.close()
    
    def get_memory_context_prompt(self, current_query: str = None) -> str:
        """Generate memory context for the agent's prompt - OPTIMIZED"""
        # Get recent short-term memory (last 3 turns only)
        short_term = ""
        if self.short_term_memory:
            short_term = "## Recent (Current Session)\n"
            for turn in self.short_term_memory[-3:]:
                user_text = turn['user'][:80] + "..." if len(turn['user']) > 80 else turn['user']
                agent_text = turn['agent'][:80] + "..." if len(turn['agent']) > 80 else turn['agent']
                short_term += f"- User: {user_text}\n- Gyanika: {agent_text}\n"
        
        # Get past memories (cached)
        past_memories = self.recall_memories(current_query)
        
        # Skip learning progress for performance (can add back later)
        
        # Combine - keep it minimal
        if past_memories or short_term:
            return f"# Memory for {self.user_name}\n{short_term}\n{past_memories}".strip()
        return ""
    
    def end_conversation(self, summary: str = None, topic: str = None):
        """End the current conversation and save summary"""
        conn = get_db_connection()
        if not conn or not self.current_conversation_id:
            return
            
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE conversations 
                    SET ended_at = CURRENT_TIMESTAMP,
                        duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at)),
                        summary = %s,
                        topic = %s
                    WHERE id = %s
                """, (summary, topic, self.current_conversation_id))
                conn.commit()
                logger.info(f"📝 Ended conversation: {self.current_conversation_id}")
        except Exception as e:
            logger.error(f"Error ending conversation: {e}")
            conn.rollback()
        finally:
            conn.close()


# Global memory instances per user
_memory_instances: Dict[str, PostgresMemory] = {}


def get_postgres_memory(user_id: str, user_name: str = None, force_new: bool = False) -> PostgresMemory:
    """Get or create a PostgresMemory instance for a user
    
    Args:
        user_id: User identifier
        user_name: User's display name
        force_new: If True, always create a new instance (for new sessions)
    """
    if force_new or user_id not in _memory_instances:
        logger.info(f"🧠 Creating {'new' if force_new else 'first'} PostgresMemory for {user_id}")
        _memory_instances[user_id] = PostgresMemory(user_id, user_name)
    return _memory_instances[user_id]


def clear_memory_cache(user_id: str = None):
    """Clear memory cache for a user or all users"""
    global _memory_instances
    if user_id:
        if user_id in _memory_instances:
            del _memory_instances[user_id]
            logger.info(f"🗑️ Cleared memory cache for {user_id}")
    else:
        _memory_instances = {}
        logger.info("🗑️ Cleared all memory cache")


def test_connection():
    """Test PostgreSQL connection"""
    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT version();")
                version = cur.fetchone()[0]
                logger.info(f"✅ PostgreSQL connected: {version[:50]}...")
                return True
        except Exception as e:
            logger.error(f"❌ PostgreSQL test failed: {e}")
            return False
        finally:
            conn.close()
    return False


if __name__ == "__main__":
    # Test the memory system
    logging.basicConfig(level=logging.INFO)
    
    if test_connection():
        print("✅ PostgreSQL connection successful!")
        
        # Test memory operations
        memory = get_postgres_memory("test_user", "Test User")
        memory.add_to_short_term(
            "What is photosynthesis?",
            "Photosynthesis is the process by which plants convert sunlight into energy..."
        )
        print("✅ Memory operations working!")
        
        # Test recall
        memories = memory.recall_memories()
        print(f"📝 Past memories: {len(memories)} characters")
    else:
        print("❌ PostgreSQL connection failed!")
