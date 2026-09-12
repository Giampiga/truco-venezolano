export const INITIAL_RATING = 1000;
export function eloDelta(winnerRating: number, loserRating: number) {
  return Math.round(32 / (1 + 10 ** ((winnerRating - loserRating) / 400)));
}
export type RatingEntry = {
  name: string;
  rating: number;
  games: number;
  wins: number;
};
export type Ranking = {
  format: '1v1' | '2v2';
  you: RatingEntry | null;
  leaders: RatingEntry[];
  history: {
    room: string;
    at: number;
    won: boolean;
    rated: boolean;
    delta: number;
    rating: number;
  }[];
};
