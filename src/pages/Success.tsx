import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, Download, Mail, ArrowRight, Sparkles, Receipt, Clock } from 'lucide-react';

export default function Success() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || searchParams.get('order');
  const email = searchParams.get('email');

  return (
    <div className="page-enter relative min-h-[80vh] py-16">
      {/* Motion streak backdrop — celebratory, same language as hero */}
      <div className="absolute inset-0 pointer-events-none opacity-40 overflow-hidden">
        {Array.from({ length: 14 }).map((_, i) => {
          const top = (i * 41) % 100;
          const left = (i * 67) % 100;
          const width = 160 + (i * 17) % 260;
          const rotate = -15 + (i * 5) % 30;
          const hue = i % 3 === 0 ? '#10b981' : i % 3 === 1 ? '#38bdf8' : '#7dd3fc';
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: `${top}%`,
                left: `${left}%`,
                width: `${width}px`,
                height: '1.5px',
                background: `linear-gradient(90deg, transparent, ${hue}55, transparent)`,
                transform: `rotate(${rotate}deg)`,
                filter: 'blur(0.5px)',
              }}
            />
          );
        })}
      </div>

      {/* Radial glow behind the card */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 40%, rgba(16,185,129,0.18), transparent 55%), radial-gradient(circle at 50% 80%, rgba(56,189,248,0.12), transparent 60%)',
        }}
      />

      <div className="relative max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Sparkle row */}
        <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.25em] text-emerald-400 mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          Purchase confirmed · Royalty-free license issued
          <Sparkles className="w-3.5 h-3.5" />
        </div>

        <h1 className="font-display font-bold text-4xl md:text-5xl tracking-tight leading-none">
          <span
            style={{
              backgroundImage: 'linear-gradient(90deg, #34d399 0%, #7dd3fc 50%, #f97316 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Landed. Clip is yours.
          </span>
        </h1>
        <p className="text-sky-400 text-base mt-4">
          Royalty-free 360° master ready to download. Receipt on its way to your inbox.
        </p>

        {/* Main card */}
        <div
          className="mt-10 rounded-3xl p-8"
          style={{
            background: 'linear-gradient(180deg, rgba(20,29,54,0.85), rgba(10,14,26,0.95))',
            border: '1px solid rgba(16,185,129,0.35)',
            boxShadow: '0 30px 80px -30px rgba(16,185,129,0.25), 0 0 0 1px rgba(16,185,129,0.15)',
          }}
        >
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(52,211,153,0.15))',
              border: '1px solid rgba(16,185,129,0.5)',
              boxShadow: '0 0 40px rgba(16,185,129,0.35)',
            }}
          >
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>

          <h2 className="font-display font-bold text-2xl text-white mb-2">Purchase complete</h2>
          <p className="text-sky-400 mb-8">
            Thank you. Your footage is ready.
          </p>

          {/* Info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8 text-left">
            <div
              className="rounded-2xl p-4"
              style={{
                background: 'rgba(10,14,26,0.6)',
                border: '1px solid rgba(59,108,181,0.25)',
              }}
            >
              <div className="flex items-start gap-2.5">
                <Mail className="w-4 h-4 text-sky-300 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-sky-500">Email delivery</div>
                  <div className="text-xs text-sky-200 mt-0.5 truncate">
                    Link sent to <strong className="text-white">{email || 'your inbox'}</strong>
                  </div>
                  <div className="text-[11px] text-sky-600 mt-1">Check spam if it doesn't arrive within 2 min.</div>
                </div>
              </div>
            </div>

            <div
              className="rounded-2xl p-4"
              style={{
                background: 'rgba(10,14,26,0.6)',
                border: '1px solid rgba(59,108,181,0.25)',
              }}
            >
              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-sky-300 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-sky-500">Download window</div>
                  <div className="text-xs text-sky-200 mt-0.5">
                    <strong className="text-white">5 downloads</strong> · link expires in <strong className="text-white">72h</strong>
                  </div>
                  <div className="text-[11px] text-sky-600 mt-1">Unwatermarked full-quality master</div>
                </div>
              </div>
            </div>
          </div>

          {token && (
            <Link
              to={`/download?token=${token}`}
              className="inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-display font-semibold text-base text-white transition-all hover:scale-[1.01]"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
                boxShadow: '0 12px 32px -10px rgba(16,185,129,0.5)',
              }}
            >
              <Download className="w-5 h-5" />
              Download now
            </Link>
          )}

          {token && (
            <div className="mt-4 flex items-center justify-center gap-2 text-[11px] font-mono text-sky-600">
              <Receipt className="w-3 h-3" />
              Order ref · {token.slice(0, 8)}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/browse"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-display font-medium text-sky-300 border border-sky-700/40 hover:text-white hover:border-sky-500/50 transition-colors"
          >
            Browse more footage <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
