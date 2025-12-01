import 'dotenv/config';

import { fileURLToPath } from 'node:url';

import { cli, defineAgent, JobContext, WorkerOptions, voice } from '@livekit/agents';
import { ParticipantKind } from '@livekit/rtc-node';
import { beta as google } from '@livekit/agents-plugin-google';

import { AGENT_INSTRUCTION, SESSION_INSTRUCTION } from './prompts.js';
import { tools } from './tools.js';

const { Agent, AgentSession } = voice;

class Assistant extends Agent {
  constructor() {
    super({
      instructions: AGENT_INSTRUCTION,
      tools,
      llm: new google.realtime.RealtimeModel({
        model: 'models/gemini-2.5-flash-native-audio-preview-09-2025',
        voice: 'Zephyr',
        temperature: 0.8,
      }),
    });
  }
}

import { RemoteVideoTrack, RoomEvent, TrackKind } from '@livekit/rtc-node';
const agent = defineAgent({
  async entry(ctx: JobContext) {
    const activeVideoStreams = new Map<string, RemoteVideoTrack>();

    const assistant = new Assistant();
    const session = new AgentSession<{ videoStreams: typeof activeVideoStreams }>({
      userData: { videoStreams: activeVideoStreams },
    });

    await session.start({
      room: ctx.room,
      agent: assistant,
      inputOptions: {
        audioEnabled: true,
        textEnabled: true,
        videoEnabled: true,
        participantKinds: [ParticipantKind.STANDARD],
      },
      outputOptions: {
        audioEnabled: true,
        transcriptionEnabled: true,
        syncTranscription: true,
        audioNumChannels: 1,
        audioSampleRate: 16000,
      },
    });

    await ctx.connect();

    ctx.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (track.kind === TrackKind.KIND_VIDEO) {
        const videoTrack = track as RemoteVideoTrack;
        const key = publication.sid ?? videoTrack.sid ?? `${participant.identity}-${Date.now()}`;
        activeVideoStreams.set(key, videoTrack);
        console.info(
          `[Gyanika] Subscribed to video track from ${participant.identity} (${publication.source})`,
        );
        console.warn('[Gyanika] Video tracks detected but cannot be processed - @livekit/rtc-node VideoStream has FFI bugs');
      }
    });

    ctx.room.on(RoomEvent.TrackUnsubscribed, (_, publication) => {
      const key = publication.sid ?? publication.track?.sid ?? null;
      if (key && activeVideoStreams.has(key)) {
        activeVideoStreams.delete(key);
      }
    });

    // Skip auto-greeting to avoid timeout - Gemini won't generate without user input
    // await session.generateReply({ instructions: SESSION_INSTRUCTION });
  },
});

export default agent;

if (import.meta.url === `file://${process.argv[1]}`) {
  const agentPath = fileURLToPath(import.meta.url);
  cli.runApp(new WorkerOptions({
    agent: agentPath,
    jobMemoryWarnMB: 0,
  }));
}
