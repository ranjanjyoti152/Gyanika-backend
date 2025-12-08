'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  useSessionContext,
  useSessionMessages,
  useVoiceAssistant,
} from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import { ChatTranscript } from '@/components/app/chat-transcript';
import { PreConnectMessage } from '@/components/app/preconnect-message';
import { TileLayout } from '@/components/app/tile-layout';
import {
  AgentControlBar,
  type ControlBarControls,
} from '@/components/livekit/agent-control-bar/agent-control-bar';
import { useConnection } from '@/hooks/useConnection';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../livekit/scroll-area/scroll-area';

const MotionBottom = motion.create('div');

const BOTTOM_VIEW_MOTION_PROPS = {
  variants: {
    visible: {
      opacity: 1,
      translateY: '0%',
    },
    hidden: {
      opacity: 0,
      translateY: '100%',
    },
  },
  initial: 'hidden' as const,
  animate: 'visible' as const,
  exit: 'hidden' as const,
  transition: {
    duration: 0.3,
    delay: 0.5,
    ease: 'easeOut' as const,
  },
};

interface FadeProps {
  top?: boolean;
  bottom?: boolean;
  className?: string;
}

export function Fade({ top = false, bottom = false, className }: FadeProps) {
  return (
    <div
      className={cn(
        'pointer-events-none h-4',
        top && 'bg-gradient-to-b from-cyan-950/50 to-transparent',
        bottom && 'bg-gradient-to-t from-cyan-950/50 to-transparent',
        className
      )}
    />
  );
}

interface SessionViewProps {
  appConfig: AppConfig;
}

export const SessionView = ({
  appConfig,
  ...props
}: React.ComponentProps<'section'> & SessionViewProps) => {
  const session = useSessionContext();
  const { messages } = useSessionMessages(session);
  const [chatOpen, setChatOpen] = useState(false);
  const { isConnectionActive, startDisconnectTransition } = useConnection();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Get agent state to show loading until agent is ready
  const { state: agentState } = useVoiceAssistant();

  // Agent is ready when state is not 'disconnected' or 'connecting'
  const isAgentReady = agentState && !['disconnected', 'connecting'].includes(agentState);

  const controls: ControlBarControls = {
    leave: true,
    microphone: true,
    chat: appConfig.supportsChatInput,
    camera: appConfig.supportsVideoInput,
    screenShare: appConfig.supportsVideoInput,
  };

  useEffect(() => {
    const lastMessage = messages.at(-1);
    const lastMessageIsLocal = lastMessage?.from?.isLocal === true;

    if (scrollAreaRef.current && lastMessageIsLocal) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Show loading screen while agent is connecting
  if (!isAgentReady) {
    return (
      <section className="relative z-10 flex h-full w-full items-center justify-center" {...props}>
        {/* Content */}
        <div className="animate-fade-in-up relative z-10 space-y-8 text-center">
          {/* Animated Logo with glow */}
          <div className="animate-float relative">
            <div className="text-8xl">🎓</div>
            {/* Glowing ring */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="h-32 w-32 animate-spin rounded-full border-4 border-cyan-400/30 border-t-cyan-400"
                style={{ animationDuration: '2s' }}
              />
            </div>
            {/* Ambient glow */}
            <div className="absolute inset-0 -z-10 flex items-center justify-center">
              <div className="h-40 w-40 animate-pulse rounded-full bg-cyan-500/15 blur-2xl" />
            </div>
          </div>

          {/* Loading Text with glow */}
          <div className="space-y-3">
            <h2 className="glow-text text-2xl font-bold text-cyan-100">
              Gyanika is getting ready...
            </h2>
            <p className="text-sm text-cyan-300/80">
              {agentState === 'connecting'
                ? '🔗 Connecting to your AI tutor...'
                : '⏳ Please wait...'}
            </p>
          </div>

          {/* Animated Progress Bar */}
          <div className="mx-auto w-72">
            <div className="h-1.5 overflow-hidden rounded-full border border-cyan-500/20 bg-cyan-900/40">
              <div className="animate-loading-bar h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-400 to-cyan-500" />
            </div>
          </div>

          {/* Tips with glass effect */}
          <div className="glass-panel mx-auto max-w-sm rounded-xl px-6 py-3">
            <p className="text-sm text-cyan-200/90">
              💡 Tip: You can speak in Hindi, English, or Hinglish!
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative z-10 h-full w-full" {...props}>
      {/* Chat Transcript */}
      <div
        className={cn(
          'fixed inset-0 grid grid-cols-1 grid-rows-1',
          !chatOpen && 'pointer-events-none'
        )}
      >
        <Fade top className="absolute inset-x-0 top-0 z-10 h-20" />
        <ScrollArea ref={scrollAreaRef} className="px-4 pt-40 pb-[150px] md:px-6 md:pb-[200px]">
          <ChatTranscript
            hidden={!chatOpen}
            messages={messages}
            className="mx-auto max-w-2xl space-y-3 transition-opacity duration-300 ease-out"
          />
        </ScrollArea>
      </div>

      {/* Tile Layout */}
      <TileLayout chatOpen={chatOpen} />

      {/* Bottom */}
      <MotionBottom
        {...BOTTOM_VIEW_MOTION_PROPS}
        className="fixed inset-x-3 bottom-0 z-50 md:inset-x-12"
      >
        {appConfig.isPreConnectBufferEnabled && (
          <PreConnectMessage messages={messages} className="pb-4" />
        )}
        <div className="relative mx-auto max-w-2xl rounded-t-2xl border border-b-0 border-cyan-500/20 bg-cyan-950/30 px-4 pt-4 pb-3 backdrop-blur-xl md:pb-12">
          <AgentControlBar
            controls={controls}
            isConnectionActive={isConnectionActive}
            onDisconnect={startDisconnectTransition}
            onChatOpenChange={setChatOpen}
          />
        </div>
      </MotionBottom>
    </section>
  );
};
