# Competitive rooms

- All room and ranking APIs require the Sites authenticated identity in production. Display names and browser storage never authorize an account. Local development uses isolated guest cookies for testing only.
- `RoomConfig.ranked` opts a room into Elo. Duels and pairs have separate ratings, starting at 1000. The server fixes ranked games to oriental rules, 24 points, one chico, flor a ley, three-point flor, and open stacked parda.
- Elo uses K=32 and team-average ratings. Each teammate receives the same change. Only a server-authoritative completed match can award points; clients cannot submit a winner or rating.
- Leaving an active ranked match forfeits for the entire team. The host cannot cancel it. After an opponent has been absent for two minutes, a connected player can claim a forfeit. Ordinary disconnects preserve the seat during that grace period.
- D1 stores ratings and one immutable result per room. An atomic, conditional batch prevents duplicate awards and lost changes when the same account completes concurrent games. Room reads and ranking reads recover interrupted settlements.
- `/api/ranking?format=1v1` (or `2v2`) returns the caller's rating, top 20 display names/ratings, and their last ten results. It never returns account identifiers.
- Tests: `npm test`, `npm run test:ranked`, `npm run test:integration` against a local preview. The latter checks normal completed games; ranked tests cover forfeits and concurrent settlement.

## UI integration for design work

Keep `CreateRoomDialog`'s ranked, voice and camera fields. `VoiceRoom` takes `roomId`, `enabled`, and `cameraAllowed`; joining does not request devices. Its separate microphone and camera buttons opt in individually. `RankingPanel` includes format selection, rating/history, sign-in and retry states, and `onPlay(format)`.

This is competitive scoring for hosted rooms, without automated matchmaking or anti-collusion enforcement. Add opponent matching and repeat-opponent limits before treating the ladder as a public tournament ranking. The Site's existing access policy still governs who can visit; room invitations do not change Site access.
