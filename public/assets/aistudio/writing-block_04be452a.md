# LRCGlass — Complete Master Development Prompt for Gemini Pro

## 1. Your role and mission

You are Gemini Pro acting as a senior full-stack developer, software architect, database engineer, music API integration specialist, UI/UX designer, and animation engineer.

Your task is to inspect, improve, and complete **LRCGlass**, an advanced music discovery, artist, album, song, and synchronized lyrics platform.

LRCGlass should combine the immersive presentation of Apple Music with the functionality of a powerful lyrics platform inspired by LRC.red.

It should offer:

- Spotify-powered artist, album, and song search.
- Complete artist discography discovery.
- Complete album track listings.
- Automatic song and artist metadata.
- Artist profile pictures.
- Album cover artwork.
- Headliner-powered animated artist headers.
- Headliner-powered animated album artwork.
- Static artwork fallbacks.
- Artist logos.
- Automatic lyrics discovery.
- LRCGlass community-contributed lyrics.
- LRCLIB integration.
- LRC.red integration.
- Authorized Genius integration.
- TTML and LRC support.
- Apple Music-inspired synchronized lyrics.
- Word-level karaoke synchronization.
- A compact and efficient server-side database.
- A premium, responsive interface.

The final result should feel like a complete music application, not a generic lyrics-search website.

**Preserve the existing LRCGlass identity, architecture, components, routes, and working functionality. Do not unnecessarily rebuild the application.**

---

# 2. First: inspect the entire existing project

Before modifying anything, inspect the complete repository.

Inspect:

1. Full directory structure.
2. `package.json`.
3. Package lockfile.
4. Installed dependencies.
5. Next.js configuration.
6. Tailwind CSS configuration.
7. Application routes.
8. Frontend components.
9. Backend API routes.
10. Database models and migrations.
11. Authentication.
12. Existing music provider integrations.
13. Image and video retrieval.
14. Lyrics parsing and rendering.
15. Existing caching systems.
16. Environment variables.
17. Deployment configuration.
18. Existing tests.

Pay special attention to:

```text
Artists
Albums
Songs
Lyrics
Lyrics player
ArtistBackdrop
ArtistLogo
ArtistPlatformLinks
Search
Music metadata
Apple Music
Headliner
TTML parser
LRC parser
```

Understand how everything is connected.

Do not create duplicate components when existing functionality can be improved.

Produce a short project audit before making major changes.

---

# 3. Existing technology and environment

The project has previously used:

| Technology | Known configuration |
|---|---|
| Framework | Next.js |
| Known Next.js version | 16.4.2 |
| Bundler | Turbopack |
| Language | TypeScript |
| Frontend | React |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| Font | Nunito |
| Themes | Dark and light |
| Application | Full-stack web application |

Previously observed styling:

```css
@import 'tailwindcss';

@theme inline {
  /* Existing theme configuration */
}
```

Previously observed font variable:

```css
--font-nunito
```

Previously used colors:

```css
--background: #180b0f;
--foreground: #f5e8e2;
--accent: #e49c98;
```

The light theme has previously used:

```css
:root[data-theme='light']
```

Preserve this existing design system unless the current project has intentionally evolved.

Some previously used components and utilities include:

```text
ArtistBackdrop
ArtistLogo
ArtistPlatformLinks
EntityPage
artist-backdrop-math
```

Previously encountered functions include:

```text
blurFor
scrollProgress
shadeFor
videoOpacityFor
```

Inspect the actual current implementation before changing anything.

Do not downgrade Next.js or replace the stack unnecessarily.

---

# 4. Environment variables and configuration

Inspect every existing environment variable.

Search for:

```text
process.env
NEXT_PUBLIC_
.env
.env.local
.env.example
```

Document every variable that the actual project uses.

## Spotify environment variables

Use:

```env
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_MARKET=NL
```

Purpose:

| Variable | Purpose |
|---|---|
| `SPOTIFY_CLIENT_ID` | Spotify developer application ID |
| `SPOTIFY_CLIENT_SECRET` | Private Spotify application secret |
| `SPOTIFY_MARKET` | Default Spotify catalog market, initially NL |

Keep the secret completely server-side.

Never expose it through:

```text
NEXT_PUBLIC_
```

## Headliner environment variable

Use:

```env
HEADLINER_API_BASE_URL=https://headliner.nandoothjuuh.me
```

## Lyrics providers

Inspect which external lyrics providers require credentials.

Potential variables:

```env
GENIUS_ACCESS_TOKEN=
LRCLIB_APP_ID=
```

Only add these when required by the actual implementation.

LRCLIB does not require an API key for ordinary API access, but it expects client identification.

LRC.red also requires client identification and attribution.

## Environment requirements

Maintain:

```text
.env.example
```

Document:

- Variable name.
- Purpose.
- Required/optional status.
- Whether it is public or private.
- How to obtain it.
- Which integration uses it.
- What happens when it is missing.

Never overwrite `.env.local`.

Never display actual secrets in logs.

---

# 5. Spotify API — PRIMARY MUSIC CATALOG SOURCE

This is one of the most important parts of LRCGlass.

**Spotify must become the primary source for discovering and searching artists, albums, and songs.**

Do not use Apple Music as the primary search catalog.

Apple Music and other services can remain useful for specific additional assets and external links, but Spotify should be the primary metadata discovery system.

Official documentation:

https://developer.spotify.com/documentation/web-api

## 5.1 Spotify authentication

Use Spotify's official Web API.

For server-side catalog lookups, investigate the OAuth 2.0 Client Credentials Flow.

