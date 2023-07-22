const SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1";
const SPOTIFY_ACCOUNTS_BASE_URL = "https://accounts.spotify.com";

const ENDPOINTS = {
  SAVED_TRACKS: `${SPOTIFY_API_BASE_URL}/me/tracks`,
  SAVED_ALBUMS: `${SPOTIFY_API_BASE_URL}/me/albums`,
  SAVED_PLAYLISTS: `${SPOTIFY_API_BASE_URL}/me/playlists`,
  TOP_ARTISTS: `${SPOTIFY_API_BASE_URL}/me/top/artists`,
  TOP_TRACKS: `${SPOTIFY_API_BASE_URL}/me/top/tracks`,
  TOKEN: `${SPOTIFY_ACCOUNTS_BASE_URL}/api/token`,
} as const;

const ENDPOINTS_WITH_ID = {
  PLAYLIST: (id: string) => `${SPOTIFY_API_BASE_URL}/playlists/${id}` as const,
  PLAYLIST_TRACKS: (id: string) =>
    `${SPOTIFY_API_BASE_URL}/playlists/${id}/tracks` as const,
} as const;

type ENDPOINT =
  | (typeof ENDPOINTS)[keyof typeof ENDPOINTS]
  | ReturnType<(typeof ENDPOINTS_WITH_ID)[keyof typeof ENDPOINTS_WITH_ID]>;

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
    ) => Promise<SpotifyApi.PagingObject<T>>,
    query?: Record<string, string>
  ): Promise<T[]>;
  getSaved<T>(endpoint: ENDPOINT, query: Record<string, string>): Promise<T>;
  getAllById<T>(
    getFunction: (
      id: string,
      query: Record<string, string>
    ) => Promise<SpotifyApi.PagingObject<T>>,
    id: string
  ): Promise<T[]>;
  getById<T>(
    endpoint: (typeof ENDPOINTS_WITH_ID)[keyof typeof ENDPOINTS_WITH_ID],
    id: string,
    query: Record<string, string>
  ): Promise<T>;
  getAllTopItems<T>(
    getFunction: (
      query: Record<string, string>
    ) => Promise<SpotifyApi.PagingObject<T>>,
    query?: Record<string, string>
  ): Promise<T[]>;
  getSavedTracks(
    query: Record<string, string>
  ): Promise<SpotifyApi.UsersSavedTracksResponse>;
  getAllSavedTracks(): Promise<SpotifyApi.SavedTrackObject[]>;
  getSavedAlbums(
    query: Record<string, string>
  ): Promise<SpotifyApi.UsersSavedAlbumsResponse>;
  getAllSavedAlbums(): Promise<SpotifyApi.SavedAlbumObject[]>;
  getSavedPlaylists(
    query: Record<string, string>
  ): Promise<SpotifyApi.ListOfUsersPlaylistsResponse>;
  getAllSavedPlaylists(): Promise<SpotifyApi.PlaylistObjectSimplified[]>;
  getTopArtists(
    query: Record<string, string>
  ): Promise<SpotifyApi.UsersTopArtistsResponse>;
  getAllTopArtists(
    query: Record<string, string>
  ): Promise<SpotifyApi.ArtistObjectFull[]>;
  getTopTracks(
    query: Record<string, string>
  ): Promise<SpotifyApi.UsersTopTracksResponse>;
  getAllTopTracks(
    query: Record<string, string>
  ): Promise<SpotifyApi.TrackObjectFull[]>;
  getPlaylist(
    id: string,
    query: Record<string, string>
  ): Promise<
    Omit<SpotifyApi.PlaylistObjectFull, "tracks"> & {
      tracks: SpotifyApi.PlaylistTrackObject[];
    }
  >;
  getPlaylistTracks(
    id: string,
    query: Record<string, string>
  ): Promise<SpotifyApi.PlaylistTrackResponse>;
  getAllPlaylistTracks(id: string): Promise<SpotifyApi.PlaylistTrackObject[]>;
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
      ) => Promise<SpotifyApi.PagingObject<T>>,
      query: Record<string, string> = {}
    ) {
      const { limit, total, items } = await getFunction({
        limit: "50",
        ...query,
      });

      const promises: Promise<SpotifyApi.PagingObject<T>>[] = [];

      for (let i = 1; i <= Math.floor(total / 50); i++) {
        promises.push(
          getFunction({ limit: `${limit}`, offset: `${i * limit}`, ...query })
        );
      }

      const rest = (await Promise.all(promises)).map((r) => r.items).flat();

      return [...items, ...rest];
    },
    async getById<T>(
      endpoint: (typeof ENDPOINTS_WITH_ID)[keyof typeof ENDPOINTS_WITH_ID],
      id: string,
      query: Record<string, string>
    ) {
      return await client.getSaved<T>(endpoint(id), query);
    },
    async getAllById<T>(
      getFunction: (
        id: string,
        query: Record<string, string>
      ) => Promise<SpotifyApi.PagingObject<T>>,
      id: string
    ) {
      return await client.getAllSaved<T>((query) => getFunction(id, query));
    },
    async getAllTopItems<T>(
      getFunction: (
        query: Record<string, string>
      ) => Promise<SpotifyApi.PagingObject<T>>,
      query: Record<string, string> = {}
    ) {
      // Spotify's API reports there are only 50 items in total, but you can
      // actually get 49 more items by setting the limit to 50 and the offset
      // to 49. Once the offset is 50 or more, you can't get any more items.
      const { items: first49 } = await getFunction({
        limit: "49",
        ...query,
      });
      const { items: rest } = await getFunction({
        limit: "50",
        offset: "49",
        ...query,
      });
      return [...first49, ...rest];
    },
    async getSavedTracks(query) {
      return client.getSaved(ENDPOINTS.SAVED_TRACKS, query);
    },
    async getSavedAlbums(query) {
      return client.getSaved(ENDPOINTS.SAVED_ALBUMS, query);
    },
    async getSavedPlaylists(query) {
      return client.getSaved(ENDPOINTS.SAVED_PLAYLISTS, query);
    },
    async getTopArtists(query) {
      return client.getSaved(ENDPOINTS.TOP_ARTISTS, query);
    },
    async getTopTracks(query) {
      return client.getSaved(ENDPOINTS.TOP_TRACKS, query);
    },
    async getAllSavedTracks() {
      return (await client.getAllSaved(client.getSavedTracks)).sort(
        compareTrack
      );
    },
    async getAllSavedAlbums() {
      return (await client.getAllSaved(client.getSavedAlbums)).sort(
        compareAlbum
      );
    },
    async getAllSavedPlaylists() {
      return await client.getAllSaved(client.getSavedPlaylists);
    },
    async getAllTopArtists(query) {
      return await client.getAllTopItems(client.getTopArtists, query);
    },
    async getAllTopTracks(query) {
      return await client.getAllTopItems(client.getTopTracks, query);
    },
    async getPlaylistTracks(id, query) {
      return client.getById(ENDPOINTS_WITH_ID.PLAYLIST_TRACKS, id, query);
    },
    async getAllPlaylistTracks(id) {
      return await client.getAllById(client.getPlaylistTracks, id);
    },
    async getPlaylist(id, query) {
      const playlistResponse = client.getById<SpotifyApi.PlaylistObjectFull>(
        ENDPOINTS_WITH_ID.PLAYLIST,
        id,
        query
      );
      const tracks = await client.getAllPlaylistTracks(id);
      const { tracks: _tracks, ...playlist } = await playlistResponse;
      return { ...playlist, tracks };
    },
  };

  return client;
}

