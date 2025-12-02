'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useSessionContext, useSessionMessages, useVoiceAssistant } from '@livekit/components-react';
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
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: {
    duration: 0.3,
    delay: 0.5,
    ease: 'easeOut',
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
      <section className="relative z-10 h-full w-full flex items-center justify-center" {...props}>
        {/* Content */}
        <div className="relative z-10 text-center space-y-8 animate-fade-in-up">
          {/* Animated Logo with glow */}
          <div className="relative animate-float">
            <div className="text-8xl">🎓</div>
            {/* Glowing ring */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" style={{ animationDuration: '2s' }} />
            </div>
            {/* Ambient glow */}
            <div className="absolute inset-0 flex items-center justify-center -z-10">
              <div className="w-40 h-40 bg-cyan-500/15 rounded-full blur-2xl animate-pulse" />
            </div>
          </div>
          
          {/* Loading Text with glow */}
          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-cyan-100 glow-text">
              Gyanika is getting ready...
            </h2>
            <p className="text-cyan-300/80 text-sm">
              {agentState === 'connecting' ? '🔗 Connecting to your AI tutor...' : '⏳ Please wait...'}
            </p>
          </div>
          
          {/* Animated Progress Bar */}
          <div className="w-72 mx-auto">
            <div className="h-1.5 bg-cyan-900/40 rounded-full overflow-hidden border border-cyan-500/20">
              <div className="h-full bg-gradient-to-r from-cyan-500 via-blue-400 to-cyan-500 rounded-full animate-loading-bar" />
            </div>
          </div>
          
          {/* Tips with glass effect */}
          <div className="glass-panel rounded-xl px-6 py-3 max-w-sm mx-auto">
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
        <Fade top className="absolute inset-x-0 top-0 h-20 z-10" />
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
        <div className="relative mx-auto max-w-2xl pb-3 md:pb-12 backdrop-blur-xl bg-cyan-950/30 rounded-t-2xl border border-cyan-500/20 border-b-0 px-4 pt-4">
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