Token endpoint:

```http
POST https://accounts.spotify.com/api/token
```

Body:

```text
grant_type=client_credentials
```

Use the application client ID and secret as required by Spotify's documentation.

Implementation requirements:

- Authenticate on the server.
- Cache the access token.
- Respect its expiration.
- Refresh before expiration.
- Avoid requesting a new token for every search.
- Never expose the client secret.
- Handle authentication failures.
- Handle rate limits.
- Handle unavailable credentials.

This application does not need to ask every LRCGlass visitor to log in to Spotify merely to search the public music catalog.

Use user authorization only if a future feature actually requires personal Spotify account information.

**Important current Spotify restrictions:** Check the app's developer dashboard and current Web API requirements before implementing. Development Mode apps have restrictions, including an active Premium requirement for their owner and a five-user limit for new apps under the February 2026 rules. Determine whether LRCGlass needs Extended Quota Mode for its intended audience. Never attempt to bypass Spotify's restrictions.

## 5.2 Spotify unified search

Use the official search endpoint:

```http
GET https://api.spotify.com/v1/search
```

Parameters:

```text
q={search_query}
type=track,album,artist
market=NL
limit=10
offset=0
```

For example:

```http
GET https://api.spotify.com/v1/search?q=alex%20warren&type=track,album,artist&market=NL&limit=10
```

Support searches for:

- Artists.
- Albums.
- Songs.

Implement search tabs:

```text
All
Songs
Albums
Artists
```

The All tab should show relevant results from all three categories.

Use the Spotify API's supported pagination and search limits.

Do not assume the API always returns the same results or that a specific artist is always the first result.

## 5.3 Search result appearance

When searching for a song, the results must immediately show real music artwork and artist information.

Each song search result should contain:

1. Album cover.
2. Artist profile picture.
3. Song title.
4. Artist name.
5. Album name.
6. Duration.
7. Release information, when available.
8. Explicit-content indication when provided.
9. Spotify link.

Example layout:

```text
[Album Cover] [Artist Picture]

Song Title
Artist Name
Album Name

3:24                         Spotify ↗
```

Use the album image returned in Spotify's track result.

Spotify's track search results provide album artwork, but their simplified artist entries do not contain the full artist profile images.

Therefore, retrieve the artist profile using:

```http
GET https://api.spotify.com/v1/artists/{artist_id}
```

Read the artist's `images` array.

Use the highest suitable resolution.

For efficiency:

- Retrieve each unique artist profile once per search batch.
- Avoid repeating requests for artists that are already in the current short-lived cache.
- Use controlled concurrency.
- Handle image loading independently from song metadata.
- Show artwork as soon as it becomes available.
- Never display broken images.

For tracks with multiple credited artists, display the primary artist picture and all relevant artist names.

Do not invent images or information.

## 5.4 Artist image

Spotify's artist endpoint:

```http
GET /v1/artists/{id}
```

Use the returned information to display:

- Artist name.
- Artist profile picture.
- Spotify URL.
- Genres when available.
- Spotify ID.
- Other relevant metadata.

Remember that Spotify profile images can be missing.

When missing, use the existing LRCGlass artist image fallback system.

## 5.5 Album search

Spotify album results should show:

- Album cover.
- Album title.
- Primary artist.
- Release date.
- Album type.
- Track count.
- Spotify link.

When a user opens an album, retrieve the full album information and all its tracks.

Use:

```http
GET /v1/albums/{album_id}
```

Then retrieve the track listing:

```http
GET /v1/albums/{album_id}/tracks
```

Handle pagination until all available tracks have been retrieved.

Display:

- Track number.
- Song title.
- Artist.
- Duration.
- Explicit status.
- Lyrics availability when determined.

Clicking a song should open the appropriate LRCGlass song page or lyrics player.

## 5.6 Artist search and automatic discography discovery

This feature is especially important.

When a user searches for an artist and selects the correct artist, LRCGlass must automatically create or open the artist page and discover the artist's available discography.

Do not merely show the artist's profile picture and a few popular songs.

Retrieve the artist's albums using:

```http
GET /v1/artists/{artist_id}/albums
```

Use the appropriate `include_groups` values:

```text
album,single,appears_on,compilation
```

Retrieve every available page.

Then retrieve the tracks connected to each album using:

```http
GET /v1/albums/{album_id}/tracks
```

Continue following pagination until the complete available result set has been processed.

This should discover:

- Studio albums.
- Singles.
- EP releases.
- Collaborations.
- Featured appearances.
- Compilation appearances where available.

Deduplicate the resulting track list by Spotify track ID.

Do not show the same song repeatedly simply because it appears on multiple releases.

Distinguish primary artist credits from featured appearances.

The artist page should contain:

### Artist header

- Artist name.
- Artist picture.
- Animated header from Headliner when available.
- Static fallback when unavailable.
- Artist logo when available.

### Discography

- Popular songs, when available.
- Albums.
- Singles.
- EPs.
- Collaborations.
- Featured appearances.
- Complete available track collection.

### Additional artist information

- Genres.
- Biography from an appropriate source, when available.
- External platform links.
- Related artists, when supported.

**Important:** Only describe this as the complete Spotify-available catalog. Spotify's results can be market-dependent and may not include every recording the artist has ever released.

Do not falsely claim that the catalog is globally exhaustive.

## 5.7 Artist page loading

Artists can have hundreds or thousands of associated tracks.

Do not make the visitor wait for every API request before displaying the artist page.

Instead:

