# Geolocation Reliability Test Matrix

BlueBlueLink treats live GPS sharing as a foreground-only contract. The app should keep sending while the sender page or installed PWA is open and active, then clearly show that updates can pause when the screen locks, the app is backgrounded, or connectivity is lost.

## Automated Coverage

- Sender starts `watchPosition` only after explicit user action.
- Sender clears the geolocation watch, wake lock, resend timer, and cached point on stop or unmount.
- Latest GPS point is resent every 15 seconds while active.
- Offline sends are held as delayed and retried on the browser `online` event.
- Hidden pages enter the background state and retry the latest point when visible again.
- Sender UI states the foreground-only GPS contract in Korean.

## Manual Device Matrix

| Scenario | Expected result |
| --- | --- |
| iOS Safari foreground share | Location permission prompt appears, map loads, sender stays active, receiver freshness updates. |
| Installed iOS PWA foreground share | App opens in standalone mode, location updates continue while the app is visible. |
| Android Chrome foreground share | Location permission prompt appears, wake lock is attempted, receiver freshness updates. |
| Installed Android PWA foreground share | Installed app opens to the route and continues visible foreground updates. |
| Screen lock or background | Sender shows the background/paused contract after relaunch or visibility return, then sends the latest available point. |
| Relaunch after stop | A stopped share does not keep watching GPS and does not resume sending until the user starts again. |
| Offline while sharing | Sender shows delayed state, no upload is attempted while offline, latest point retries after reconnect. |
| Poor GPS accuracy | Sender uploads accuracy metadata and receiver can treat stale or low-quality updates as product state. |
