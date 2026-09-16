import axios from "axios";

export async function geocodeZip(zip) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${zip}&key=${apiKey}`;
  const res = await axios.get(url);

  if (res.data.results.length > 0) {
    const loc = res.data.results[0].geometry.location;
    return { lat: loc.lat, lng: loc.lng };
  }
  return null;
}
