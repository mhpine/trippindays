export type PassportStamp = {
  id: string;
  slug: string;
  name: string;
  location: string;
  category: string | null;
  image_url: string | null;
  prompt: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  unlock_radius: number;
  state: string | null;
  country: string;
  description: string | null;
  difficulty: string;
  featured: boolean;
  created_at: string;
  updated_at: string;
};

export type EarnedStamp = {
  stamp_slug: string;
  earned_at: string;
  verification_photo_path: string | null;
};
