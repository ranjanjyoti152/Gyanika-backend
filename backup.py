from dotenv import load_dotenv
import asyncio
import os
import logging

from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions
from livekit.plugins import google
from prompts import AGENT_INSTRUCTION, SESSION_INSTRUCTION
from vector_store import get_vector_store
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
    
    # Get user and session identifiers from room participants
    user_id = ctx.room.name or "default_room"
    session_id = ctx.room.sid if hasattr(ctx.room, 'sid') else "default_session"
    
    logging.info("=" * 80)
    logging.info(f"🚀 Starting Gyanika AI Assistant")
    logging.info(f"   Room: {user_id}")
    logging.info(f"   Session: {session_id}")
    logging.info(f"   Vector Store: http://10.10.18.161:6333")
    logging.info("   NOTE: Conversation memory tracking is set up")
    logging.info("=" * 80)
    
    # Set user context for conversation logging
    set_user_context(user_id, session_id)
    
    # Store conversation context
    conversation_context = {"user_msg": None, "agent_msg": None}
    intro_sent = False
    
    session = AgentSession()

    # Create assistant
    assistant = Assistant()
    
    # Hook into the session to capture conversations
    # We'll use the room's data channel to listen for transcription events
    @ctx.room.on("data_received")
    def on_data_received(data_packet):
        """Capture transcription data from the room"""
        nonlocal intro_sent
        try:
            import json
            data = json.loads(data_packet.data.decode('utf-8'))
            
            # Check if this is a transcription message
            if data.get("type") == "transcription":
                text = data.get("text", "")
                participant = data.get("participant_identity", "")
                is_final = data.get("is_final", False)
                
                if is_final and text:
                    # Determine if it's user or agent
                    is_agent = "agent" in participant.lower() or participant == assistant.__class__.__name__
                    
                    if is_agent:
                        conversation_context["agent_msg"] = text
                        logging.info(f"🤖 Gyanika: {text[:100]}...")
                        
                        # If we have both user and agent messages, save them
                        if conversation_context["user_msg"]:
                            log_conversation_turn(
                                user_message=conversation_context["user_msg"],
                                assistant_response=conversation_context["agent_msg"]
                            )
                            conversation_context["user_msg"] = None
                            conversation_context["agent_msg"] = None
                    else:
                        conversation_context["user_msg"] = text
                        logging.info(f"👤 User: {text[:100]}...")
                        if not intro_sent:
                            asyncio.create_task(
                                session.generate_reply(
                                    instructions=SESSION_INSTRUCTION,
                                )
                            )
                            intro_sent = True
        except Exception as e:
            logging.debug(f"Data packet processing: {e}")
    
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
    logging.info("💾 Listening for conversations to save to Qdrant...")


if __name__ == "__main__":
    agents.cli.run_app(
        agents.WorkerOptions(
            entrypoint_fnc=entrypoint,
            job_memory_warn_mb=0,
            job_memory_limit_mb=0,
        )
    )