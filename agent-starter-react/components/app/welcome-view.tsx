import { Button } from '@/components/livekit/button';
import { getCurrentUser } from '@/lib/auth';

function WelcomeImage() {
  return (
    <div className="relative animate-float">
      <div className="text-7xl mb-4">🎓</div>
      {/* Subtle glow ring */}
      <div className="absolute inset-0 flex items-center justify-center -z-10">
        <div className="w-24 h-24 rounded-full bg-cyan-500/20 blur-xl animate-pulse" />
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
  const user = getCurrentUser();

  return (
    <div ref={ref} className="relative">
      {/* Animated blur overlay for background */}
      <div className="fixed inset-0 backdrop-blur-sm -z-10" />
      
      <section className="flex flex-col items-center justify-center text-center animate-fade-in-up relative z-10">
        <WelcomeImage />

        <h1 className="text-3xl font-bold text-cyan-100 mb-2 glow-text">
          {user ? `Hello, ${user.name}! 👋` : 'Welcome to Gyanika'}
        </h1>
        
        <p className="text-cyan-300/80 max-w-prose pt-1 leading-6">
          {user?.class 
            ? `Ready to learn Class ${user.class} topics?` 
            : 'Your AI learning assistant for Classes 9-12'}
        </p>

        <Button 
          variant="primary" 
          size="lg" 
          onClick={onStartCall} 
          className="mt-8 w-64 font-mono relative overflow-hidden group transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-cyan-500/30"
        >
          {/* Shimmer effect on hover */}
          <span className="absolute inset-0 animate-shimmer opacity-0 group-hover:opacity-100 transition-opacity" />
          <span className="relative z-10">{startButtonText}</span>
        </Button>
        
        <p className="text-cyan-400/70 text-xs mt-4">
          🧠 I'll remember our conversations
        </p>
      </section>

      <div className="fixed bottom-5 left-0 flex w-full items-center justify-center">
        <div className="glass-panel rounded-full px-6 py-2">
          <p className="text-cyan-300/80 max-w-prose text-xs leading-5 font-normal text-pretty md:text-sm">
            Ask me about Physics, Chemistry, Math, Biology & more! 📚
          </p>
        </div>
      </div>
    </div>
  );
};
