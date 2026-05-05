# Privacy And Retention

BlueBlueLink stores only the latest known location for a share session in the MVP.
It does not store a route history or playback timeline.

## Live Location

- Each sender update replaces `latitude`, `longitude`, `accuracy_meters`, and `last_updated_location` on the current `ShareSession`.
- Public tracking responses never include owner email, owner ID, internal PIN hash, or session ownership metadata.
- PINs are stored as password hashes, not plain text.
- Normal production request logs are configured to redact precise coordinate fields and PIN values.

## Stop, Expiry, And Delete

- Stopping a share changes the session status to `stopped` and keeps the last known point so the owner can see recent share history.
- Expired shares are treated as unavailable to public viewers, but their latest point remains attached to the owner-visible session record until deletion.
- Deleting a share removes the session record and its latest stored location from the application data store.

## Current Limitation

The MVP does not yet include an automated retention job. Until one is added, owners should delete old shares they no longer need.
