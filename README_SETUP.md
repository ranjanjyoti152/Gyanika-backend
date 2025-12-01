# 🎓 Gyanika - AI Learning Assistant

Complete AI-powered learning assistant for Classes 9–12 students with NCERT curriculum support.

## ✨ What's New

- ✅ **Ollama Integration** - Local embeddings using qwen3-embedding:8b (4096 dimensions)
- ✅ **Doculing Integration** - Advanced PDF extraction with OCR support
- ✅ **Qdrant Vector DB** - Semantic search across educational content
- ✅ **Conversation Memory** - Remembers past discussions for context-aware responses
- ✅ **Learning Progress Tracking** - Monitors student activities and provides insights

## 🏗️ System Architecture

```
┌─────────────────┐
│  PDF Documents  │
│  (ncert_books/) │
└────────┬────────┘
         │
         v
┌─────────────────┐      ┌──────────────┐
│   Doculing      │─────>│  Text Data   │
│  PDF Extractor  │      └──────┬───────┘
│ :5001/extract   │             │
└─────────────────┘             v
                       ┌─────────────────┐
                       │     Ollama      │
                       │   qwen3-embed   │
                       │    :11434       │
                       └────────┬────────┘
                                │
                                v (4096-dim vectors)
                       ┌─────────────────┐
                       │     Qdrant      │
                       │   Vector DB     │
                       │     :6333       │
                       └────────┬────────┘
                                │
                                v
                       ┌─────────────────┐
                       │    Gyanika      │
                       │  AI Assistant   │
                       └─────────────────┘
```

## 🚀 Quick Start

### 1. Prerequisites

Ensure all services are running:

```bash
# Test all services
python test_services.py
```

Required services:
- **Qdrant** - Vector database (required)
- **Ollama** - Embedding service (optional, will fallback)
- **Doculing** - PDF extraction (optional, will fallback)

### 2. Add PDF Documents

Place NCERT textbooks in `ncert_books/` folder:

```bash
cp ~/Downloads/class_10_science.pdf ncert_books/
cp ~/Downloads/class_10_mathematics.pdf ncert_books/
```

### 3. Populate Database

```bash
python populate_qdrant.py
```

The script will:
1. Send PDFs to Doculing for text extraction
2. Generate embeddings using Ollama
3. Store in Qdrant vector database

### 4. Start Gyanika

```bash
python agent.py dev
```

## 📋 Service Configuration

### Ollama (Embeddings)
- **URL**: http://localhost:11434
- **Model**: qwen3-embedding:8b
- **Dimensions**: 4096
- **Fallback**: sentence-transformers (384-dim)

Install model:
```bash
ollama pull qwen3-embedding:8b
```

### Doculing (PDF Extraction)
- **URL**: http://192.168.101.66:5001
- **Endpoint**: /extract
- **Features**: OCR support for scanned PDFs
- **Fallback**: PyPDF2 local extraction

### Qdrant (Vector Database)
- **URL**: http://10.10.18.161:6333
- **Collections**: 
  - `gyanika_education` (4096-dim)
  - `gyanika_conversations` (4096-dim)
  - `gyanika_learning_history` (4096-dim)

## 🔧 Features

### 📚 Educational Tools
- Search NCERT content by topic, class, or subject
- Step-by-step problem solving
- Concept explanations with examples
- Chapter summaries

### 💬 Conversation Memory
- Remembers previous discussions
- Context-aware responses
- Personalized learning paths

### 📊 Progress Tracking
- Track questions asked
- Monitor subjects studied
- Learning activity insights

### 🖥️ System Control (Optional)
- Open applications
- Adjust volume/brightness
- File management
- Process monitoring

## 🧪 Testing

### Health Check
```bash
python test_services.py
```

### Vector Store Test
```bash
python test_vector_store.py
```

### End-to-End Test
```bash
# Add a test PDF
cp sample.pdf ncert_books/test.pdf

# Process it
python populate_qdrant.py

# Query it
python agent.py dev
# Then ask: "What's in the test document?"
```

## 📝 Example Queries

Once running, ask Gyanika:

- "Explain photosynthesis from Class 10 Science"
- "How do I solve quadratic equations?"
- "What caused the French Revolution?"
- "Show my learning progress"
- "What subjects have I studied today?"

## 🔄 Fallback Behavior

The system is designed to work with partial service availability:

| Service | Status | Behavior |
|---------|--------|----------|
| Ollama | ✅ Running | Uses qwen3-embedding:8b (4096-dim) |
| Ollama | ❌ Down | Falls back to sentence-transformers (384-dim) |
| Doculing | ✅ Running | Advanced PDF extraction with OCR |
| Doculing | ❌ Down | Falls back to PyPDF2 local extraction |
| Qdrant | ✅ Running | Full functionality |
| Qdrant | ❌ Down | ⚠️ System will not work |

## 📂 File Structure

```
Gyanika/
├── agent.py                    # Main AI agent
├── vector_store.py             # Qdrant + Ollama integration
├── populate_qdrant.py          # PDF processor
├── tools.py                    # Agent capabilities
├── prompts.py                  # AI personality & instructions
├── test_services.py            # Service health checker
├── test_vector_store.py        # Vector DB tester
├── ncert_books/                # 📚 PUT PDFs HERE
│   └── README.md
├── KNOWLEDGE_BASE_GUIDE.md     # Detailed guide
└── requirements.txt            # Python dependencies
```

## 🛠️ Troubleshooting

### "Cannot connect to Ollama"
```bash
# Start Ollama
ollama serve

# Verify model
ollama list | grep qwen3-embedding

# Pull if missing
ollama pull qwen3-embedding:8b
```

### "Doculing unavailable"
- System will use PyPDF2 fallback automatically
- No action needed unless you want OCR support

### "Qdrant connection error"
```bash
# Check Qdrant status
curl http://10.10.18.161:6333/collections

# Verify network connectivity
ping 10.10.18.161
```

### Vector size mismatch
- Delete and recreate collections if switching between Ollama and fallback
- Or use separate collection names for different embedding models

## 📦 Dependencies

```bash
pip install -r requirements.txt
```

Key packages:
- `qdrant-client` - Vector database client
- `sentence-transformers` - Fallback embeddings
- `livekit-agents` - AI agent framework
- `livekit-plugins-google` - Gemini integration
- `PyPDF2` - PDF processing
- `requests` - HTTP client

## 🤝 Contributing

Improvements welcome! Focus areas:
- Additional PDF formats (DOCX, EPUB)
- Better OCR integration
- More educational tools
- Performance optimization

## 📄 License

See LICENSE file.

## 👥 Credits

- Built on LiveKit Agents framework
- Uses Ollama for local embeddings
- Qdrant for vector storage
- Doculing for PDF extraction
