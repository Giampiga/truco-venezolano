export function tablePosition(
  seats: readonly { id: string }[],
  seatId: string,
  you: string,
) {
  const index = seats.findIndex((seat) => seat.id === seatId);
  const viewer = seats.findIndex((seat) => seat.id === you);
  if (index < 0 || viewer < 0) return undefined;
  const positions =
    seats.length === 2
      ? (['bottom', 'top'] as const)
      : (['bottom', 'right', 'top', 'left'] as const);
  return positions[(index - viewer + seats.length) % seats.length];
}
