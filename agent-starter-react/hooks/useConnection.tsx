'use client';

import { createContext, useContext, useMemo, useState, useEffect, useRef } from 'react';
import { TokenSource } from 'livekit-client';
import { SessionProvider, useSession } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import type { User } from '@/hooks/useAuth';

interface ConnectionContextType {
  isConnectionActive: boolean;
  connect: () => void;
  startDisconnectTransition: () => void;
  onDisconnectTransitionComplete: () => void;
}

const ConnectionContext = createContext<ConnectionContextType>({
  isConnectionActive: false,
  connect: () => {},
  startDisconnectTransition: () => {},
  onDisconnectTransitionComplete: () => {},
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
  onSessionEnd
}: ConnectionProviderInnerProps) {
  const [isConnectionActive, setIsConnectionActive] = useState(false);
  const [shouldConnect, setShouldConnect] = useState(false);
  const roomNameRef = useRef<string | null>(null);

  // Create token source with user info
  const tokenSource = useMemo(() => {
    console.log('[Connection] Creating token source for user:', user?.username);
    
    return TokenSource.custom(async () => {
      // Always create new room name
      const newRoomName = `gyanika_room_${user?.username || user?.id || 'guest'}_${Date.now()}`;
      roomNameRef.current = newRoomName;
      
      console.log('[Connection] Fetching token for room:', newRoomName);
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
            room_name: newRoomName,
            user_id: user?.username || user?.id,
            user_name: user?.full_name || user?.username || 'Student',
            user_email: user?.email,
            user_db_id: user?.id,
          }),
        });
        
        if (!res.ok) {
          throw new Error(`Failed to get connection details: ${res.status}`);
        }
        
        const data = await res.json();
        console.log('[Connection] Got token, room:', data.roomName, 'identity:', data.participantIdentity);
        return data;
      } catch (error) {
        console.error('[Connection] Error fetching token:', error);
        throw error;
      }
    });
  }, [appConfig.agentName, user?.id, user?.username, user?.full_name, user?.email]);

  const session = useSession(
    tokenSource,
    appConfig.agentName ? { agentName: appConfig.agentName } : undefined
  );

  // Log session connection state changes
  useEffect(() => {
    console.log('[Connection] Session connection state:', session.connectionState);
  }, [session.connectionState]);

  const { start: startSession, end: endSession } = session;

  // Effect to start session when shouldConnect becomes true
  useEffect(() => {
    if (shouldConnect) {
      console.log('[Connection] Starting session...');
      startSession();
      setShouldConnect(false);
    }
  }, [shouldConnect, startSession]);

  const value = useMemo(() => {
    return {
      isConnectionActive,
      connect: () => {
        console.log('[Connection] Connect called');
        setIsConnectionActive(true);
        setShouldConnect(true);
      },
      startDisconnectTransition: () => {
        console.log('[Connection] Disconnect transition started, ending session');
        setIsConnectionActive(false);
        endSession();
        // Trigger remount for next connection
        onSessionEnd();
      },
      onDisconnectTransitionComplete: () => {
        console.log('[Connection] Disconnect transition complete');
        roomNameRef.current = null;
      },
    };
  }, [endSession, isConnectionActive, onSessionEnd]);

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
    setSessionKey(prev => prev + 1);
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
