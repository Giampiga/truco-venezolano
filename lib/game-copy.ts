import { trucoAcceptedValue, trucoRejectedValue } from './truco-rules.ts';
export const manoAnnouncement = (name: string, isYou: boolean) =>
  isYou ? 'Eres mano.' : `${name} es mano.`;

export function gameEventText(
  event: string,
  names: Record<string, string>,
  you: string,
  teams: Partial<Record<'A' | 'B', string>> = {},
) {
  const personal: Record<string, string> = {
    'jugó ': 'Jugaste ',
    'apiló sus dos cartas': 'Apilaste tus dos cartas',
    'pasó sus tres cartas': 'Pasaste tus tres cartas',
    'se fue al mazo': 'Te fuiste al mazo',
  };
  for (const [verb, replacement] of Object.entries(personal)) {
    const prefix = `${you} ${verb}`;
    if (event.startsWith(prefix))
      event = replacement + event.slice(prefix.length);
  }
  for (const [id, name] of Object.entries(names))
    event = event.replaceAll(`${id} `, `${name} `);
  event = event.replace(
    /\b(?:el equipo )?([AB])(?=[., ]|$)/g,
    (text, team: 'A' | 'B') => teams[team] ?? text,
  );
  return event
    .replaceAll('para Tú', 'para ti')
    .replaceAll('ganó Tú', 'ganaste')
    .replaceAll('vale-nueve', 'Vale nueve')
    .replaceAll('vale-juego', 'Vale juego');
}
export const actionLabels: Record<string, string> = {
  'answer-quiero': 'Quiero',
  'answer-no-quiero': 'No quiero',
  'raise-truco': 'Subir el truco',
  'call-truco': 'Cantar truco',
  'raise-envido': 'Subir el envite',
  'call-envido': 'Envido',
  'call-falta': 'La falta',
  'declare-flor': 'Cantar flor',
  'call-flor-envida': 'Mi flor envida',
};

export function pendingCanto(
  state: Pick<
    import('./truco-engine.ts').EngineSnapshot,
    'priority' | 'truco' | 'envido' | 'handComplete'
  >,
) {
  if (state.handComplete || state.priority.active === 'play') return null;
  const labels = {
    truco: 'Truco',
    retruco: 'Retruco',
    'vale-nueve': 'Vale nueve',
    'vale-juego': 'Vale juego',
  };
  const points = (n: number) => `${n} ${n === 1 ? 'punto' : 'puntos'}`;
  const pending =
    state.priority.active === 'truco'
      ? state.truco.pending
      : state.envido.pending;
  if (!pending) return null;
  const suspended = state.priority.suspendedTruco
    ? labels[state.priority.suspendedTruco.call]
    : null;
  if ('call' in pending) {
    const accepted = trucoAcceptedValue(pending.call);
    const rejected = trucoRejectedValue(pending.call);
    return {
      ...pending,
      label: labels[pending.call],
      accept:
        accepted !== 'game'
          ? `La base vale ${points(accepted)}.`
          : 'La base decide el chico.',
      reject: `El equipo que cantó gana ${points(rejected)} y termina la base.`,
      suspended,
    };
  }
  return {
    ...pending,
    label: `${state.priority.active === 'flor' ? (pending.kind === 'flor' ? 'Flor' : 'Con flor envido') : pending.kind === 'falta' ? 'La falta' : 'Envido'} · ${points(pending.stake)}`,
    accept: `Se comparan los tantos por ${points(pending.stake)}.${state.priority.active === 'flor' ? ' Incluye la flor; cada flor aliada adicional suma sus puntos.' : ' Se valida al terminar la base, antes del Truco.'}`,
    reject: `El equipo que cantó gana ${points(pending.rejectionAward)}.`,
    suspended,
  };
}