1. Retrieve the artist profile.
2. Immediately render the artist hero.
3. Retrieve the first available albums.
4. Start retrieving the tracks.
5. Render completed sections progressively.
6. Continue processing the remaining albums.
7. Start lyrics discovery for tracks in controlled batches.
8. Update the page as additional information becomes available.

Display appropriate loading states.

Do not reload the entire page whenever a new album or track is discovered.

Use a queue or background processing system if the existing infrastructure supports it.

Handle interrupted jobs and retry safely.

## 5.8 Spotify API pagination and rate limits

Handle:

- Pagination.
- `next` URLs.
- `429 Too Many Requests`.
- `Retry-After`.
- Expired access tokens.
- `401 Unauthorized`.
- `403 Forbidden`.
- Market restrictions.
- Missing resources.
- Provider downtime.

Use bounded concurrency.

Do not fire hundreds of API requests simultaneously.

Also inspect Spotify's current API documentation for changes to batch endpoints. Do not rely on deprecated bulk endpoints.

In particular, newer Development Mode restrictions removed several multi-item batch endpoints. Use supported individual endpoints where necessary.

## 5.9 Spotify attribution and content rules

This is mandatory.

Whenever Spotify metadata or artwork is displayed:

- Attribute Spotify as required.
- Include links back to the applicable Spotify track, album, or artist.
- Follow Spotify Branding Guidelines.
- Keep artwork in its original form.
- Do not crop, recolor, overlay logos on, or otherwise modify Spotify artwork.
- Do not use Spotify's data to train AI models.
- Do not offer Spotify metadata or cover art as a standalone product.
- Do not store Spotify content indefinitely.
- Do not create an unrestricted permanent copy of the Spotify catalog.

Use temporary caching only where permitted and necessary.

Review Spotify's current Developer Terms and Policy before implementing persistent catalog behavior.

---

# 6. Compact song database storage

I want LRCGlass to save searched songs in the server-side database using a very small data representation.

The purpose is to keep the database efficient while making it possible to retrieve the song again.

**Do not save entire Spotify API responses in the database.**

Use compact identifiers.

For example:

```text
sp:t:4iV5W9uYEdYUVa79Axb7Rh
```

This represents:

```text
sp = Spotify
t  = Track
id = Spotify Track ID
```

Use similar identifiers:

```text
sp:a:{spotify_album_id}
sp:ar:{spotify_artist_id}
```

The actual IDs must come from Spotify.

Do not generate fake identifiers.

## Database representation

Use a minimal reference structure similar to:

```json
{
  "code": "sp:t:4iV5W9uYEdYUVa79Axb7Rh",
  "provider": "spotify",
  "type": "track",
  "providerId": "4iV5W9uYEdYUVa79Axb7Rh"
}
```

This is an example of the compact reference representation, not a requirement to store that exact JSON format.

Prefer a concise indexed database representation.

Requirements:

- Unique provider and item identifiers.
- No duplicate song records.
- Efficient lookup.
- Minimal storage.
- No complete raw API responses.
- No permanently stored Spotify artwork URLs or full metadata snapshots unless explicitly permitted.
- Temporary metadata caching with an appropriate expiration policy.
- Automatic cleanup of expired cached provider data.

When a valid search result is presented or selected, upsert its compact reference into the server database.

Do not insert a new record for every keystroke or repeat an existing record unnecessarily.

When an entity is opened again, use its compact reference to retrieve the current metadata from Spotify.

**Important:** Saving the compact reference is not permission to create a permanent Spotify catalog database. Keep all persisted external data within Spotify's current terms. If a particular field cannot legally be retained, do not retain it.

## Database relationships

The existing database should efficiently associate:

```text
Artist
  ├── Albums
  │     └── Tracks
  └── Tracks

Track
  ├── Primary artist
  ├── Featured artists
  ├── Album
  ├── Lyrics contributions
  ├── External lyrics references
  └── Artwork references
```

Use proper unique constraints and relationship tables where needed.

Store LRCGlass-owned contributions separately from Spotify metadata.

The database should be designed so user-submitted lyrics remain available even if an external music provider changes its response.

---

# 7. Automatic lyrics discovery — MOST IMPORTANT

Every discovered song must have its lyrics availability checked.

This applies to:

- Individual song searches.
- Tracks inside an album.
- Tracks inside an artist's discography.
- Tracks opened directly by URL.

**The number one lyrics priority is always lyrics contributed by LRCGlass users.**

The priority must be:

<badge color="success">#1 priority</badge>

**LRCGlass community-contributed lyrics**

Then:

2. LRCLIB.
3. LRC.red.
4. Genius, only where actual lyrics retrieval is legally authorized and supported.

The system should search available providers intelligently and select the best verified lyrics version.

## 7.1 First priority: LRCGlass user contributions

Before contacting an external lyrics provider, check the LRCGlass database.

Look for existing lyrics associated with the correct song.

A published LRCGlass contribution always takes priority over externally retrieved lyrics.

Use the contributed version even when another external provider has a different version.

For each contribution, maintain:

- Contributor.
- Track reference.
- Lyrics format.
- Lyrics content.
- Language.
- Synchronization information.
- Creation date.
- Last modified date.
- Publication or moderation status.
- Version history.
- Relevant credits.

Supported contributions should include:

- Plain text.
- LRC.
- Enhanced LRC.
- TTML.
- Other properly supported formats.

When multiple community contributions exist:

- Prefer published contributions.
- Use appropriate moderation and verification.
- Keep version history.
- Identify the contributor.
- Avoid duplicate submissions.
- Allow corrections.
- Preserve the original contribution when creating a revision.

