# spotify-saved-tracks

Save your Spotify saved tracks into a GitHub repository, updated daily by GitHub
Actions.

To use this repository with your Spotify account, click on "Use this template"
and "Create a new repository". Then, go to the repository's "Settings >
Actions > General > Workflow permissions" and enable "Read and write
permissions". Finally, go to "Settings > Secrets and Variables > Actions" and
configure the following secrets:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REFRESH_TOKEN`

For more details on how to obtain those values, see
[Spotify Web API docs][spotify-api].

The workflow is run every day to update the data, but you can trigger it
[manually][manual-workflow] or by pushing a new commit to the repository. The
data can then be found inside the `data` directory on the `data` branch.

[spotify-api]: https://developer.spotify.com/documentation/web-api/
[manual-workflow]: https://docs.github.com/en/actions/managing-workflow-runs/manually-running-a-workflow
