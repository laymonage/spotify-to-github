const SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1";
const SPOTIFY_ACCOUNTS_BASE_URL = "https://accounts.spotify.com";

const ENDPOINTS = {
  SAVED_TRACKS: `${SPOTIFY_API_BASE_URL}/me/tracks`,
  TOKEN: `${SPOTIFY_ACCOUNTS_BASE_URL}/api/token`,
};

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
  getSavedTracks(
    query: Record<string, string>
  ): Promise<SpotifyApi.UsersSavedTracksResponse>;
  getAllSavedTracks(): Promise<SpotifyApi.SavedTrackObject[]>;
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
    async getSavedTracks(query: Record<string, string>) {
      const response = await fetch(
        `${ENDPOINTS.SAVED_TRACKS}?${new URLSearchParams(query)}`,
        init
      );
      return await response.json();
    },
    async getAllSavedTracks() {
      const { limit, total, items } = await this.getSavedTracks({
        limit: "50",
      });

      const promises: Promise<SpotifyApi.UsersSavedTracksResponse>[] = [];

      for (let i = 1; i <= Math.floor(total / 50); i++) {
        promises.push(
          this.getSavedTracks({ limit: `${limit}`, offset: `${i * limit}` })
        );
      }

      const rest = (await Promise.all(promises)).map((r) => r.items).flat();

      return [...items, ...rest];
    },
  };

  return client;
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
    external_urls: saved.track.external_urls,
    preview_url: saved.track.preview_url,
    album: {
      id: saved.track.album.id,
      name: saved.track.album.name,
      release_date: saved.track.album.release_date,
      images: saved.track.album.images,
    },
    artists: saved.track.artists.map((a) => ({
      id: a.id,
      name: a.name,
      external_urls: a.external_urls,
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
  external_urls: SpotifyApi.ExternalUrlObject;
  preview_url: string | null;
  album: {
    id: string;
    name: string;
    release_date: string;
    images: SpotifyApi.ImageObject[];
  };
  artists: Array<{
    id: string;
    name: string;
    external_urls: SpotifyApi.ExternalUrlObject;
  }>;
}