Do not overwrite good lyrics simply because a new submission exists.

## 7.2 Second priority: LRCLIB

API documentation:

https://lrclib.net/docs

Base URL:

```text
https://lrclib.net
```

LRCLIB supports:

- Plain lyrics.
- Synchronized LRC lyrics.
- Lyricsfile YAML.
- Word-level timing where available.

First use the track signature endpoint:

```http
GET /api/get
```

Parameters:

```text
track_name
artist_name
album_name
duration
```

Example:

```http
GET https://lrclib.net/api/get?track_name=Ordinary&artist_name=Alex%20Warren&album_name=You%20Will%20Be%20Alright%20Kid&duration=170
```

The actual query values must come from the Spotify track metadata.

Providing the actual track duration is particularly important. LRCLIB uses duration matching, with a documented tolerance of approximately two seconds.

If the direct lookup fails, use:

```http
GET /api/search
```

With:

```text
track_name
artist_name
album_name
```

Do not select the first returned result blindly.

Check:

- Track name.
- Main artist.
- Featured artists.
- Album.
- Duration.
- Version.
- Other available identifiers.

### LRCLIB response formats

Check these fields:

```text
plainLyrics
syncedLyrics
lyricsfile
hasWordSync
instrumental
```

Preference within LRCLIB:

1. Word-synchronized Lyricsfile.
2. Synchronized LRC.
3. Plain lyrics.

Preserve the original format when passing lyrics into the LRCGlass normalizer.

### LRCLIB identification

Use an appropriate descriptive `User-Agent` containing the LRCGlass application name, version, and actual project homepage or contact information.

Respect rate limits.

If LRCLIB returns:

```text
429 Too Many Requests
```

Respect the `Retry-After` header.

Do not retry continuously.

No API key is required for normal LRCLIB API access.

## 7.3 Third priority: LRC.red

API documentation:

https://lrc.red/api

LRC.red is particularly useful for synchronized lyrics and TTML.

Use:

```http
GET https://lrc.red/search.json?q={query}
```

Search with the song title and artist.

Where available, use the returned ISRC to retrieve the specific track record:

```http
GET https://lrc.red/s/{ISRC}.json
```

An example of an ISRC-based endpoint:

```http
GET https://lrc.red/s/GBAYE9200070.json
```

Inspect the response for:

```text
isrc
title
artist
featured
album
released
duration
language
songwriters
sync
lines
page
files
cover
```

The API provides lyric file references such as:

```text
files.ttml
files.lrc
files.lyricsfile
```

Retrieve the actual files when appropriate.

### LRC.red priority

When a matching LRCGlass contribution is unavailable, prioritize higher-quality external synchronization:

1. Word/syllable-synchronized TTML.
2. Word-level Lyricsfile where available.
3. Synchronized LRC.
4. Plain lyrics.

Do not assume that every result contains all formats.

Check the available file properties.

### LRC.red attribution

LRC.red requires:

- Appropriate client identification through `User-Agent` or `X-Client-ID`.
- Clear attribution.
- A visible link back to LRC.red wherever its data is displayed.

Include the appropriate attribution in the lyrics interface.

Do not omit this requirement.

## 7.4 Fourth priority: Genius

Genius can be used as an additional discovery source.

Official developer API:

```text
https://api.genius.com
```

Use an appropriate access token:

```env
GENIUS_ACCESS_TOKEN=
```

Investigate its official API and available song-search functionality.

Important distinction:

The Genius developer API can provide song and artist discovery information, but do not assume that its ordinary API responses provide reusable full lyric text.

**Do not scrape Genius song pages to extract lyrics.**

Do not use an unofficial scraping workaround.

Only retrieve and display Genius lyrics when a supported, licensed, explicitly authorized method actually provides them.

Otherwise:

- Use Genius for song identification.
- Provide a link to the relevant Genius page when appropriate.
- Continue looking for lyrics through LRCLIB and LRC.red.

Respect Genius's terms and lyric licensing requirements.

---

# 8. Lyrics matching and quality verification

Never associate lyrics with a song based only on a similar title.

Match the track using:

1. Known LRCGlass track reference.
2. Exact ISRC, where available.
3. Spotify track identifier mapping, if already established.
4. Exact normalized title.
5. Main artist.
6. Featured artists.
7. Album.
8. Duration.
9. Recording/version information.

Distinguish:

- Original tracks.
- Remixes.
- Live recordings.
- Acoustic versions.
- Radio edits.
- Clean versions.
- Explicit versions.
- Remasters.
- Different album releases.

Do not show lyrics from a different recording simply because the title matches.

If the match is uncertain, continue searching or display an honest unavailable state.

## Lyrics result selection

When multiple valid sources are found, select the best valid version based on:

- Correct track matching.
- Source reliability.
- Synchronization quality.
- Word-level timing availability.
- Language.
- Format support.
- Validity of the actual file.

LRCGlass contributions always override these external ranking rules.

Do not silently combine lyrics from multiple sources into a fabricated version.

Preserve the original source information.

---

# 9. Lyrics presentation and contribution interface

When a song page loads:

1. Retrieve its track information.
2. Check the LRCGlass lyrics database first.
3. Search supported external lyrics providers if no suitable LRCGlass contribution exists.
4. Validate the result.
5. Normalize its format.
6. Display the lyrics.
7. Display the correct source and contributor information.

When lyrics are available:

- Show the lyrics.
- Show whether they are synchronized.
- Show the source.
- Show contributor credits where appropriate.
- Allow users to submit corrections or improved versions according to the contribution system.

When no lyrics are available:

