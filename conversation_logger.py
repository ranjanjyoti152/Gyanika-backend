"""
Conversation logger module for Gyanika
Captures and saves conversation turns to LightRAG for memory
"""
import logging
from typing import Optional
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
    """Log a complete conversation turn to LightRAG for memory"""
    user_id = _current_conversation.get("user_id", "unknown_user")
    session_id = _current_conversation.get("session_id", "unknown_session")
    
    logging.info("=" * 60)
    logging.info("📝 SAVING CONVERSATION TURN TO LIGHTRAG")
    logging.info(f"   User ID: {user_id}")
    logging.info(f"   Session ID: {session_id}")
    logging.info(f"   User Message: {user_message[:100] if user_message else 'None'}...")
    logging.info(f"   Assistant Response: {assistant_response[:100] if assistant_response else 'None'}...")
    logging.info("=" * 60)
    
    if not user_message or not assistant_response:
        logging.warning("⚠️  Incomplete conversation turn - skipping save")
        return False
    
    success_lightrag = False
    
    # Save to LightRAG for knowledge graph and memory
    try:
        lightrag = get_lightrag_store()
        logging.info(f"📤 Attempting to save to LightRAG at {lightrag.url}...")
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
        logging.warning(f"⚠️ LightRAG save error: {e}", exc_info=True)
    
    logging.info(f"💾 Save result - LightRAG: {success_lightrag}")
    return success_lightrag

def get_conversation_history(query: str, user_id: Optional[str] = None, limit: int = 5):
    """Retrieve conversation history for context from LightRAG"""
    if user_id is None:
        user_id = _current_conversation.get("user_id", "unknown_user")
    
    results = []
    
    # Get from LightRAG for conversation context
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
        logging.warning(f"⚠️ LightRAG search error: {e}")
    
    return results
