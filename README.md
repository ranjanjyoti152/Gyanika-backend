<p align="center">
  <img src="agent-starter-react/public/ai-background.jpg" alt="Gyanika Banner" width="100%" />
</p>

<h1 align="center">🎓 Gyanika - AI-Powered Educational Voice Assistant</h1>

<p align="center">
  <strong>Your Personal AI Tutor for Competitive Exam Preparation</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#api-reference">API Reference</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11+-blue?style=for-the-badge&logo=python" alt="Python" />
  <img src="https://img.shields.io/badge/Next.js-15.5-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/LiveKit-Agents-purple?style=for-the-badge&logo=webrtc" alt="LiveKit" />
  <img src="https://img.shields.io/badge/Gemini-2.5_Flash-orange?style=for-the-badge&logo=google" alt="Gemini" />
  <img src="https://img.shields.io/badge/LightRAG-Memory-green?style=for-the-badge" alt="LightRAG" />
</p>

---

## 🌟 Overview

**Gyanika** (ज्ञानिका - derived from "Gyan" meaning knowledge) is an advanced AI-powered educational voice assistant designed specifically for Indian students preparing for competitive exams like **UPSC, SSC, Banking, Railways**, and more.

Built with cutting-edge technologies including **Google Gemini 2.5 Flash** for real-time voice conversations, **LiveKit** for WebRTC-based communication, and **LightRAG** for persistent conversation memory, Gyanika provides a personalized, intelligent tutoring experience.

### 🎯 Key Highlights

- **🗣️ Natural Voice Conversations** - Speak in Hindi, English, or Hinglish
- **🧠 Long-term Memory** - Remembers your learning progress across sessions
- **📚 Exam-Focused** - Tailored for Indian competitive exam preparation
- **🔐 User Authentication** - Personalized learning experience
- **🎨 Beautiful UI** - Modern dark theme with glass-morphism effects
- **⚡ Real-time** - Sub-second response latency with native audio

---

## ✨ Features

### 🎙️ Voice-First Interaction
- Real-time voice conversations powered by **Gemini 2.5 Flash Native Audio**
- Natural voice synthesis with **Zephyr** voice model
- Support for multilingual input (Hindi, English, Hinglish)
- Automatic voice activity detection

### 🧠 Intelligent Memory System
- **LightRAG Integration** - Graph-based knowledge retrieval
- Persistent conversation history across sessions
- Context-aware responses based on past interactions
- User-specific knowledge graphs

### 📖 Educational Excellence
- Structured explanations for complex topics
- Real-world examples and mnemonics
- Progressive difficulty adjustment
- Exam-specific tips and strategies

### 🎨 Modern User Interface
- Dark theme with cyan/blue gradient accents
- Glass-morphism design elements
- Animated loading states and transitions
- Responsive design for all devices
- Audio visualizer with real-time feedback

### 🔐 Authentication System
- User registration and login
- Session persistence with localStorage
- Personalized greetings and interactions
- Secure token-based room access

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                               │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              Next.js 15.5 React Application                  │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │    │
│  │  │  Auth Page  │  │Welcome View │  │   Session View      │  │    │
│  │  │  (Login/    │  │ (Start      │  │  (Voice Chat +      │  │    │
│  │  │  Signup)    │  │  Learning)  │  │   Transcript)       │  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ WebRTC (Audio/Video)
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         LIVEKIT CLOUD                                │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Room Management                           │    │
│  │         • Real-time Audio/Video Streaming                    │    │
│  │         • Participant Management                             │    │
│  │         • Agent Dispatching                                  │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ Agent SDK
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         AGENT LAYER                                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              Python LiveKit Agent (agent.py)                 │    │
│  │  ┌───────────────┐  ┌────────────────┐  ┌────────────────┐  │    │
│  │  │ Gemini 2.5    │  │   Memory       │  │    Tools       │  │    │
│  │  │ Flash Native  │  │   Manager      │  │  (Web Search,  │  │    │
│  │  │ Audio Model   │  │   (LightRAG)   │  │   Wikipedia)   │  │    │
│  │  └───────────────┘  └────────────────┘  └────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ REST API
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        STORAGE LAYER                                 │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    LightRAG Server                           │    │
│  │         • Graph-based Knowledge Storage                      │    │
│  │         • Semantic Search & Retrieval                        │    │
│  │         • Conversation Memory                                │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
Gyanika/
├── 🐍 Backend (Python)
│   ├── agent.py              # Main LiveKit agent with Gemini integration
│   ├── memory.py             # LightRAG memory management
│   ├── prompts.py            # System prompts and instructions
│   ├── tools.py              # Web search, Wikipedia tools
│   ├── vector_store.py       # Vector storage utilities
│   ├── conversation_logger.py # Conversation logging
│   └── requirements.txt      # Python dependencies
│
├── 🌐 Frontend (Next.js)
│   └── agent-starter-react/
│       ├── app/              # Next.js app router
│       │   ├── page.tsx      # Main application page
│       │   └── api/          # API routes
│       │       └── connection-details/
│       │           └── route.ts  # LiveKit token generation
│       ├── components/
│       │   ├── app/          # Application components
│       │   │   ├── auth-page.tsx      # Login/Signup UI
│       │   │   ├── welcome-view.tsx   # Welcome screen
│       │   │   ├── session-view.tsx   # Voice chat session
│       │   │   └── tile-layout.tsx    # Audio visualizer
│       │   └── livekit/      # LiveKit UI components
│       ├── styles/
│       │   └── globals.css   # Global styles & theme
│       └── public/
│           └── ai-background.jpg  # Background image
│
└── 📚 Documentation
    ├── README.md             # This file
    ├── KNOWLEDGE_BASE_GUIDE.md
    └── README_SETUP.md
