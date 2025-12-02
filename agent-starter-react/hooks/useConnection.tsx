'use client';

import { createContext, useContext, useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { TokenSource } from 'livekit-client';
import { SessionProvider, useSession } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import type { User } from '@/lib/auth';

interface ConnectionContextType {
  isConnectionActive: boolean;
  connect: (startSession?: boolean) => void;
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

// Inner component that handles the session
function ConnectionProviderInner({ 
  appConfig, 
  user,
  children 
}: ConnectionProviderProps) {
  const [isConnectionActive, setIsConnectionActive] = useState(false);
  const roomNameRef = useRef<string | null>(null);

  // Create token source with user info - use a stable room name per session
  const tokenSource = useMemo(() => {
    console.log('[Connection] Creating token source for user:', user?.id, user?.name);
    
    // Custom token source that includes user info
    return TokenSource.custom(async () => {
      // Reuse existing room name if available, otherwise create new one
      if (!roomNameRef.current) {
        roomNameRef.current = `gyanika_room_${user?.id || 'guest'}_${Date.now()}`;
      }
      
      console.log('[Connection] Fetching token for room:', roomNameRef.current);
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
            room_name: roomNameRef.current,
            user_id: user?.id,
            user_name: user?.name,
            user_email: user?.email,
            user_class: user?.class,
          }),
        });
        const data = await res.json();
        console.log('[Connection] Got token, room:', data.roomName, 'identity:', data.participantIdentity);
        return data;
      } catch (error) {
        console.error('[Connection] Error:', error);
        throw error;
      }
    });
  }, [appConfig.agentName, user?.id, user?.name, user?.email, user?.class]);

  const session = useSession(
    tokenSource,
    appConfig.agentName ? { agentName: appConfig.agentName } : undefined
  );

  // Log session connection state changes
  useEffect(() => {
    console.log('[Connection] Session connection state:', session.connectionState);
  }, [session.connectionState]);

  const { start: startSession, end: endSession } = session;

  const value = useMemo(() => {
    return {
      isConnectionActive,
      connect: () => {
        console.log('[Connection] Connect called, starting session...');
        // Reset room name for new session
        roomNameRef.current = null;
        setIsConnectionActive(true);
        startSession();
      },
      startDisconnectTransition: () => {
        console.log('[Connection] Disconnect transition started, ending session');
        setIsConnectionActive(false);
        endSession();
      },
      onDisconnectTransitionComplete: () => {
        console.log('[Connection] Disconnect transition complete');
        // Reset room name so next connection gets a new room
        roomNameRef.current = null;
      },
    };
  }, [startSession, endSession, isConnectionActive]);

  return (
    <SessionProvider session={session}>
      <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>
    </SessionProvider>
  );
}

// Simple wrapper - no key-based remounting needed
export function ConnectionProvider({ appConfig, user, children }: ConnectionProviderProps) {
  // Use user id as key to reset when user changes
  const key = user?.id || 'no-user';
  
  console.log('[ConnectionProvider] Rendering for user:', key);
  
  return (
    <ConnectionProviderInner 
      key={key}
      appConfig={appConfig} 
      user={user}
    >
      {children}
    </ConnectionProviderInner>
  );
}
