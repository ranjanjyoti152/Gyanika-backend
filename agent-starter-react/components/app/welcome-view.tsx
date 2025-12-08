import { Button } from '@/components/livekit/button';
import { useAuth } from '@/hooks/useAuth';

function WelcomeImage() {
  return (
    <div className="animate-float relative">
      <div className="mb-4 text-7xl">🎓</div>
      {/* Subtle glow ring */}
      <div className="absolute inset-0 -z-10 flex items-center justify-center">
        <div className="h-24 w-24 animate-pulse rounded-full bg-cyan-500/20 blur-xl" />
      </div>
    </div>
  );
}

interface WelcomeViewProps {
  startButtonText: string;
  onStartCall: () => void;
}

export const WelcomeView = ({
  startButtonText,
  onStartCall,
  ref,
}: React.ComponentProps<'div'> & WelcomeViewProps) => {
  const { user } = useAuth();

  return (
    <div ref={ref} className="relative">
      {/* Animated blur overlay for background */}
      <div className="fixed inset-0 -z-10 backdrop-blur-sm" />

      <section className="animate-fade-in-up relative z-10 flex flex-col items-center justify-center text-center">
        <WelcomeImage />

        <h1 className="glow-text mb-2 text-3xl font-bold text-cyan-100">
          {user ? `Hello, ${user.full_name || user.username}! 👋` : 'Welcome to Gyanika'}
        </h1>

        <p className="max-w-prose pt-1 leading-6 text-cyan-300/80">
          {user?.exam_target
            ? `Ready to learn ${user.exam_target} topics?`
            : 'Your AI learning assistant for Classes 9-12'}
        </p>

        <Button
          variant="primary"
          size="lg"
          onClick={onStartCall}
          className="group relative mt-8 w-64 overflow-hidden font-mono transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-cyan-500/30"
        >
          {/* Shimmer effect on hover */}
          <span className="animate-shimmer absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100" />
          <span className="relative z-10">{startButtonText}</span>
        </Button>

        <p className="mt-4 text-xs text-cyan-400/70">🧠 I&apos;ll remember our conversations</p>
      </section>

      <div className="fixed bottom-5 left-0 flex w-full items-center justify-center">
        <div className="glass-panel rounded-full px-6 py-2">
          <p className="max-w-prose text-xs leading-5 font-normal text-pretty text-cyan-300/80 md:text-sm">
            Ask me about Physics, Chemistry, Math, Biology & more! 📚
          </p>
        </div>
      </div>
    </div>
  );
};
