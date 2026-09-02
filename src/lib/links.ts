// Small helpers to build external lookup links (no API keys required).

export function googleMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

// Flightradar24's flight page accepts a bare flight number (airline code + number),
// e.g. "aa123", and shows schedule/history even for flights that aren't airborne
// right now — broader coverage than FlightAware for regional/low-cost carriers.
export function flightStatusUrl(flightNumber: string): string {
  return `https://www.flightradar24.com/data/flights/${encodeURIComponent(flightNumber.replace(/\s+/g, '').toLowerCase())}`;
}
