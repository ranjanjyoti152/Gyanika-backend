"""
LightRAG integration module for Gyanika
Stores all conversations and model responses in LightRAG for knowledge graph-based retrieval
"""
import logging
import os
import requests
from typing import Optional, Dict, Any, List
from datetime import datetime
import json

class LightRAGStore:
    """
    LightRAG store for Gyanika - stores conversations and responses
    in a knowledge graph for enhanced retrieval
    """
    
    def __init__(
        self,
        url: str = None,
        api_key: str = None,
        workspace: str = "gyanika_conversations"
    ):
        self.url = url or os.getenv("LIGHTRAG_URL", "http://localhost:9621")
        self.api_key = api_key or os.getenv("LIGHTRAG_API_KEY", "")
        self.workspace = workspace
        self.timeout = 60
        
        # Ensure URL doesn't end with /
        self.url = self.url.rstrip("/")
        
        logging.info(f"LightRAG store initialized at {self.url}")
        logging.info(f"Workspace: {self.workspace}")
    
    def _get_headers(self) -> Dict[str, str]:
        """Get request headers with API key if configured"""
        headers = {
            "Content-Type": "application/json",
        }
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        return headers
    
    def _format_conversation_document(
        self,
        user_id: str,
        session_id: str,
        user_message: str,
        assistant_response: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Format conversation as a document for LightRAG indexing
        Creates a structured document that LightRAG can extract entities and relations from
        """
        timestamp = datetime.now().isoformat()
        
        # Create a structured document format that LightRAG can process
        document = f"""
=== CONVERSATION RECORD ===
Timestamp: {timestamp}
User ID: {user_id}
Session ID: {session_id}

USER QUESTION:
{user_message}

GYANIKA RESPONSE:
{assistant_response}

METADATA:
- Source: Gyanika AI Assistant
- Type: Conversation
- Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
        
        if metadata:
            for key, value in metadata.items():
                document += f"- {key}: {value}\n"
        
        document += "\n=== END CONVERSATION ===\n"
        
        return document
    
    def add_conversation(
        self,
        user_id: str,
        session_id: str,
        user_message: str,
        assistant_response: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Store a conversation turn in LightRAG
        
        Args:
            user_id: Unique user identifier
            session_id: Current session ID
            user_message: User's message
            assistant_response: Gyanika's response
            metadata: Additional metadata
        """
        try:
            # Format the conversation as a document
            document = self._format_conversation_document(
                user_id=user_id,
                session_id=session_id,
                user_message=user_message,
                assistant_response=assistant_response,
                metadata=metadata
            )
            
            # LightRAG API endpoint for text insertion
            endpoint = f"{self.url}/documents/text"
            
            payload = {
                "text": document,
                "description": f"Conversation between user {user_id} and Gyanika AI"
            }
            
            response = requests.post(
                endpoint,
                headers=self._get_headers(),
                json=payload,
                timeout=self.timeout
            )
            
            if response.status_code in [200, 201, 202]:
                logging.info(f"✅ Conversation saved to LightRAG for user {user_id}")
                return True
            else:
                logging.error(f"❌ LightRAG insert failed: {response.status_code} - {response.text}")
                return False
                
        except requests.exceptions.ConnectionError as e:
            logging.warning(f"⚠️ LightRAG connection failed (server may be down): {e}")
            return False
        except Exception as e:
            logging.error(f"❌ Error storing conversation in LightRAG: {e}")
            return False
    
    def add_text(self, text: str, description: str = "") -> bool:
        """
        Add arbitrary text to LightRAG for indexing
        
        Args:
            text: Text content to index
            description: Description of the content
        """
        try:
            endpoint = f"{self.url}/documents/text"
            
            payload = {
                "text": text,
                "description": description
            }
            
            response = requests.post(
                endpoint,
                headers=self._get_headers(),
                json=payload,
                timeout=self.timeout
            )
            
            if response.status_code in [200, 201, 202]:
                logging.info(f"✅ Text added to LightRAG")
                return True
            else:
                logging.error(f"❌ LightRAG insert failed: {response.status_code}")
                return False
                
        except Exception as e:
            logging.error(f"❌ Error adding text to LightRAG: {e}")
            return False
    
    def query(
        self,
        query: str,
        mode: str = "hybrid",
        only_need_context: bool = False,
        top_k: int = 10
    ) -> Dict[str, Any]:
        """
        Query LightRAG for relevant information
        
        Args:
            query: Search query
            mode: Query mode - 'local', 'global', 'hybrid', 'naive', 'mix'
            only_need_context: If True, only returns retrieved context
            top_k: Number of top results to retrieve
        
        Returns:
            Query response with answer and context
        """
        try:
            endpoint = f"{self.url}/query"
            
            payload = {
                "query": query,
                "mode": mode,
                "only_need_context": only_need_context,
                "top_k": top_k
            }
            
            response = requests.post(
                endpoint,
                headers=self._get_headers(),
                json=payload,
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                result = response.json()
                logging.info(f"🔍 LightRAG query successful")
                return result
            else:
                logging.error(f"❌ LightRAG query failed: {response.status_code}")
                return {"error": response.text}
                
        except Exception as e:
            logging.error(f"❌ Error querying LightRAG: {e}")
            return {"error": str(e)}
    
    def search_conversations(
        self,
        query: str,
        user_id: Optional[str] = None,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Search for relevant past conversations
        
        Args:
            query: Search query
            user_id: Optional user filter (not directly supported, included in query)
            limit: Number of results
        
        Returns:
            List of relevant conversation contexts
        """
        try:
            # If user_id is provided, include it in the query for better filtering
            search_query = query
            if user_id:
                search_query = f"User {user_id}: {query}"
            
            result = self.query(
                query=search_query,
                mode="hybrid",
                only_need_context=True,
                top_k=limit
            )
            
            if "error" in result:
                return []
            
            # Parse the context into conversation items
            context = result.get("response", "") or result.get("context", "")
            
            # Return as a list with the context
            if context:
                return [{
                    "context": context,
                    "query": query,
                    "timestamp": datetime.now().isoformat()
                }]
            
            return []
            
        except Exception as e:
            logging.error(f"❌ Error searching conversations in LightRAG: {e}")
            return []
    
    def health_check(self) -> bool:
        """Check if LightRAG server is available"""
        try:
            response = requests.get(
                f"{self.url}/health",
                headers=self._get_headers(),
                timeout=5
            )
            return response.status_code == 200
        except Exception:
            return False
    
    def get_graph_stats(self) -> Dict[str, Any]:
        """Get knowledge graph statistics"""
        try:
            response = requests.get(
                f"{self.url}/graphs",
                headers=self._get_headers(),
                timeout=10
            )
            
            if response.status_code == 200:
                return response.json()
            return {}
        except Exception as e:
            logging.error(f"Error getting graph stats: {e}")
            return {}


# Global instance
_lightrag_store = None


def get_lightrag_store() -> LightRAGStore:
    """Get or create global LightRAG store instance"""
    global _lightrag_store
    if _lightrag_store is None:
        _lightrag_store = LightRAGStore(
            url=os.getenv("LIGHTRAG_URL", "http://localhost:9621"),
            api_key=os.getenv("LIGHTRAG_API_KEY", "")
        )
    return _lightrag_store
