export const manoAnnouncement = (name: string, isYou: boolean) =>
  isYou ? 'Eres mano.' : `${name} es mano.`;

export function gameEventText(event: string, names: Record<string, string>, you: string) {
  const personal: Record<string, string> = {
    'jugó ': 'Jugaste ',
    'apiló sus dos cartas': 'Apilaste tus dos cartas',
    'pasó sus tres cartas': 'Pasaste tus tres cartas',
    'se fue al mazo': 'Te fuiste al mazo',
  };
  for (const [verb, replacement] of Object.entries(personal)) {
    const prefix = `${you} ${verb}`;
    if (event.startsWith(prefix)) event = replacement + event.slice(prefix.length);
  }
  for (const [id, name] of Object.entries(names)) event = event.replaceAll(`${id} `, `${name} `);
  return event.replaceAll('vale-nueve', 'Vale nueve').replaceAll('vale-juego', 'Vale juego');
}
export const actionLabels: Record<string, string> = {
  'answer-quiero': 'Quiero', 'answer-no-quiero': 'No quiero',
  'raise-truco': 'Subir el truco', 'call-truco': 'Cantar truco',
  'raise-envido': 'Subir el envite', 'call-envido': 'Envido',
  'call-falta': 'La falta', 'declare-flor': 'Cantar flor',
  'call-flor-envida': 'Mi flor envida',
};
