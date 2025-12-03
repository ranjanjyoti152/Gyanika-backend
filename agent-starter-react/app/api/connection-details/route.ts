import { NextResponse } from 'next/server';
import { AccessToken, type AccessTokenOptions, type VideoGrant, RoomServiceClient } from 'livekit-server-sdk';
import { RoomConfiguration } from '@livekit/protocol';

type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
  participantIdentity: string;
};

// NOTE: you are expected to define the following environment variables in `.env.local`:
const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

// Create room service client
const livekitHost = LIVEKIT_URL?.replace('wss://', 'https://') || '';
const roomService = new RoomServiceClient(livekitHost, API_KEY, API_SECRET);

// don't cache the results
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    if (LIVEKIT_URL === undefined) {
      throw new Error('LIVEKIT_URL is not defined');
    }
    if (API_KEY === undefined) {
      throw new Error('LIVEKIT_API_KEY is not defined');
    }
    if (API_SECRET === undefined) {
      throw new Error('LIVEKIT_API_SECRET is not defined');
    }

    // Parse request body
    const body = await req.json();
    const agentName: string = body?.room_config?.agents?.[0]?.agent_name || '';
    
    // Get user info from request (for persistent identity)
    const userName: string = body?.user_name || 'Student';
    const userId: string = body?.user_id || `user_${userName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const userEmail: string = body?.user_email || '';
    const userDbId: string = body?.user_db_id || userId;  // PostgreSQL UUID

    // Use provided user info for persistent identity
    const participantName = userName;
    const participantIdentity = userId;  // Use username as identity for agent to recognize
    
    // USER-SPECIFIC ROOM: Each user gets their own stable room
    // Room name is based on userId (no timestamp) so reconnecting joins same room
    // This prevents users from talking to each other while still having 1 agent per user
    const roomName = `gyanika_room_${userId}`;

    // Build metadata with user info for the agent
    const metadata = JSON.stringify({
      user_id: userId,           // Username for agent to identify
      user_db_id: userDbId,      // PostgreSQL UUID
      name: participantName,
      email: userEmail,
    });

    console.log(`[connection-details] User: ${participantName} (${userId}), Room: ${roomName}`);

    // Check if room already exists
    let roomExists = false;
    let hasActiveAgent = false;
    let hasHumanUser = false;
    try {
      const rooms = await roomService.listRooms([roomName]);
      if (rooms && rooms.length > 0) {
        roomExists = true;
        // Check participants in the room
        const participants = await roomService.listParticipants(roomName);
        
        for (const p of participants) {
          const isAgent = p.identity?.startsWith('agent-') || p.name?.toLowerCase().includes('gyanika');
          if (isAgent) {
            hasActiveAgent = true;
          } else {
            hasHumanUser = true;
          }
        }
        
        console.log(`Room ${roomName} exists, hasActiveAgent: ${hasActiveAgent}, hasHumanUser: ${hasHumanUser}, participants: ${participants.length}`);
        
        // If room exists but no human user, it's a stale room with orphan agent
        // Delete the room so we start fresh
        if (roomExists && hasActiveAgent && !hasHumanUser) {
          console.log(`Deleting stale room ${roomName} with orphan agent`);
          try {
            await roomService.deleteRoom(roomName);
            roomExists = false;
            hasActiveAgent = false;
          } catch (e) {
            console.log(`Failed to delete stale room: ${e}`);
          }
        }
      }
    } catch (e) {
      console.log(`Room check failed (probably doesn't exist): ${e}`);
    }

    // Create the room if it doesn't exist
    if (!roomExists) {
      try {
        await roomService.createRoom({
          name: roomName,
          emptyTimeout: 60 * 10, // 10 minutes
          maxParticipants: 10,
        });
        console.log(`Room created: ${roomName}`);
      } catch (e) {
        // Room might already exist, that's ok
        console.log(`Room creation: ${e}`);
      }
    }

    // Only dispatch agent if room is new or doesn't have an active agent
    const shouldDispatchAgent = !hasActiveAgent;
    console.log(`Room: ${roomName}, shouldDispatchAgent: ${shouldDispatchAgent}`);

    const participantToken = await createParticipantToken(
      { identity: participantIdentity, name: participantName, metadata },
      roomName,
      agentName,
      shouldDispatchAgent  // Only dispatch if no agent in room
    );

    // Return connection details
    const data: ConnectionDetails = {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantToken: participantToken,
      participantName,
      participantIdentity,
    };
    const headers = new Headers({
      'Cache-Control': 'no-store',
    });
    return NextResponse.json(data, { headers });
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return new NextResponse(error.message, { status: 500 });
    }
  }
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  agentName?: string,
  dispatchAgent: boolean = true
): Promise<string> {
  const at = new AccessToken(API_KEY, API_SECRET, {
    ...userInfo,
    ttl: '15m',
  });
  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);

  // Only dispatch agent if needed (new room or no agent present)
  // This prevents duplicate agents on reconnection
  if (dispatchAgent) {
    at.roomConfig = new RoomConfiguration({
      agents: [{ agentName: agentName || '' }],
    });
  }

  return at.toJwt();
}
