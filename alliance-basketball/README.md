# Alliance Basketball

## Running it on one laptop (match day)

1. Install Node.js 24 LTS (at least 22.13).
2. In this folder run `npm ci` once (needs internet), then `npm run dev`.
3. Open http://127.0.0.1:5173 in Chrome; press F11 for full screen.

Everything is stored in `.sites-runtime/preview.sqlite` in this folder: no
internet is needed once installed. Do not delete `.sites-runtime`; delete it
only to start completely fresh. Click **Backup** after every game. Keep the
terminal window open while scoring.

Tests: `node scripts/test-engine.mjs && node scripts/test-merge.mjs && node scripts/test-bracket.mjs && node scripts/test-roster.mjs`.

A four-page tournament dashboard using the supplied Alliance Basketball crest and a charcoal, silver and deep-red theme.

## Operations

1. **Teams & players:** add reusable teams, then players with unique jersey numbers. Enter selected teams into the active tournament. Export the registry as CSV. Remove team deletes a team and its players and clears affected unstarted draws. Teams belonging to a started tournament are protected until that tournament is deleted; saved reports remain.
2. **Fixtures:** choose single elimination, round-robin league, or knockout qualifiers followed by a final league. The initial draw uses cryptographic Fisher–Yates shuffling. Drag two draw positions onto each other, or tap them sequentially, to swap. Swaps rebuild fixtures and clear schedule times. Editing is locked once play begins.
3. **Score desk:** select a match and tap the large +1/+2/+3 or Foul buttons immediately. No players or lineup selection are required. Assign each basket or foul to a player afterward in Assign players later; this never changes the team score. Add players on page 1 and use Load added players to append them to the match roster. Attribution is editable after the final whistle and refreshes an existing saved report. Unassigned totals remain visible in reports. Five players maximum can be on court. The configurable foul limit removes a fouled-out player. Undo reverses the latest scoring, foul or substitution action. Set/pause the game clock, advance quarters, or start overtime. Finishing saves a report and advances the winner.
4. **Match reports:** view saved results, per-period scores, player points/fouls, and the play log. Add notes. Export standalone HTML, player CSV or JSON; use Print / PDF to save a PDF. Deleting a report does not delete the match result.

New tournaments retain the club registry. Started matches capture roster snapshots. Saved reports remain available after their tournament is deleted. Reopening a result resets dependent games, and retained reports are marked as older snapshots.

League ranking: wins, point difference, points scored, then the initial random tiebreak order. Ties in individual matches require overtime. In combined mode, balanced random qualifier brackets each supply one finalist for the final round robin.

## Shared access and saving

Hosted storage is Cloudflare D1. Updates poll every three seconds. Revision checks reject conflicting writes with a visible retry message. Only one game clock can run at a time. The clock uses server-adjusted time and continues through page reloads.

The Site is private by default. Open it using the owner’s signed-in account on multiple devices. For separate staff accounts, grant access through the Site sharing controls, then add their sign-in email in Workspace settings. Anonymous and unapproved accounts cannot access the workspace API. No access tokens are included in the source or browser bundle.

Use Backup regularly. The owner can restore a complete workspace backup. Restore replaces shared state and pauses running clocks. Pending changes are saved on the scoring device and retried automatically; a conflicting server revision requires review. An internet connection is required to share updates with other devices.

Supported bounds: 64 entrants for knockout and combined formats, 32 for league; 50 players per team; 100 tournaments; 5,000 saved reports; 12 MB workspace JSON. Export older reports/tournaments before clearing records if a bound is reached. Player contact details and student IDs are intentionally not collected.

## Development

Requires Node 24 or later. Install the locked dependencies with `npm ci`, then run `npm run dev`. The local-only server stores a SQLite preview database in ignored `.sites-runtime/preview.sqlite` and uses a test account, never production data. Production code does not include that identity adapter.

`npm run build` creates the Vite React client and a Cloudflare-compatible Worker. The bundled Sites plugin copies the hosting manifest and generated Drizzle migrations. `.openai/hosting.json` identifies the Site and D1 binding. Migrations are applied through the Sites publishing workflow; never recreate production tables in request handlers.

Meaningful checks: `node scripts/test-engine.mjs`, TypeScript `--noEmit`, browser workflows for CRUD, fixture swaps, player scoring, clocks, reports, concurrent writes and mobile layout. Browser WebMCP exposes read-only tournament summaries and navigation to existing matches when supported.

## Match-day improvements

The compact score desk keeps scores, clock and touch controls together. Player attribution and action history can be expanded below. Each team's minus-one button reduces its latest basket by one point; the action history can change a basket to 1/2/3 or delete a basket/foul. Reopen a final result before changing its score.

Drag a named team directly within the bracket, or tap two teams. A swap preview asks for confirmation before rebuilding fixtures. Touch dragging is supported; winner placeholders and started tournaments are protected. Swaps clear schedule times.

Open Spectator view from the score desk for a separate read-only scoreboard. Invite viewers through Site sharing; do not add them to the scoring staff list. The spectator API returns only match summaries and clocks, rejects writes, and retains the Site's sign-in/access restrictions.

While the dashboard is loaded, edits are persisted locally before upload. Saved, Saving, Offline and Conflict states describe their status. Pending edits retry automatically and are preserved across reloads on the same browser. If another device changed the shared revision, the local copy is held for review rather than overwriting it. Download recovery before choosing Use server version; that choice discards the pending local copy. This does not install an offline app: first loading the site still requires connectivity. Spectators see only server-confirmed scores. Browser storage must be available; clearing it removes pending copies.

Score-desk responsiveness: controls update the local view immediately and remain enabled while background saves run. Rapid edits are coalesced into ordered uploads; acknowledgements advance the saved base without replacing newer local edits. A lost response is reconciled against the last sent snapshot before retrying. The clock updates independently, and collapsed player/history panels are not rendered until opened.

## Two-laptop projector setup

On the operator laptop, select the match and click Connect display laptop. Copy the display link and open it on the second laptop, signed in with an account granted Site access. Connect that laptop to the projector using HDMI. Move the pointer to reveal Full screen; its controls fade after three seconds. The projection shows only team names and scores. Press Escape for display setup. The display refreshes once per second after each request completes, showing server-saved operator updates. A connection warning appears if updates fail. Each link stays pinned to its match; use a new match link or select the next match in setup between games. Display accounts need Site access, but should not be added to scoring staff.

## Three-laptop operation

1. Main operator: `/scoreboard` controls points, clock, fixtures and match completion.
2. Player operator: `/tracker` assigns recorded baskets/fouls, sees player points and made 1/2/3-point shot counts, records new personal fouls, corrects assignments and exports a player-stat CSV. It has no score increment or clock buttons. Use the Player tracker link on the score desk to open the exact tournament/match on laptop 2, or Copy tracker link on the tracker page. Invite that account through Site sharing and add its email to the existing scoring-staff list. This is a focused workspace for approved staff, not a separately restricted permission role; approved staff retain dashboard access.
3. Projection laptop: `/spectator` is read-only and shows team scores and the live game clock.

The tracker updates as operator actions arrive. Unassigned points remain in team totals. Load added players appends newly registered players to a started match. Finish attribution after the final whistle to update the saved report. Avoid recording the same foul twice: assign an existing foul if the dashboard operator already entered it.

Independent concurrent edits now merge automatically by entity and action ID. Changes to the same field, or assignment of an action deleted elsewhere, remain explicit conflicts. Pending recovery copies remain preserved. The score desk still responds immediately while writes happen in the background.
