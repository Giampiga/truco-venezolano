import type { EngineCommand } from './truco-engine.ts';
export function validateCommand(input: unknown): EngineCommand {
  if (!input || typeof input !== 'object') throw new Error('Comando inválido.');
  const value = input as Record<string, unknown>;
  const validCard = (card: unknown) =>
    typeof card === 'string' &&
    /^(?:[1-7]|10|11|12)-(?:oros|copas|bastos|espadas)$/.test(card);
  const calls = ['truco', 'retruco', 'vale-nueve', 'vale-juego'];
  switch (value.type) {
    case 'PLAY_CARD':
      if (
        !validCard(value.cardId) ||
        (value.passed !== undefined && typeof value.passed !== 'boolean')
      )
        break;
      return {
        type: value.type,
        cardId: value.cardId as string,
        passed: value.passed as boolean | undefined,
      };
    case 'PLAY_STACK':
      if (
        !Array.isArray(value.cardIds) ||
        value.cardIds.length !== 2 ||
        !value.cardIds.every(validCard) ||
        value.cardIds[0] === value.cardIds[1]
      )
        break;
      return {
        type: value.type,
        cardIds: [value.cardIds[0], value.cardIds[1]] as [string, string],
      };
    case 'PASS_CARDS':
    case 'FOLD_HAND':
    case 'CALL_FLOR_ENVIDA':
      return { type: value.type };
    case 'CALL_ENVIDO':
      if (value.amount !== 2 && value.amount !== 'falta') break;
      return { type: value.type, amount: value.amount };
    case 'RAISE_ENVIDO':
      if (
        value.amount !== 'falta' &&
        !(
          Number.isInteger(value.amount) &&
          Number(value.amount) >= 1 &&
          Number(value.amount) <= 32
        )
      )
        break;
      return { type: value.type, amount: value.amount as number | 'falta' };
    case 'DECLARE_FLOR':
      if (value.mode !== 'flor' && value.mode !== 'a-ley') break;
      return { type: value.type, mode: value.mode };
    case 'CALL_TRUCO':
    case 'RAISE_TRUCO':
      if (typeof value.call !== 'string' || !calls.includes(value.call)) break;
      return {
        type: value.type,
        call: value.call as 'truco' | 'retruco' | 'vale-nueve' | 'vale-juego',
      } as EngineCommand;
    case 'ANSWER_CALL':
      if (value.answer !== 'quiero' && value.answer !== 'no-quiero') break;
      return { type: value.type, answer: value.answer };
  }
  throw new Error('La jugada tiene un formato inválido.');
}
