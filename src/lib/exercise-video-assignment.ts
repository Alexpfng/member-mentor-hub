type Video = {
  youtube_url?: string | null;
  youtube_id?: string | null;
  youtube_alt_url?: string | null;
  image_url?: string | null;
};

function normalizeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function exerciseVideoForRename<T extends Video & { name: string }>(
  source: T,
  name: string,
): Video {
  if (normalizeName(source.name) === normalizeName(name)) {
    return {
      youtube_url: source.youtube_url ?? null,
      youtube_id: source.youtube_id ?? null,
      youtube_alt_url: source.youtube_alt_url ?? null,
      image_url: source.image_url ?? null,
    };
  }
  return { youtube_url: null, youtube_id: null, youtube_alt_url: null, image_url: null };
}

export function exerciseVideoForReplacement(_source: Video, replacement: Video): Video {
  return {
    youtube_url: replacement.youtube_url ?? null,
    youtube_id: replacement.youtube_id ?? null,
    youtube_alt_url: replacement.youtube_alt_url ?? null,
    image_url: replacement.image_url ?? null,
  };
}

export function videoForLibrarySave(
  incoming: string | null,
  existing: string | null,
): string | null {
  return incoming?.trim() || existing;
}
