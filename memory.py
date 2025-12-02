"""
Memory Module for Gyanika - Human-like Memory System
Retrieves past conversations and context to make the agent remember like a human brain
Using only LightRAG for long-term memory storage and retrieval
"""
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from lightrag_store import get_lightrag_store

class GyanikaBrain:
    """
    Gyanika's Brain - Handles memory retrieval and context building
    Like a human brain, it remembers past conversations and uses them for context
    Uses only LightRAG for long-term memory (no Qdrant)
    """
    
    def __init__(self, user_id: str = "default_user", user_name: str = None):
        self.user_id = user_id
        self.user_name = user_name or user_id  # Store user's name
        self.lightrag_store = get_lightrag_store()
        self.short_term_memory: List[Dict[str, str]] = []  # Current session memory
        self.max_short_term = 10  # Keep last 10 exchanges in short-term memory
        
        logging.info(f"🧠 Gyanika Brain initialized for user: {user_name} (ID: {user_id})")
    
    def add_to_short_term(self, user_msg: str, agent_msg: str):
        """Add conversation to short-term memory (current session)"""
        self.short_term_memory.append({
            "user": user_msg,
            "agent": agent_msg,
            "timestamp": datetime.now().isoformat()
        })
        # Keep only recent conversations
        if len(self.short_term_memory) > self.max_short_term:
            self.short_term_memory.pop(0)
        logging.info(f"🧠 Short-term memory updated ({len(self.short_term_memory)} items)")
    
    def recall_memories(self, query: str, limit: int = 5) -> str:
        """
        Recall relevant memories based on the current query
        Searches LightRAG knowledge graph for past conversations and knowledge
        Returns formatted context string for the agent
        """
        memories = []
        
        # 1. First check short-term memory (current session)
        short_term_context = self._search_short_term(query)
        if short_term_context:
            memories.append(("short_term", short_term_context))
        
        # 2. Search knowledge graph from LightRAG (semantic + graph)
        # This contains all past conversations and knowledge
        try:
            if self.lightrag_store.health_check():
                # Include user_id in the query for better filtering
                user_query = f"User ID: {self.user_id}, User Name: {self.user_name}. Query: {query}"
                
                lightrag_result = self.lightrag_store.query(
                    query=user_query,
                    mode="hybrid",
                    only_need_context=True,
                    top_k=limit
                )
                if lightrag_result and "response" in lightrag_result:
                    context = lightrag_result.get("response", "")
                    if context and len(context) > 20:
                        memories.append(("knowledge_graph", context))
                        logging.info(f"🧠 Found relevant memories from LightRAG for user {self.user_id}")
        except Exception as e:
            logging.warning(f"⚠️ LightRAG memory search failed: {e}")
        
        # Format memories into a context string
        return self._format_memories(memories)
    
    def _search_short_term(self, query: str) -> Optional[str]:
        """Search short-term memory for relevant context"""
        if not self.short_term_memory:
            return None
        
        # For now, return last few exchanges as context
        # In future, could add semantic matching
        recent = self.short_term_memory[-3:]  # Last 3 exchanges
        if recent:
            formatted = []
            for mem in recent:
                formatted.append(f"User: {mem['user']}\nGyanika: {mem['agent']}")
            return "\n---\n".join(formatted)
        return None
    
    def _format_memories(self, memories: List[tuple]) -> str:
        """Format memories into a context string for the agent"""
        if not memories:
            return ""
        
        context_parts = []
        
        # Add short-term memory first (most recent)
        for mem_type, content in memories:
            if mem_type == "short_term":
                context_parts.append(f"=== Recent Conversation (This Session) ===\n{content}")
        
        # Add knowledge graph context (includes all past conversations)
        for mem_type, content in memories:
            if mem_type == "knowledge_graph":
                context_parts.append(f"=== Past Conversations & Knowledge (Memory) ===\n{content}")
        
        if context_parts:
            return "\n\n".join(context_parts)
        return ""
    
    def get_memory_context_prompt(self, user_query: str) -> str:
        """
        Generate a memory context prompt to inject into the agent's instructions
        This helps the agent use past memories naturally
        """
        memories = self.recall_memories(user_query)
        
        # Always include user's name if known
        user_info = ""
        if self.user_name and self.user_name != self.user_id:
            user_info = f"\n**Current User's Name: {self.user_name}** - Use their name warmly in conversation!\n"
        
        if not memories and not user_info:
            return ""
        
        memory_prompt = f"""
## Your Memories (Use these naturally in conversation)
You have memories of past conversations with this user. Use them to:
- Remember what topics you discussed before
- Recall the user's preferences and learning style
- Build upon previous explanations
- Show that you remember them like a friend would
{user_info}
{memories}

## How to use memories:
- If user asks about something you discussed before, reference it naturally
- E.g., "Haan, jaise humne pehle quadratic equations mein dekha tha..."
- E.g., "Remember when we talked about photosynthesis? This is similar..."
- If you know user's name, use it: "Haan {self.user_name if self.user_name else 'dost'}, mujhe yaad hai..."
- Don't force it - only use memories when relevant
"""
        return memory_prompt


def get_memory_enhanced_instructions(base_instructions: str, user_query: str, user_id: str) -> str:
    """
    Enhance the base instructions with memory context
    This is the main function to call before each agent response
    """
    try:
        brain = GyanikaBrain(user_id=user_id)
        memory_context = brain.get_memory_context_prompt(user_query)
        
        if memory_context:
            enhanced = f"{base_instructions}\n\n{memory_context}"
            logging.info(f"🧠 Instructions enhanced with memory context")
            return enhanced
        
        return base_instructions
    except Exception as e:
        logging.error(f"❌ Error getting memory context: {e}")
        return base_instructions


# Global brain instance per user
_brain_instances: Dict[str, GyanikaBrain] = {}

def get_brain(user_id: str, user_name: str = None) -> GyanikaBrain:
    """Get or create a brain instance for a user"""
    global _brain_instances
    if user_id not in _brain_instances:
        _brain_instances[user_id] = GyanikaBrain(user_id=user_id, user_name=user_name)
    elif user_name and _brain_instances[user_id].user_name != user_name:
        # Update user name if provided and different
        _brain_instances[user_id].user_name = user_name
    return _brain_instances[user_id]
