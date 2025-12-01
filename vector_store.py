import logging
from typing import List, Optional, Dict, Any
import os
import requests
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
    SearchRequest
)
from sentence_transformers import SentenceTransformer
from datetime import datetime
import uuid

class QdrantVectorStore:
    """
    Qdrant vector store for Gyanika - stores:
    1. Conversation memory
    2. Student learning history
    
    Note: Educational content (RAG) is NOT implemented yet
    """
    
    def __init__(
        self,
        url: str = "http://10.10.18.161:6333",
        embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2",
        use_ollama: bool = True,
        ollama_url: str = "http://localhost:11434",
        ollama_model: str = "qwen3-embedding:8b"
    ):
        self.client = QdrantClient(url=url)
        
        # Ollama embedding configuration
        self.use_ollama = use_ollama
        self.ollama_url = ollama_url.rstrip("/")
        self.ollama_model = ollama_model
        
        # Fallback embedding model (sentence-transformers)
        self.embedding_model = None
        self.vector_size = 384  # Default size, will be updated based on actual embeddings
        
        # Try to get vector size from Ollama or use sentence-transformers
        if self.use_ollama:
            try:
                # Test Ollama connection and get embedding size
                test_embedding = self._get_ollama_embedding("test")
                if test_embedding:
                    self.vector_size = len(test_embedding)
                    logging.info(f"Using Ollama embeddings with size {self.vector_size}")
                else:
                    self._init_fallback_model(embedding_model)
            except Exception as e:
                logging.warning(f"Ollama not available, using fallback: {e}")
                self._init_fallback_model(embedding_model)
        else:
            self._init_fallback_model(embedding_model)
        
        # Collection names (only conversation and learning history)
        self.conversation_collection = "gyanika_conversations"
        self.learning_history_collection = "gyanika_learning_history"
        
        # Initialize collections
        self._initialize_collections()
        
        logging.info(f"Qdrant vector store initialized at {url}")
    
    def _init_fallback_model(self, embedding_model: str):
        """Initialize fallback sentence-transformers model"""
        self.embedding_model = SentenceTransformer(embedding_model)
        self.vector_size = 384  # all-MiniLM-L6-v2 embedding size
        self.use_ollama = False
        logging.info(f"Using sentence-transformers fallback with size {self.vector_size}")
    
    def _get_ollama_embedding(self, text: str) -> Optional[List[float]]:
        """Get embedding from Ollama service"""
        try:
            response = requests.post(
                f"{self.ollama_url}/api/embeddings",
                json={
                    "model": self.ollama_model,
                    "prompt": text
                },
                timeout=30
            )
            response.raise_for_status()
            data = response.json()
            
            # Ollama returns {"embedding": [...]}
            if "embedding" in data:
                return data["embedding"]
            
            logging.warning(f"Unexpected Ollama response format: {data}")
            return None
        except Exception as e:
            logging.error(f"Ollama embedding request failed: {e}")
            return None
    
    def _initialize_collections(self):
        """Create collections if they don't exist (only conversation and learning history)"""
        collections = [
            self.conversation_collection,
            self.learning_history_collection
        ]
        
        for collection_name in collections:
            try:
                self.client.get_collection(collection_name)
                logging.info(f"Collection '{collection_name}' already exists")
            except Exception:
                self.client.create_collection(
                    collection_name=collection_name,
                    vectors_config=VectorParams(
                        size=self.vector_size,
                        distance=Distance.COSINE
                    )
                )
                logging.info(f"Created collection '{collection_name}'")
    
    def _get_embedding(self, text: str) -> List[float]:
        """Generate embedding for text using Ollama or fallback"""
        # Try Ollama first if enabled
        if self.use_ollama:
            embedding = self._get_ollama_embedding(text)
            if embedding:
                return embedding
            else:
                logging.warning("Ollama embedding failed, using fallback")
        
        # Fallback to sentence-transformers
        if self.embedding_model is None:
            raise RuntimeError("No embedding model available")
        
        return self.embedding_model.encode(text).tolist()
    
    # ==================== CONVERSATION MEMORY ====================
    
    def add_conversation(
        self,
        user_id: str,
        session_id: str,
        user_message: str,
        assistant_response: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Store a conversation turn in vector database
        
        Args:
            user_id: Unique user identifier
            session_id: Current session ID
            user_message: User's message
            assistant_response: Gyanika's response
            metadata: Additional metadata (topic, class, subject, etc.)
        """
        try:
            # Combine user message and response for context
            conversation_text = f"User: {user_message}\nGyanika: {assistant_response}"
            
            point = PointStruct(
                id=str(uuid.uuid4()),
                vector=self._get_embedding(conversation_text),
                payload={
                    "user_id": user_id,
                    "session_id": session_id,
                    "user_message": user_message,
                    "assistant_response": assistant_response,
                    "timestamp": datetime.now().isoformat(),
                    "type": "conversation",
                    **(metadata or {})
                }
            )
            
            self.client.upsert(
                collection_name=self.conversation_collection,
                points=[point]
            )
            
            logging.info(f"Stored conversation for user {user_id}")
            return True
        except Exception as e:
            logging.error(f"Error storing conversation: {e}")
            return False
    
    def search_conversation_history(
        self,
        query: str,
        user_id: str,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Search user's conversation history for relevant context
        
        Args:
            query: Search query
            user_id: User identifier
            limit: Number of results
        """
        try:
            results = self.client.search(
                collection_name=self.conversation_collection,
                query_vector=self._get_embedding(query),
                query_filter=Filter(
                    must=[
                        FieldCondition(
                            key="user_id",
                            match=MatchValue(value=user_id)
                        )
                    ]
                ),
                limit=limit
            )
            
            return [
                {
                    "user_message": hit.payload.get("user_message"),
                    "assistant_response": hit.payload.get("assistant_response"),
                    "timestamp": hit.payload.get("timestamp"),
                    "score": hit.score
                }
                for hit in results
            ]
        except Exception as e:
            logging.error(f"Error searching conversation history: {e}")
            return []
    
    # ==================== EDUCATIONAL CONTENT (NOT IMPLEMENTED) ====================
    # RAG functionality is not implemented yet
    # These methods are placeholders for future implementation
    
    def add_ncert_content(self, *args, **kwargs) -> bool:
        """
        Educational content storage is not implemented yet.
        This is a placeholder for future RAG implementation.
        """
        logging.warning("add_ncert_content called but RAG is not implemented")
        return False
    
    def search_ncert_content(self, *args, **kwargs) -> List[Dict[str, Any]]:
        """
        Educational content search is not implemented yet.
        This is a placeholder for future RAG implementation.
        """
        logging.warning("search_ncert_content called but RAG is not implemented")
        return []
    
    # ==================== LEARNING HISTORY ====================
    
    def add_learning_activity(
        self,
        user_id: str,
        activity_type: str,  # "question", "topic_explored", "concept_learned"
        content: str,
        class_num: int,
        subject: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Track student's learning activities
        
        Args:
            user_id: User identifier
            activity_type: Type of activity
            content: Activity content/description
            class_num: Class number
            subject: Subject
            metadata: Additional metadata
        """
        try:
            point = PointStruct(
                id=str(uuid.uuid4()),
                vector=self._get_embedding(content),
                payload={
                    "user_id": user_id,
                    "activity_type": activity_type,
                    "content": content,
                    "class": class_num,
                    "subject": subject,
                    "timestamp": datetime.now().isoformat(),
                    "type": "learning_activity",
                    **(metadata or {})
                }
            )
            
            self.client.upsert(
                collection_name=self.learning_history_collection,
                points=[point]
            )
            
            logging.info(f"Logged learning activity for user {user_id}: {activity_type}")
            return True
        except Exception as e:
            logging.error(f"Error adding learning activity: {e}")
            return False
    
    def get_learning_insights(
        self,
        user_id: str,
        limit: int = 20
    ) -> Dict[str, Any]:
        """
        Get insights about student's learning patterns
        
        Args:
            user_id: User identifier
            limit: Number of recent activities to analyze
        """
        try:
            # Get recent activities
            results = self.client.scroll(
                collection_name=self.learning_history_collection,
                scroll_filter=Filter(
                    must=[
                        FieldCondition(key="user_id", match=MatchValue(value=user_id))
                    ]
                ),
                limit=limit
            )[0]
            
            # Analyze patterns
            subjects = {}
            activity_types = {}
            
            for point in results:
                subject = point.payload.get("subject")
                activity = point.payload.get("activity_type")
                
                subjects[subject] = subjects.get(subject, 0) + 1
                activity_types[activity] = activity_types.get(activity, 0) + 1
            
            return {
                "total_activities": len(results),
                "subjects_studied": subjects,
                "activity_breakdown": activity_types,
                "most_active_subject": max(subjects.items(), key=lambda x: x[1])[0] if subjects else None
            }
        except Exception as e:
            logging.error(f"Error getting learning insights: {e}")
            return {}
    
    # ==================== UTILITY METHODS ====================
    
    def _split_text(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """Split text into overlapping chunks"""
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end]
            chunks.append(chunk)
            start = end - overlap
        
        return chunks
    
    def delete_user_data(self, user_id: str) -> bool:
        """Delete all data for a user (GDPR compliance)"""
        try:
            for collection in [
                self.conversation_collection,
                self.learning_history_collection
            ]:
                self.client.delete(
                    collection_name=collection,
                    points_selector=Filter(
                        must=[
                            FieldCondition(key="user_id", match=MatchValue(value=user_id))
                        ]
                    )
                )
            
            logging.info(f"Deleted all data for user {user_id}")
            return True
        except Exception as e:
            logging.error(f"Error deleting user data: {e}")
            return False


# Global instance
_vector_store = None

def get_vector_store() -> QdrantVectorStore:
    """Get or create global vector store instance"""
    global _vector_store
    if _vector_store is None:
        _vector_store = QdrantVectorStore(url="http://10.10.18.161:6333")
    return _vector_store
