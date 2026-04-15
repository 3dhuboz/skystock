import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Film, AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { validateDownload, getDownloadUrl } from '../lib/api';
import { formatDuration, formatFileSize } from '../lib/types';
import type { Video } from '../lib/types';

export default function DownloadPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [video, setVideo] = useState<Video | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

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
      } catch (err: any) {
        setError(err.message || 'Invalid or expired download link');
      } finally {
        setLoading(false);
      }
    }
    validate();
  }, [token]);

  const handleDownload = async () => {
    if (!token) return;
    setDownloading(true);
    try {
      const { url } = await getDownloadUrl(token);
      window.location.href = url;
      setRemaining(r => Math.max(0, r - 1));
    } catch (err: any) {
      setError(err.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
      </div>
    );
  }

  if (error || !valid) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="glass-card p-10">
          <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="font-display font-bold text-2xl text-white mb-3">Download Unavailable</h1>
          <p className="text-sky-400">{error || 'This download link is invalid or has expired.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter max-w-lg mx-auto px-4 py-16 text-center">
      <div className="glass-card p-10">
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>

        <h1 className="font-display font-bold text-2xl text-white mb-2">Your Download is Ready</h1>
        <p className="text-sky-400 mb-6">Full unwatermarked {video?.resolution} file</p>

        {video && (
          <div className="glass-card p-4 mb-6 flex items-center gap-4 text-left">
            <div className="w-16 h-16 rounded-xl bg-sky-800/40 flex items-center justify-center shrink-0">
              <Film className="w-7 h-7 text-sky-500" />
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
          className="btn-ember w-full text-base py-4 mb-4"
        >
          {downloading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Starting download...
            </span>
          ) : (
            <>
              <Download className="w-5 h-5" /> Download Full Video
            </>
          )}
        </button>

        <div className="flex items-center justify-center gap-4 text-xs text-sky-500">
          <span className="flex items-center gap-1">
            <Download className="w-3.5 h-3.5" /> {remaining} downloads remaining
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Link expires in 72h
          </span>
        </div>
      </div>
    </div>
  );
}
