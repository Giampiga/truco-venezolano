'use client';

import { SyntheticEvent, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  Info,
  MessageCircle,
  Mic,
  MicOff,
  ShieldCheck,
  VolumeX,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { RoomConfig, RoomSummary } from '@/lib/product-types';

type RoomViewProps = {
  room: RoomSummary;
  config: RoomConfig;
  ready: boolean;
  voiceEnabled: boolean;
  onBack: () => void;
  onReadyChange: (ready: boolean) => void;
  onStart: () => void;
  onOpenVoice: () => void;
  onOpenRules: () => void;
  onToast: (message: string) => void;
};

const seats = [
  { name: 'Mariale', role: 'Mano', team: 'ellos', status: 'host', mic: 'speaking' },
  { name: 'Rafael C.', role: 'Trasmano', team: 'nosotros', status: 'ready', mic: 'on' },
  { name: 'Vale_23', role: 'Antepie', team: 'ellos', status: 'ready', mic: 'deafened' },
  { name: 'CantoClaro', role: 'Pie', team: 'nosotros', status: 'you', mic: 'off' },
] as const;

export function RoomView({
  room,
  config,
  ready,
  voiceEnabled,
  onBack,
  onReadyChange,
  onStart,
  onOpenVoice,
  onOpenRules,
  onToast,
}: RoomViewProps) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    { author: 'Mariale', text: '¿Dejamos pardas abiertas?' },
    { author: 'Rafael C.', text: 'Sí, y con flor a ley.' },
  ]);

  function sendMessage(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = message.trim();
    if (!clean) return;
    setMessages((current) => [...current, { author: 'Tú', text: clean }]);
    setMessage('');
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText('CANTO7');
      onToast('Código CANTO7 copiado.');
    } catch {
      onToast('Código de la mesa: CANTO7');
    }
  }

  return (
    <div className="mx-auto max-w-[1380px] px-4 py-5 sm:px-7 lg:px-10 lg:py-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Button onClick={onBack} variant="ghost" className="-ml-2 h-11 rounded-xl">
          <ArrowLeft className="size-4" />
          Volver al salón
        </Button>
        <Badge variant="outline" className="h-7 gap-1.5 px-3">
          <ShieldCheck className="size-3.5 text-emerald-700" />
          Mesa moderada
        </Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-5 sm:p-7">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{room.status === 'private' ? 'Privada' : 'Abierta'}</Badge>
                  <span className="text-xs text-muted-foreground">4 de 4 asientos</span>
                </div>
                <h1 className="mt-3 font-display text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
                  {room.name}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Revisa las reglas, ponte listo y arrancamos la primera base.
                </p>
              </div>
              <button
                onClick={copyCode}
                className="group flex min-h-12 items-center gap-3 rounded-xl border border-dashed border-primary/35 bg-secondary/50 px-4 text-left transition-colors hover:bg-secondary"
                aria-label="Copiar código de mesa CANTO7"
              >
                <span>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Código de mesa
                  </span>
                  <span className="mt-0.5 block font-mono text-lg font-bold tracking-[0.13em]">CANTO7</span>
                </span>
                <Copy className="size-4 text-muted-foreground group-hover:text-foreground" />
              </button>
            </div>
          </div>

          <div className="p-5 sm:p-7">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Asientos · parejas alternadas
              </h2>
              <span className="text-xs text-muted-foreground">Reparto antihorario</span>
            </div>
            <div className="seat-grid">
              {seats.map((seat) => (
                <article
                  key={seat.name}
                  className={`seat-card ${seat.team === 'nosotros' ? 'seat-card-us' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`player-avatar ${seat.mic === 'speaking' ? 'is-speaking' : ''}`}
                        aria-hidden="true"
                      >
                        {seat.name.slice(0, 1)}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-semibold">{seat.name}</h3>
                          {seat.status === 'host' && (
                            <Crown className="size-3.5 text-amber-700" aria-label="Anfitriona" />
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {seat.role} · {seat.team === 'nosotros' ? 'tu pareja' : 'contrarios'}
                        </p>
                      </div>
                    </div>
                    {seat.mic === 'speaking' && (
                      <span className="voice-indicator text-emerald-700">
                        <Mic className="size-3.5" />
                        <span className="sr-only">Está hablando</span>
                      </span>
                    )}
                    {seat.mic === 'on' && <Mic className="size-4 text-muted-foreground" aria-label="Micrófono activo" />}
                    {seat.mic === 'off' && <MicOff className="size-4 text-muted-foreground" aria-label="Micrófono apagado" />}
                    {seat.mic === 'deafened' && <VolumeX className="size-4 text-muted-foreground" aria-label="Audio desactivado" />}
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground">
                      {seat.status === 'you' ? 'Este eres tú' : 'Conectado'}
                    </span>
                    {seat.status === 'you' ? (
                      <span className={`text-xs font-semibold ${ready ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {ready ? 'Listo' : 'Falta confirmar'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <Check className="size-3.5" />
                        Listo
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-border bg-muted/35 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex min-h-11 items-center gap-3">
              <Switch checked={ready} onCheckedChange={onReadyChange} aria-label="Marcarme listo" />
              <span>
                <span className="block text-sm font-semibold">Estoy listo</span>
                <span className="block text-xs text-muted-foreground">
                  Confirmo estas reglas y mi asiento.
                </span>
              </span>
            </div>
            <Button
              onClick={onStart}
              disabled={!ready}
              className="h-12 rounded-xl px-6 text-[15px]"
            >
              Comenzar partida
            </Button>
          </div>
        </section>

        <aside className="grid content-start gap-4">
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Reglas acordadas
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold">{config.preset === 'rapida' ? 'Mesa rápida' : 'Oriental clásico'}</h2>
              </div>
              <Button onClick={onOpenRules} variant="ghost" size="icon" aria-label="Ver reglas completas">
                <Info className="size-4" />
              </Button>
            </div>
            <dl className="rule-list mt-5">
              <div>
                <dt>Formato</dt>
                <dd>2 contra 2 · {config.target} piedras</dd>
              </div>
              <div>
                <dt>Flor</dt>
                <dd>{config.flor === 'off' ? 'Sin flor' : config.flor === 'por-derecho' ? 'Por derecho' : 'A ley'}</dd>
              </div>
              <div>
                <dt>Primera parda</dt>
                <dd>{config.parda === 'abierta' ? 'Venezolana abierta' : 'Venezolana cerrada'}</dd>
              </div>
              <div>
                <dt>Cantos</dt>
                <dd>Truco · Retruco · Vale 9 · Vale juego</dd>
              </div>
              <div>
                <dt>Señas</dt>
                <dd>Públicas para toda la mesa</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="size-4 text-primary" />
                <h2 className="font-semibold">Voz de mesa</h2>
              </div>
              <Badge variant="outline">{voiceEnabled ? 'Conectada' : 'Apagada'}</Badge>
            </div>
            <p className="mt-3 text-sm leading-5 text-muted-foreground">
              Es opcional. Los cantos solo cuentan cuando se confirman con los botones.
            </p>
            <Button
              onClick={onOpenVoice}
              variant="outline"
              className="mt-4 h-11 w-full rounded-xl"
            >
              {voiceEnabled ? 'Configurar audio' : 'Entrar al canal de voz'}
            </Button>
          </section>

          <section className="rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <MessageCircle className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Conversación</h2>
            </div>
            <div className="max-h-36 space-y-3 overflow-y-auto p-5" aria-live="polite">
              {messages.map((item, index) => (
                <p key={`${item.author}-${index}`} className="text-sm">
                  <span className="font-semibold">{item.author}</span>{' '}
                  <span className="text-muted-foreground">{item.text}</span>
                </p>
              ))}
            </div>
            <form onSubmit={sendMessage} className="flex gap-2 border-t border-border p-3">
              <Input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                aria-label="Mensaje para la mesa"
                placeholder="Escribe a la mesa…"
                className="h-10 rounded-xl"
              />
              <Button type="submit" variant="secondary" className="h-10 rounded-xl">
                Enviar
              </Button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}
