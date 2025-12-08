import { useEffect, useRef } from 'react';
import { useAgent } from '@livekit/components-react';
import { toastAlert } from '@/components/livekit/alert-toast';
import { useConnection } from './useConnection';

export function useAgentErrors() {
  const agent = useAgent();
  const { isConnectionActive, startDisconnectTransition } = useConnection();

  // Track if agent was ever connected successfully
  const wasConnectedRef = useRef(false);

  useEffect(() => {
    // Mark as connected if agent state becomes 'idle' or 'speaking' etc.
    if (agent.state !== 'failed' && agent.state !== 'initializing') {
      wasConnectedRef.current = true;
    }

    // Only trigger disconnect if:
    // 1. Connection is active
    // 2. Agent state is 'failed'
    // 3. Agent was previously connected (not initial failure)
    // This prevents disconnecting while waiting for agent to join
    if (isConnectionActive && agent.state === 'failed' && wasConnectedRef.current) {
      const reasons = agent.failureReasons;

      toastAlert({
        title: 'Session ended',
        description: (
          <>
            {reasons.length > 1 && (
              <ul className="list-inside list-disc">
                {reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
            {reasons.length === 1 && <p className="w-full">{reasons[0]}</p>}
            <p className="w-full">
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://docs.livekit.io/agents/start/voice-ai/"
                className="whitespace-nowrap underline"
              >
                See quickstart guide
              </a>
              .
            </p>
          </>
        ),
      });

      startDisconnectTransition();
    }
  }, [agent.state, agent.failureReasons, isConnectionActive, startDisconnectTransition]);

  // Reset when connection becomes inactive
  useEffect(() => {
    if (!isConnectionActive) {
      wasConnectedRef.current = false;
    }
  }, [isConnectionActive]);
}
