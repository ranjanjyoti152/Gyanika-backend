# Conversation Memory Fix for Gyanika

## Problem
Conversations were not being saved to the Qdrant vector store at `http://10.10.18.161:6333`, even though the vector store infrastructure was properly set up.

## Root Cause
The `add_conversation()` method existed in `vector_store.py`, but was **never being called** from the agent. The LiveKit agent in `agent.py` had no hooks to capture and store conversation turns.

## Solution Implemented

### 1. Created `conversation_logger.py`
A new module to handle conversation logging with the following functions:
- `set_user_context(user_id, session_id)` - Initialize conversation context
- `log_conversation_turn(user_message, assistant_response)` - Save complete conversation turns to Qdrant
- `get_conversation_history(query, user_id, limit)` - Retrieve conversation history

### 2. Modified `agent.py`
Added conversation memory tracking:
- Import conversation logger module
- Initialize vector store and user context on session start
- Hook into room's `data_received` event to capture transcription data
- Automatically save conversation turns when both user and agent messages are received
- Added comprehensive logging to track conversation capture

### 3. Created Test Script
`test_conversation_memory.py` - Standalone test to verify:
- Conversation saving works
- Vector store connection is functional
- Search functionality works
- Collection status can be checked

## How It Works

1. **Session Initialization**: When a user connects, the agent creates a session with:
   - `user_id`: Based on room name
   - `session_id`: Based on room SID

2. **Message Capture**: The agent listens to the room's data channel for transcription events:
   - User messages are captured when transcriptions are final
   - Agent responses are captured when speech is completed

3. **Automatic Storage**: When both user message and agent response are available:
   - Combined into a conversation turn
   - Embedded using Ollama (qwen3-embedding:8b) or sentence-transformers fallback
   - Stored in Qdrant's `gyanika_conversations` collection

4. **Metadata Tracked**:
   - User ID
   - Session ID
   - Timestamp
   - Message content (user and assistant)
   - Source identifier

## Testing

### Test the conversation memory:
```bash
python test_conversation_memory.py
```

### Check Qdrant directly:
```bash
curl http://10.10.18.161:6333/collections/gyanika_conversations
```

### Run the agent:
```bash
python agent.py dev
```

Monitor logs for:
- `✅ Conversation saved to Qdrant` - Successful saves
- `👤 User:` - User messages captured
- `🤖 Gyanika:` - Agent responses captured

## Files Modified/Created

- ✅ `agent.py` - Added conversation tracking hooks
- ✅ `conversation_logger.py` - New conversation logging module (NEW)
- ✅ `test_conversation_memory.py` - Test script (NEW)
- ✅ `vector_store.py` - No changes (already had functionality)
- ✅ `tools.py` - No changes needed

## Next Steps

To verify the fix is working:

1. Start the agent: `python agent.py dev`
2. Connect via the playground UI
3. Have a conversation with Gyanika
4. Check the logs for `✅ Conversation saved to Qdrant`
5. Verify in Qdrant:
   ```bash
   curl http://10.10.18.161:6333/collections/gyanika_conversations/points/scroll
   ```

## Notes

- The conversation memory uses the same embedding model as other features (Ollama qwen3-embedding:8b with sentence-transformers fallback)
- Conversations are automatically embedded and stored with no additional user action required
- The system tracks conversation history per user_id for contextual responses
- GDPR compliance: Use `delete_user_data(user_id)` to remove all user data
