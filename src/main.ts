import { mkdir, writeFile } from "fs/promises";
import {
  createClient,
  simplifySavedAlbum,
  simplifySavedTrack,
} from "./spotify";

function log(message: string): void {
  console.log(`[${new Date().toISOString()}]: ${message}`);
}

async function writeJSON(name: string, data: Record<string, unknown>) {
  await mkdir("data", { recursive: true });
  writeFile(`data/${name}.json`, JSON.stringify(data), {});
}

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
    SPOTIFY_REFRESH_TOKEN
  );

  log(`Getting all saved tracks…`);
  const tracks = await client.getAllSavedTracks();

  let total = tracks.length;
  log(`Found ${total} saved tracks.`);

  log(`Writing full saved tracks data…`);
  let output: Record<string, unknown> = { total, tracks };
  writeJSON("saved_tracks", output);

  log(`Simplifying saved tracks data…`);
  let simplifiedOutput: { total: number } & Record<string, unknown> = {
    total,
    tracks: tracks.map(simplifySavedTrack),
  };

  log(`Writing simplified saved tracks data…`);
  writeJSON("saved_tracks_simplified", simplifiedOutput);

  log(`Getting all saved albums…`);
  const albums = await client.getAllSavedAlbums();

  total = albums.length;
  log(`Found ${total} saved albums.`);

  log(`Writing full saved albums data…`);
  output = { total, albums };
  writeJSON("saved_albums", output);

  log(`Simplifying saved albums data…`);
  simplifiedOutput = { total, albums: albums.map(simplifySavedAlbum) };

  log(`Writing simplified saved albums data…`);
  writeJSON("saved_albums_simplified", simplifiedOutput);

  log(`Getting all saved playlists…`);
  const playlists = await client.getAllSavedPlaylists();
  total = playlists.length;
  output = { total, playlists };

  log(`Writing full saved playlists data…`);
  writeJSON("saved_playlists", output);

  log(`Done!`);
}

main();
