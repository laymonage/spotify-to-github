const SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1";
const SPOTIFY_ACCOUNTS_BASE_URL = "https://accounts.spotify.com";

const ENDPOINTS = {
  TRACKS: `${SPOTIFY_API_BASE_URL}/me/tracks`,
  ALBUMS: `${SPOTIFY_API_BASE_URL}/me/albums`,
  PLAYLISTS: `${SPOTIFY_API_BASE_URL}/me/playlists`,
  SHOWS: `${SPOTIFY_API_BASE_URL}/me/shows`,
  EPISODES: `${SPOTIFY_API_BASE_URL}/me/episodes`,
  TOP_ARTISTS: `${SPOTIFY_API_BASE_URL}/me/top/artists`,
  TOP_TRACKS: `${SPOTIFY_API_BASE_URL}/me/top/tracks`,
  FOLLOWING: `${SPOTIFY_API_BASE_URL}/me/following`,
  TOKEN: `${SPOTIFY_ACCOUNTS_BASE_URL}/api/token`,
} as const;

const ENDPOINTS_WITH_ID = {
  PLAYLIST: (id: string) => `${SPOTIFY_API_BASE_URL}/playlists/${id}` as const,
  PLAYLIST_TRACKS: (id: string) =>
    `${SPOTIFY_API_BASE_URL}/playlists/${id}/tracks` as const,
  SHOW: (id: string) => `${SPOTIFY_API_BASE_URL}/shows/${id}` as const,
  SHOW_EPISODES: (id: string) =>
    `${SPOTIFY_API_BASE_URL}/shows/${id}/episodes` as const,
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
  getSavedShows(
    query: Record<string, string>
  ): Promise<SpotifyApi.UsersSavedShowsResponse>;
  getAllSavedShows(): Promise<SpotifyApi.SavedShowObject[]>;
  getSavedEpisodes(
    query: Record<string, string>
  ): Promise<SpotifyApi.UsersSavedEpisodesResponse>;
  getAllSavedEpisodes(): Promise<SpotifyApi.SavedEpisodeObject[]>;
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
  getFollowing(
    query: Record<string, string>
  ): Promise<SpotifyApi.UsersFollowedArtistsResponse>;
  getAllFollowing(): Promise<SpotifyApi.ArtistObjectFull[]>;
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
  getShow(
    id: string,
    query: Record<string, string>
  ): Promise<
    Omit<SpotifyApi.ShowObjectFull, "episodes"> & {
      episodes: SpotifyApi.EpisodeObjectSimplified[];
    }
  >;
  getShowEpisodes(
    id: string,
    query: Record<string, string>
  ): Promise<SpotifyApi.ShowEpisodesResponse>;
  getAllShowEpisodes(id: string): Promise<SpotifyApi.EpisodeObjectSimplified[]>;
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
      return client.getSaved(ENDPOINTS.TRACKS, query);
    },
    async getSavedAlbums(query) {
      return client.getSaved(ENDPOINTS.ALBUMS, query);
    },
    async getSavedPlaylists(query) {
      return client.getSaved(ENDPOINTS.PLAYLISTS, query);
    },
    async getSavedShows(query) {
      return client.getSaved(ENDPOINTS.SHOWS, query);
    },
    async getSavedEpisodes(query) {
      return client.getSaved(ENDPOINTS.EPISODES, query);
    },
    async getTopArtists(query) {
      return client.getSaved(ENDPOINTS.TOP_ARTISTS, query);
    },
    async getTopTracks(query) {
      return client.getSaved(ENDPOINTS.TOP_TRACKS, query);
    },
    async getFollowing(query) {
      return client.getSaved(ENDPOINTS.FOLLOWING, { type: "artist", ...query });
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
    async getAllSavedShows() {
      return (await client.getAllSaved(client.getSavedShows)).sort(compareShow);
    },
    async getAllSavedEpisodes() {
      return (await client.getAllSaved(client.getSavedEpisodes)).sort(
        compareEpisode
      );
    },
    async getAllTopArtists(query) {
      return await client.getAllTopItems(client.getTopArtists, query);
    },
    async getAllTopTracks(query) {
      return await client.getAllTopItems(client.getTopTracks, query);
    },
    async getAllFollowing() {
      const { artists } = await client.getFollowing({ limit: "50" });
      const { items } = artists;
      let after: string | null = artists.cursors.after;

      while (after) {
        const { artists: nextArtists } = await client.getFollowing({
          limit: "50",
          after,
        });
        items.push(...nextArtists.items);
        after = nextArtists.cursors.after;
      }

      return items;
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
    async getShowEpisodes(id, query) {
      return client.getById(ENDPOINTS_WITH_ID.SHOW_EPISODES, id, query);
    },
    async getAllShowEpisodes(id) {
      return await client.getAllById(client.getShowEpisodes, id);
    },
    async getShow(id, query) {
      const showResponse = client.getById<SpotifyApi.ShowObjectFull>(
        ENDPOINTS_WITH_ID.SHOW,
        id,
        query
      );
      const episodes = await client.getAllShowEpisodes(id);
      const { episodes: _episodes, ...show } = await showResponse;
      return { ...show, episodes };
    },
  };

  return client;
}

function compareString(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function compareDateString(a: string, b: string): number {
  return new Date(b).getTime() - new Date(a).getTime();
}

function compareSaved<
  T extends
    | SpotifyApi.SavedAlbumObject
    | SpotifyApi.SavedTrackObject
    | SpotifyApi.SavedShowObject
    | SpotifyApi.SavedEpisodeObject
>(a: T, b: T): number {
  return compareDateString(a.added_at, b.added_at);
}

function compareTrack(
  a: SpotifyApi.SavedTrackObject,
  b: SpotifyApi.SavedTrackObject
): number {
  const byDate = compareSaved(a, b);
  if (byDate !== 0) return byDate;

  if (a.track.album.id === b.track.album.id) {
    if (a.track.disc_number === b.track.disc_number) {
      return a.track.track_number - b.track.track_number;
    }
    return a.track.disc_number - b.track.disc_number;
  }

  if (a.track.artists[0].id === b.track.artists[0].id) {
    return compareString(a.track.album.name, b.track.album.name);
  }

  return compareString(a.track.artists[0].name, b.track.artists[0].name);
}

function compareAlbum(
  a: SpotifyApi.SavedAlbumObject,
  b: SpotifyApi.SavedAlbumObject
): number {
  const byDate = compareSaved(a, b);
  if (byDate !== 0) return byDate;

  if (a.album.artists[0].id === b.album.artists[0].id) {
    return compareString(a.album.name, b.album.name);
  }

  return compareString(a.album.artists[0].name, b.album.artists[0].name);
}

function compareEpisode(
  a: SpotifyApi.SavedEpisodeObject,
  b: SpotifyApi.SavedEpisodeObject
): number {
  const byDate = compareSaved(a, b);
  if (byDate !== 0) return byDate;

  if (a.episode.show.id === b.episode.show.id) {
    return compareDateString(a.episode.release_date, b.episode.release_date);
  }

  return compareString(a.episode.name, b.episode.name);
}

function compareShow(
  a: SpotifyApi.SavedShowObject,
  b: SpotifyApi.SavedShowObject
): number {
  const byDate = compareSaved(a, b);
  if (byDate !== 0) return byDate;

  return compareString(a.show.name, b.show.name);
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
