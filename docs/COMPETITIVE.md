# Competitive rooms

- Competitive creation, joins and matchmaking require a confirmed, non-anonymous Supabase account. Display names and browser storage never authorize an account. Local testing can explicitly enable isolated test cookies; production ignores that switch.
- `RoomConfig.ranked` opts a room into Elo. Duels and pairs have separate ratings, starting at 1000. The server fixes ranked games to oriental rules, 24 points, one chico, flor a ley, three-point flor, and open stacked parda.
- Elo uses K=32 and team-average ratings. Each teammate receives the same change. Only a server-authoritative completed match can award points; clients cannot submit a winner or rating.
- Leaving an active ranked match forfeits for the entire team. The host cannot cancel it. After an opponent has been absent for two minutes, a connected player can claim a forfeit. Ordinary disconnects preserve the seat during that grace period.
- Postgres stores ratings and one immutable result per room. An atomic, conditional batch prevents duplicate awards and lost changes when the same account completes concurrent games. Room reads and ranking reads recover interrupted settlements.
- `/api/ranking?format=1v1` (or `2v2`) returns the caller's rating, top 20 display names/ratings, and their last ten results. It never returns account identifiers.
- Tests: `npm test`, `npm run test:ranked`, `npm run test:integration` against a local preview. The latter checks normal completed games; ranked tests cover forfeits and concurrent settlement.

## UI integration for design work

Keep `CreateRoomDialog`'s ranked, voice and camera fields. `VoiceRoom` takes `roomId`, `enabled`, and `cameraAllowed`; joining does not request devices. Its separate microphone and camera buttons opt in individually. `RankingPanel` includes format selection, rating/history, sign-in and retry states, and `onPlay(format)`.

Matchmaking supports solo entry for duels and four-player teams. It chooses nearby Elo, widens the range from 150 to 600 as the caller waits, and balances the selected four players into teams. A live queue entry expires after 90 seconds without polling; assignments and cancellation use atomic database checks so an account cannot be paired twice. Assigned players still confirm readiness before the host deals.

Only three rated matches against each opponent in a rolling 24-hour window count, across both formats. A fourth result is stored with `rated = 0`, zero Elo change, and no rated win/game increment. In pairs, reaching the limit with either opponent makes the entire result unrated. The cap is checked inside the atomic settlement claim, including simultaneous finishes across formats. Matchmaking excludes capped opponents, while manually created rooms remain playable.

This limits repeat-opponent farming; it does not detect coordinated multi-account abuse. Run `npm run test:matchmaking` for queue, cancellation, pairing, capped results and concurrency checks. Room invitations do not bypass membership or competitive account checks.