Show a clean empty state.

For example:

```text
Lyrics are not available yet.

Be the first to contribute!
```

Provide a functional:

```text
Contribute Lyrics
```

button.

Allow users to submit:

- Plain lyrics.
- LRC files.
- Enhanced LRC.
- TTML files.

Validate all uploads.

Never silently publish malicious files or malformed timing data.

Use the existing LRCGlass authentication and contribution architecture where available.

The contribution system must be connected to the real database.

Do not build decorative contribution buttons.

---

# 10. Lyrics caching and server-side processing

Lyrics retrieval should be efficient.

Maintain a compact internal state for each track's lyric lookup.

For example:

```text
not_checked
searching
community_found
external_found
not_found
error
```

Do not repeatedly query every provider when the same track has already been checked recently.

Cache lookup results and source references where permitted.

Store LRCGlass user-submitted lyrics persistently.

Only retain third-party lyrics content according to the applicable provider's permissions and terms.

Where persistent storage is not permitted, use an appropriate temporary retrieval/cache strategy.

Use a background queue for artist discography lyric discovery.

Priority:

1. Visible tracks.
2. Popular tracks.
3. Newly requested tracks.
4. Remaining discography tracks.

Process requests in controlled batches.

Avoid sending hundreds of external lyrics requests simultaneously.

Update the artist and album pages as information becomes available.

---

# 11. Headliner API — ANIMATED ARTIST AND ALBUM ARTWORK

Headliner must be the primary source for animated Apple Music headers and animated album covers.

API documentation:

https://headliner.nandoothjuuh.me/docs

Base URL:

```text
https://headliner.nandoothjuuh.me
```

Configuration:

```env
HEADLINER_API_BASE_URL=https://headliner.nandoothjuuh.me
```

Do not unnecessarily rebuild Headliner's extraction functionality inside LRCGlass.

## 11.1 Artist search

Use:

```http
GET /api/v1/artists/search?q={artist_name}
```

Example:

```http
GET https://headliner.nandoothjuuh.me/api/v1/artists/search?q=alex%20warren
```

Use the result to resolve the correct Apple Music artist.

Check:

- Artist name.
- Artist ID.
- Artist URL.
- Spotify artist identity.
- Other available matching information.

Avoid matching unrelated artists with similar names.

## 11.2 Artist extraction

Use:

```http
GET /api/v1/extract/artist?url={encoded_apple_music_artist_url}
```

The extraction response can include:

```text
headerVideo
headerVideoMp4
variants[]
ratioCheck
```

Inspect the complete response schema for other properties, including artist logo information and static artwork.

Do not invent property names.

### Artist header priority

1. Recommended Headliner `headerVideo`.
2. Highest-quality suitable 16:9 variant.
3. Valid MP4 fallback.
4. Suitable alternative video variant.
5. Static image.
6. Other verified artist image.
7. Automatic high-resolution image-search fallback.

Prefer the highest-quality valid 16:9 version.

## 11.3 Album search

Use:

```http
GET /api/v1/albums/search?q={album_name}
```

Resolve the correct Apple Music album.

Check:

- Album title.
- Artist.
- Apple Music album ID.
- Release date.
- Album version.
- Other available metadata.

## 11.4 Album extraction

Use:

```http
GET /api/v1/extract/album?url={encoded_apple_music_album_url}
```

Retrieve the available animated album artwork.

Supported output can include:

- Animated MP4.
- Animated HLS.
- Static artwork fallback.

Priority:

1. Valid animated MP4/HLS.
2. Appropriate alternative animated variant.
3. Headliner's static artwork fallback.
4. Verified Spotify album cover.

Album covers must retain their square aspect ratio.

Do not apply the artist header's 16:9 requirements to album covers.

## 11.5 Headliner media proxy

Use:

```http
GET /api/media?url={encoded_apple_media_url}
```

This can proxy media and rewrite HLS playlists.

Use it when necessary to make Apple-hosted video playback more reliable.

Do not proxy every ordinary image unnecessarily.

Validate input URLs and avoid creating an unrestricted public URL proxy.

## 11.6 Health and status

Available endpoints:

```http
GET /api/v1/health
GET /api/v1/status
```

Use for diagnostics where appropriate.

## 11.7 Download

Available endpoint:

```http
GET /api/download?url={media_url}&name={name}&label={resolution}
```

Only implement this if LRCGlass genuinely needs media-download functionality.

It is not needed for ordinary animated header playback.

## 11.8 Headliner reliability

Handle:

- Invalid Apple Music URLs.
- Artist name mismatches.
- Missing videos.
- Invalid video variants.
- API errors.
- Timeouts.
- HLS errors.
- MP4 errors.
- Missing static artwork.
- Expired media URLs.

Do not consider an asset valid merely because its URL is present.

Actually test loading and playback.

---

# 12. Automatic static artist image fallback

When no suitable Headliner animated artist header is found, LRCGlass must display a static artist image.

Fallback order:

1. Static artist artwork returned by Headliner.
2. Spotify artist profile picture.
3. Another verified music-provider artist image.
4. A verified high-resolution image-search result.
5. Clean fallback presentation.

The selected image should show the correct artist.

## Image search

Use a reliable image-search API.

Google Images is preferred where a compliant integration is available.

Do not scrape Google's search-result HTML.

Target:

- Minimum 1920 × 1080.
- Approximately 16:9.
- High resolution.
- Correct artist identity.
- No watermarks.
- Appropriate wide composition.

Validate the actual image file and dimensions.

Do not stretch portrait photographs into 16:9.

