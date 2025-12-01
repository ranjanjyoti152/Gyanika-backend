# 📚 Gyanika Knowledge Base Setup Guide

## System Architecture

Gyanika uses:
- **Doculing** (`http://192.168.101.66:5001`) - Advanced PDF text extraction
- **Ollama** (`http://localhost:11434`) - Local embeddings with `qwen3-embedding:8b` model
- **Qdrant** (`http://10.10.18.161:6333`) - Vector database for semantic search

## Quick Start

### 1. Add Your PDF Documents

Place your NCERT textbooks and educational PDFs in the `ncert_books/` folder.

**Recommended naming convention:**
```
ncert_books/
├── class_9_science.pdf
├── class_9_mathematics.pdf
├── class_10_science.pdf
├── class_10_mathematics.pdf
├── class_10_social_science.pdf
├── class_11_physics.pdf
├── class_12_chemistry.pdf
└── any_other_educational_content.pdf
```

### 2. Update Gyanika's Knowledge Base

Run the populate script:
```bash
python populate_qdrant.py
```

The script will:
- ✅ Scan all PDFs in `ncert_books/` folder
- ✅ Extract text using Doculing service (fallback to PyPDF2 if unavailable)
- ✅ Generate embeddings using Ollama with qwen3-embedding:8b (4096 dimensions)
- ✅ Split content into searchable chunks
- ✅ Store everything in Qdrant vector database
- ✅ Make it available for Gyanika to search

### 3. Start Using Gyanika

After populating the database, Gyanika can answer questions based on the uploaded content:

```bash
python agent.py dev
```

Then ask questions like:
- "Explain photosynthesis from Class 10 Science"
- "What is the quadratic formula?"
- "Tell me about the French Revolution"

## Features

### 🔍 Semantic Search
Gyanika uses vector embeddings to understand the meaning of questions and find relevant content, not just keyword matching.

### 📊 Progress Tracking
Gyanika tracks each student's learning activities and provides personalized insights.

### 💬 Conversation Memory
All conversations are stored and can be recalled for context-aware responses.

### 🎯 Class & Subject Filtering
Search can be filtered by:
- Class (9, 10, 11, 12)
- Subject (Science, Mathematics, Social Science, etc.)

## Supported File Types

- **PDF** - Text-based PDF files (`.pdf`)
- **Text** - Plain text files (coming soon)
- **Word** - DOCX files (coming soon)

## Tips

1. **File Names Matter**: Use descriptive names to help automatic metadata detection
2. **Text-Based PDFs**: Scanned PDFs require OCR (not yet implemented)
3. **File Size**: Large PDFs are automatically chunked for better search results
4. **Update Anytime**: Run `populate_qdrant.py` anytime you add new PDFs

## Troubleshooting

### Service Health Check

Run the health check script to verify all services:
```bash
python test_services.py
```

This will check:
- Ollama embedding service
- Doculing PDF extraction service  
- Qdrant vector database

### Qdrant Connection Error
```bash
# Check if Qdrant is running
curl http://10.10.18.161:6333/
```

### PDF Extraction Issues
- Doculing service provides better extraction than PyPDF2
- If Doculing is unavailable, the system will automatically fall back to PyPDF2
- Check Doculing is running: `curl http://192.168.101.66:5001/health`
- Scanned PDFs work better with Doculing (has OCR support)

### Ollama Embedding Issues
- Verify Ollama is running: `curl http://localhost:11434/api/tags`
- Check if model is available: `ollama list | grep qwen3-embedding`
- Pull the model if needed: `ollama pull qwen3-embedding:8b`
- If Ollama fails, system will fall back to sentence-transformers (slower, smaller embeddings)

### Missing Dependencies
```bash
pip install -r requirements.txt
```

## Database Collections

Gyanika uses 3 collections in Qdrant:

1. **gyanika_education** - NCERT content and educational materials (4096-dim vectors)
2. **gyanika_conversations** - Chat history for context
3. **gyanika_learning_history** - Student activity tracking

## Environment Variables

You can customize service URLs:

```bash
# Doculing PDF extraction service
export DOCULING_URL="http://192.168.101.66:5001"

# These are configured in vector_store.py:
# - Ollama: http://localhost:11434
# - Qdrant: http://10.10.18.161:6333
```

## Need Help?

Check the main README.md or contact support.
