'use client';
import { AccountLabel } from '@/components/account-label';
import { Check, Crown, UserRound, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { RoomAction, RoomState } from '@/lib/room-model';

export function RoomView({
  room,
  act,
  pending,
}: {
  room: RoomState;
  act: (action: RoomAction) => Promise<boolean>;
  pending: boolean;
}) {
  const capacity = room.config.format === '1v1' ? 2 : 4;
  const self = room.members.find((member) => member.seatId === room.you)!;
  const full = room.members.length === capacity;
  const allReady =
    full &&
    room.members.every(
      (member) =>
        member.ready &&
        !member.left &&
        room.serverTime - member.lastSeen < 45_000,
    );
  return (
    <section className="waiting-room">
      <div className="waiting-intro">
        <p className="eyebrow">ANTES DE REPARTIR</p>
        <h2>Tu puesto está guardado.</h2>
        <p>Comparte el código, revisen las reglas y pónganse listos.</p>
      </div>
      <div className="room-seat-grid">
        {Array.from({ length: capacity }, (_, index) => {
          const member = room.members.find(
            (member) => member.seatId === `p${index}`,
          );
          const you = member?.seatId === room.you;
          return (
            <article
              className={`real-seat ${you ? 'your-seat' : ''} ${!member ? 'empty-seat' : ''}`}
              key={index}
            >
              <div className="seat-topline">
                <span>ASIENTO {String(index + 1).padStart(2, '0')}</span>
                <span>EQUIPO {index % 2 === 0 ? 'A' : 'B'}</span>
              </div>
              <div className="seat-identity">
                <span className="seat-monogram">
                  {member ? (
                    member.name.slice(0, 1).toUpperCase()
                  ) : (
                    <UserRound size={24} />
                  )}
                </span>
                <div>
                  <h3>
                    {member?.name ?? 'Puesto libre'}
                    {member && <AccountLabel handle={member.handle} />}
                    {member?.seatId === room.host && <Crown size={15} />}
                  </h3>
                  <p>
                    {you
                      ? 'Este eres tú'
                      : member
                        ? 'En la mesa'
                        : 'Esperando a un pana'}
                  </p>
                </div>
              </div>
              <div className="seat-readiness">
                {member ? (
                  <>
                    <span
                      className={`connection-light ${room.serverTime - member.lastSeen < 45_000 ? 'online' : ''}`}
                    />
                    {room.serverTime - member.lastSeen >= 45_000 ? (
                      'Reconectando'
                    ) : member.ready ? (
                      <>
                        <Check size={14} />
                        Listo para jugar
                      </>
                    ) : (
                      'Revisando las reglas'
                    )}
                  </>
                ) : (
                  <>
                    <Users size={14} />
                    Invita con el código de arriba
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <div className="ready-bar">
        <label htmlFor="ready-switch">
          <Switch
            id="ready-switch"
            checked={self.ready}
            onCheckedChange={(ready) => void act({ type: 'ready', ready })}
            disabled={pending}
            aria-label="Estoy listo para jugar"
          />
          <span>
            <strong>Estoy listo</strong>
            <small>De acuerdo con las reglas de esta mesa.</small>
          </span>
        </label>
        <Button
          disabled={pending || !allReady || room.host !== room.you}
          onClick={() => void act({ type: 'start' })}
        >
          {room.host === room.you
            ? 'Repartir las cartas'
            : 'Esperando al anfitrión'}
        </Button>
      </div>
      {!allReady && (
        <p className="waiting-hint">
          {!full
            ? `Falta${capacity - room.members.length === 1 ? '' : 'n'} ${capacity - room.members.length} ${capacity - room.members.length === 1 ? 'jugador' : 'jugadores'} para completar la mesa.`
            : 'Todos deben confirmar que están listos.'}
        </p>
      )}
    </section>
  );
}
