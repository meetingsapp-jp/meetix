// Small helpers to build external lookup links (no API keys required).

export function googleMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

// FlightAware's live tracker accepts a bare flight number (airline code + number),
// e.g. "AA123". It's a reasonable public fallback without needing a flight-status API key.
export function flightStatusUrl(flightNumber: string): string {
  return `https://www.flightaware.com/live/flight/${encodeURIComponent(flightNumber.replace(/\s+/g, ''))}`;
}