Do not select random images merely because they match the dimensions.

Store appropriate image source and attribution information.

## User feedback

For fallback images, include:

- Like.
- Dislike.

Like:

- Record positive feedback.
- Associate the image with the artist.
- Improve future image selection.

Dislike:

- Record negative feedback.
- Avoid repeatedly recommending the same image.
- Prefer alternative search results.

Persist feedback.

Use the real database, not local-only visual state.

---

# 13. Artist pages and dynamic visual backgrounds

Artist pages should be immersive and Apple Music-inspired.

Preserve the existing LRCGlass design.

## Hero

Display:

- Animated background from Headliner where available.
- Static fallback otherwise.
- Artist logo where available.
- Artist name as a fallback heading.
- Relevant artist information.

## Dynamic background colors

The artist page should adapt its background to the lower region of the header artwork.

Do not extract an arbitrary average color from the entire video.

Sample the lower area when technically possible.

For video:

- Sample representative frames.
- Handle CORS.
- Cache results.
- Avoid excessive processing.
- Avoid flickering.
- Smoothly transition colors.
- Fall back to static artwork sampling.

Do not modify Spotify-owned visual assets or turn them into derivative artwork.

Use Headliner artwork or other appropriately usable media for the artist hero and its color extraction.

## Scroll transitions

When scrolling:

- Blur the video progressively.
- Darken it.
- Fade its opacity.
- Transition into the page content.
- Avoid layout shifts.
- Keep scrolling smooth.

Reuse existing functions where appropriate:

```text
blurFor
scrollProgress
shadeFor
videoOpacityFor
```

## Artist sections

Display:

- Popular tracks.
- Complete available discography.
- Albums.
- Singles.
- EPs.
- Collaborations.
- Featured appearances.
- Related artists.
- External platform links.

Use real Spotify track and album discovery, combined with the existing artwork system.

---

# 14. Album pages and album artwork

Album pages should combine Spotify's real metadata with Headliner's animated artwork.

Display:

- Album title.
- Artist.
- Album cover.
- Animated artwork when available.
- Release date.
- Album type.
- Track count.
- Complete track listing.
- Song durations.
- Explicit indicators when provided.
- Lyrics availability.
- External platform links.

Ensure each album links to the correct artist.

Ensure each song links to the correct album.

Use the correct version of the album.

Avoid duplicate tracks and incorrect album relationships.

---

# 15. Songs and music player

Song pages should combine Spotify's song information with lyrics from the available providers.

Display:

- Song title.
- Artist.
- Featured artists.
- Album artwork.
- Animated artwork where available.
- Album name.
- Duration.
- Release information.
- Lyrics.
- Lyrics source.
- Contributor information.
- External streaming links.

The music player should support:

- Play and pause.
- Playback progress.
- Duration.
- Seeking.
- Album artwork.
- Song information.
- Lyrics synchronization.
- Word-level timing when available.

Do not pretend Spotify catalog API access grants audio-streaming rights.

Do not download or stream-rip Spotify audio.

Only enable playback through an explicitly supported and authorized audio source.

Use one authoritative playback clock for lyrics synchronization.

---

# 16. Lyrics engine: LRC and TTML

LRCGlass must properly support:

- Standard LRC.
- Enhanced LRC.
- TTML.
- Word-level timings.
- Syllable-level timings where provided.
- Instrumental pauses.
- Plain lyrics.

Previously encountered TTML error:

```text
Relative parent timing and sequential TTML containers are not supported
```

Fix this correctly.

Implement:

- Relative parent timing.
- Nested elements.
- `par` containers.
- `seq` containers.
- Inherited timing.
- `begin`.
- `end`.
- `dur`.
- Sequential child calculations.
- Parallel timing.
- Word-level timing.
- Line-level timing.
- Frame-based timing where applicable.
- Tick-based timing where applicable.
- Correct namespace handling.

Calculate actual absolute playback times from the document hierarchy.

Do not flatten complex TTML documents incorrectly.

Use a normalized timeline format for all sources.

Include tests with nested parallel and sequential TTML documents.

Preserve the original source format and metadata where possible.

---

# 17. Apple Music-inspired lyrics visual design

This is one of the most important visual features.

The lyrics interface should feel similar in quality to Apple's synchronized lyrics.

It must not be an ordinary karaoke interface.

## Typography and active lyrics

Use:

- Large typography.
- Smooth fading.
- Dynamic lighting.
- Subtle glow.
- Balanced spacing.
- Clear active-line emphasis.
- Smooth automatic scrolling.

## Word synchronization

When word timestamps exist:

- Highlight individual words accurately.
- Follow the playback clock.
- Avoid timing jitter.
- Keep text positions stable.

**Normal lyrics must not be pushed out of position when a word starts playing.**

The highlight must progress over the existing text.

## Wave effects

Only animate long, sustained words.

Do not animate every word.

The wave should:

- Follow actual word duration.
- Progress naturally.
- Use restrained lighting.
- Have a subtle glow.
- Avoid abrupt resets.

Short words should receive ordinary synchronized highlighting.

## Spacing

Prevent animated words from colliding with their neighbors.

Keep the line readable.

Avoid layout shifts and horizontal jumps.

## Instrumental dots

Display instrumental pause dots like normal lyrics lines.

Give them:

- Proper alignment.
- Correct line spacing.
- Synchronization.
- Appropriate fading.
- Glow and wave effects when applicable.

## Scrolling

The active lyric line should remain naturally positioned.

Avoid jumping, flickering, and unnecessary scroll events.

---

# 18. Search interface and user experience

Implement a polished unified search interface.

