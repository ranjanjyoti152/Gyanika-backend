'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { TokenSource } from 'livekit-client';
import { SessionProvider, useSession } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import type { User } from '@/hooks/useAuth';

interface ConnectionContextType {
  isConnectionActive: boolean;
  connect: () => void;
  startDisconnectTransition: () => void;
  onDisconnectTransitionComplete: () => void;
  reconnect: () => void;
  connectionError: string | null;
  isReconnecting: boolean;
}

const ConnectionContext = createContext<ConnectionContextType>({
  isConnectionActive: false,
  connect: () => {},
  startDisconnectTransition: () => {},
  onDisconnectTransitionComplete: () => {},
  reconnect: () => {},
  connectionError: null,
  isReconnecting: false,
});

export function useConnection() {
  const ctx = useContext(ConnectionContext);
  if (!ctx) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return ctx;
}

interface ConnectionProviderProps {
  appConfig: AppConfig;
  user: User | null;
  children: React.ReactNode;
}

interface ConnectionProviderInnerProps extends ConnectionProviderProps {
  onSessionEnd: () => void;
}

// Inner component that handles the session
function ConnectionProviderInner({
  appConfig,
  user,
  children,
  onSessionEnd,
}: ConnectionProviderInnerProps) {
  const [isConnectionActive, setIsConnectionActive] = useState(false);
  const [shouldConnect, setShouldConnect] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const roomNameRef = useRef<string | null>(null);
  const fetchingTokenRef = useRef<Promise<any> | null>(null); // Lock to prevent duplicate token fetches
  const maxRetries = 3;
  const retryDelay = 2000; // 2 seconds between retries

  // Create token source with user info
  const tokenSource = useMemo(() => {
    console.log('[Connection] Creating token source for user:', user?.username);

    return TokenSource.custom(async () => {
      // If already fetching, wait for that request
      if (fetchingTokenRef.current) {
        console.log('[Connection] Token fetch already in progress, waiting...');
        return fetchingTokenRef.current;
      }

      // Backend generates stable room name: gyanika_room_{userId}
      // We just pass user info, don't generate room name here
      console.log('[Connection] Fetching token for user:', user?.username || user?.id);
      
      const fetchPromise = (async () => {
        try {
          const res = await fetch('/api/connection-details', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              room_config: appConfig.agentName
                ? { agents: [{ agent_name: appConfig.agentName }] }
                : undefined,
              user_id: user?.username || user?.id,
              user_name: user?.full_name || user?.username || 'Student',
              user_email: user?.email,
              user_db_id: user?.id,
            }),
          });

          if (res.status === 429) {
            const retryAfter = res.headers.get('Retry-After') || '60';
            throw new Error(`Rate limited. Please wait ${retryAfter} seconds before reconnecting.`);
          }

          if (!res.ok) {
            throw new Error(`Failed to get connection details: ${res.status}`);
          }

          const data = await res.json();
          roomNameRef.current = data.roomName; // Store room name from backend
          setConnectionError(null); // Clear any previous errors
          setRetryCount(0); // Reset retry count on success
          console.log(
            '[Connection] Got token, room:',
            data.roomName,
            'identity:',
            data.participantIdentity
          );
          return data;
        } catch (error) {
          console.error('[Connection] Error fetching token:', error);
          const errorMessage = error instanceof Error ? error.message : 'Connection failed';
          setConnectionError(errorMessage);
          throw error;
        } finally {
          // Clear the lock after request completes (with small delay to prevent rapid re-requests)
          setTimeout(() => {
            fetchingTokenRef.current = null;
          }, 1000);
        }
      })();

      fetchingTokenRef.current = fetchPromise;
      return fetchPromise;
    });
  }, [appConfig.agentName, user?.id, user?.username, user?.full_name, user?.email]);

  const session = useSession(
    tokenSource,
    appConfig.agentName ? { agentName: appConfig.agentName } : undefined
  );

  // Log session connection state changes and handle unexpected disconnections
  useEffect(() => {
    console.log('[Connection] Session connection state:', session.connectionState);
    
    // If session disconnects unexpectedly while we think we're connected, trigger reconnection
    if (session.connectionState === 'disconnected' && isConnectionActive && !isReconnecting) {
      console.warn('[Connection] Session disconnected unexpectedly, will attempt reconnect');
      // Don't auto-reconnect immediately, let user know there's an issue
      setConnectionError('Connection lost. Click to reconnect.');
    }
  }, [session.connectionState, isConnectionActive, isReconnecting]);

  const { start: startSession, end: endSession } = session;

  // Effect to start session when shouldConnect becomes true
  useEffect(() => {
    if (shouldConnect) {
      console.log('[Connection] Starting session...');
      startSession();
      setShouldConnect(false);
    }
  }, [shouldConnect, startSession]);

  // Reconnection handler with retry logic
  const handleReconnect = useCallback(async () => {
    if (isReconnecting) return;
    
    if (retryCount >= maxRetries) {
      setConnectionError(`Failed after ${maxRetries} attempts. Please try again later.`);
      setIsReconnecting(false);
      return;
    }

    console.log(`[Connection] Attempting reconnect (attempt ${retryCount + 1}/${maxRetries})`);
    setIsReconnecting(true);
    setRetryCount(prev => prev + 1);

    // End current session
    endSession();
    
    // Wait before reconnecting
    await new Promise(resolve => setTimeout(resolve, retryDelay));
    
    // Trigger remount for clean reconnection
    onSessionEnd();
    setIsReconnecting(false);
    
    // Start new connection
    setIsConnectionActive(true);
    setShouldConnect(true);
  }, [isReconnecting, retryCount, maxRetries, retryDelay, endSession, onSessionEnd]);

  const value = useMemo(() => {
    return {
      isConnectionActive,
      connectionError,
      isReconnecting,
      connect: () => {
        console.log('[Connection] Connect called');
        setConnectionError(null);
        setIsConnectionActive(true);
        setShouldConnect(true);
      },
      startDisconnectTransition: () => {
        console.log('[Connection] Disconnect transition started, ending session');
        setIsConnectionActive(false);
        setConnectionError(null);
        endSession();
        // Trigger remount for next connection
        onSessionEnd();
      },
      onDisconnectTransitionComplete: () => {
        console.log('[Connection] Disconnect transition complete');
        roomNameRef.current = null;
        setRetryCount(0);
      },
      reconnect: handleReconnect,
    };
  }, [endSession, isConnectionActive, onSessionEnd, connectionError, isReconnecting, handleReconnect]);

  return (
    <SessionProvider session={session}>
      <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>
    </SessionProvider>
  );
}

// Wrapper that remounts the inner component on each new session
export function ConnectionProvider({ appConfig, user, children }: ConnectionProviderProps) {
  const [sessionKey, setSessionKey] = useState(0);

  // Key combines user id and session key to force remount
  const key = `${user?.id || 'no-user'}-session-${sessionKey}`;

  console.log('[ConnectionProvider] Rendering with key:', key);

  const handleSessionEnd = () => {
    console.log('[ConnectionProvider] Session ended, will remount on next connect');
    // Increment key to force remount on next render
    setSessionKey((prev) => prev + 1);
  };

  return (
    <ConnectionProviderInner
      key={key}
      appConfig={appConfig}
      user={user}
      onSessionEnd={handleSessionEnd}
    >
      {children}
    </ConnectionProviderInner>
  );
}
