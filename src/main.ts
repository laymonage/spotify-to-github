import { log, sleep, writeJSON } from "./functions";
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

  log(`Getting all saved tracks…`);
  const tracks = await client.getAllSavedTracks();

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

  total = albums.length;
  log(`Found ${total} saved albums.`);

  log(`Writing full saved albums data…`);
  output = { total, albums };
  writeJSON("albums", output);

  log(`Simplifying saved albums data…`);
  simplifiedOutput = { total, albums: albums.map(simplifySavedAlbum) };

  log(`Writing simplified saved albums data…`);
  writeJSON("albums_simplified", simplifiedOutput);

  log(`Getting all saved episodes…`);
  const episodes = await client.getAllSavedEpisodes();

  total = episodes.length;
  log(`Found ${total} saved episodes.`);

  log(`Writing saved episodes data…`);
  output = { total, episodes };
  writeJSON("episodes", output);

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
  }

  log(`Getting all followed artists…`);
  const followedArtists = await client.getAllFollowing();

  total = followedArtists.length;
  log(`Found ${total} followed artists.`);

  log(`Writing followed artists data…`);
  output = { total, artists: followedArtists };
  writeJSON("following", output);

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

  for (const playlist of playlists) {
    log(`Getting playlist ${playlist.name}…`);
    await client.getPlaylist(playlist.id, {}).then((playlist) => {
      log(`Writing playlist ${playlist.name} to ${playlist.id}.json…`);
      writeJSON(`playlists/${playlist.id}`, playlist);
    });
    // Spotify's API rate limit is calculated in a rolling 30 second window.
    // Sleep for half a second between playlist requests to avoid hitting the
    // rate limit.
    log(`Waiting for 500 milliseconds…`);
    await sleep(500);
  }

  log(`Getting all shows…`);
  const shows = await client.getAllSavedShows();
  total = shows.length;
  log(`Found ${total} shows.`);

  log(`Writing shows data…`);
  output = { total, shows };
  writeJSON("shows", output);

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