A query should be able to discover:

- Songs.
- Artists.
- Albums.

Use a clean visual distinction between result types.

For song results, always prioritize:

- Album cover.
- Artist profile photo.
- Title.
- Artist.
- Album.
- Duration.

For album results:

- Album cover.
- Album title.
- Artist.
- Release date.
- Track count.

For artist results:

- Profile picture.
- Artist name.
- Genres where available.

Clicking a result should take the visitor to the relevant LRCGlass entity page.

Use correct and stable entity references.

Avoid duplicate search requests and implement debouncing.

Include proper loading, empty, and error states.

---

# 19. Backend and database architecture

Inspect the existing database first.

Do not replace it without a compelling reason.

Keep a clean separation between:

**External catalog references**

- Spotify IDs.
- Apple Music IDs.
- Provider URLs.
- Compact entity codes.
- Temporary provider metadata.

**LRCGlass-owned information**

- User contributions.
- User feedback.
- Submission history.
- Moderation status.
- Lyrics versions.
- Application-specific relationships.
- User preferences.

Avoid permanently storing external provider catalog data without permission.

The compact Spotify reference should be enough to look up the current metadata again.

Use unique indexes.

Prevent duplicates.

Make database writes idempotent.

Provide migrations for any structural changes.

---

# 20. Performance and reliability

The application must remain fast even when an artist has a very large discography.

Prioritize:

- Server-side API calls.
- Token caching.
- Temporary catalog caching.
- Efficient database queries.
- Progressive artist page rendering.
- Paginated discovery.
- Controlled concurrent requests.
- Background lyrics retrieval.
- Image lazy loading.
- Video resource cleanup.
- Proper caching.
- Retry handling.
- Memory cleanup.

Avoid:

- Hundreds of simultaneous provider requests.
- Unnecessary full-page reloads.
- Repeated Spotify authentication.
- Repeated lyrics searches.
- Sampling video frames continuously.
- Unnecessary React renders.
- Persisting external data indefinitely.
- Excessive network traffic.

Implement appropriate exponential backoff and respect `Retry-After` headers.

---

# 21. No placeholders or fake functionality

This is mandatory.

Never use:

- Fake Spotify search results.
- Fake artists.
- Fake songs.
- Fake albums.
- Fake lyrics.
- Fake artist pictures.
- Placeholder album covers in production.
- Random fallback images.
- Fake contributions.
- Fake API responses.
- Nonfunctional buttons.

Everything must use actual connected backend data.

If a provider does not return information, show an honest empty state.

If lyrics cannot be found:

```text
Lyrics are not available yet.
Be the first to contribute!
```

If animated artwork cannot be found, display the appropriate static image.

Never pretend an unavailable feature is working.

---

# 22. Implementation order

Work through these phases.

## Phase 1 — Full project audit

Inspect the repository, architecture, dependencies, environment, database, existing components, and integrations.

## Phase 2 — Spotify authentication and search

Implement:

- Spotify server-side authentication.
- Token caching.
- Unified search.
- Artist search.
- Album search.
- Track search.
- Profile picture retrieval.
- Album artwork retrieval.
- Spotify attribution.
- Compact database references.
- Search pagination.
- Error handling.

Test all three search categories.

## Phase 3 — Complete discography system

Implement:

- Artist album discovery.
- Artist singles.
- EPs.
- Featured appearances.
- Full album track listings.
- Pagination.
- Track deduplication.
- Progressive page rendering.

## Phase 4 — Headliner integration

Implement:

- Artist search.
- Artist extraction.
- Animated artist headers.
- Artist logos.
- Album search.
- Album extraction.
- Animated album covers.
- HLS/MP4 playback.
- Static fallbacks.
- Media proxy support.

## Phase 5 — Database and entity relationships

Implement:

- Compact catalog references.
- Artist/album/song relationships.
- Database uniqueness.
- LRCGlass contribution relationships.
- Caching.
- Expiration.
- Cleanup.

## Phase 6 — Lyrics discovery

Implement:

1. LRCGlass contribution lookup.
2. LRCLIB.
3. LRC.red.
4. Authorized Genius discovery.
5. Lyrics matching.
6. Format selection.
7. Contribution interface.
8. Source attribution.
9. Background processing.

## Phase 7 — Lyrics engine and player

Implement:

- LRC improvements.
- TTML improvements.
- Nested timing.
- Word-level synchronization.
- Sustained-word animation.
- Dynamic glow.
- Instrumental dots.
- Stable word positioning.
- Smooth scrolling.

## Phase 8 — Quality assurance

Test real APIs and real tracks.

Verify that the application does not use fake results.

Run:

```bash
npm run dev
npm run lint
npx tsc --noEmit
npm run build
```

Only run commands that actually exist or have been appropriately configured.

---

# 23. Acceptance criteria

## Spotify search

- [ ] Search finds real artists.
- [ ] Search finds real albums.
- [ ] Search finds real songs.
- [ ] Song results show the correct album cover.
- [ ] Song results show the correct artist profile picture.
- [ ] Album results show the correct cover.
- [ ] Artist results show the correct profile picture.
- [ ] Clicking results opens the correct LRCGlass page.
- [ ] Spotify links and attribution are present.
- [ ] API limits and errors are handled.

## Artist discography

- [ ] Searching for an artist opens the correct artist page.
- [ ] Artist albums are retrieved.
- [ ] Singles are retrieved.
- [ ] EPs are retrieved.
- [ ] Featured appearances are retrieved.
- [ ] Album tracks are retrieved.
- [ ] Pagination works.
- [ ] Duplicate songs are removed.
- [ ] Songs are linked to the right album and artists.
- [ ] Lyrics discovery starts for the tracks.

