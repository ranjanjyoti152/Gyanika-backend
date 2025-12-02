from dotenv import load_dotenv
import asyncio
import os
import logging

from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions
from livekit.plugins import google
from prompts import AGENT_INSTRUCTION, SESSION_INSTRUCTION
from lightrag_store import get_lightrag_store
from conversation_logger import set_user_context, log_conversation_turn
from memory import get_brain, get_memory_enhanced_instructions
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
    # Initialize LightRAG store for conversation memory
    lightrag_store = get_lightrag_store()
    lightrag_available = lightrag_store.health_check()
    
    # Wait for connection and get actual user identity
    await ctx.connect()
    
    # Get user identity from the first non-agent participant
    user_id = None
    user_name = None
    user_metadata = {}
    
    # Wait for a real user to join (not another agent)
    # Try up to 30 seconds to find a user participant
    for attempt in range(30):
        for participant in ctx.room.remote_participants.values():
            # Skip if this is another agent (check identity prefix and kind)
            identity = participant.identity or ""
            
            # Agents have identity starting with "agent-" 
            if identity.startswith("agent-"):
                logging.debug(f"Skipping agent participant: {identity}")
                continue
            
            # Also check participant kind if available
            try:
                if hasattr(participant, 'kind') and str(participant.kind).upper() == "AGENT":
                    logging.debug(f"Skipping agent by kind: {identity}")
                    continue
            except:
                pass
            
            # This is a real user!
            user_id = identity
            user_name = participant.name or identity
            
            # Parse metadata if available (could contain user profile info)
            if participant.metadata:
                try:
                    import json
                    user_metadata = json.loads(participant.metadata)
                    # If metadata has user_id or name, use those
                    user_id = user_metadata.get("user_id", user_id)
                    user_name = user_metadata.get("name", user_name)
                except:
                    pass
            
            logging.info(f"👤 Found user: {user_name} (ID: {user_id})")
            break
        
        if user_id:
            break
            
        # Wait a bit and try again
        if attempt < 29:
            await asyncio.sleep(1)
            if attempt % 5 == 0:
                logging.info(f"⏳ Waiting for user to join... ({attempt + 1}s)")
    
    # Fallback to room name if no user found after waiting
    if not user_id:
        user_id = ctx.room.name or "default_user"
        user_name = user_id
        logging.info(f"⚠️ No user participant found after waiting, using room name: {user_id}")
    
    # Get session ID properly (it might be a coroutine in some versions)
    try:
        session_id = ctx.room.sid
        if asyncio.iscoroutine(session_id):
            session_id = await session_id
    except:
        session_id = ctx.room.name or "default_session"
    
    logging.info("=" * 80)
    logging.info(f"🚀 Starting Gyanika AI Assistant")
    logging.info(f"   User: {user_name} (ID: {user_id})")
    logging.info(f"   Room: {ctx.room.name}")
    logging.info(f"   Session: {session_id}")
    logging.info(f"   LightRAG: {os.getenv('LIGHTRAG_URL', 'http://localhost:9621')}")
    logging.info(f"   LightRAG Status: {'✅ Connected' if lightrag_available else '⚠️ Not Available'}")
    logging.info("   NOTE: Conversations saved per user to LightRAG")
    logging.info("=" * 80)
    
    # Set user context for conversation logging
    set_user_context(user_id, session_id)
    
    # Initialize Gyanika's Brain (Memory System) with user name
    brain = get_brain(user_id, user_name)
    logging.info(f"🧠 Gyanika's Brain initialized for {user_name} - ready to remember past conversations!")
    
    # Fetch past memories at session start
    initial_memory_context = ""
    try:
        # Query past conversations for this user
        past_memories = brain.recall_memories(f"Previous conversations with user {user_name}")
        if past_memories:
            initial_memory_context = past_memories
            logging.info(f"🧠 Loaded past memory context for {user_name}")
        else:
            logging.info(f"🆕 No past conversations found for {user_name} - new user!")
    except Exception as e:
        logging.warning(f"⚠️ Could not load past memories: {e}")
    
    # Store conversation context
    conversation_context = {"user_msg": None, "agent_msg": None}
    intro_sent = False
    
    session = AgentSession()

    # Create assistant
    assistant = Assistant()
    
    # Subscribe to user transcription events
    @session.on("user_input_transcribed")
    def on_user_transcribed(event: agents.UserInputTranscribedEvent):
        """Capture user speech transcription and enhance with memory"""
        nonlocal intro_sent
        if event.is_final and event.transcript:
            user_query = event.transcript
            conversation_context["user_msg"] = user_query
            logging.info(f"👤 User: {user_query[:100]}...")
            
            # Recall memories and enhance instructions
            try:
                memory_context = brain.get_memory_context_prompt(user_query)
                if memory_context:
                    logging.info(f"🧠 Memory recalled for query - enhancing response context")
                    # Update agent with memory-enhanced instructions
                    enhanced_instructions = f"{AGENT_INSTRUCTION}\n\n{memory_context}"
                    session.update_agent(instructions=enhanced_instructions)
            except Exception as e:
                logging.warning(f"⚠️ Memory recall failed: {e}")
            
            # Generate intro on first interaction
            if not intro_sent:
                try:
                    session.generate_reply(instructions=SESSION_INSTRUCTION)
                    intro_sent = True
                except Exception as e:
                    logging.error(f"Error generating intro reply: {e}")
    
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
                        # Save to long-term memory (Qdrant + LightRAG)
                        log_conversation_turn(
                            user_message=conversation_context["user_msg"],
                            assistant_response=conversation_context["agent_msg"]
                        )
                        # Also save to short-term memory (Brain)
                        brain.add_to_short_term(
                            user_msg=conversation_context["user_msg"],
                            agent_msg=conversation_context["agent_msg"]
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
                    # Save to long-term memory
                    log_conversation_turn(
                        user_message=conversation_context["user_msg"],
                        assistant_response=text
                    )
                    # Save to short-term memory (Brain)
                    brain.add_to_short_term(
                        user_msg=conversation_context["user_msg"],
                        agent_msg=text
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

    # Listen for new participants joining (to update user identity)
    @ctx.room.on("participant_connected")
    def on_participant_connected(participant):
        nonlocal user_id, user_name, brain
        
        # Skip if this is another agent (check identity prefix)
        identity = participant.identity or ""
        if identity.startswith("agent-"):
            logging.debug(f"Skipping agent participant: {identity}")
            return
            
        # Also check participant kind if available
        try:
            if hasattr(participant, 'kind') and str(participant.kind).upper() == "AGENT":
                logging.debug(f"Skipping agent by kind: {identity}")
                return
        except:
            pass
        
        # This is a real user
        user_id = participant.identity
        user_name = participant.name or participant.identity
        
        # Parse metadata if available
        if participant.metadata:
            try:
                import json
                meta = json.loads(participant.metadata)
                user_id = meta.get("user_id", user_id)
                user_name = meta.get("name", user_name)
            except:
                pass
        
        logging.info(f"👤 User joined: {user_name} (ID: {user_id})")
        
        # Update brain for this specific user with their name
        set_user_context(user_id, session_id)
        brain = get_brain(user_id, user_name)
        logging.info(f"🧠 Brain updated for user: {user_name} ({user_id})")

    logging.info("✅ Gyanika agent connected and ready!")
    logging.info(f"💾 Listening for conversations from user: {user_name}...")


async def request_fnc(req: agents.JobRequest) -> None:
    """Auto-accept all job requests - agent will join any room that requests it"""
    logging.info(f"📥 Job request received for room: {req.room.name}")
    try:
        await req.accept()
        logging.info(f"✅ Job accepted for room: {req.room.name}")
    except Exception as e:
        logging.error(f"❌ Failed to accept job for room {req.room.name}: {e}")


if __name__ == "__main__":
    agents.cli.run_app(
        agents.WorkerOptions(
            entrypoint_fnc=entrypoint,
            request_fnc=request_fnc,
            job_memory_warn_mb=0,
            job_memory_limit_mb=0,
        )
    )