export type PassportStamp = {
  id: number;
  slug: string;
  name: string;
  location: string;
  image: string;
  latitude: number;
  longitude: number;
  unlockRadiusMeters: number;
};

export const passportStamps: PassportStamp[] = [
  { id: 1, slug: "mount-rainier", name: "Mount Rainier", location: "Washington", image: "/stamps/rainier.png", latitude: 46.7867, longitude: -121.735, unlockRadiusMeters: 1500 },
  { id: 2, slug: "olympic-national-park", name: "Olympic National Park", location: "Washington", image: "/stamps/onp.png", latitude: 47.8021, longitude: -123.6044, unlockRadiusMeters: 2500 },
  { id: 3, slug: "yellowstone", name: "Yellowstone", location: "Wyoming", image: "/stamps/yellowstone.png", latitude: 44.4605, longitude: -110.8281, unlockRadiusMeters: 2500 },
  { id: 4, slug: "crater-lake", name: "Crater Lake", location: "Oregon", image: "/stamps/creatorlake_or.png", latitude: 42.9446, longitude: -122.109, unlockRadiusMeters: 2500 },
  { id: 5, slug: "seattle", name: "Seattle", location: "Washington", image: "/stamps/seattle.png", latitude: 47.6062, longitude: -122.3321, unlockRadiusMeters: 2500 },
  { id: 6, slug: "portland", name: "Portland", location: "Oregon", image: "/stamps/portland.png", latitude: 45.5152, longitude: -122.6784, unlockRadiusMeters: 2500 },
  { id: 7, slug: "cannon-beach", name: "Cannon Beach", location: "Oregon", image: "/stamps/cannonbeach.png", latitude: 45.8918, longitude: -123.9615, unlockRadiusMeters: 1800 },
  { id: 8, slug: "grand-canyon", name: "Grand Canyon", location: "Arizona", image: "/stamps/gcanyon.png", latitude: 36.0544, longitude: -112.1401, unlockRadiusMeters: 3000 },
  { id: 9, slug: "payette-lake", name: "Payette Lake", location: "Idaho", image: "/stamps/plake.png", latitude: 44.9541, longitude: -116.1082, unlockRadiusMeters: 2500 },
  { id: 10, slug: "craters-of-the-moon", name: "Craters of the Moon", location: "Idaho", image: "/stamps/cotm.png", latitude: 43.4166, longitude: -113.5167, unlockRadiusMeters: 2500 },
  { id: 11, slug: "crow-canyon", name: "Crow Canyon", location: "New Mexico", image: "/stamps/crcanyon.png", latitude: 36.5908, longitude: -107.4506, unlockRadiusMeters: 2500 },
  { id: 12, slug: "san-francisco", name: "San Francisco", location: "California", image: "/stamps/sanfran.png", latitude: 37.7749, longitude: -122.4194, unlockRadiusMeters: 3000 },
  { id: 13, slug: "las-vegas", name: "Las Vegas", location: "Nevada", image: "/stamps/vegas.png", latitude: 36.1699, longitude: -115.1398, unlockRadiusMeters: 3000 },
  { id: 14, slug: "everglades", name: "Everglades National Park", location: "Florida", image: "/stamps/everglades.png", latitude: 25.395269, longitude: -80.583156, unlockRadiusMeters: 1200 },
  { id: 15, slug: "acadia", name: "Acadia National Park", location: "Maine", image: "/stamps/acadia.png", latitude: 44.3386, longitude: -68.2733, unlockRadiusMeters: 2500 },
];

export function getStampBySlug(slug: string) {
  const normalized = decodeURIComponent(slug).trim().toLowerCase();
  return passportStamps.find((stamp) => stamp.slug.toLowerCase() === normalized);
}