## Compact database

- [ ] Searched items receive compact references.
- [ ] Duplicate records are prevented.
- [ ] Full Spotify API responses are not stored.
- [ ] Temporary metadata caches expire.
- [ ] Provider references can be resolved again.
- [ ] LRCGlass contributions remain independently stored.

## Lyrics

- [ ] User-contributed lyrics take absolute priority.
- [ ] LRCLIB lookup works.
- [ ] LRC.red lookup works.
- [ ] TTML and LRC files are retrieved where available.
- [ ] Genius is used only through authorized functionality.
- [ ] Lyrics matching is accurate.
- [ ] Correct source attribution is shown.
- [ ] Missing lyrics show a contribution option.
- [ ] Contributions are persisted.
- [ ] Existing contributions are not overwritten accidentally.

## Artwork

- [ ] Headliner animated artist headers load.
- [ ] Headliner animated album artwork loads.
- [ ] Static artist image fallback works.
- [ ] Static album cover fallback works.
- [ ] Logos load.
- [ ] Artist backgrounds adapt to artwork colors.
- [ ] Scroll transitions work.
- [ ] No broken media elements remain.

## Lyrics player

- [ ] LRC works.
- [ ] Enhanced LRC works.
- [ ] TTML works.
- [ ] Sequential and parallel timing works.
- [ ] Word highlighting works.
- [ ] Sustained-word animations work.
- [ ] Short words are not unnecessarily animated.
- [ ] Normal lyric positions remain stable.
- [ ] Neighboring words do not overlap.
- [ ] Instrumental dots work.
- [ ] Scrolling is smooth.

## Application quality

- [ ] Dark theme works.
- [ ] Light theme works.
- [ ] Desktop layout works.
- [ ] Mobile layout works.
- [ ] Reduced motion is supported.
- [ ] Environment variables are documented.
- [ ] No missing dependencies.
- [ ] No unresolved imports.
- [ ] Production build succeeds.
- [ ] No fake production data.

---

# 24. Code delivery requirements

I prefer complete updated files, not partial snippets.

Whenever you edit a file:

1. Read the original file.
2. Understand its dependencies.
3. Understand where it is used.
4. Make the changes.
5. Preserve existing functionality.
6. Verify TypeScript.
7. Verify imports.
8. Test related components.

**ALWAYS PROVIDE COMPLETE UPDATED FILES, NOT SNIPPETS.**

Never write:

```tsx
// Existing code stays here
```

Never omit imports, types, exports, or required functions.

Always provide the exact file path.

When you have direct project workspace access, make the changes directly and report what changed.

When multiple files need modifications, provide every complete updated file whenever practical.

Never silently truncate a file.

---

# 25. Final reporting

After implementation, report:

### Project audit

What you inspected and how the current architecture works.

### Spotify implementation

Which endpoints were integrated, how authentication works, how search works, and how artist and album discographies are retrieved.

### Headliner implementation

How animated artist headers and album artwork work, including their fallbacks.

### Lyrics implementation

How community contributions, LRCLIB, LRC.red, and authorized Genius functionality are prioritized.

### Database

Explain the compact entity reference format, relationships, cache expiration, and contribution storage.

### Environment variables

Show every actual variable and its purpose.

### Dependencies

List added, removed, and updated packages.

### Testing

Show the commands executed and their actual results.

### Outstanding issues

Be honest about API access limitations, permissions, missing credentials, and untested features.

Never claim that something works without testing it.

---

# 26. The final vision

LRCGlass should become a premium music discovery and synchronized lyrics platform.

The complete experience should work as follows:

**A user searches for a song:**

1. Spotify searches for the song.
2. LRCGlass retrieves the album artwork.
3. LRCGlass retrieves the artist profile picture.
4. The song appears in the results with both images.
5. A compact song reference is saved server-side.
6. The user opens the song.
7. LRCGlass checks community-contributed lyrics first.
8. If none exist, LRCLIB and LRC.red are checked.
9. Authorized Genius functionality can supplement discovery.
10. The best valid available lyrics are displayed.
11. If nothing is found, the user can contribute lyrics.

**A user searches for an album:**

1. Spotify finds the album.
2. LRCGlass displays its actual cover and metadata.
3. A compact album reference is saved.
4. Headliner searches for animated album artwork.
5. Animated artwork is displayed when available.
6. Static artwork is used otherwise.
7. Every available album track is retrieved.
8. Each track can be opened and its lyrics discovered.

**A user searches for an artist:**

1. Spotify finds the correct artist.
2. LRCGlass retrieves the artist profile picture.
3. A compact artist reference is saved.
4. Headliner searches for an animated artist header.
5. Artist logos are retrieved when available.
6. Static images are used when animation is unavailable.
7. Spotify's available album discography is retrieved.
8. All available connected tracks are collected.
9. Duplicates are removed.
10. The artist page progressively displays the discography.
11. Lyrics discovery begins for every discovered track, using a controlled queue.
12. Every available LRCGlass contribution takes priority.

The result should feel like a premium music discovery and lyrics application that people genuinely enjoy using.

**Spotify is the primary music catalog. Headliner is the primary animated artwork provider. LRCGlass user contributions are the primary lyrics source. LRCLIB and LRC.red are the main external lyrics providers. Genius is an additional authorized discovery source.**

Preserve existing LRCGlass functionality, design, and architecture.

Start by auditing the current project. Then implement the systems in the specified order.