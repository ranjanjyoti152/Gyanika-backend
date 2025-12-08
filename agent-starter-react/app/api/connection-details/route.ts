import { NextResponse } from 'next/server';
import {
  AccessToken,
  type AccessTokenOptions,
  RoomServiceClient,
  type VideoGrant,
} from 'livekit-server-sdk';
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

// Lock to prevent duplicate room creation for same user
const pendingRooms = new Map<string, Promise<void>>();

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
    const userId: string =
      body?.user_id || `user_${userName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const userEmail: string = body?.user_email || '';
    const userDbId: string = body?.user_db_id || userId; // PostgreSQL UUID

    // Use provided user info for persistent identity
    const participantName = userName;
    const participantIdentity = userId; // Use username as identity for agent to recognize

    // USER-SPECIFIC ROOM: Each user gets their own stable room
    // Room name is based on userId (no timestamp) so reconnecting joins same room
    // This prevents users from talking to each other while still having 1 agent per user
    const roomName = `gyanika_room_${userId}`;

    // Build metadata with user info for the agent
    const metadata = JSON.stringify({
      user_id: userId, // Username for agent to identify
      user_db_id: userDbId, // PostgreSQL UUID
      name: participantName,
      email: userEmail,
    });

    console.log(`[connection-details] User: ${participantName} (${userId}), Room: ${roomName}`);

    // Check if there's already a pending request for this room
    if (pendingRooms.has(roomName)) {
      console.log(`[connection-details] Waiting for pending room setup: ${roomName}`);
      await pendingRooms.get(roomName);
      // Return token without dispatching agent (already dispatched)
      const participantToken = await createParticipantToken(
        { identity: participantIdentity, name: participantName, metadata },
        roomName,
        agentName,
        false // Don't dispatch agent
      );
      const data: ConnectionDetails = {
        serverUrl: LIVEKIT_URL,
        roomName,
        participantToken: participantToken,
        participantName,
        participantIdentity,
      };
      return NextResponse.json(data, { headers: new Headers({ 'Cache-Control': 'no-store' }) });
    }

    // Create a promise for this room setup
    const setupPromise = (async () => {
      // Delete existing room to prevent duplicate agents
      try {
        await roomService.deleteRoom(roomName);
        console.log(`Deleted existing room: ${roomName}`);
      } catch (_e) {
        console.log(`Room ${roomName} doesn't exist or already deleted`);
      }

      // Small delay to ensure room is fully deleted
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Create fresh room
      try {
        await roomService.createRoom({
          name: roomName,
          emptyTimeout: 60 * 5, // 5 minutes
          maxParticipants: 5,
        });
        console.log(`Room created: ${roomName}`);
      } catch (e) {
        console.log(`Room creation: ${e}`);
      }
    })();

    pendingRooms.set(roomName, setupPromise);

    try {
      await setupPromise;
    } finally {
      // Remove from pending after 5 seconds (allow reconnects to use same room)
      setTimeout(() => pendingRooms.delete(roomName), 5000);
    }

    // Always dispatch agent for fresh room
    const shouldDispatchAgent = true;
    console.log(`Room: ${roomName}, shouldDispatchAgent: ${shouldDispatchAgent}`);

    const participantToken = await createParticipantToken(
      { identity: participantIdentity, name: participantName, metadata },
      roomName,
      agentName,
      shouldDispatchAgent // Only dispatch if no agent in room
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
