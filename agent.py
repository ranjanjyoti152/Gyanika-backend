from dotenv import load_dotenv
import asyncio
import os
import logging

from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions
from livekit.plugins import google
from prompts import AGENT_INSTRUCTION, SESSION_INSTRUCTION
from vector_store import get_vector_store
from lightrag_store import get_lightrag_store
from conversation_logger import set_user_context, log_conversation_turn
from tools import (
    get_weather,
    search_web,
    send_email,
)

load_dotenv()

# Enable NVIDIA hardware acceleration
os.environ["LIVEKIT_HARDWARE_ENCODER"] = "nvidia"
os.environ["LIVEKIT_HARDWARE_DECODER"] = "nvidia"

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions=AGENT_INSTRUCTION,
            llm=google.beta.realtime.RealtimeModel(
                model="models/gemini-2.5-flash-native-audio-preview-09-2025",
                voice="Zephyr",  # Female Hindi voice with Indian accent - perfect for Gyanika
                temperature=0.8,  # Balanced temperature for educational responses
            ),
            tools=[
                # Educational Tools (NOT IMPLEMENTED YET - RAG functionality pending)
                # search_ncert_content,
                # get_my_learning_progress,
                # Communication & Search Tools
                get_weather,
                search_web,
                send_email,
            ],
        )
        



async def entrypoint(ctx: agents.JobContext):
    # Initialize vector store for conversation memory
    vector_store = get_vector_store()
    
    # Initialize LightRAG store
    lightrag_store = get_lightrag_store()
    lightrag_available = lightrag_store.health_check()
    
    # Get user and session identifiers from room participants
    user_id = ctx.room.name or "default_room"
    session_id = ctx.room.sid if hasattr(ctx.room, 'sid') else "default_session"
    
    logging.info("=" * 80)
    logging.info(f"🚀 Starting Gyanika AI Assistant")
    logging.info(f"   Room: {user_id}")
    logging.info(f"   Session: {session_id}")
    logging.info(f"   Vector Store (Qdrant): http://10.10.18.161:6333")
    logging.info(f"   LightRAG: {os.getenv('LIGHTRAG_URL', 'http://localhost:9621')}")
    logging.info(f"   LightRAG Status: {'✅ Connected' if lightrag_available else '⚠️ Not Available'}")
    logging.info("   NOTE: Conversations saved to both Qdrant and LightRAG")
    logging.info("=" * 80)
    
    # Set user context for conversation logging
    set_user_context(user_id, session_id)
    
    # Store conversation context
    conversation_context = {"user_msg": None, "agent_msg": None}
    intro_sent = False
    
    session = AgentSession()

    # Create assistant
    assistant = Assistant()
    
    # Subscribe to user transcription events
    @session.on("user_input_transcribed")
    def on_user_transcribed(event: agents.UserInputTranscribedEvent):
        """Capture user speech transcription"""
        nonlocal intro_sent
        if event.is_final and event.transcript:
            conversation_context["user_msg"] = event.transcript
            logging.info(f"👤 User: {event.transcript[:100]}...")
            
            # Generate intro on first interaction
            if not intro_sent:
                asyncio.create_task(
                    session.generate_reply(
                        instructions=SESSION_INSTRUCTION,
                    )
                )
                intro_sent = True
    
    # Subscribe to conversation item events (captures agent responses)
    @session.on("conversation_item_added")
    def on_conversation_item(event: agents.ConversationItemAddedEvent):
        """Capture agent responses from conversation"""
        try:
            item = event.item
            # Check if this is an assistant/agent message
            if hasattr(item, 'role') and item.role in ['assistant', 'model']:
                # Extract text content from the message
                text_content = ""
                if hasattr(item, 'content'):
                    if isinstance(item.content, str):
                        text_content = item.content
                    elif isinstance(item.content, list):
                        # Content might be a list of content parts
                        for part in item.content:
                            if hasattr(part, 'text'):
                                text_content += part.text
                            elif isinstance(part, str):
                                text_content += part
                
                if text_content:
                    conversation_context["agent_msg"] = text_content
                    logging.info(f"🤖 Gyanika: {text_content[:100]}...")
                    
                    # Save conversation if we have both user and agent messages
                    if conversation_context["user_msg"]:
                        log_conversation_turn(
                            user_message=conversation_context["user_msg"],
                            assistant_response=conversation_context["agent_msg"]
                        )
                        conversation_context["user_msg"] = None
                        conversation_context["agent_msg"] = None
            
            # Also check for user messages
            elif hasattr(item, 'role') and item.role == 'user':
                text_content = ""
                if hasattr(item, 'content'):
                    if isinstance(item.content, str):
                        text_content = item.content
                    elif isinstance(item.content, list):
                        for part in item.content:
                            if hasattr(part, 'text'):
                                text_content += part.text
                            elif isinstance(part, str):
                                text_content += part
                
                if text_content and not conversation_context["user_msg"]:
                    conversation_context["user_msg"] = text_content
                    logging.info(f"👤 User (from chat): {text_content[:100]}...")
                    
        except Exception as e:
            logging.debug(f"Conversation item processing: {e}")
    
    # Also listen for speech events (backup method)
    @session.on("agent_speech_committed")  
    def on_speech_committed(event):
        """Backup capture of agent speech when committed"""
        try:
            if hasattr(event, 'content') and event.content:
                text = event.content
                conversation_context["agent_msg"] = text
                logging.info(f"🤖 Gyanika (speech): {text[:100]}...")
                
                if conversation_context["user_msg"]:
                    log_conversation_turn(
                        user_message=conversation_context["user_msg"],
                        assistant_response=text
                    )
                    conversation_context["user_msg"] = None
                    conversation_context["agent_msg"] = None
        except Exception as e:
            logging.debug(f"Speech commit processing: {e}")
    
    await session.start(
        room=ctx.room,
        agent=assistant,
        room_input_options=RoomInputOptions(
            # Cloud-only noise cancellation disabled for self-hosting
            video_enabled=True,
        ),
    )

    await ctx.connect()

    logging.info("✅ Gyanika agent connected and ready!")
    logging.info("💾 Listening for conversations to save to Qdrant and LightRAG...")


if __name__ == "__main__":
    agents.cli.run_app(
        agents.WorkerOptions(
            entrypoint_fnc=entrypoint,
            job_memory_warn_mb=0,
            job_memory_limit_mb=0,
        )
    )