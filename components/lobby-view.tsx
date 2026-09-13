'use client';
import { useState, type ReactNode, type SyntheticEvent } from 'react';
import {
  ArrowUpRight,
  Bot,
  Headphones,
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  Users,
  Trophy,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlobalChat } from '@/components/global-chat';
import { RankingPanel } from '@/components/ranking-panel';
import { Input } from '@/components/ui/input';
import type { GameFormat, RoomSummary } from '@/lib/product-types';

const botRooms: RoomSummary[] = [
  {
    id: 'practice-1v1',
    name: 'Duelo con Truquito',
    host: '1 bot criollo',
    players: '1/2',
    format: '1v1',
    opponent: 'ai',
    score: '24 piedras',
    rule: 'Oriental clásico',
    voice: 0,
    tone: 'green',
    status: 'open',
  },
  {
    id: 'practice-2v2',
    name: 'Parejas con bots',
    host: '3 bots: aprendiz, criollo y maestro',
    players: '3/4',
    format: '2v2',
    opponent: 'ai',
    score: '24 piedras',
    rule: 'Oriental clásico',
    voice: 0,
    tone: 'green',
    status: 'open',
  },
];

type Props = {
  matchmaking: ReactNode;
  nickname: string;
  rooms: RoomSummary[];
  loading: boolean;
  error: string;
  voiceAvailable: boolean;
  resumeAvailable: boolean;
  onlineResume: boolean;
  onResume: () => void;
  onOnlineResume: () => void;
  onCreate: (ranked?: boolean, format?: GameFormat) => void;
  onJoin: (room: RoomSummary) => void;
  onJoinCode: (code: string) => void;
  onPractice: () => void;
  onBotTable: (format: GameFormat) => void;
  onRefresh: () => void;
  onRules: () => void;
  busy: boolean;
};
export function LobbyView(props: Props) {
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [filter, setFilter] = useState<'all' | GameFormat>('all');
  const [mode, setMode] = useState<'casual' | 'ranked'>('casual');
  const [search, setSearch] = useState('');
  const rooms = [...props.rooms, ...botRooms].filter(
    (room) =>
      !!room.ranked === (mode === 'ranked') &&
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
          <p className="eyebrow">TRUCO VENEZOLANO / EN LÍNEA</p>
          <h1>A la mesa.</h1>
          <p>Elige cómo quieres jugar.</p>
        </div>
        <Button
          onClick={() => props.onCreate(mode === 'ranked')}
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
      <div className="play-mode-bar" aria-label="Tipo de partida">
        <button
          aria-pressed={mode === 'casual'}
          onClick={() => setMode('casual')}
        >
          <Users size={24} />
          <span>
            <strong>Entre panas</strong>
            <small>A tu manera. Sin puntos de ranking.</small>
          </span>
          <b>01</b>
        </button>
        <button
          aria-pressed={mode === 'ranked'}
          onClick={() => setMode('ranked')}
        >
          <Trophy size={24} />
          <span>
            <strong>Competitivo</strong>
            <small>Reglas fijas. Cada partida cuenta.</small>
          </span>
          <b>02</b>
        </button>
      </div>
      <div hidden={mode !== 'ranked'}>{props.matchmaking}</div>
      <form className="quick-invite" onSubmit={join}>
        <KeyRound size={18} />
        <label htmlFor="invite-code-input">¿Tienes un código?</label>
        <Input
          id="invite-code-input"
          aria-label="Código de invitación"
          value={code}
          onChange={(e) =>
            setCode(
              e.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '')
                .slice(0, 6),
            )
          }
          placeholder="ABC123"
          maxLength={6}
          autoComplete="off"
        />
        <Button type="submit" variant="outline" disabled={props.busy}>
          Entrar
        </Button>
        {codeError && <span role="alert">{codeError}</span>}
      </form>
      <div className="lobby-columns">
        <section className="lobby-main">
          <div className="section-top">
            <div>
              <h2>
                {mode === 'ranked' ? 'Mesas competitivas' : 'Mesas abiertas'}
              </h2>
              <span>
                {props.loading
                  ? 'Buscando mesas…'
                  : `${rooms.length} disponibles`}
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
          ) : null}
          {rooms.length ? (
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
                        {room.opponent === 'ai'
                          ? `${room.players} · Tu puesto libre`
                          : room.players}
                      </span>
                      <span>{room.score}</span>
                      {room.opponent === 'ai' && (
                        <span>
                          <Bot size={14} /> Práctica · Sin voz ni cámara · Sin
                          ranking
                        </span>
                      )}
                      {room.camera && (
                        <span>
                          <Video size={14} /> Cámara opcional
                        </span>
                      )}
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
                    onClick={() =>
                      botRooms.includes(room)
                        ? props.onBotTable(room.format)
                        : props.onJoin(room)
                    }
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
          ) : !props.error && !props.loading ? (
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
              <Button
                variant="outline"
                onClick={() => props.onCreate(mode === 'ranked')}
              >
                Abrir una mesa <Plus size={16} />
              </Button>
            </div>
          ) : null}
          <div className="lobby-footnote">
            <span className="connection-light online" />
            Las reglas se acuerdan antes de repartir.
            <button onClick={props.onRules}>
              Ver cómo se juega <ArrowUpRight size={14} />
            </button>
          </div>

          <GlobalChat name={props.nickname} />
        </section>
        <aside className="lobby-sidebar">
          {mode === 'ranked' && (
            <RankingPanel onPlay={(format) => props.onCreate(true, format)} />
          )}
          {mode === 'casual' && (
            <section className="practice-panel">
              <div className="panel-heading">
                <Bot size={20} />
                <span className="eyebrow">A TU RITMO</span>
              </div>
              <h2>Afina el canto con Truquito.</h2>
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
          )}
          <details className="inline-help">
            <summary>¿Cómo funcionan las mesas?</summary>
            <button onClick={props.onRules}>Consultar las reglas</button>
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
          </details>
        </aside>
      </div>
      <footer className="club-footer">
        <span>TRUCO / VENEZUELA</span>
        <span>40 cartas. Mil maneras de cantarlo.</span>
        <span>
          Hecho por{' '}
          <a href="https://giampi.me" target="_blank" rel="noopener noreferrer">
            giampiga
          </a>
        </span>
      </footer>
    </div>
  );
}