function compareTrack(
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

function compareAlbum(
  a: SpotifyApi.SavedAlbumObject,
  b: SpotifyApi.SavedAlbumObject
): number {
  const byDate =
    new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
  if (byDate !== 0) return byDate;

  return a.album.name.localeCompare(b.album.name);
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

export function simplifySavedAlbum(
  saved: SpotifyApi.SavedAlbumObject
): SavedAlbumSimplified {
  return {
    id: saved.album.id,
    name: saved.album.name,
    added_at: saved.added_at,
    type: saved.album.album_type,
    total_tracks: saved.album.total_tracks,
    url: saved.album.external_urls.spotify,
    image_url: saved.album.images[0].url,
    release_date: saved.album.release_date,
    artists: saved.album.artists.map((a) => ({
      id: a.id,
      name: a.name,
      url: a.external_urls.spotify,
    })),
    genres: saved.album.genres,
    popularity: saved.album.popularity,
  };
}

interface SavedTrackSimplified {
  id: string;
  name: string;
  added_at: string;
  popularity: number;
  url: string;
  duration_ms: number;
  explicit: boolean;
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

interface SavedAlbumSimplified {
  id: string;
  name: string;
  added_at: string;
  popularity: number;
  url: string;
  image_url: string;
  type: SpotifyApi.AlbumObjectSimplified["album_type"];
  total_tracks: number;
  release_date: string;
  genres: string[];
  artists: Array<{
    id: string;
    name: string;
    url: string;
  }>;
}
