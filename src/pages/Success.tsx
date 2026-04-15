import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, Download, Mail, ArrowRight, ExternalLink } from 'lucide-react';

export default function Success() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || searchParams.get('order');
  const email = searchParams.get('email');

  return (
    <div className="page-enter max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
      <div className="glass-card p-10">
        <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </div>

        <h1 className="font-display font-bold text-3xl text-white mb-3">Purchase Complete!</h1>
        <p className="text-sky-400 text-lg mb-8">
          Thank you for your purchase. Your footage is ready to download.
        </p>

        <div className="glass-card p-6 mb-8 text-left space-y-4">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-sky-400 mt-0.5 shrink-0" />
            <div>
              <span className="block text-sm font-display font-semibold text-sky-200">Download link emailed</span>
              <span className="block text-sm text-sky-500">
                A secure download link has been sent to <strong className="text-sky-300">{email || 'your email'}</strong>.
                Check your inbox (and spam folder). You'll also receive a purchase receipt.
              </span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Download className="w-5 h-5 text-sky-400 mt-0.5 shrink-0" />
            <div>
              <span className="block text-sm font-display font-semibold text-sky-200">Download limits</span>
              <span className="block text-sm text-sky-500">
                You can download the full unwatermarked file up to 5 times. The link expires in 72 hours.
              </span>
            </div>
          </div>
        </div>

        {token && (
          <div className="mb-6">
            <Link
              to={`/download?token=${token}`}
              className="btn-ember inline-flex items-center gap-2 text-base py-3 px-6"
            >
              <Download className="w-5 h-5" /> Download Now
            </Link>
            <p className="text-xs font-mono text-sky-600 mt-3">Ref: {token.slice(0, 8)}...</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/browse" className="btn-primary">
            Browse More Footage <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
