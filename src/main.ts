import { difference, log, sleep, writeJSON } from "./functions";
import {
  createClient,
  simplifySavedAlbum,
  simplifySavedTrack,
} from "./spotify";

async function main() {
  const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID as string;
  const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET as string;
  const SPOTIFY_REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN as string;

  const missing: string[] = [];
  if (!SPOTIFY_CLIENT_ID) missing.push("SPOTIFY_CLIENT_ID");
  if (!SPOTIFY_CLIENT_SECRET) missing.push("SPOTIFY_CLIENT_SECRET");
  if (!SPOTIFY_REFRESH_TOKEN) missing.push("SPOTIFY_REFRESH_TOKEN");
  if (missing.length > 0) {
    throw new Error(`Missing required inputs: ${missing.join(", ")}`);
  }

  log(`Creating Spotify client…`);
  const client = await createClient(
    SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET,
    SPOTIFY_REFRESH_TOKEN,
  );

  log(`Getting current user…`);
  // Strip email from profile data to prevent exposure.
  const { email: _email, ...me } = await client.getProfile();
  log(`Logged in as ${me.display_name} (${me.id}).`);
  writeJSON("me", me);

  log(`Getting all saved tracks…`);
  const tracks = await client.getAllSavedTracks();

  log(`Waiting for 1 second…`);
  await sleep(1000);

  let total = tracks.length;
  log(`Found ${total} saved tracks.`);

  log(`Writing full saved tracks data…`);
  let output: Record<string, unknown> = { total, tracks };
  writeJSON("tracks", output);

  log(`Simplifying saved tracks data…`);
  let simplifiedOutput: { total: number } & Record<string, unknown> = {
    total,
    tracks: tracks.map(simplifySavedTrack),
  };

  log(`Writing simplified saved tracks data…`);
  writeJSON("tracks_simplified", simplifiedOutput);

  log(`Getting all saved albums…`);
  const albums = await client.getAllSavedAlbums();

  log(`Waiting for 1 second…`);
  await sleep(1000);

  total = albums.length;
  log(`Found ${total} saved albums.`);

  log(`Writing full saved albums data…`);
  output = { total, albums };
  writeJSON("albums", output);

  log(`Simplifying saved albums data…`);
  simplifiedOutput = { total, albums: albums.map(simplifySavedAlbum) };

  log(`Writing simplified saved albums data…`);
  writeJSON("albums_simplified", simplifiedOutput);

  log(`Waiting for 1 second…`);
  await sleep(1000);

  log(`Getting all saved episodes…`);
  const episodes = await client.getAllSavedEpisodes();

  total = episodes.length;
  log(`Found ${total} saved episodes.`);

  log(`Writing saved episodes data…`);
  output = { total, episodes };
  writeJSON("episodes", output);

  log(`Waiting for 1 second…`);
  await sleep(1000);

  const timeRanges = ["short_term", "medium_term", "long_term"];
  for (const timeRange of timeRanges) {
    log(`Getting top artists and tracks for ${timeRange}…`);
    const promises = [
      client.getAllTopArtists({ time_range: timeRange }),
      client.getAllTopTracks({ time_range: timeRange }),
    ];
    const [artists, tracks] = await Promise.all(promises);

    total = artists.length;
    log(`Found ${total} top artists for ${timeRange}.`);

    log(`Writing top artists for ${timeRange} data…`);
    writeJSON(`top/artists/${timeRange}`, { total, artists });

    log(`Getting top tracks for ${timeRange}…`);
    total = tracks.length;
    log(`Found ${total} top tracks for ${timeRange}.`);

    log(`Writing top tracks for ${timeRange} data…`);
    writeJSON(`top/tracks/${timeRange}`, { total, tracks });

    log(`Waiting for 1 second…`);
    await sleep(1000);
  }

  log(`Getting all followed artists…`);
  const followedArtists = await client.getAllFollowing();

  total = followedArtists.length;
  log(`Found ${total} followed artists.`);

  log(`Writing followed artists data…`);
  output = { total, artists: followedArtists };
  writeJSON("following", output);

  log(`Waiting for 1 second…`);
  await sleep(1000);

  log(`Getting all playlists…`);
  let playlists = await client.getAllSavedPlaylists();
  total = playlists.length;
  log(`Found ${total} playlists.`);

  if (process.env.SPOTIFY_PUBLIC_PLAYLISTS_ONLY === "true") {
    playlists = playlists.filter((playlist) => playlist.public);
    total = playlists.length;
    log(`Will only write ${total} public playlists.`);
  }
  output = { total, playlists };

  log(`Writing playlists data…`);
  writeJSON("playlists", output);

  log(`Waiting for 1 second…`);
  await sleep(1000);

  let savedTracksPlaylist: SpotifyApi.PlaylistObjectSimplified | undefined;
  let savedTracksPlaylistFull:
    | Awaited<ReturnType<typeof client.getPlaylist>>
    | undefined;
  let playlistTrackUris = new Set<string>();
  const savedTrackUris = new Set<string>(
    tracks.map(({ track: { uri } }) => uri),
  );

  for (const playlist of playlists) {
    log(`Getting playlist ${playlist.name}…`);
    const playlistFull = await client.getPlaylist(playlist.id, {});

    if (
      playlist.name.toLowerCase() == "liked songs (mirror)" &&
      playlist.description?.toLowerCase().includes("spotify-to-github")
    ) {
      log(
        `Found ${playlist.name} playlist. Will use it to store saved tracks.`,
      );

      savedTracksPlaylist = playlist;
      savedTracksPlaylistFull = playlistFull;
      playlistTrackUris = new Set(
        savedTracksPlaylistFull.tracks
          .filter(({ track }) => !!track)
          .map(({ track }) => track?.uri as string),
      );
    } else {
      log(`Writing playlist ${playlist.name} to ${playlist.id}.json…`);
      writeJSON(`playlists/${playlist.id}`, playlistFull);
    }
    // Spotify's API rate limit is calculated in a rolling 30 second window.
    // Sleep for half a second between playlist requests to avoid hitting the
    // rate limit.
    log(`Waiting for 500 milliseconds…`);
    await sleep(500);
  }

  if (!savedTracksPlaylist) {
    log(`Saved tracks playlist not found. Creating a new playlist…`);
    savedTracksPlaylist = await client.createPlaylist({
      name: "Liked Songs (Mirror)",
      description:
        "Shareable Liked Songs playlist synchronised by spotify-to-github.",
    });
    const { name, uri } = savedTracksPlaylist;
    log(`Created playlist ${name} with uri: ${uri}.`);
  } else {
    const deletedTrackUris = difference(playlistTrackUris, savedTrackUris);
    if (deletedTrackUris.size) {
      log(
        `Deleting ${deletedTrackUris.size} tracks from saved tracks playlist…`,
      );
      await client.deletePlaylistTracks(savedTracksPlaylist, [
        ...deletedTrackUris,
      ]);
    } else {
      log(`No tracks to delete from saved tracks playlist.`);
    }
  }

  const addedTrackUris = difference(savedTrackUris, playlistTrackUris);
  if (addedTrackUris.size) {
    log(`Adding ${addedTrackUris.size} tracks to saved tracks playlist…`);
    await client.addPlaylistTracks(savedTracksPlaylist, [...addedTrackUris]);
  } else {
    log(`No tracks to add to saved tracks playlist.`);
  }

  log(`Writing saved tracks playlist to ${savedTracksPlaylistFull!.id}.json…`);
  writeJSON(
    `playlists/${savedTracksPlaylistFull!.id}`,
    savedTracksPlaylistFull!,
  );

  log(`Waiting for 1 second…`);
  await sleep(1000);

  log(`Getting all shows…`);
  const shows = await client.getAllSavedShows();
  total = shows.length;
  log(`Found ${total} shows.`);

  log(`Writing shows data…`);
  output = { total, shows };
  writeJSON("shows", output);

  log(`Waiting for 1 second…`);
  await sleep(1000);

  for (const savedShow of shows) {
    log(`Getting show ${savedShow.show.name}…`);
    await client.getShow(savedShow.show.id, {}).then((show) => {
      log(`Writing show ${show.name} to ${show.id}.json…`);
      writeJSON(`shows/${show.id}`, show);
    });
    // Spotify's API rate limit is calculated in a rolling 30 second window.
    // Sleep for half a second between show requests to avoid hitting the
    // rate limit.
    log(`Waiting for 500 milliseconds…`);
    await sleep(500);
  }

  log(`Done!`);
}

main();
