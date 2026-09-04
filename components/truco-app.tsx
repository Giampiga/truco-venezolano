'use client';
import { useCallback, useEffect, useState, type SyntheticEvent } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Copy,
  Download,
  LockKeyhole,
  BookOpen,
  UserRound,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LobbyView } from '@/components/lobby-view';
import { RoomView } from '@/components/room-view';
import { OnlineTable } from '@/components/online-table';
import { RoomChat } from '@/components/room-chat';
import { VoiceRoom } from '@/components/voice-room';
import { GameTable } from '@/components/game-table';
import {
  CreateRoomDialog,
  PracticeDialog,
  RulesDialog,
} from '@/components/room-dialogs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DEFAULT_CONFIG, presetName, type RoomState } from '@/lib/room-model';
import { roomRequest, RoomRequestError, useRoom } from '@/hooks/use-room';
import type { RoomConfig, RoomSummary } from '@/lib/product-types';
import type { PracticeDifficulty } from '@/lib/practice-ai';

type Practice = {
  room: RoomSummary;
  config: RoomConfig;
  difficulty: PracticeDifficulty;
  guided: boolean;
  resume: boolean;
};
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export function TrucoApp() {
  const online = useRoom();
  const [nickname, setNickname] = useState('');
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [lobbyError, setLobbyError] = useState('');
  const [needsSignin, setNeedsSignin] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [config, setConfig] = useState<RoomConfig>(DEFAULT_CONFIG);
  const [createOpen, setCreateOpen] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [practice, setPractice] = useState<Practice | null>(null);
  const [practiceResume, setPracticeResume] = useState(false);
  const [onlineResume, setOnlineResume] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [actionError, setActionError] = useState('');
  const [invitation, setInvitation] = useState('');
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await roomRequest<{
        rooms: RoomSummary[];
        voiceAvailable: boolean;
      }>('/api/rooms');
      setRooms(data.rooms);
      setVoiceAvailable(data.voiceAvailable);
      setLobbyError('');
      setNeedsSignin(false);
    } catch (error) {
      setLobbyError(
        error instanceof Error ? error.message : 'No se pudo abrir el salón.',
      );
      setNeedsSignin(error instanceof RoomRequestError && error.status === 401);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const initialize = window.setTimeout(() => {
      setNickname(localStorage.getItem('truco-nickname') ?? '');
      setPracticeResume(!!localStorage.getItem('truco-active-table'));
      setOnlineResume(localStorage.getItem('truco-online-room') ?? '');
      setInvitation(
        new URLSearchParams(location.search)
          .get('mesa')
          ?.toUpperCase()
          .slice(0, 6) ?? '',
      );
      void refresh();
    }, 0);
    const handler = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => {
      window.clearTimeout(initialize);
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, [refresh]);
  useEffect(() => {
    if (!online.room && !practice) {
      const timer = setInterval(() => {
        if (!document.hidden) void refresh();
      }, 15000);
      return () => clearInterval(timer);
    }
  }, [online.room, practice, refresh]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  function updateName(value: string) {
    setNickname(value);
    localStorage.setItem('truco-nickname', value);
  }
  function ensureName() {
    if (nickname.trim().length >= 2) return true;
    setActionError('Elige un nombre de al menos 2 caracteres para sentarte.');
    document.getElementById('player-name')?.focus();
    return false;
  }
  async function join(id: string) {
    if (busy || !ensureName()) return;
    setBusy(true);
    setActionError('');
    try {
      const room = await roomRequest<RoomState>(
        `/api/rooms/${encodeURIComponent(id)}`,
        { type: 'join', name: nickname },
      );
      online.enter(room);
      setOnlineResume(room.id);
      setInvitation('');
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'No pudimos entrar a la mesa.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function create(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !ensureName()) return;
    setBusy(true);
    setActionError('');
    try {
      const room = await roomRequest<RoomState>('/api/rooms', {
        config,
        name: nickname,
      });
      online.enter(room);
      setOnlineResume(room.id);
      setCreateOpen(false);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'No pudimos crear la mesa.',
      );
    } finally {
      setBusy(false);
    }
  }
  function startPractice(options: {
    difficulty: PracticeDifficulty;
    preset: RoomConfig['preset'];
    target: RoomConfig['target'];
    guided: boolean;
  }) {
    const config: RoomConfig = {
      ...DEFAULT_CONFIG,
      name: 'Práctica con Truquito',
      format: '1v1',
      opponent: 'ai',
      preset: options.preset,
      target: options.target,
      voice: false,
      flor: options.preset === 'rapida' ? 'off' : 'a-ley',
      parda: options.preset === 'oriental' ? 'abierta' : 'cerrada',
      pardaEngine:
        options.preset === 'rapida' ? 'secuencial-online' : 'apilada-clasica',
      match: options.preset === 'competitiva' ? 'mejor-de-tres' : 'un-chico',
    };
    const room: RoomSummary = {
      id: 'practice-ai',
      name: config.name,
      host: 'Truquito',
      players: '2/2',
      format: '1v1',
      opponent: 'ai',
      score: `A ${config.target} piedras`,
      rule: presetName(config.preset),
      voice: 0,
      tone: 'green',
      status: 'private',
    };
    setPractice({
      room,
      config,
      difficulty: options.difficulty,
      guided: options.guided,
      resume: false,
    });
    setPracticeOpen(false);
    setPracticeResume(true);
  }
  function resumePractice() {
    try {
      const data = JSON.parse(
        localStorage.getItem('truco-active-table') ?? '{}',
      );
      if (!data.engine || data.config?.opponent !== 'ai') throw new Error();
      setPractice({
        room: data.room,
        config: data.config,
        difficulty: data.practiceDifficulty ?? 'criollo',
        guided: data.guidedPractice ?? true,
        resume: true,
      });
    } catch {
      setPracticeResume(false);
      setActionError(
        'No encontramos una práctica guardada compatible. Puedes empezar otra.',
      );
    }
  }
  async function copyInvite() {
    if (!online.room) return;
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/?mesa=${online.room.code}`,
      );
      setToast('Enlace de invitación copiado.');
    } catch {
      setToast(`Código de la mesa: ${online.room.code}`);
    }
  }
  const activeConfig = online.room?.config ?? practice?.config ?? config;
  return (
    <main className="truco-club">
      {!practice && (
        <header className="club-header">
          <div className="club-header-inner">
            <button
              className="club-brand"
              aria-label="Truco, volver al salón"
              onClick={() => (online.room ? setLeaveOpen(true) : undefined)}
            >
              <span className="club-logo">T</span>
              <span>
                TRUCO<small>LA MESA VENEZOLANA</small>
              </span>
            </button>
            <nav aria-label="Navegación principal">
              <span className="nav-current">
                {online.room ? 'Tu mesa' : 'El salón'}
              </span>
              <button onClick={() => setRulesOpen(true)}>
                <BookOpen size={16} />
                Las reglas
              </button>
            </nav>
            <div className="header-profile">
              {install && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Instalar Truco"
                  onClick={async () => {
                    await install.prompt();
                    setInstall(null);
                  }}
                >
                  <Download size={17} />
                </Button>
              )}
              <UserRound size={17} />
              <Input
                id="player-name"
                aria-label="Tu nombre de jugador"
                placeholder="Tu nombre"
                maxLength={24}
                value={nickname}
                onChange={(event) => updateName(event.target.value)}
              />
            </div>
          </div>
        </header>
      )}
      {needsSignin && (
        <div className="invitation-strip">
          <span>Inicia sesión para jugar con tus panas.</span>
          <a
            href={`/signin-with-chatgpt?return_to=${encodeURIComponent(invitation ? `/?mesa=${invitation}` : '/')}`}
            target="_top"
          >
            Continuar con ChatGPT →
          </a>
        </div>
      )}
      {!online.room && online.error && (
        <p className="global-error" role="alert">
          {online.error}
        </p>
      )}
      {actionError && (
        <div className="global-error" role="alert">
          <span>{actionError}</span>
          <button aria-label="Cerrar aviso" onClick={() => setActionError('')}>
            <X size={16} />
          </button>
        </div>
      )}
      {!online.room && !practice && (
        <>
          {invitation && (
            <div className="invitation-strip">
              <span>
                Te invitaron a la mesa <strong>{invitation}</strong>. Escribe tu
                nombre arriba y toma asiento.
              </span>
              <Button disabled={busy} onClick={() => void join(invitation)}>
                Entrar a esta mesa <ArrowUpRight size={16} />
              </Button>
            </div>
          )}
          <LobbyView
            rooms={rooms}
            loading={loading}
            error={lobbyError}
            voiceAvailable={voiceAvailable}
            resumeAvailable={practiceResume}
            onlineResume={!!onlineResume}
            onResume={resumePractice}
            onOnlineResume={() => void join(onlineResume)}
            onCreate={() => {
              if (ensureName()) {
                setConfig({
                  ...DEFAULT_CONFIG,
                  name: `Mesa de ${nickname}`.slice(0, 36),
                });
                setCreateOpen(true);
              }
            }}
            onJoin={(room) => void join(room.id)}
            onJoinCode={(code) => void join(code)}
            onPractice={() => setPracticeOpen(true)}
            onRefresh={() => void refresh()}
            onRules={() => setRulesOpen(true)}
            busy={busy}
          />
        </>
      )}
      {online.room && (
        <div className="club-layout room-layout">
          <div className="room-breadcrumb">
            <Button variant="ghost" onClick={() => setLeaveOpen(true)}>
              <ArrowLeft size={16} />
              El salón
            </Button>
            <span>
              <span
                className={`connection-light ${online.connected ? 'online' : ''}`}
              />
              {online.connected ? 'Mesa conectada' : 'Reconectando…'}
            </span>
          </div>
          <div className="room-page-heading">
            <div>
              <p className="eyebrow">
                {online.room.config.isPrivate ? 'MESA PRIVADA' : 'MESA ABIERTA'}{' '}
                / {online.room.config.format}
              </p>
              <h1>{online.room.config.name}</h1>
              <p>
                {presetName(online.room.config.preset)} · A{' '}
                {online.room.config.target} piedras
              </p>
            </div>
            <button
              className="invite-code"
              onClick={copyInvite}
              aria-label="Copiar enlace de invitación"
            >
              <span>
                CÓDIGO DE MESA<strong>{online.room.code}</strong>
              </span>
              <Copy size={19} />
            </button>
          </div>
          {online.error && (
            <p className="global-error" role="alert">
              {online.error}
            </p>
          )}
          {online.room.closed ? (
            <section className="lobby-empty">
              <h2>La mesa está cerrada.</h2>
              <Button
                onClick={() => {
                  online.detach();
                  setOnlineResume('');
                  void refresh();
                }}
              >
                Volver al salón
              </Button>
            </section>
          ) : (
            <div className="room-columns">
              <div className="min-w-0">
                {online.room.game ? (
                  <OnlineTable
                    room={online.room}
                    act={online.act}
                    pending={online.pending}
                    connected={online.connected}
                  />
                ) : (
                  <RoomView
                    room={online.room}
                    act={online.act}
                    pending={online.pending}
                  />
                )}
                <div className="room-rules-strip">
                  <LockKeyhole size={16} />
                  <span>
                    Reglas acordadas ·{' '}
                    {online.room.config.flor === 'off'
                      ? 'Sin flor'
                      : 'Con flor'}{' '}
                    · Pardas{' '}
                    {online.room.config.parda === 'abierta'
                      ? 'abiertas'
                      : 'cerradas'}
                  </span>
                  <button onClick={() => setRulesOpen(true)}>
                    Ver reglas <ArrowUpRight size={15} />
                  </button>
                </div>
              </div>
              <aside className="room-sidebar">
                <VoiceRoom
                  key={online.room.id}
                  roomId={online.room.id}
                  enabled={online.room.config.voice}
                />
                <RoomChat
                  room={online.room}
                  act={online.act}
                  pending={online.pending}
                />
              </aside>
            </div>
          )}
        </div>
      )}
      {practice && (
        <GameTable
          room={practice.room}
          config={practice.config}
          practiceDifficulty={practice.difficulty}
          guidedPractice={practice.guided}
          resumeFromStorage={practice.resume}
          networkState="online"
          voiceEnabled={false}
          muted
          deafened={false}
          onToggleMute={() => {}}
          onToggleDeafen={() => {}}
          onOpenVoice={() =>
            setToast(
              'La práctica es individual. La voz está en las mesas con tus panas.',
            )
          }
          onOpenRules={() => setRulesOpen(true)}
          onOpenReport={() => setToast('Estás en una práctica individual.')}
          onLeave={() => {
            setPractice(null);
            setPracticeResume(true);
          }}
          onToast={setToast}
        />
      )}
      <CreateRoomDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        config={config}
        onConfigChange={setConfig}
        onSubmit={create}
      />
      <PracticeDialog
        open={practiceOpen}
        onOpenChange={setPracticeOpen}
        initialDifficulty="criollo"
        onStart={startPractice}
      />
      <RulesDialog
        open={rulesOpen}
        onOpenChange={setRulesOpen}
        config={activeConfig}
      />
      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Sales de la mesa?</DialogTitle>
            <DialogDescription>
              {online.room?.game
                ? 'La partida se pausará hasta que vuelvas. La voz se desconectará.'
                : 'Tu asiento quedará libre y la voz se desconectará.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveOpen(false)}>
              Me quedo
            </Button>
            {online.room?.host === online.room?.you && (
              <Button
                variant="outline"
                disabled={online.pending}
                onClick={async () => {
                  if (await online.act({ type: 'close' })) {
                    online.detach();
                    setOnlineResume('');
                    setLeaveOpen(false);
                    void refresh();
                  }
                }}
              >
                Cerrar la mesa
              </Button>
            )}
            <Button
              disabled={online.pending}
              onClick={async () => {
                const saved = online.room?.game ? online.room.id : '';
                if (await online.act({ type: 'leave' })) {
                  setOnlineResume(saved);
                  if (saved) localStorage.setItem('truco-online-room', saved);
                  setLeaveOpen(false);
                  void refresh();
                }
              }}
            >
              Salir al salón
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {toast && (
        <output className="app-toast" aria-live="polite">
          {toast}
        </output>
      )}
    </main>
  );
}
