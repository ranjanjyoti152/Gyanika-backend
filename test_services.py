#!/usr/bin/env python3
"""
Test script to verify Doculing and Ollama services are working
"""
import requests
import sys

def test_ollama():
    """Test Ollama embedding service"""
    print("🔍 Testing Ollama embedding service...")
    try:
        response = requests.post(
            "http://localhost:11434/api/embeddings",
            json={
                "model": "qwen3-embedding:8b",
                "prompt": "test"
            },
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        
        if "embedding" in data:
            embedding_size = len(data["embedding"])
            print(f"   ✅ Ollama is working! Embedding size: {embedding_size}")
            return True
        else:
            print(f"   ❌ Unexpected Ollama response: {data}")
            return False
    except requests.exceptions.ConnectionError:
        print(f"   ❌ Cannot connect to Ollama at http://localhost:11434")
        print(f"   💡 Make sure Ollama is running: ollama serve")
        return False
    except Exception as e:
        print(f"   ❌ Ollama error: {e}")
        return False

def test_doculing():
    """Test Doculing PDF extraction service"""
    print("\n🔍 Testing Doculing PDF extraction service...")
    try:
        response = requests.get(
            "http://192.168.101.66:5001/health",
            timeout=5
        )
        print(f"   ✅ Doculing is accessible")
        return True
    except requests.exceptions.ConnectionError:
        print(f"   ⚠️  Cannot connect to Doculing at http://192.168.101.66:5001")
        print(f"   💡 Doculing might not be running or network is unreachable")
        print(f"   💡 Will fall back to PyPDF2 for PDF extraction")
        return False
    except Exception as e:
        print(f"   ⚠️  Doculing error: {e}")
        return False

def test_qdrant():
    """Test Qdrant vector database"""
    print("\n🔍 Testing Qdrant vector database...")
    try:
        response = requests.get(
            "http://10.10.18.161:6333/collections",
            timeout=5
        )
        response.raise_for_status()
        data = response.json()
        
        if "result" in data:
            collections = data["result"].get("collections", [])
            print(f"   ✅ Qdrant is working! Found {len(collections)} collection(s)")
            for col in collections:
                print(f"      - {col.get('name', 'unknown')}")
            return True
        else:
            print(f"   ✅ Qdrant is accessible")
            return True
    except requests.exceptions.ConnectionError:
        print(f"   ❌ Cannot connect to Qdrant at http://10.10.18.161:6333")
        print(f"   💡 Make sure Qdrant is running")
        return False
    except Exception as e:
        print(f"   ❌ Qdrant error: {e}")
        return False

def main():
    print("=" * 60)
    print("  🧪 GYANIKA - Service Health Check")
    print("=" * 60)
    print()
    
    ollama_ok = test_ollama()
    doculing_ok = test_doculing()
    qdrant_ok = test_qdrant()
    
    print()
    print("=" * 60)
    print("  📊 Summary")
    print("=" * 60)
    print(f"  Ollama (embeddings):  {'✅ Ready' if ollama_ok else '❌ Not available'}")
    print(f"  Doculing (PDF):       {'✅ Ready' if doculing_ok else '⚠️  Will use fallback'}")
    print(f"  Qdrant (database):    {'✅ Ready' if qdrant_ok else '❌ Not available'}")
    print()
    
    if qdrant_ok and (ollama_ok or True):  # Qdrant is essential
        print("✅ System is ready to process PDFs!")
        if not ollama_ok:
            print("⚠️  Will use sentence-transformers for embeddings (slower)")
        if not doculing_ok:
            print("⚠️  Will use PyPDF2 for PDF extraction (may be less accurate)")
        return 0
    else:
        print("❌ Critical services are not available. Please fix the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
