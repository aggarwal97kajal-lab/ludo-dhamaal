# Ludo Dhamaal

3D Ludo for Android with cartoon people instead of tokens, play vs computer, pass & play, online rooms with friends and live voice chat.

## Parts

| Part | Folder | What it is |
| --- | --- | --- |
| Game | `app/src/main/assets/www` | The whole game: Three.js 3D board (`js/board3d.js`), rules (`js/rules.js`), screens (`js/app.js`), online (`js/net.js`), voice chat (`js/voice.js`) |
| Android app | `app/` | Kotlin WebView that runs the game, asks for the mic, shares on WhatsApp |
| Online server | `server/` | Cloudflare Worker + Durable Object, one per room. Rolls the dice and checks every move |

## Rules used

6 to come out, capture sends the player home, star and start squares are safe, extra turn for 6 / capture / reaching the centre, three 6s lose the turn, exact number to finish. No block (jodi) rule. A player who goes offline is skipped (no bot plays for them); 30 seconds per turn online.

## APK

Every push to `main` builds the APK on GitHub (`.github/workflows/apk.yml`) and puts it on the Releases page as `LudoDhamaal.apk`.

## Online server

Cloudflare → Workers & Pages → Create → Import a repository → this repo.
Root directory: `server`, deploy command: `npx wrangler deploy`.
Then put the Worker address (like `https://ludo-dhamaal.NAME.workers.dev`) in `server_url.txt` and push; the next APK uses it.

## Test

`cd test && node rules.test.mjs && node server.test.mjs` plays 300 random games and a full online game through the room server.
