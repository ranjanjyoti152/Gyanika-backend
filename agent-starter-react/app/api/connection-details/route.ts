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

// Rate limiting to prevent abuse
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 10; // Max 10 requests
const RATE_LIMIT_WINDOW = 60000; // Per 60 seconds

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT_MAX) {
    return false;
  }

  userLimit.count++;
  return true;
}

// Cleanup old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60000);

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

    // Parse request body with error handling
    let body;
    try {
      body = await req.json();
    } catch {
      return new NextResponse('Invalid JSON body', { status: 400 });
    }

    const agentName: string = body?.room_config?.agents?.[0]?.agent_name || '';

    // Get user info from request (for persistent identity)
    // Sanitize inputs to prevent injection
    const sanitize = (str: string): string =>
      str.replace(/[^a-zA-Z0-9_@.\-\s]/g, '').substring(0, 100);

    const userName: string = sanitize(body?.user_name || 'Student');
    const userId: string = sanitize(
      body?.user_id || `user_${userName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
    );
    const userEmail: string = sanitize(body?.user_email || '');
    const userDbId: string = sanitize(body?.user_db_id || userId); // PostgreSQL UUID

    // Rate limiting check
    if (!checkRateLimit(userId)) {
      console.warn(`[connection-details] Rate limit exceeded for user: ${userId}`);
      return new NextResponse('Too many requests. Please wait before reconnecting.', {
        status: 429,
        headers: { 'Retry-After': '60' }
      });
    }

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

    // ALWAYS delete existing room and create fresh one
    // This ensures agent connects properly after user ends call and rejoins
    const setupPromise = (async () => {
      // Delete existing room to get fresh agent connection
      try {
        await roomService.deleteRoom(roomName);
        console.log(`[connection-details] Deleted existing room: ${roomName}`);
      } catch (_e) {
        console.log(`[connection-details] Room ${roomName} doesn't exist or already deleted`);
      }

      // Small delay to ensure room is fully deleted
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Create fresh room
      try {
        await roomService.createRoom({
          name: roomName,
          emptyTimeout: 60 * 5, // 5 minutes
          maxParticipants: 5,
        });
        console.log(`[connection-details] Room created: ${roomName}`);
      } catch (e) {
        console.log(`[connection-details] Room creation: ${e}`);
      }
    })();

    pendingRooms.set(roomName, setupPromise);

    try {
      await setupPromise;
    } finally {
      // Remove from pending after 10 seconds
      setTimeout(() => pendingRooms.delete(roomName), 10000);
    }

    // Always dispatch agent for fresh room
    const shouldDispatchAgent = true;
    console.log(`[connection-details] Room: ${roomName}, shouldDispatchAgent: ${shouldDispatchAgent}`);

    const participantToken = await createParticipantToken(
      { identity: participantIdentity, name: participantName, metadata },
      roomName,
      agentName,
      shouldDispatchAgent
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
    // Type assertion needed due to @livekit/protocol version mismatch between dependencies
    (at as { roomConfig: unknown }).roomConfig = new RoomConfiguration({
      agents: [{ agentName: agentName || '' }],
    });
  }

  return at.toJwt();
}