```

---

## 🚀 Installation

### Prerequisites

- **Python 3.11+**
- **Node.js 18+** with pnpm
- **LightRAG Server** running on port 9621
- **LiveKit Cloud Account** or self-hosted LiveKit server
- **Google AI API Key** (for Gemini)

### 1. Clone the Repository

```bash
git clone https://github.com/ranjanjyoti152/Gyanika-backend.git
cd Gyanika-backend
```

### 2. Backend Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
LIVEKIT_URL=wss://your-livekit-server.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
GOOGLE_API_KEY=your_gemini_api_key
LIGHTRAG_API_BASE=http://localhost:9621
EOF
```

### 3. Frontend Setup

```bash
cd agent-starter-react

# Install dependencies
pnpm install

# Create .env.local file
cat > .env.local << EOF
LIVEKIT_URL=wss://your-livekit-server.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
EOF
```

### 4. Start LightRAG Server

```bash
# Using Docker
docker run -d -p 9621:9621 lightrag/lightrag-server

# Or using Python
lightrag-server --port 9621
```

---

## 🎮 Usage

### Start the Backend Agent

```bash
# From project root
source venv/bin/activate
python agent.py dev
```

### Start the Frontend

```bash
# From agent-starter-react directory
pnpm dev
```

### Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

### User Flow

1. **Sign Up / Login** - Create an account or login with existing credentials
2. **Welcome Screen** - Click "Start Learning" to begin a voice session
3. **Voice Chat** - Speak to Gyanika in Hindi, English, or Hinglish
4. **End Session** - Click "End Call" to disconnect

---

## 🔌 API Reference

### Connection Details API

**Endpoint:** `POST /api/connection-details`

**Request Body:**
```json
{
  "user_id": "string",
  "user_name": "string"
}
```

**Response:**
```json
{
  "serverUrl": "wss://livekit-server.cloud",
  "roomName": "room_user123_1701432000",
  "participantToken": "eyJ...",
  "participantName": "User Name"
}
```

### LightRAG Memory API

**Store Memory:**
```python
POST /documents/text
{
  "text": "conversation content",
  "metadata": {"user_id": "user123"}
}
```

**Query Memory:**
```python
POST /query
{
  "query": "user_id:user123 topic",
  "mode": "hybrid"
}
```

---

## 🛠️ Technology Stack

| Component | Technology |
|-----------|------------|
| **Voice AI** | Google Gemini 2.5 Flash Native Audio |
| **Real-time Communication** | LiveKit (WebRTC) |
| **Memory/RAG** | LightRAG with Graph Storage |
| **Backend Framework** | Python LiveKit Agents SDK 1.3.5 |
| **Frontend Framework** | Next.js 15.5 with React 19 |
| **Styling** | TailwindCSS 4.0 with custom theme |
| **Animation** | Framer Motion |
| **Voice Synthesis** | Zephyr Voice Model |

---

## 🎨 UI Theme

The application uses a custom dark blue/cyan theme:

| Element | Color |
|---------|-------|
| **Background** | `#0a0f1a` (Dark Blue) |
| **Primary** | `cyan-500` (#06b6d4) |
| **Accent** | `blue-500` (#3b82f6) |
| **Text** | `cyan-100` to `cyan-300` |
| **Glass Panel** | `rgba(10, 30, 60, 0.6)` with blur |
| **Glow Effect** | `cyan-500/30` shadow |

---

## 🧪 Testing

```bash
# Test LightRAG connection
python test_services.py

# Test conversation memory
python test_conversation_memory.py

# Test vector store
python test_vector_store.py
```

---

## 📝 Environment Variables

### Backend (.env)

| Variable | Description |
|----------|-------------|
| `LIVEKIT_URL` | LiveKit server WebSocket URL |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `GOOGLE_API_KEY` | Google AI/Gemini API key |
| `LIGHTRAG_API_BASE` | LightRAG server URL |

### Frontend (.env.local)

| Variable | Description |
|----------|-------------|
| `LIVEKIT_URL` | LiveKit server WebSocket URL |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Ranjan Jyoti**
- GitHub: [@ranjanjyoti152](https://github.com/ranjanjyoti152)

---

## 🙏 Acknowledgments

- [LiveKit](https://livekit.io/) for the amazing real-time communication platform
- [Google AI](https://ai.google.dev/) for Gemini 2.5 Flash
- [LightRAG](https://github.com/HKUDS/LightRAG) for the graph-based RAG system

---

<p align="center">
  Made with ❤️ for Indian Students
</p>

<p align="center">
  <strong>🎓 Gyanika - Knowledge is Power 🎓</strong>
</p>
