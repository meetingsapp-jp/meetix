// QR check-in payload format. Scanning always happens inside the app (a
// coordinator's phone camera via QrScanner), never a generic camera app, so
// this doesn't need to be a resolvable URL — a short custom scheme is
// enough and keeps the QR simpler to read at a distance.
const PREFIX = 'MEETIX-CHECKIN:';

export function qrPayloadForPassenger(passengerId: string): string {
  return `${PREFIX}${passengerId}`;
}

export function passengerIdFromQrPayload(text: string): string | null {
  if (!text.startsWith(PREFIX)) return null;
  const id = text.slice(PREFIX.length).trim();
  return id || null;
}
