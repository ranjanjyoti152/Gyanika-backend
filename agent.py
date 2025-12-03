from dotenv import load_dotenv
import asyncio
import os
import logging
import time

from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions
from livekit.plugins import google
from prompts import AGENT_INSTRUCTION, SESSION_INSTRUCTION
from postgres_memory import get_postgres_memory, test_connection as test_db_connection
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
    # Test PostgreSQL connection
    db_available = test_db_connection()
    
    # Wait for connection and get actual user identity
    await ctx.connect()
    
    # Dictionary to track memory per user in the room
    user_memories = {}  # {user_id: memory_instance}
    current_speaker_id = None
    current_speaker_name = None
    
    # Get user info - Priority order:
    # 1. From participant metadata (most reliable)
    # 2. From room name parsing
    # 3. Fallback to guest
    
    user_id = None
    user_name = None
    user_metadata = {}
    
    # STEP 1: Quick check for existing participants with metadata
    for participant in ctx.room.remote_participants.values():
        identity = participant.identity or ""
        
        # Skip agents
        if identity.startswith("agent-"):
            continue
        
        # Found a user! Get their metadata
        if participant.metadata:
            try:
                import json
                user_metadata = json.loads(participant.metadata)
                user_id = user_metadata.get("user_id") or identity
                user_name = user_metadata.get("name") or participant.name or identity
                logging.info(f"👤 Found user from participant: {user_name} (ID: {user_id})")
                break
            except:
                user_id = identity
                user_name = participant.name or identity
                break
        else:
            user_id = identity
            user_name = participant.name or identity
            break
    
    # STEP 2: If no participant yet, parse from room name (faster than waiting)
    if not user_id:
        room_name = ctx.room.name or ""
        if room_name.startswith("gyanika_room_"):
            # Parse: gyanika_room_USERNAME or gyanika_room_USERNAME_TIMESTAMP
            remainder = room_name.replace("gyanika_room_", "")
            parts = remainder.split("_")
            
            # Check if last part is timestamp (all digits, length > 10)
            if len(parts) >= 2 and parts[-1].isdigit() and len(parts[-1]) > 10:
                extracted_username = "_".join(parts[:-1])
            else:
                extracted_username = remainder
            
            if extracted_username:
                user_id = extracted_username
                user_name = extracted_username.replace("_", " ").title()
                logging.info(f"👤 User from room name: {user_name} (ID: {user_id})")
    
    # STEP 3: If still no user, wait briefly for participant (max 3 seconds)
    if not user_id:
        for attempt in range(6):  # 6 x 0.5s = 3 seconds max
            await asyncio.sleep(0.5)
            
            for participant in ctx.room.remote_participants.values():
                identity = participant.identity or ""
                if identity.startswith("agent-"):
                    continue
                    
                if participant.metadata:
                    try:
                        import json
                        user_metadata = json.loads(participant.metadata)
                        user_id = user_metadata.get("user_id") or identity
                        user_name = user_metadata.get("name") or participant.name or identity
                    except:
                        user_id = identity
                        user_name = participant.name or identity
                else:
                    user_id = identity
                    user_name = participant.name or identity
                    
                if user_id:
                    logging.info(f"👤 Found user after wait: {user_name} (ID: {user_id})")
                    break
            
            if user_id:
                break
    
    # STEP 4: Final fallback
    if not user_id:
        user_id = "guest"
        user_name = "Guest User"
        logging.warning(f"⚠️ No user found, using fallback: {user_id}")
    
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
    logging.info(f"   PostgreSQL: {'✅ Connected' if db_available else '⚠️ Not Available'}")
    logging.info("   NOTE: Conversations saved to PostgreSQL database")
    logging.info("=" * 80)
    
    # Initialize PostgreSQL Memory System - force new instance for each session
    # This ensures fresh conversation_id and proper memory recall
    memory = get_postgres_memory(user_id, user_name, force_new=True)
    logging.info(f"🧠 PostgreSQL Memory initialized for {user_name} - ready to remember past conversations!")
    
    # Fetch past memories at session start
    initial_memory_context = ""
    try:
        # Query past conversations for this user from PostgreSQL
        past_memories = memory.recall_memories()
        if past_memories:
            initial_memory_context = past_memories
            logging.info(f"🧠 Loaded past memory context for {user_name}")
            logging.info(f"📝 Memory length: {len(past_memories)} characters")
        else:
            logging.info(f"🆕 No past conversations found for {user_name} - new user!")
    except Exception as e:
        logging.warning(f"⚠️ Could not load past memories: {e}")
        import traceback
        traceback.print_exc()
    
    # Store conversation context with deduplication
    conversation_context = {
        "user_msg": None, 
        "agent_msg": None,
        "last_saved_user_msg": None,  # Track last saved to prevent duplicates
        "last_saved_agent_msg": None,
        "processing": False,  # Prevent concurrent saves
        "last_transcription": None,  # Prevent duplicate transcription processing
        "last_transcription_time": 0,  # Timestamp for debounce
    }
    
    def save_conversation_if_ready():
        """Save conversation only if we have both messages and not already saved"""
        if conversation_context["processing"]:
            return
            
        user_msg = conversation_context["user_msg"]
        agent_msg = conversation_context["agent_msg"]
        
        # Check if we have both messages
        if not user_msg or not agent_msg:
            return
            
        # Check if this exact pair was already saved (deduplication)
        if (user_msg == conversation_context["last_saved_user_msg"] and 
            agent_msg == conversation_context["last_saved_agent_msg"]):
            logging.debug("Skipping duplicate conversation save")
            return
        
        conversation_context["processing"] = True
        try:
            # Save to PostgreSQL memory
            memory.add_to_short_term(user_msg=user_msg, agent_msg=agent_msg)
            
            # Track what we saved
            conversation_context["last_saved_user_msg"] = user_msg
            conversation_context["last_saved_agent_msg"] = agent_msg
            
            # Clear current context
            conversation_context["user_msg"] = None
            conversation_context["agent_msg"] = None
            
            logging.info(f"💾 Saved conversation turn")
        except Exception as e:
            logging.warning(f"⚠️ Failed to save conversation: {e}")
        finally:
            conversation_context["processing"] = False
    
    session = AgentSession()

    # Create assistant with memory-enhanced instructions if available
    base_instructions = AGENT_INSTRUCTION
    if initial_memory_context:
        base_instructions = f"{AGENT_INSTRUCTION}\n\n{initial_memory_context}"
        logging.info(f"🧠 Agent initialized with past memory context!")
    
    # Create assistant with memory context
    assistant = Assistant()
    # Update assistant instructions with memory
    assistant._instructions = base_instructions
    
    # Subscribe to user transcription events
    @session.on("user_input_transcribed")
    def on_user_transcribed(event: agents.UserInputTranscribedEvent):
        """Capture user speech transcription and enhance with memory"""
        if event.is_final and event.transcript:
            user_query = event.transcript.strip()
            
            # Skip if empty
            if not user_query:
                return
            
            # Deduplication: Skip if same transcription within 2 seconds
            current_time = time.time()
            if (user_query == conversation_context["last_transcription"] and 
                current_time - conversation_context["last_transcription_time"] < 2.0):
                logging.debug(f"⏭️ Skipping duplicate transcription: {user_query[:50]}...")
                return
            
            # Update tracking
            conversation_context["last_transcription"] = user_query
            conversation_context["last_transcription_time"] = current_time
            conversation_context["user_msg"] = user_query
            
            logging.info(f"👤 User: {user_query[:100]}...")
            
            # Recall memories for context (logged but not dynamically injected)
            # Dynamic instruction update not supported in current API
            try:
                memory_context = memory.get_memory_context_prompt(user_query)
                if memory_context:
                    logging.info(f"🧠 Memory recalled for query - context available")
            except Exception as e:
                logging.warning(f"⚠️ Memory recall failed: {e}")
            
            # NOTE: DO NOT call generate_reply() here!
            # Gemini Realtime API automatically generates response when user speaks
            # Calling generate_reply() causes timeout conflicts
    
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
                    save_conversation_if_ready()
            
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
                # Only update if we don't already have an agent message
                if not conversation_context["agent_msg"]:
                    conversation_context["agent_msg"] = text
                    logging.info(f"🤖 Gyanika (speech): {text[:100]}...")
                    save_conversation_if_ready()
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

    # Listen for new participants joining - SHARED ROOM MODEL
    @ctx.room.on("participant_connected")
    def on_participant_connected(participant):
        nonlocal current_speaker_id, current_speaker_name, user_memories
        
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
        
        # This is a real user - get their info
        p_user_id = participant.identity
        p_user_name = participant.name or participant.identity
        
        # Parse metadata if available
        if participant.metadata:
            try:
                import json
                meta = json.loads(participant.metadata)
                p_user_id = meta.get("user_id", p_user_id)
                p_user_name = meta.get("name", p_user_name)
            except:
                pass
        
        logging.info(f"👤 User joined room: {p_user_name} (ID: {p_user_id})")
        
        # Create memory for this user if not exists
        if p_user_id not in user_memories:
            user_memories[p_user_id] = {
                'memory': get_postgres_memory(p_user_id, p_user_name),
                'name': p_user_name
            }
            logging.info(f"🧠 PostgreSQL Memory initialized for: {p_user_name}")
        
        # Set as current speaker if first user
        if current_speaker_id is None:
            current_speaker_id = p_user_id
            current_speaker_name = p_user_name

    # Handle participant disconnect - SHARED ROOM MODEL
    @ctx.room.on("participant_disconnected")
    def on_participant_disconnected(participant):
        nonlocal current_speaker_id, current_speaker_name, user_memories
        
        identity = participant.identity or ""
        
        # Skip agent disconnects
        if identity.startswith("agent-"):
            return
        try:
            if hasattr(participant, 'kind') and str(participant.kind).upper() == "AGENT":
                return
        except:
            pass
        
        # Get user id from metadata or identity
        p_user_id = identity
        if participant.metadata:
            try:
                import json
                meta = json.loads(participant.metadata)
                p_user_id = meta.get("user_id", p_user_id)
            except:
                pass
        
        logging.info(f"👋 User left room: {participant.name or identity}")
        
        # End conversation for this user and remove from memories
        if p_user_id in user_memories:
            try:
                user_memories[p_user_id]['memory'].end_conversation()
                logging.info(f"💾 Conversation saved for: {p_user_id}")
            except Exception as e:
                logging.warning(f"⚠️ Could not save conversation: {e}")
            del user_memories[p_user_id]
        
        # Update current speaker if they left
        if current_speaker_id == p_user_id:
            # Set to another user if available
            if user_memories:
                current_speaker_id = list(user_memories.keys())[0]
                current_speaker_name = user_memories[current_speaker_id]['name']
            else:
                current_speaker_id = None
                current_speaker_name = None

    logging.info("✅ Gyanika agent connected and ready!")
    logging.info(f"🎯 Shared room mode - ready for multiple users!")


async def request_fnc(req: agents.JobRequest) -> None:
    """Auto-accept all job requests - agent will join any room that requests it"""
    logging.info(f"📥 Job request received for room: {req.room.name}")
    try:
        await req.accept()
        logging.info(f"✅ Job accepted for room: {req.room.name}")
    except Exception as e:
        logging.error(f"❌ Failed to accept job for room {req.room.name}: {e}")


if __name__ == "__main__":
    from livekit.agents import JobExecutorType
    
    agents.cli.run_app(
        agents.WorkerOptions(
            entrypoint_fnc=entrypoint,
            request_fnc=request_fnc,
            # CRITICAL: Use THREAD executor to minimize sessions/billing
            # THREAD = All jobs run in same process (1 session for multiple users)
            # PROCESS = Each job spawns new process (multiple sessions = more billing)
            job_executor_type=JobExecutorType.THREAD,
            num_idle_processes=0,   # No idle processes with thread executor
            load_threshold=0.9,     # Accept jobs up to 90% load
            job_memory_warn_mb=0,
            job_memory_limit_mb=0,
        )
    )