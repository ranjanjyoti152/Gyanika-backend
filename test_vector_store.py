#!/usr/bin/env python3
"""
Quick test to verify the vector store is working with Ollama embeddings
"""
from vector_store import get_vector_store
import logging

logging.basicConfig(level=logging.INFO)

def main():
    print("=" * 60)
    print("  Testing Gyanika Vector Store with Ollama")
    print("=" * 60)
    print()
    
    # Initialize vector store
    print("🔧 Initializing vector store...")
    vs = get_vector_store()
    
    # Test adding some sample content
    print("\n📝 Adding sample educational content...")
    success = vs.add_ncert_content(
        content="Photosynthesis is the process by which green plants make food using sunlight, water, and carbon dioxide.",
        class_num=10,
        subject="Science",
        chapter="Life Processes",
        chapter_num=6,
        topic="Photosynthesis"
    )
    
    if success:
        print("   ✅ Content added successfully!")
    else:
        print("   ❌ Failed to add content")
        return
    
    # Test searching
    print("\n🔍 Searching for 'how do plants make food'...")
    results = vs.search_ncert_content(
        query="how do plants make food",
        limit=3
    )
    
    if results:
        print(f"\n   ✅ Found {len(results)} result(s):")
        for i, result in enumerate(results, 1):
            print(f"\n   Result {i}:")
            print(f"   Class: {result['class']}, Subject: {result['subject']}")
            print(f"   Content: {result['content'][:100]}...")
            print(f"   Relevance: {result['score']:.2%}")
    else:
        print("   ⚠️  No results found")
    
    print("\n" + "=" * 60)
    print("✅ Vector store test completed successfully!")
    print("=" * 60)

if __name__ == "__main__":
    main()
