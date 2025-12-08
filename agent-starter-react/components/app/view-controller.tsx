'use client';

import { useCallback, useEffect } from 'react';
import { AnimatePresence, type AnimationDefinition, motion } from 'motion/react';
import type { AppConfig } from '@/app-config';
import { SessionView } from '@/components/app/session-view';
import { WelcomeView } from '@/components/app/welcome-view';
import { useConnection } from '@/hooks/useConnection';

const MotionWelcomeView = motion.create(WelcomeView);
const MotionSessionView = motion.create(SessionView);

const VIEW_MOTION_PROPS = {
  variants: {
    visible: {
      opacity: 1,
    },
    hidden: {
      opacity: 0,
    },
  },
  initial: 'hidden' as const,
  animate: 'visible' as const,
  exit: 'hidden' as const,
  transition: {
    duration: 0.5,
    ease: 'linear' as const,
  },
};

interface ViewControllerProps {
  appConfig: AppConfig;
}

export function ViewController({ appConfig }: ViewControllerProps) {
  const { isConnectionActive, connect, onDisconnectTransitionComplete } = useConnection();

  // Log connection state changes
  useEffect(() => {
    console.log('[ViewController] isConnectionActive changed to:', isConnectionActive);
  }, [isConnectionActive]);

  const handleAnimationComplete = useCallback(
    (definition: AnimationDefinition) => {
      console.log('[ViewController] Animation complete:', definition);
      // Only end session when explicitly going to hidden state after being visible
      // This prevents ending session on initial mount
      if (definition === 'hidden' && !isConnectionActive) {
        console.log('[ViewController] Calling onDisconnectTransitionComplete');
        onDisconnectTransitionComplete();
      }
    },
    [onDisconnectTransitionComplete, isConnectionActive]
  );

  return (
    <AnimatePresence mode="wait">
      {/* Welcome view */}
      {!isConnectionActive && (
        <MotionWelcomeView
          key="welcome"
          {...VIEW_MOTION_PROPS}
          startButtonText={appConfig.startButtonText}
          onStartCall={connect}
        />
      )}
      {/* Session view */}
      {isConnectionActive && (
        <MotionSessionView
          key="session-view"
          {...VIEW_MOTION_PROPS}
          appConfig={appConfig}
          onAnimationComplete={handleAnimationComplete}
        />
      )}
    </AnimatePresence>
  );
}
