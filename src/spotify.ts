const SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1";
const SPOTIFY_ACCOUNTS_BASE_URL = "https://accounts.spotify.com";

const ENDPOINTS = {
  SAVED_TRACKS: `${SPOTIFY_API_BASE_URL}/me/tracks`,
  SAVED_ALBUMS: `${SPOTIFY_API_BASE_URL}/me/albums`,
  TOKEN: `${SPOTIFY_ACCOUNTS_BASE_URL}/api/token`,
} as const;

async function getAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string> {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(ENDPOINTS.TOKEN, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}` },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const { access_token } = await response.json();

  return access_token;
}

interface Client {
  getAllSaved<T>(
    getFunction: (
      query: Record<string, string>
    ) => Promise<SpotifyApi.PagingObject<T>>
  ): Promise<T[]>;
  getSaved<T>(
    endpoint: (typeof ENDPOINTS)[keyof typeof ENDPOINTS],
    query: Record<string, string>
  ): Promise<T>;
  getSavedTracks(
    query: Record<string, string>
  ): Promise<SpotifyApi.UsersSavedTracksResponse>;
  getAllSavedTracks(): Promise<SpotifyApi.SavedTrackObject[]>;
  getSavedAlbums(
    query: Record<string, string>
  ): Promise<SpotifyApi.UsersSavedAlbumsResponse>;
  getAllSavedAlbums(): Promise<SpotifyApi.SavedAlbumObject[]>;
}

export async function createClient(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<Client> {
  const accessToken = await getAccessToken(
    clientId,
    clientSecret,
    refreshToken
  );
  const init = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };

  const client: Client = {
    async getSaved<T>(
      endpoint: (typeof ENDPOINTS)[keyof typeof ENDPOINTS],
      query: Record<string, string>
    ) {
      const response = await fetch(
        `${endpoint}?${new URLSearchParams(query)}`,
        init
      );
      return (await response.json()) as T;
    },
    async getAllSaved<T>(
      getFunction: (
        query: Record<string, string>
      ) => Promise<SpotifyApi.PagingObject<T>>
    ) {
      const { limit, total, items } = await getFunction({
        limit: "50",
      });

      const promises: Promise<SpotifyApi.PagingObject<T>>[] = [];

      for (let i = 1; i <= Math.floor(total / 50); i++) {
        promises.push(
          getFunction({ limit: `${limit}`, offset: `${i * limit}` })
        );
      }

      const rest = (await Promise.all(promises)).map((r) => r.items).flat();

      return [...items, ...rest];
    },
    async getSavedTracks(query) {
      return client.getSaved(ENDPOINTS.SAVED_TRACKS, query);
    },
    async getSavedAlbums(query) {
      return client.getSaved(ENDPOINTS.SAVED_ALBUMS, query);
    },
    async getAllSavedTracks() {
      return (await client.getAllSaved(client.getSavedTracks)).sort(compare);
    },
    async getAllSavedAlbums() {
      return client.getAllSaved(client.getSavedAlbums);
    },
  };

  return client;
}

function compare(
  a: SpotifyApi.SavedTrackObject,
  b: SpotifyApi.SavedTrackObject
): number {
  const byDate =
    new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
  if (byDate !== 0) return byDate;

  if (a.track.album.id === b.track.album.id) {
    if (a.track.disc_number === b.track.disc_number) {
      return a.track.track_number - b.track.track_number;
    }
    return a.track.disc_number - b.track.disc_number;
  }

  return a.track.name.localeCompare(b.track.name);
}

export function simplifySavedTrack(
  saved: SpotifyApi.SavedTrackObject
): SavedTrackSimplified {
  return {
    id: saved.track.id,
    name: saved.track.name,
    added_at: saved.added_at,
    popularity: saved.track.popularity,
    duration_ms: saved.track.duration_ms,
    explicit: saved.track.explicit,
    url: saved.track.external_urls.spotify,
    preview_url: saved.track.preview_url,
    album: {
      id: saved.track.album.id,
      name: saved.track.album.name,
      release_date: saved.track.album.release_date,
      image_url: saved.track.album.images[0].url,
      url: saved.track.album.external_urls.spotify,
    },
    artists: saved.track.artists.map((a) => ({
      id: a.id,
      name: a.name,
      url: a.external_urls.spotify,
    })),
  };
}

interface SavedTrackSimplified {
  id: string;
  name: string;
  added_at: string;
  popularity: number;
  duration_ms: number;
  explicit: boolean;
  url: string;
  preview_url: string | null;
  album: {
    id: string;
    name: string;
    release_date: string;
    image_url: string;
    url: string;
  };
  artists: Array<{
    id: string;
    name: string;
    url: string;
  }>;
}
