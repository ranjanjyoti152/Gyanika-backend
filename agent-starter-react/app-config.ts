export interface AppConfig {
  pageTitle: string;
  pageDescription: string;
  companyName: string;

  supportsChatInput: boolean;
  supportsVideoInput: boolean;
  supportsScreenShare: boolean;
  isPreConnectBufferEnabled: boolean;

  logo: string;
  startButtonText: string;
  accent?: string;
  logoDark?: string;
  accentDark?: string;

  // for LiveKit Cloud Sandbox
  sandboxId?: string;
  agentName?: string;
}

export const APP_CONFIG_DEFAULTS: AppConfig = {
  companyName: 'Gyanika',
  pageTitle: 'Gyanika - AI Learning Assistant',
  pageDescription: 'Your AI learning assistant for Classes 9-12. Get help with NCERT curriculum subjects.',

  supportsChatInput: true,
  supportsVideoInput: true,
  supportsScreenShare: true,
  isPreConnectBufferEnabled: true,

  logo: '/lk-logo.svg',
  accent: '#10b981', // Green color for education
  logoDark: '/lk-logo-dark.svg',
  accentDark: '#34d399',
  startButtonText: 'Start Learning 🎓',

  // for LiveKit Cloud Sandbox
  sandboxId: undefined,
  agentName: undefined,
};
