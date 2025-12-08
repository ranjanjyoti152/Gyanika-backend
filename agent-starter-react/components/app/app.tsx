'use client';

import { useEffect, useState } from 'react';
import { RoomAudioRenderer, StartAudio } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import { AuthPage } from '@/components/app/auth-page';
import { ViewController } from '@/components/app/view-controller';
import { Toaster } from '@/components/livekit/toaster';
import { useAgentErrors } from '@/hooks/useAgentErrors';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { ConnectionProvider } from '@/hooks/useConnection';
import { useDebugMode } from '@/hooks/useDebug';

const IN_DEVELOPMENT = process.env.NODE_ENV !== 'production';

function AppSetup() {
  useDebugMode({ enabled: IN_DEVELOPMENT });
  useAgentErrors();

  return null;
}

interface AppProps {
  appConfig: AppConfig;
}

function MainApp({ appConfig }: AppProps) {
  const { user, isLoading, logout } = useAuth();
  const [showApp, setShowApp] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      setShowApp(true);
    }
  }, [isLoading, user]);

  if (isLoading) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 animate-pulse text-5xl">🎓</div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !showApp) {
    return <AuthPage onAuthSuccess={() => setShowApp(true)} />;
  }

  return (
    <ConnectionProvider appConfig={appConfig} user={user}>
      <AppSetup />

      {/* User Header with glass effect */}
      <div className="fixed top-0 right-0 z-50 flex items-center gap-3 p-4">
        <div className="glass-panel flex items-center gap-3 rounded-xl px-4 py-2">
          <div className="text-right">
            <p className="text-sm font-medium text-cyan-100">{user.full_name || user.username}</p>
            <p className="text-xs text-cyan-400/70">{user.exam_target || user.email}</p>
          </div>
          <button
            onClick={logout}
            className="rounded-lg bg-cyan-500/20 p-2 text-cyan-300 transition-all duration-300 hover:bg-cyan-500/40 hover:text-cyan-100"
            title="Logout"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      <main className="grid h-svh grid-cols-1 place-content-center">
        <ViewController appConfig={appConfig} />
      </main>
      <StartAudio label="Start Audio" />
      <RoomAudioRenderer />
      <Toaster />
    </ConnectionProvider>
  );
}

export function App({ appConfig }: AppProps) {
  return (
    <AuthProvider>
      <MainApp appConfig={appConfig} />
    </AuthProvider>
  );
}
