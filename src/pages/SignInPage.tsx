import { SignIn } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '../components/Logo';

export default function SignInPage() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-sky-950 flex items-center justify-center px-4 py-16">
      {/* Motion streak backdrop */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        {Array.from({ length: 18 }).map((_, i) => {
          const top = (i * 37) % 100;
          const left = (i * 53) % 100;
          const width = 120 + (i * 13) % 240;
          const rotate = -25 + (i * 7) % 50;
          const hue = i % 3 === 0 ? '#f97316' : i % 3 === 1 ? '#38bdf8' : '#7dd3fc';
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: `${top}%`,
                left: `${left}%`,
                width: `${width}px`,
                height: '2px',
                background: `linear-gradient(90deg, transparent, ${hue}55, transparent)`,
                transform: `rotate(${rotate}deg)`,
                filter: 'blur(1px)',
              }}
            />
          );
        })}
      </div>

      {/* Radial aurora */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 20% 30%, rgba(56,189,248,0.18), transparent 50%), radial-gradient(circle at 80% 70%, rgba(249,115,22,0.15), transparent 50%)',
        }}
      />

      {/* Back home */}
      <Link
        to="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-sm text-sky-300 hover:text-white transition-colors z-10"
      >
        <ArrowLeft className="w-4 h-4" /> Back to SkyStock
      </Link>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Gradient border wrapper */}
        <div
          className="rounded-3xl p-[1px]"
          style={{
            background:
              'linear-gradient(135deg, rgba(125,211,252,0.6) 0%, rgba(249,115,22,0.5) 50%, rgba(253,186,116,0.4) 100%)',
          }}
        >
          <div
            className="rounded-3xl px-8 py-10 backdrop-blur-xl"
            style={{
              background: 'linear-gradient(180deg, rgba(20,29,54,0.92), rgba(10,14,26,0.95))',
            }}
          >
            {/* Brand */}
            <div className="flex items-center gap-3 mb-8">
              <Logo size={44} glow />
              <div>
                <div className="font-display font-bold text-xl text-white tracking-tight">SkyStock</div>
                <div className="text-xs uppercase tracking-[0.2em] text-ember-400">FPV · Avata 360</div>
              </div>
            </div>

            <h1 className="font-display font-bold text-3xl text-white mb-2">Welcome back</h1>
            <p className="text-sm text-sky-400 mb-8">
              Sign in to access your edits, saved clips, and receipts.
            </p>

            <SignIn
              routing="path"
              path="/sign-in"
              signUpUrl="/sign-up"
              afterSignInUrl="/account"
              afterSignUpUrl="/account"
              appearance={{
                elements: {
                  rootBox: 'w-full',
                  card: 'bg-transparent shadow-none border-0 p-0',
                  headerTitle: 'hidden',
                  headerSubtitle: 'hidden',
                  socialButtonsBlockButton:
                    'bg-sky-900/60 border border-sky-700/40 text-sky-100 hover:bg-sky-800/60',
                  socialButtonsBlockButtonText: 'text-sky-100 font-medium',
                  dividerLine: 'bg-sky-700/30',
                  dividerText: 'text-sky-500',
                  formFieldLabel: 'text-sky-300 text-xs uppercase tracking-wider',
                  formFieldInput:
                    'bg-sky-900/50 border border-sky-700/40 text-white placeholder:text-sky-600 focus:border-ember-400 focus:ring-ember-400/30',
                  formButtonPrimary:
                    'bg-gradient-to-r from-sky-500 to-ember-500 hover:from-sky-400 hover:to-ember-400 shadow-lg shadow-ember-500/20 normal-case text-sm font-display font-semibold',
                  footerActionText: 'text-sky-500',
                  footerActionLink: 'text-ember-400 hover:text-ember-300',
                  identityPreviewText: 'text-sky-300',
                  identityPreviewEditButton: 'text-ember-400',
                  formResendCodeLink: 'text-ember-400 hover:text-ember-300',
                },
                variables: {
                  colorPrimary: '#f97316',
                  colorBackground: 'transparent',
                  colorInputBackground: 'rgba(15,23,42,0.6)',
                  colorInputText: '#ffffff',
                  colorText: '#e8edf5',
                  colorTextSecondary: '#7dd3fc',
                  borderRadius: '0.75rem',
                  fontFamily: '"DM Sans", sans-serif',
                },
              }}
            />
          </div>
        </div>

        <p className="text-center text-xs text-sky-600 mt-6">
          Buying footage doesn't require an account — sign in is only for editing & receipts.
        </p>
      </div>
    </div>
  );
}
