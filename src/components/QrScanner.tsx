import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './ui/Modal';

// Opens the device camera and decodes QR codes frame-by-frame with jsQR
// (pure JS, no native BarcodeDetector dependency — works across browsers).
export default function QrScanner({
  open,
  onClose,
  onDetected,
}: {
  open: boolean;
  onClose: () => void;
  onDetected: (text: string) => void;
}) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const jsQR = (await import('jsqr')).default;
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

        const tick = () => {
          if (cancelled) return;
          const video = videoRef.current;
          if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(frame.data, frame.width, frame.height);
            if (code?.data) {
              onDetected(code.data);
              return;
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) setError(t('coordinator.qr.cameraError'));
      }
    }
    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Modal open={open} title={t('coordinator.qr.scanTitle')} onClose={onClose}>
      {error ? (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : (
        <div className="overflow-hidden rounded-lg bg-black">
          <video ref={videoRef} className="w-full" muted playsInline />
        </div>
      )}
      <canvas ref={canvasRef} hidden />
      <p className="mt-3 text-center text-sm text-slate-500">{t('coordinator.qr.scanHint')}</p>
    </Modal>
  );
}
