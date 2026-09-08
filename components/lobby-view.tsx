'use client';
import { useState, type SyntheticEvent } from 'react';
import {
  ArrowUpRight,
  Bot,
  Headphones,
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { GameFormat, RoomSummary } from '@/lib/product-types';

type Props = {
  rooms: RoomSummary[];
  loading: boolean;
  error: string;
  voiceAvailable: boolean;
  resumeAvailable: boolean;
  onlineResume: boolean;
  onResume: () => void;
  onOnlineResume: () => void;
  onCreate: () => void;
  onJoin: (room: RoomSummary) => void;
  onJoinCode: (code: string) => void;
  onPractice: () => void;
  onRefresh: () => void;
  onRules: () => void;
  busy: boolean;
};
export function LobbyView(props: Props) {
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [filter, setFilter] = useState<'all' | GameFormat>('all');
  const [search, setSearch] = useState('');
  const rooms = props.rooms.filter(
    (room) =>
      (filter === 'all' || room.format === filter) &&
      `${room.name} ${room.host}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  function join(event: SyntheticEvent) {
    event.preventDefault();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setCodeError('El código tiene 6 letras o números.');
      return;
    }
    setCodeError('');
    props.onJoinCode(code);
  }
  return (
    <div className="club-layout">
      <div className="lobby-title">
        <div>
          <p className="eyebrow">EL SALÓN</p>
          <h1>Una mesa. Buenos panas.</h1>
          <p>Busca tu partida o reúne a los tuyos.</p>
        </div>
        <Button
          onClick={props.onCreate}
          className="create-button"
          disabled={props.busy}
        >
          <Plus size={18} />
          Crear mesa
        </Button>
      </div>
      {(props.onlineResume || props.resumeAvailable) && (
        <div className="resume-strip">
          <span>Tu partida puede continuar.</span>
          <div>
            {props.onlineResume && (
              <Button
                variant="outline"
                onClick={props.onOnlineResume}
                disabled={props.busy}
              >
                Volver a mi mesa <ArrowUpRight size={15} />
              </Button>
            )}
            {props.resumeAvailable && (
              <Button variant="ghost" onClick={props.onResume}>
                Retomar práctica
              </Button>
            )}
          </div>
        </div>
      )}
      <div className="lobby-columns">
        <section className="lobby-main">
          <div className="section-top">
            <div>
              <h2>Mesas abiertas</h2>
              <span>
                {props.loading
                  ? 'Buscando mesas…'
                  : `${props.rooms.length} disponibles`}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Actualizar mesas"
              disabled={props.loading}
              onClick={props.onRefresh}
            >
              <RefreshCw
                size={16}
                className={props.loading ? 'animate-spin' : ''}
              />
            </Button>
          </div>
          <div className="room-toolbar">
            <div className="segmented">
              {(['all', '2v2', '1v1'] as const).map((value) => (
                <button
                  key={value}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {value === 'all'
                    ? 'Todas'
                    : value === '2v2'
                      ? 'En parejas'
                      : 'Duelo'}
                </button>
              ))}
            </div>
            <label className="room-search">
              <Search size={16} />
              <input
                aria-label="Buscar una mesa"
                placeholder="Buscar mesa o anfitrión"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>
          {props.error ? (
            <div className="lobby-empty">
              <p role="alert">{props.error}</p>
              <Button variant="outline" onClick={props.onRefresh}>
                Volver a conectar
              </Button>
            </div>
          ) : rooms.length ? (
            <div className="live-room-list">
              {rooms.map((room) => (
                <article className="live-room-row" key={room.id}>
                  <span className="room-number">
                    {room.format === '1v1' ? '02' : '04'}
                  </span>
                  <div className="room-description">
                    <h3>{room.name}</h3>
                    <p>
                      {room.host} <span>·</span> {room.rule}
                    </p>
                    <div className="room-meta">
                      <span>
                        <Users size={14} />
                        {room.players}
                      </span>
                      <span>{room.score}</span>
                      {room.voice > 0 && (
                        <span>
                          <Headphones size={14} />
                          Voz opcional
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => props.onJoin(room)}
                    disabled={
                      props.busy ||
                      room.players.split('/')[0] === room.players.split('/')[1]
                    }
                  >
                    Sentarme <ArrowUpRight size={16} />
                  </Button>
                </article>
              ))}
            </div>
          ) : (
            <div className="lobby-empty">
              <Users size={28} strokeWidth={1.3} />
              <h3>
                {search || filter !== 'all'
                  ? 'No hay mesas con ese filtro'
                  : 'La próxima partida empieza contigo'}
              </h3>
              <p>
                {search || filter !== 'all'
                  ? 'Prueba otra búsqueda o crea tu propia mesa.'
                  : 'Crea una mesa e invita a tus panas. Mientras llegan, practica con Truquito.'}
              </p>
              <Button variant="outline" onClick={props.onCreate}>
                Abrir una mesa <Plus size={16} />
              </Button>
            </div>
          )}
          <div className="lobby-footnote">
            <span className="connection-light online" />
            Las reglas se acuerdan antes de repartir.
            <button onClick={props.onRules}>
              Ver cómo se juega <ArrowUpRight size={14} />
            </button>
          </div>
          <section className="rule-guide">
            <p className="eyebrow">EL TRUCO DE AQUÍ</p>
            <h2>La vira cambia todo.</h2>
            <p>
              El Perico y la Perica mandan. Cantamos Truco, Retruco, Vale nueve
              y Vale juego. Elige las variantes de tu mesa antes de sentarte.
            </p>
            <Button variant="ghost" onClick={props.onRules}>
              Conocer las reglas <ArrowUpRight size={16} />
            </Button>
          </section>
        </section>
        <aside className="lobby-sidebar">
          <section className="invite-panel">
            <KeyRound size={21} />
            <h2>¿Te guardaron puesto?</h2>
            <p>Entra con el código de tu mesa.</p>
            <form onSubmit={join}>
              <Input
                aria-label="Código de invitación"
                value={code}
                onChange={(event) =>
                  setCode(
                    event.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, '')
                      .slice(0, 6),
                  )
                }
                placeholder="ABC123"
                className="code-input"
                maxLength={6}
                autoComplete="off"
              />
              <Button type="submit" variant="secondary" disabled={props.busy}>
                Entrar con código <ArrowUpRight size={16} />
              </Button>
            </form>
            {codeError && (
              <p className="inline-error" role="alert">
                {codeError}
              </p>
            )}
          </section>
          <section className="practice-panel">
            <div className="panel-heading">
              <Bot size={20} />
              <span className="eyebrow">A TU RITMO</span>
            </div>
            <h2>
              Afina el canto{' '}
              <br />
              con Truquito.
            </h2>
            <p>
              Tres niveles. Sin presión. Aprende a leer la mesa y prueba tus
              jugadas.
            </p>
            <div className="difficulty-line">
              <span>Aprendiz</span>
              <span>Criollo</span>
              <span>Maestro</span>
            </div>
            <Button onClick={props.onPractice}>
              Jugar contra la IA <ArrowUpRight size={16} />
            </Button>
          </section>
          <div className="voice-lobby-note">
            <Headphones size={20} />
            <p>
              <strong>
                {props.voiceAvailable
                  ? 'La sobremesa también se juega.'
                  : 'El chat de la mesa está abierto.'}
              </strong>
              {props.voiceAvailable
                ? 'Habla en la sala y durante la partida. La voz es opcional.'
                : 'Coordina la partida por escrito. La voz estará disponible cuando se conecte el servicio.'}
            </p>
          </div>
        </aside>
      </div>
      <footer className="club-footer">
        <span>TRUCO / VENEZUELA</span>
        <span>40 cartas. Mil maneras de cantarlo.</span>
      </footer>
    </div>
  );
}
