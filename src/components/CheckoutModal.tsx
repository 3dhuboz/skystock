import { useState, useRef } from 'react';
import { X, Mail, ShieldCheck, Lock, AlertCircle } from 'lucide-react';
import { PayPalButtons } from '@paypal/react-paypal-js';
import type { Video } from '../lib/types';
import { formatPrice } from '../lib/types';
import { createPayPalOrder, capturePayPalOrder } from '../lib/api';
import toast from 'react-hot-toast';

interface CheckoutModalProps {
  video: Video;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (downloadToken: string) => void;
}

export default function CheckoutModal({ video, isOpen, onClose, onSuccess }: CheckoutModalProps) {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'payment' | 'processing'>('email');
  const [error, setError] = useState('');
  // Store the internal order ID returned by our API so we can pass it to capture
  const orderRef = useRef<{ orderId: string; paypalOrderId: string } | null>(null);

  if (!isOpen) return null;

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    setError('');
    setStep('payment');
  }

  async function handleCreateOrder(): Promise<string> {
    try {
      const result = await createPayPalOrder(video.id, email);
      orderRef.current = result;
      return result.paypalOrderId;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create order';
      setError(message);
      toast.error(message);
      throw err;
    }
  }

  async function handleApprove(data: { orderID: string }) {
    setStep('processing');
    try {
      const internalOrderId = orderRef.current?.orderId ?? '';
      const result = await capturePayPalOrder(data.orderID, internalOrderId);
      if (result.success) {
        toast.success('Purchase complete! Check your email for the download link.');
        onSuccess(result.downloadToken);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Payment capture failed';
      setError(message);
      setStep('payment');
      toast.error('Payment failed. Please try again.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-sky-950/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md glass-card p-8 animate-slide-up">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-sky-500 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>

        {/* Video info header */}
        <div className="mb-6">
          <h2 className="font-display font-bold text-xl text-white">Purchase Video</h2>
          <p className="text-sky-400 text-sm mt-1">{video.title}</p>
          <div className="flex items-center justify-between mt-4 p-3 bg-sky-800/30 rounded-xl">
            <span className="text-sm text-sky-300">Total</span>
            <span className="font-display font-bold text-2xl text-ember-400">{formatPrice(video.price_cents)}</span>
          </div>
        </div>

        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-display font-medium text-sky-300 mb-2">
                <Mail className="w-4 h-4 inline mr-2" />
                Email for download link
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="input-field"
                required
                autoFocus
              />
              {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
              <p className="text-xs text-sky-600 mt-2">We'll send your download link to this address</p>
            </div>
            <button type="submit" className="btn-ember w-full py-4">
              Continue to Payment
            </button>
          </form>
        )}

        {step === 'payment' && (
          <div className="space-y-4">
            <p className="text-sm text-sky-400 mb-4">
              Download link will be sent to <strong className="text-sky-200">{email}</strong>
            </p>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-900/30 border border-red-700/30 text-sm text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            {/* PayPal Smart Buttons */}
            <div className="rounded-xl overflow-hidden">
              <PayPalButtons
                style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' }}
                createOrder={handleCreateOrder}
                onApprove={handleApprove}
                onError={(err) => {
                  console.error('PayPal error:', err);
                  setError('PayPal encountered an error. Please try again.');
                  toast.error('Payment error. Please try again.');
                }}
                onCancel={() => {
                  toast('Payment cancelled.', { icon: '↩️' });
                }}
              />
            </div>

            <button onClick={() => { setStep('email'); setError(''); }} className="btn-ghost w-full text-sm">
              Change email
            </button>
          </div>
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-12 h-12 rounded-full border-2 border-sky-500 border-t-transparent animate-spin mb-4" />
            <p className="font-display font-medium text-white">Processing payment...</p>
            <p className="text-sm text-sky-500 mt-1">Please don't close this window</p>
          </div>
        )}

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-sky-700/20">
          <span className="flex items-center gap-1 text-xs text-sky-600"><Lock className="w-3 h-3" /> Secure checkout</span>
          <span className="flex items-center gap-1 text-xs text-sky-600"><ShieldCheck className="w-3 h-3" /> PayPal protected</span>
        </div>
      </div>
    </div>
  );
}
