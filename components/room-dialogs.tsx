'use client';
import { SyntheticEvent, useState } from 'react';
import { Bot, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import type { RoomConfig } from '@/lib/product-types';
import { cardHierarchy, getPieces, type TrucoCard } from '@/lib/truco-rules';
import type { PracticeDifficulty } from '@/lib/practice-ai';
export function CreateRoomDialog({
  open,
  onOpenChange,
  config,
  onConfigChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: RoomConfig;
  onConfigChange: (config: RoomConfig) => void;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
}) {
  function update<K extends keyof RoomConfig>(key: K, value: RoomConfig[K]) {
    onConfigChange({ ...config, [key]: value });
  }

  function changePreset(preset: RoomConfig['preset']) {
    if (preset === 'rapida') {
      onConfigChange({
        ...config,
        preset,
        target: '12',
        match: 'un-chico',
        flor: 'off',
        parda: 'cerrada',
        pardaEngine: 'apilada-clasica',
        truco: 'cerrado',
        envido: 'escalera-online',
        cardPlay: 'visible',
        privando: false,
      });
    } else if (preset === 'competitiva') {
      onConfigChange({
        ...config,
        preset,
        target: '32',
        match: 'mejor-de-tres',
        flor: 'a-ley',
        parda: 'cerrada',
        pardaEngine: 'apilada-clasica',
        truco: 'cerrado',
        envido: 'clasico',
        cardPlay: 'visible',
        privando: false,
      });
    } else {
      onConfigChange({
        ...config,
        preset,
        target: '24',
        match: 'un-chico',
        flor: 'a-ley',
        parda: 'abierta',
        pardaEngine: 'apilada-clasica',
        truco: 'abierto',
        envido: 'clasico',
        cardPlay: 'visible',
        privando: true,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
            Nueva mesa
          </p>
          <DialogTitle className="font-display text-3xl font-bold tracking-[-0.03em]">
            Las reglas primero
          </DialogTitle>
          <DialogDescription>
            El Truco venezolano cambia por región y por casa. Elige un punto de
            partida y deja cada variante visible.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="field-group sm:col-span-2">
              <span>Nombre de la mesa</span>
              <Input
                aria-label="Nombre de la mesa"
                value={config.name}
                onChange={(event) => update('name', event.target.value)}
                maxLength={36}
                className="h-11 rounded-xl"
              />
            </div>

            <div className="field-group sm:col-span-2">
              <span>Formato</span>
              <div className="format-segment" aria-label="Formato de la mesa">
                {(['2v2', '1v1'] as RoomConfig['format'][]).map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => update('format', format)}
                    aria-pressed={config.format === format}
                  >
                    <strong>{format}</strong>
                    <small>
                      {format === '2v2'
                        ? 'Parejas fijas · predeterminado'
                        : 'Mano contra Pie'}
                    </small>
                  </button>
                ))}
              </div>
            </div>

            <div className="switch-row sm:col-span-2">
              <span>
                <strong>Partida competitiva</strong>
                <small>
                  Con sesión iniciada. Cuenta para tu Elo; abandonar es perder.
                </small>
              </span>
              <Switch
                aria-label="Partida competitiva"
                checked={!!config.ranked}
                onCheckedChange={(ranked) =>
                  onConfigChange({
                    ...config,
                    ranked,
                    ...(ranked
                      ? {
                          preset: 'oriental',
                          target: '24',
                          match: 'un-chico',
                          flor: 'a-ley',
                          florPoints: '3',
                          parda: 'abierta',
                          pardaEngine: 'apilada-clasica',
                        }
                      : {}),
                  })
                }
              />
            </div>
            {config.ranked && (
              <p className="sm:col-span-2 text-sm">
                Reglas iguales para todos: oriental, 24 piedras, un chico, flor
                a ley y parda abierta. Rankings separados para duelo y parejas.
              </p>
            )}
            <fieldset disabled={!!config.ranked} className="contents">
              <div className="field-group sm:col-span-2">
                <span>Regla base</span>
                <NativeSelect
                  aria-label="Regla base"
                  value={config.preset}
                  onChange={(event) =>
                    changePreset(event.target.value as RoomConfig['preset'])
                  }
                  className="w-full [&>select]:h-11 [&>select]:rounded-xl"
                >
                  <NativeSelectOption value="oriental">
                    Oriental clásico · 24 piedras
                  </NativeSelectOption>
                  <NativeSelectOption value="rapida">
                    Mesa rápida · 12 piedras
                  </NativeSelectOption>
                  <NativeSelectOption value="competitiva">
                    Competitiva larga · 32 · mejor de tres
                  </NativeSelectOption>
                </NativeSelect>
              </div>

              <div className="field-group">
                <span>Piedras para ganar</span>
                <NativeSelect
                  aria-label="Piedras para ganar"
                  value={config.target}
                  onChange={(event) => {
                    const target = event.target.value as RoomConfig['target'];
                    onConfigChange({
                      ...config,
                      target,
                      privando: target === '24' ? config.privando : false,
                    });
                  }}
                  className="w-full [&>select]:h-11 [&>select]:rounded-xl"
                >
                  <NativeSelectOption value="24">
                    24 · clásico
                  </NativeSelectOption>
                  <NativeSelectOption value="12">
                    12 · rápida
                  </NativeSelectOption>
                  <NativeSelectOption value="32">32 · larga</NativeSelectOption>
                </NativeSelect>
              </div>

              <div className="field-group">
                <span>Serie</span>
                <NativeSelect
                  aria-label="Duración de la serie"
                  value={config.match}
                  onChange={(event) =>
                    update('match', event.target.value as RoomConfig['match'])
                  }
                  className="w-full [&>select]:h-11 [&>select]:rounded-xl"
                >
                  <NativeSelectOption value="un-chico">
                    Un chico
                  </NativeSelectOption>
                  <NativeSelectOption value="mejor-de-tres">
                    Mejor de tres chicos
                  </NativeSelectOption>
                </NativeSelect>
              </div>

              <div className="field-group">
                <span>Modo de Flor</span>
                <NativeSelect
                  aria-label="Modo de Flor"
                  value={config.flor}
                  onChange={(event) =>
                    update('flor', event.target.value as RoomConfig['flor'])
                  }
                  className="w-full [&>select]:h-11 [&>select]:rounded-xl"
                >
                  <NativeSelectOption value="a-ley">
                    Con flor · A ley
                  </NativeSelectOption>
                  <NativeSelectOption value="off">Sin flor</NativeSelectOption>
                  <NativeSelectOption value="por-derecho">
                    Flor por derecho · regional
                  </NativeSelectOption>
                </NativeSelect>
              </div>

              <div className="field-group">
                <span>Primera parda</span>
                <NativeSelect
                  aria-label="Regla de primera parda"
                  value={config.parda}
                  onChange={(event) =>
                    update('parda', event.target.value as RoomConfig['parda'])
                  }
                  className="w-full [&>select]:h-11 [&>select]:rounded-xl"
                >
                  <NativeSelectOption value="abierta">
                    Venezolana abierta
                  </NativeSelectOption>
                  <NativeSelectOption value="cerrada">
                    Venezolana cerrada
                  </NativeSelectOption>
                </NativeSelect>
              </div>

              <p className="text-sm text-muted-foreground">
                Primera vuelta parda: se juegan las dos cartas restantes juntas,
                con la mayor arriba y la menor tapada.
              </p>

              <div className="rule-preview rounded-xl border border-border bg-muted/35 p-4">
                <p className="text-xs font-semibold">Escalera de canto</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Truco 3 · Retruco 6 · Vale nueve 9 · Vale juego
                </p>
              </div>

              <div className="rule-preview rounded-xl border border-border bg-muted/35 p-4">
                <p className="text-xs font-semibold">Flor y Reservada</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  La Flor vale 3 piedras. Una Reservada gana la comparación de
                  flores.
                </p>
              </div>
            </fieldset>
            <div className="switch-row sm:col-span-2">
              <span>
                <strong>Visible en el salón</strong>
                <small>
                  {config.isPrivate
                    ? 'Mesa privada: solo se entra con el código o el enlace. No aparece en la lista.'
                    : 'Aparece en la lista de mesas para que otros jugadores puedan sentarse.'}
                </small>
              </span>
              <Switch
                aria-label="Mostrar la mesa en el salón"
                checked={!config.isPrivate}
                onCheckedChange={(visible) => update('isPrivate', !visible)}
              />
            </div>
            <div className="switch-row sm:col-span-2">
              <span>
                <strong>Voz opcional</strong>
                <small>
                  Cada jugador da permiso por separado; todos empiezan
                  silenciados.
                </small>
              </span>
              <Switch
                aria-label="Permitir voz opcional"
                checked={config.voice}
                onCheckedChange={(voice) =>
                  onConfigChange({
                    ...config,
                    voice,
                    camera: voice && config.camera,
                  })
                }
              />
            </div>
            <div className="switch-row sm:col-span-2">
              <span>
                <strong>Permitir cámaras</strong>
                <small>
                  Opcional para cada jugador. Siempre empiezan apagadas.
                </small>
              </span>
              <Switch
                aria-label="Permitir cámaras"
                disabled={!config.voice}
                checked={!!config.camera}
                onCheckedChange={(value) => update('camera', value)}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit">Crear mesa</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PracticeDialog({
  open,
  onOpenChange,
  initialDifficulty,
  onStart,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDifficulty: PracticeDifficulty;
  onStart: (settings: {
    difficulty: PracticeDifficulty;
    preset: RoomConfig['preset'];
    target: RoomConfig['target'];
    guided: boolean;
  }) => void;
}) {
  const [difficulty, setDifficulty] =
    useState<PracticeDifficulty>(initialDifficulty);
  const [preset, setPreset] = useState<RoomConfig['preset']>('oriental');
  const [target, setTarget] = useState<RoomConfig['target']>('24');
  const [guided, setGuided] = useState(true);

  function updatePreset(next: RoomConfig['preset']) {
    setPreset(next);
    setTarget(next === 'rapida' ? '12' : next === 'competitiva' ? '32' : '24');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl"
      >
        <DialogHeader>
          <span className="dialog-icon">
            <Bot className="size-5" />
          </span>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
            Sala de práctica · 1v1
          </p>
          <DialogTitle className="font-display text-3xl font-bold tracking-[-0.03em]">
            Juega contra Truquito
          </DialogTitle>
          <DialogDescription>
            Practica a tu ritmo, sin micrófono ni puntos de clasificación.
            Truquito sigue las mismas reglas y nunca ve tu mano ni las cartas
            sin repartir.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="field-group">
            <span>Dificultad</span>
            <div
              className="difficulty-segment"
              aria-label="Dificultad de Truquito"
            >
              {(['aprendiz', 'criollo', 'maestro'] as PracticeDifficulty[]).map(
                (value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDifficulty(value)}
                    aria-pressed={difficulty === value}
                  >
                    <strong>{value[0].toUpperCase() + value.slice(1)}</strong>
                    <small>
                      {value === 'aprendiz'
                        ? 'Juega simple y explica más'
                        : value === 'criollo'
                          ? 'Balanceado · recomendado'
                          : 'Riesgo, posición y marcador'}
                    </small>
                  </button>
                ),
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field-group">
              <span>Reglas</span>
              <NativeSelect
                aria-label="Reglas de práctica"
                value={preset}
                onChange={(event) =>
                  updatePreset(event.target.value as RoomConfig['preset'])
                }
                className="w-full [&>select]:h-11 [&>select]:rounded-xl"
              >
                <NativeSelectOption value="oriental">
                  Oriental clásico
                </NativeSelectOption>
                <NativeSelectOption value="rapida">
                  Mesa rápida
                </NativeSelectOption>
                <NativeSelectOption value="competitiva">
                  Competitiva larga
                </NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="field-group">
              <span>Meta</span>
              <NativeSelect
                aria-label="Piedras de práctica"
                value={target}
                onChange={(event) =>
                  setTarget(event.target.value as RoomConfig['target'])
                }
                className="w-full [&>select]:h-11 [&>select]:rounded-xl"
              >
                <NativeSelectOption value="12">12 piedras</NativeSelectOption>
                <NativeSelectOption value="24">24 piedras</NativeSelectOption>
                <NativeSelectOption value="32">32 piedras</NativeSelectOption>
              </NativeSelect>
            </div>
          </div>

          <div className="switch-row">
            <span>
              <strong>Modo guiado</strong>
              <small>
                Explica piezas, cuentas, cantos legales y por qué resolvió cada
                vuelta.
              </small>
            </span>
            <Switch
              aria-label="Activar modo guiado"
              checked={guided}
              onCheckedChange={setGuided}
            />
          </div>

          <div className="rules-caveat">
            <Info className="size-4" />
            <p>
              Puedes pausar, adelantar la respuesta de la IA, deshacer una
              acción, rehacerla, reiniciar la base o pedir un reparto nuevo.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => onStart({ difficulty, preset, target, guided })}
          >
            Empezar práctica
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RulesDialog({
  open,
  onOpenChange,
  config,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: RoomConfig;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="rules-dialog sm:max-w-2xl">
        <DialogHeader className="rules-dialog-header">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
            TRUCO VENEZOLANO
          </p>
          <DialogTitle className="font-display text-3xl font-bold">
            Cómo jugar
          </DialogTitle>
          <DialogDescription>
            Esta mesa juega con{' '}
            {config.preset === 'oriental'
              ? 'Oriental clásico'
              : config.preset === 'rapida'
                ? 'Mesa rápida'
                : 'Competitiva larga'}
            . Abre una sección para consultar lo que necesitas.
          </DialogDescription>
        </DialogHeader>
        <div className="rules-dialog-body">
          <details className="rules-chapter">
            <summary>1. Lo básico: de la primera carta al marcador</summary>
            <ol className="rules-steps">
              <li>
                <strong>Recibe tus cartas.</strong> Cada jugador recibe tres. La
                vira queda boca arriba y determina el Perico y la Perica.
              </li>
              <li>
                <strong>Juega por turnos.</strong> Empieza la mano. La carta más
                fuerte gana la vuelta; gana la base quien se lleva dos vueltas.
                Los empates tienen reglas especiales.
              </li>
              <li>
                <strong>Elige tus cantos.</strong> Truco sube la apuesta de la
                base. Envido compara los tantos de las cartas; Flor tiene
                prioridad cuando está habilitada.
              </li>
              <li>
                <strong>Revisa los puntos.</strong> Al terminar la base verás
                cuánto ganó cada equipo y por qué. Gana el chico quien llega a{' '}
                {config.target} piedras.
              </li>
            </ol>
          </details>
          <details className="rules-chapter">
            <summary>2. Valor de las cartas y empates</summary>
            <CardHierarchy />
          </details>
          <details className="rules-chapter rules-agreement">
            <summary>3. Cantos y reglas de esta mesa</summary>
            <dl className="rules-detail-grid">
              <RuleDetail
                label="Formato"
                value={`${config.format === '1v1' ? '2 jugadores · Mano/Pie' : '4 jugadores · parejas fijas'} · ${config.target} piedras · ${config.match === 'mejor-de-tres' ? 'mejor de 3' : 'un chico'}`}
              />
              <RuleDetail
                label="Baraja"
                value="Española de 40 · 3 cartas · vira visible"
              />
              <RuleDetail
                label="Piezas"
                value="Perico 11 · Perica 10 de la pinta; si la vira es 11 o 10, el 12 sustituye esa pieza"
              />
              <RuleDetail
                label="Truco"
                value="Sin canto 1 · Truco 3/rehúse 1 · Retruco 6/3 · Vale 9 9/6 · Vale Juego chico/9"
              />
              <RuleDetail
                label="Envite"
                value="Envido 2 · Quiero y Envido 4 · Falta del que va ganando · empate para Mano · querido: al terminar la base · no querido: pago inmediato"
              />
              <RuleDetail
                label="Flor"
                value={
                  config.flor === 'off'
                    ? 'Sin flor'
                    : config.flor === 'por-derecho'
                      ? 'Flor por derecho · repítela antes de cada carta'
                      : 'Repite Flor antes de cada carta o se invalida · 3 por flor · Reservada gana la comparación'
                }
              />
              <RuleDetail
                label="Primera parda"
                value={
                  config.parda === 'abierta'
                    ? 'Dos cartas juntas; la mayor arriba; admite repique'
                    : 'Dos cartas juntas; sin canto entre carta y destape'
                }
              />
              <RuleDetail
                label="Cartas pasadas"
                value="Activas · cuentan para el Envido, no matan en Truco"
              />
              <RuleDetail
                label="Truco abierto/cerrado"
                value="Manos privadas para todos los asientos"
              />
              <RuleDetail
                label="Tapado"
                value={
                  config.cardPlay === 'matar-tapado'
                    ? 'Experimental; no automatizado en mesas competitivas'
                    : 'Todas las cartas visibles'
                }
              />
              <RuleDetail
                label="Final"
                value="Se gana al alcanzar la meta de piedras · sin Privando"
              />
              <RuleDetail
                label="Señas"
                value="Permitidas, siempre visibles a toda la mesa"
              />
              <RuleDetail
                label="Prioridad"
                value="Flor anula el Envido normal; se puede responder y envidar con Flor. El Envite se acredita antes del Truco; luego se retoma el canto suspendido"
              />
            </dl>
            <div className="rules-caveat">
              <Info className="size-4" />
              <p>
                Si hay Flor, repítela antes de cada carta. La primera parda se
                juega con las dos cartas juntas. Privando, matar tapado, Flor de
                4/5 y Reservada «cobra todo» no están habilitados. Las reglas
                regionales pueden variar. Consulta las{' '}
                <a
                  href="https://www.ludoteka.com/juegos/truco-venezolano/reglas"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  reglas de referencia
                </a>
                .
              </p>
            </div>
          </details>
        </div>
        <DialogFooter className="rules-dialog-footer">
          <Button onClick={() => onOpenChange(false)}>Entendido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RuleDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function CardHierarchy() {
  const vira: TrucoCard = { rank: 6, suit: 'copas' };
  const { perico, perica } = getPieces(vira);
  return (
    <section className="card-hierarchy" aria-labelledby="card-hierarchy-title">
      <h3 id="card-hierarchy-title">¿Qué carta le gana a cuál?</h3>
      <p>
        De mayor a menor: cada fila le gana a todas las de abajo. Las cartas de
        una misma fila empatan, sin importar la pinta.
      </p>
      <p>Ejemplo con vira de 6 de copas:</p>
      <p aria-live="polite">
        Perico: {perico.rank} de {perico.suit}. Perica: {perica.rank} de{' '}
        {perica.suit}.{' '}
        {vira.rank === 10 || vira.rank === 11
          ? 'El 12 sustituye a la pieza que salió de vira.'
          : 'Las piezas son el 11 y el 10 de la pinta de la vira.'}{' '}
        La vira queda en la mesa: no se reparte ni se juega.
      </p>
      <ol className="hierarchy-ladder">
        {cardHierarchy(vira).map(({ strength, label, cards }) => (
          <li key={strength}>
            <strong>{label}</strong>
            <span>
              {cards.map((card) => `${card.rank} de ${card.suit}`).join(' · ')}
            </span>
          </li>
        ))}
      </ol>
      <details>
        <summary>¿Y si hay empate o una carta pasada?</summary>
        <p>
          Si empatan rivales en la primera vuelta, cada jugador coloca sus dos
          cartas restantes juntas, con la mayor arriba. Si las de arriba
          empatan, solo quienes empataron destapan la otra. Si persiste el
          empate, gana el que esté primero en el orden de mano entre los
          empatados.
        </p>
        <p>
          Si se empata la segunda o la tercera vuelta, gana quien ganó la
          primera. Dos cartas iguales de compañeros no producen parda. Una carta
          pasada pierde contra cualquier carta sin pasar y conserva su valor
          para el Envido.
        </p>
      </details>
      <p>
        Esta escalera es para ganar vueltas. En el Envido se suman tantos: dos
        cartas de la misma pinta suman 20 más sus números; las figuras valen 0.
        Con Perico o Perica, se suman 30 o 29 más la mejor otra carta.
      </p>
    </section>
  );
}
