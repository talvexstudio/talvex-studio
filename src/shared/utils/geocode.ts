export type GeocodeResult = {
  label: string;
  lat: number;
  lon: number;
};

export async function geocodeAddress(query: string): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const googleKey = import.meta.env.VITE_GOOGLE_MAPS_KEY || import.meta.env.VITE_GOOGLE_API_KEY;
  if (googleKey) {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(trimmed)}&key=${googleKey}`
    );
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data.results)) return [];
    return data.results.slice(0, 6).map((result: any) => ({
      label: String(result.formatted_address || 'Result'),
      lat: Number(result.geometry?.location?.lat ?? 0),
      lon: Number(result.geometry?.location?.lng ?? 0)
    }));
  }
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(trimmed)}`
  );
  if (!response.ok) return [];
  const data = await response.json();
  if (!Array.isArray(data)) return [];
  return data.map((result: any) => ({
    label: String(result.display_name || 'Result'),
    lat: Number(result.lat),
    lon: Number(result.lon)
  }));
}
