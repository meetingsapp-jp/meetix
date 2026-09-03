import { useEffect, useState } from 'react';
import { qrPayloadForPassenger } from '../lib/qrCheckin';

// Renders a passenger's check-in QR as a data: URI image, generated
// entirely client-side (no network round trip, no server-side QR service).
export default function PassengerQrCode({ passengerId, size = 220 }: { passengerId: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    import('qrcode').then((QRCode) =>
      QRCode.toDataURL(qrPayloadForPassenger(passengerId), { width: size, margin: 1 }).then((url) => {
        if (alive) setDataUrl(url);
      }),
    );
    return () => {
      alive = false;
    };
  }, [passengerId, size]);

  if (!dataUrl) {
    return <div className="flex items-center justify-center" style={{ width: size, height: size }} />;
  }
  return <img src={dataUrl} width={size} height={size} alt="QR de check-in" className="rounded-lg border border-slate-200" />;
}
