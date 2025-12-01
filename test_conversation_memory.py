#!/usr/bin/env python3
"""
Test script to verify conversation memory is being saved to Qdrant
"""
import logging
from vector_store import get_vector_store
from conversation_logger import set_user_context, log_conversation_turn

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def test_conversation_saving():
    print("=" * 80)
    print("Testing Conversation Memory Storage in Qdrant")
    print("Vector Store: http://10.10.18.161:6333")
    print("=" * 80)
    print()
    
    # Initialize
    vs = get_vector_store()
    set_user_context(user_id="test_user_123", session_id="test_session_456")
    
    # Test 1: Save a simple conversation
    print("📝 Test 1: Saving a simple conversation turn...")
    success = log_conversation_turn(
        user_message="What is photosynthesis?",
        assistant_response="Photosynthesis is the process by which green plants use sunlight to synthesize nutrients from carbon dioxide and water. It's a crucial biological process that produces oxygen as a byproduct."
    )
    print(f"   Result: {'✅ SUCCESS' if success else '❌ FAILED'}")
    print()
    
    # Test 2: Save another conversation
    print("📝 Test 2: Saving another conversation turn...")
    success = log_conversation_turn(
        user_message="Can you explain Newton's first law?",
        assistant_response="Newton's first law, also known as the law of inertia, states that an object at rest stays at rest and an object in motion stays in motion with the same speed and direction unless acted upon by an external force."
    )
    print(f"   Result: {'✅ SUCCESS' if success else '❌ FAILED'}")
    print()
    
    # Test 3: Search conversation history
    print("🔍 Test 3: Searching conversation history...")
    results = vs.search_conversation_history(
        query="plants and food",
        user_id="test_user_123",
        limit=5
    )
    print(f"   Found {len(results)} matching conversations")
    if results:
        for i, result in enumerate(results, 1):
            print(f"\n   Match {i} (relevance: {result['score']:.2%}):")
            print(f"   User: {result['user_message'][:80]}...")
            print(f"   Assistant: {result['assistant_response'][:80]}...")
    print()
    
    # Test 4: Direct API test
    print("🔗 Test 4: Direct Qdrant API connection test...")
    try:
        from qdrant_client import QdrantClient
        client = QdrantClient(url="http://10.10.18.161:6333")
        
        # List collections
        collections = client.get_collections()
        print(f"   Available collections:")
        for collection in collections.collections:
            count = client.count(collection_name=collection.name)
            print(f"     - {collection.name}: {count.count} points")
        print()
        
        # Check conversation collection
        conv_collection = "gyanika_conversations"
        count = client.count(collection_name=conv_collection)
        print(f"   Conversation collection: {count.count} entries")
        
    except Exception as e:
        print(f"   ❌ Error connecting to Qdrant: {e}")
    
    print()
    print("=" * 80)
    print("Test Complete!")
    print("=" * 80)

if __name__ == "__main__":
    test_conversation_saving()
