import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Download, Film, AlertCircle, CheckCircle2, Clock, Loader2, ArrowRight, Shield } from 'lucide-react';
import { validateDownload, getDownloadUrl } from '../lib/api';
import { formatDuration, formatFileSize } from '../lib/types';
import type { Video } from '../lib/types';

function useCountdown(expiresAt: string | null) {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    if (!expiresAt) return;
    function tick() {
      const diff = new Date(expiresAt!).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Expired'); return; }
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${hours}h ${mins}m remaining`);
    }
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return timeLeft;
}

export default function DownloadPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [video, setVideo] = useState<Video | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [error, setError] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const countdown = useCountdown(expiresAt);

  useEffect(() => {
    async function validate() {
      if (!token) {
        setError('No download token provided');
        setLoading(false);
        return;
      }
      try {
        const data = await validateDownload(token);
        setValid(data.valid);
        setVideo(data.video);
        setRemaining(data.remainingDownloads);
        // Estimate expiry: 72h from now if not returned by API
        if ((data as any).expiresAt) {
          setExpiresAt((data as any).expiresAt);
        }
      } catch (err: any) {
        setError(err.message || 'Invalid or expired download link');
      } finally {
        setLoading(false);
      }
    }
    validate();
  }, [token]);

  const handleDownload = useCallback(async () => {
    if (!token) return;
    setDownloading(true);
    try {
      const data = await getDownloadUrl(token);
      // Use the direct file delivery URL
      const a = document.createElement('a');
      a.href = data.url;
      a.download = (data as any).filename || 'skystock-video.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setRemaining(r => Math.max(0, r - 1));
      setDownloaded(true);
    } catch (err: any) {
      setError(err.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
      </div>
    );
  }

  if (error || !valid) {
    return (
      <div className="page-enter max-w-lg mx-auto px-4 py-20 text-center">
        <div className="glass-card p-10">
          <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="font-display font-bold text-2xl text-white mb-3">Download Unavailable</h1>
          <p className="text-sky-400 mb-6">{error || 'This download link is invalid or has expired.'}</p>
          <Link to="/browse" className="btn-primary">
            Browse Footage <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter max-w-lg mx-auto px-4 py-16 text-center">
      <div className="glass-card p-10">
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-5">
          {downloaded ? (
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          ) : (
            <Download className="w-8 h-8 text-emerald-400" />
          )}
        </div>

        <h1 className="font-display font-bold text-2xl text-white mb-2">
          {downloaded ? 'Download Started!' : 'Your Download is Ready'}
        </h1>
        <p className="text-sky-400 mb-6">
          {downloaded ? 'Check your browser downloads.' : `Full unwatermarked ${video?.resolution || '4K'} file`}
        </p>

        {video && (
          <div className="glass-card p-4 mb-6 flex items-center gap-4 text-left">
            <div className="w-16 h-16 rounded-xl bg-sky-800/40 flex items-center justify-center shrink-0 overflow-hidden">
              {video.thumbnail_url ? (
                <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Film className="w-7 h-7 text-sky-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-display font-semibold text-white text-sm truncate">{video.title}</h3>
              <p className="text-xs text-sky-500 mt-1">
                {video.resolution} · {video.fps}fps · {formatDuration(video.duration_seconds)} · {formatFileSize(video.file_size_bytes)}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={handleDownload}
          disabled={downloading || remaining <= 0}
          className="btn-ember w-full text-base py-4 mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {downloading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Preparing download...
            </span>
          ) : remaining <= 0 ? (
            'Download limit reached'
          ) : downloaded ? (
            <>
              <Download className="w-5 h-5" /> Download Again ({remaining} left)
            </>
          ) : (
            <>
              <Download className="w-5 h-5" /> Download Full Video
            </>
          )}
        </button>

        <div className="flex items-center justify-center gap-4 text-xs text-sky-500 mb-6">
          <span className="flex items-center gap-1">
            <Download className="w-3.5 h-3.5" /> {remaining} download{remaining !== 1 ? 's' : ''} remaining
          </span>
          {countdown && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {countdown}
            </span>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-sky-600">
          <Shield className="w-3.5 h-3.5" />
          Secure download · Royalty-free license included
        </div>

        {downloaded && (
          <div className="mt-6 pt-6 border-t border-sky-700/20">
            <Link to="/browse" className="btn-primary">
              Browse More Footage <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
