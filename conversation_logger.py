"""
Conversation logger module for Gyanika
Captures and saves conversation turns to Qdrant vector store and LightRAG
"""
import logging
from typing import Optional
from vector_store import get_vector_store
from lightrag_store import get_lightrag_store
from datetime import datetime

# Global conversation state
_current_conversation = {
    "user_message": None,
    "user_id": None,
    "session_id": None
}

def set_user_context(user_id: str, session_id: str):
    """Set the current user context for conversation logging"""
    _current_conversation["user_id"] = user_id
    _current_conversation["session_id"] = session_id
    logging.info(f"📝 Conversation logger initialized for user: {user_id}, session: {session_id}")

def log_user_message(message: str):
    """Log a user message (to be paired with assistant response)"""
    _current_conversation["user_message"] = message
    logging.info(f"👤 User message logged: {message[:100]}...")

def log_conversation_turn(user_message: str, assistant_response: str):
    """Log a complete conversation turn to Qdrant and LightRAG"""
    user_id = _current_conversation.get("user_id", "unknown_user")
    session_id = _current_conversation.get("session_id", "unknown_session")
    
    if not user_message or not assistant_response:
        logging.warning("⚠️  Incomplete conversation turn - skipping save")
        return False
    
    success_qdrant = False
    success_lightrag = False
    
    # Save to Qdrant vector store
    try:
        vs = get_vector_store()
        success_qdrant = vs.add_conversation(
            user_id=user_id,
            session_id=session_id,
            user_message=user_message,
            assistant_response=assistant_response,
            metadata={
                "timestamp": datetime.now().isoformat(),
                "source": "gyanika_agent"
            }
        )
        
        if success_qdrant:
            logging.info(f"✅ Conversation saved to Qdrant: user={user_id}")
        else:
            logging.error(f"❌ Failed to save conversation to Qdrant")
    except Exception as e:
        logging.error(f"❌ Error saving conversation to Qdrant: {e}")
    
    # Save to LightRAG for knowledge graph
    try:
        lightrag = get_lightrag_store()
        success_lightrag = lightrag.add_conversation(
            user_id=user_id,
            session_id=session_id,
            user_message=user_message,
            assistant_response=assistant_response,
            metadata={
                "timestamp": datetime.now().isoformat(),
                "source": "gyanika_agent"
            }
        )
        
        if success_lightrag:
            logging.info(f"✅ Conversation saved to LightRAG: user={user_id}")
        else:
            logging.warning(f"⚠️ Failed to save conversation to LightRAG (server may be unavailable)")
    except Exception as e:
        logging.warning(f"⚠️ LightRAG save skipped: {e}")
    
    return success_qdrant or success_lightrag

def get_conversation_history(query: str, user_id: Optional[str] = None, limit: int = 5):
    """Retrieve conversation history for context from Qdrant and LightRAG"""
    if user_id is None:
        user_id = _current_conversation.get("user_id", "unknown_user")
    
    results = []
    
    # Try Qdrant first
    try:
        vs = get_vector_store()
        qdrant_results = vs.search_conversation_history(
            query=query,
            user_id=user_id,
            limit=limit
        )
        results.extend(qdrant_results)
        logging.info(f"🔍 Retrieved {len(qdrant_results)} items from Qdrant for {user_id}")
    except Exception as e:
        logging.error(f"❌ Error retrieving from Qdrant: {e}")
    
    # Also try LightRAG for additional context
    try:
        lightrag = get_lightrag_store()
        lightrag_results = lightrag.search_conversations(
            query=query,
            user_id=user_id,
            limit=limit
        )
        if lightrag_results:
            results.extend(lightrag_results)
            logging.info(f"🔍 Retrieved {len(lightrag_results)} items from LightRAG for {user_id}")
    except Exception as e:
        logging.warning(f"⚠️ LightRAG search skipped: {e}")
    
    return results
