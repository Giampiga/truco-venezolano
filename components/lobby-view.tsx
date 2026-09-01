'use client';

import { SyntheticEvent, useState } from 'react';
import {
  AudioLines,
  ChevronRight,
  Clock3,
  KeyRound,
  LockKeyhole,
  Mic2,
  Plus,
  Radio,
  RotateCcw,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { RoomSummary } from '@/lib/product-types';

const rooms: RoomSummary[] = [
  {
    id: 'catia',
    name: 'Los panas de Catia',
    host: 'Mariale',
    players: '3/4',
    format: '2 contra 2',
    score: 'A 24 piedras',
    rule: 'Oriental clásico',
    voice: 3,
    tone: 'amber',
    status: 'open',
  },
  {
    id: 'plaza',
    name: 'Domingo en la plaza',
    host: 'Rafael C.',
    players: '4/4',
    format: '2 contra 2',
    score: 'A 30 piedras',
    rule: 'Occidental · sin flor',
    voice: 2,
    tone: 'green',
    status: 'playing',
  },
  {
    id: 'apuro',
    name: 'Truco sin apuro',
    host: 'Vale_23',
    players: '1/4',
    format: '2 contra 2',
    score: 'A 24 piedras',
    rule: 'Oriental · con flor',
    voice: 0,
    tone: 'blue',
    status: 'open',
  },
];

type LobbyViewProps = {
  resumeAvailable: boolean;
  onResume: () => void;
  onCreate: () => void;
  onJoin: (room: RoomSummary) => void;
  onJoinCode: (code: string) => void;
  onRefresh: () => void;
};

export function LobbyView({
  resumeAvailable,
  onResume,
  onCreate,
  onJoin,
  onJoinCode,
  onRefresh,
}: LobbyViewProps) {
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');

  function submitCode(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(normalized)) {
      setCodeError('El código debe tener seis letras o números.');
      return;
    }
    setCodeError('');
    onJoinCode(normalized);
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-7 lg:px-10 lg:py-9">
      {resumeAvailable && (
        <section className="resume-banner mb-6 flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary">
              <RotateCcw className="size-5" />
            </div>
            <div>
              <p className="font-semibold">Tu asiento sigue guardado</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Mesa Las Acacias · Base 7 · Nosotros 12, ellos 9
              </p>
            </div>
          </div>
          <Button onClick={onResume} className="h-11 rounded-xl px-4">
            Retomar partida
            <ChevronRight className="size-4" />
          </Button>
        </section>
      )}

      <section className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            <Radio className="size-3.5" />
            18 jugadores conectados
          </div>
          <h1 className="font-display text-4xl font-bold tracking-[-0.035em] sm:text-5xl">
            ¿Dónde echamos la partida?
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Entra a una mesa abierta o reúne a los tuyos con un código privado.
            Cada sala deja las reglas claras antes de repartir.
          </p>
        </div>
        <Button
          onClick={onCreate}
          className="h-12 w-full rounded-xl px-5 text-[15px] shadow-none md:w-auto"
        >
          <Plus className="size-4" />
          Crear una mesa
        </Button>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.12em]">Mesas abiertas</h2>
            <Button
              onClick={onRefresh}
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
            >
              Actualizar
            </Button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {rooms.map((room, index) => (
              <article
                key={room.name}
                className="room-row group grid gap-4 border-b border-border p-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5"
              >
                <div className="flex min-w-0 gap-4">
                  <div className={`room-swatch room-swatch-${room.tone}`} aria-hidden="true">
                    <span>{index + 1}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold tracking-[-0.01em]">{room.name}</h3>
                      {room.status === 'playing' && (
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-800">
                          En juego
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">La abrió {room.host}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <Users className="size-3.5 text-muted-foreground" />
                        {room.players}
                      </span>
                      <span>{room.format}</span>
                      <span className="text-muted-foreground">{room.score}</span>
                      <Badge variant="outline" className="font-normal">
                        {room.rule}
                      </Badge>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Mic2 className="size-3.5" />
                        {room.voice ? `${room.voice} en voz` : 'Sin voz'}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => onJoin(room)}
                  variant={room.status === 'playing' ? 'outline' : 'secondary'}
                  className="h-11 w-full rounded-xl sm:w-auto sm:min-w-28"
                  disabled={room.status === 'playing'}
                >
                  {room.status === 'playing' ? 'Mesa llena' : 'Entrar'}
                  {room.status !== 'playing' && <ChevronRight className="size-4" />}
                </Button>
              </article>
            ))}
          </div>
        </div>

        <aside className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="mb-5 flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
              <KeyRound className="size-5" />
            </div>
            <h2 className="font-display text-2xl font-bold tracking-[-0.025em]">Tengo un código</h2>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">
              Pega el código de seis letras que te pasó quien armó la mesa.
            </p>
            <form onSubmit={submitCode} className="mt-5">
              <div className="flex gap-2">
                <Input
                  aria-label="Código privado de la mesa"
                  aria-describedby={codeError ? 'room-code-error' : undefined}
                  aria-invalid={Boolean(codeError)}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  maxLength={6}
                  autoCapitalize="characters"
                  placeholder="P. ej. CANTO7"
                  className="h-11 rounded-xl font-mono uppercase tracking-[0.12em]"
                />
                <Button type="submit" variant="outline" className="h-11 rounded-xl px-4">
                  Ir
                </Button>
              </div>
              {codeError && (
                <p id="room-code-error" role="alert" className="mt-2 text-xs text-destructive">
                  {codeError}
                </p>
              )}
            </form>
          </section>

          <section className="voice-note rounded-2xl border p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary">
                <AudioLines className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">Voz de mesa</h2>
                  <Badge variant="outline" className="border-primary/20 text-primary">
                    Opcional
                  </Badge>
                </div>
                <p className="mt-2 text-sm leading-5 text-muted-foreground">
                  El micrófono siempre empieza apagado. Tú decides si quieres hablar al sentarte.
                </p>
              </div>
            </div>
          </section>

          <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground sm:col-span-2 xl:col-span-1">
            <LockKeyhole className="size-3.5" />
            Partidas privadas, reportes y bloqueo desde cada mesa.
          </div>
          <div className="hidden items-center gap-2 px-1 text-xs text-muted-foreground xl:flex">
            <Clock3 className="size-3.5" />
            Mesas inactivas se cierran luego de 15 minutos.
          </div>
        </aside>
      </section>
    </div>
  );
}
