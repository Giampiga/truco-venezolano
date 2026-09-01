'use client';

import { SyntheticEvent, useEffect, useState } from 'react';
import {
  AudioLines,
  Bot,
  CircleUserRound,
  Download,
  Info,
  LockKeyhole,
  Mic,
  ShieldAlert,
} from 'lucide-react';

import { GameTable } from '@/components/game-table';
import { LobbyView } from '@/components/lobby-view';
import { RoomView } from '@/components/room-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Textarea } from '@/components/ui/textarea';
import type {
  AppView,
  NetworkState,
  RoomConfig,
  RoomSummary,
} from '@/lib/product-types';
import type { PracticeDifficulty } from '@/lib/practice-ai';

const defaultConfig: RoomConfig = {
  name: 'Mesa Las Acacias',
  format: '2v2',
  opponent: 'human',
  preset: 'oriental',
  target: '24',
  match: 'un-chico',
  flor: 'a-ley',
  florPoints: '3',
  reservada: 'condicionada',
  parda: 'abierta',
  pardaEngine: 'apilada-clasica',
  truco: 'abierto',
  envido: 'clasico',
  cardPlay: 'visible',
  privando: true,
  voice: true,
  isPrivate: true,
};

const defaultRoom: RoomSummary = {
  id: 'acacias',
  name: 'Mesa Las Acacias',
  host: 'Mariale',
  players: '4/4',
  format: '2v2',
  opponent: 'human',
  score: 'A 24 piedras',
  rule: 'Oriental clásico',
  voice: 4,
  tone: 'amber',
  status: 'private',
};

function normalizeConfig(saved?: Partial<RoomConfig>): RoomConfig {
  return {
    ...defaultConfig,
    ...saved,
    pardaEngine: saved?.pardaEngine ?? defaultConfig.pardaEngine,
  };
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function TrucoApp() {
  const [view, setView] = useState<AppView>('lobby');
  const [room, setRoom] = useState<RoomSummary>(defaultRoom);
  const [config, setConfig] = useState<RoomConfig>(defaultConfig);
  const [ready, setReady] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [resumeAvailable, setResumeAvailable] = useState(false);
  const [resumeRequested, setResumeRequested] = useState(false);
  const [networkState, setNetworkState] = useState<NetworkState>('online');
  const [toast, setToast] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [muted, setMuted] = useState(true);
  const [deafened, setDeafened] = useState(false);
  const [voicePermission, setVoicePermission] = useState<'idle' | 'requesting' | 'denied'>('idle');
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [practiceDifficulty, setPracticeDifficulty] = useState<PracticeDifficulty>('criollo');
  const [guidedPractice, setGuidedPractice] = useState(true);

  useEffect(() => {
    if (window.localStorage.getItem('truco-active-table')) {
      window.setTimeout(() => setResumeAvailable(true), 0);
    }

    function goOffline() {
      setNetworkState('reconnecting');
    }

    function goOnline() {
      setNetworkState('restored');
      window.setTimeout(() => setNetworkState('online'), 2600);
    }

    function captureInstall(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    window.addEventListener('beforeinstallprompt', captureInstall);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('beforeinstallprompt', captureInstall);
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function joinRoom(nextRoom: RoomSummary) {
    setRoom(nextRoom);
    setConfig({
      ...defaultConfig,
      name: nextRoom.name,
      format: nextRoom.format,
      opponent: nextRoom.opponent,
      target: nextRoom.score.includes('32') ? '32' : nextRoom.score.includes('12') ? '12' : '24',
      isPrivate: nextRoom.status === 'private',
    });
    setReady(false);
    setView('room');
  }

  function joinByCode(code: string) {
    joinRoom({
      ...defaultRoom,
      id: code.toLowerCase(),
      name: 'Mesa privada de Mariale',
      status: 'private',
    });
    setToast('Código ' + code + ' verificado. Tu asiento está listo.');
  }

  function createRoom(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextRoom: RoomSummary = {
      ...defaultRoom,
      id: 'own-room',
      name: config.name.trim() || 'Mi mesa',
      host: 'CantoClaro',
      players: config.format === '1v1' ? '2/2' : '4/4',
      format: config.format,
      opponent: 'human',
      score: 'A ' + config.target + ' piedras',
      rule:
        config.preset === 'oriental'
          ? 'Oriental clásico'
          : config.preset === 'competitiva'
            ? 'Competitiva larga'
            : 'Mesa rápida',
      voice: config.voice ? (config.format === '1v1' ? 2 : 4) : 0,
      status: config.isPrivate ? 'private' : 'open',
    };
    setRoom(nextRoom);
    setCreateOpen(false);
    setReady(false);
    setView('room');
  }

  function startGame() {
    setResumeRequested(false);
    const snapshot = JSON.stringify({
      room,
      config,
      practiceDifficulty,
      guidedPractice,
      code: 'CANTO7',
      scoreUs: 12,
      scoreThem: 9,
      base: 7,
      savedAt: Date.now(),
    });
    window.localStorage.setItem('truco-active-table', snapshot);
    setResumeAvailable(true);
    setView('game');
  }

  function resumeGame() {
    try {
      const saved = window.localStorage.getItem('truco-active-table');
      if (!saved) throw new Error('missing');
      const snapshot = JSON.parse(saved) as {
        room?: RoomSummary;
        config?: RoomConfig;
        practiceDifficulty?: PracticeDifficulty;
        guidedPractice?: boolean;
      };
      setRoom(snapshot.room ?? defaultRoom);
      setConfig(normalizeConfig(snapshot.config));
      setPracticeDifficulty(snapshot.practiceDifficulty ?? 'criollo');
      setGuidedPractice(snapshot.guidedPractice ?? true);
    } catch {
      setRoom(defaultRoom);
      setConfig(defaultConfig);
    }
    setView('game');
    setResumeRequested(true);
    setToast('Partida recuperada desde la última acción confirmada.');
  }

  function quickPlay(format: RoomConfig['format']) {
    joinRoom({
      ...defaultRoom,
      id: `quick-${format}`,
      name: format === '1v1' ? 'Duelo rápido' : 'Mesa rápida 2v2',
      players: format === '1v1' ? '2/2' : '4/4',
      format,
      opponent: 'human',
      status: 'open',
    });
    setToast(format === '1v1' ? 'Rival encontrado. Revisen la mesa.' : 'Pareja y rivales encontrados.');
  }

  function startPractice({
    difficulty,
    preset,
    target,
    guided,
  }: {
    difficulty: PracticeDifficulty;
    preset: RoomConfig['preset'];
    target: RoomConfig['target'];
    guided: boolean;
  }) {
    const presetRules: Partial<RoomConfig> =
      preset === 'rapida'
        ? {
            flor: 'off',
            parda: 'cerrada',
            pardaEngine: 'secuencial-online',
            truco: 'cerrado',
            envido: 'escalera-online',
            cardPlay: 'visible',
            privando: false,
          }
        : preset === 'competitiva'
          ? {
              match: 'mejor-de-tres',
              flor: 'a-ley',
              parda: 'cerrada',
              pardaEngine: 'apilada-clasica',
              truco: 'cerrado',
              envido: 'clasico',
              cardPlay: 'visible',
              privando: target === '24',
            }
          : {
              flor: 'a-ley',
              parda: 'abierta',
              pardaEngine: 'apilada-clasica',
              truco: 'abierto',
              envido: 'clasico',
              cardPlay: 'visible',
              privando: target === '24',
            };
    const practiceConfig: RoomConfig = {
      ...defaultConfig,
      ...presetRules,
      name: 'Práctica con Truquito',
      format: '1v1',
      opponent: 'ai',
      preset,
      target,
      voice: false,
      isPrivate: true,
    };
    const practiceRoom: RoomSummary = {
      ...defaultRoom,
      id: 'practice-ai',
      name: 'Práctica con Truquito',
      host: 'Truquito · IA',
      players: '2/2',
      format: '1v1',
      opponent: 'ai',
      score: `A ${target} piedras`,
      rule:
        preset === 'competitiva'
          ? 'Competitiva larga'
          : preset === 'rapida'
            ? 'Mesa rápida'
            : 'Oriental clásico',
      voice: 0,
      status: 'private',
    };
    setConfig(practiceConfig);
    setRoom(practiceRoom);
    setPracticeDifficulty(difficulty);
    setGuidedPractice(guided);
    setPracticeOpen(false);
    const saved = JSON.stringify({
      room: practiceRoom,
      config: practiceConfig,
      practiceDifficulty: difficulty,
      guidedPractice: guided,
      scoreUs: 0,
      scoreThem: 0,
      base: 1,
      savedAt: Date.now(),
    });
    window.localStorage.setItem('truco-active-table', saved);
    setResumeAvailable(true);
    setResumeRequested(false);
    setView('game');
  }

  function exitGame() {
    setResumeAvailable(true);
    setView('lobby');
    setToast('Tu asiento quedó guardado para retomar la partida.');
  }

  async function enableVoice() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoicePermission('denied');
      return;
    }
    setVoicePermission('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setVoiceEnabled(true);
      setMuted(true);
      setVoicePermission('idle');
      setVoiceOpen(false);
      setToast('Permiso listo. Tu micrófono sigue apagado.');
    } catch {
      setVoicePermission('denied');
    }
  }

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setToast('Truco quedó instalado en este dispositivo.');
    }
    setInstallPrompt(null);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      {view !== 'game' && (
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-7 lg:px-10">
            <button
              onClick={() => setView('lobby')}
              className="flex min-h-11 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label="Ir al salón principal de Truco"
            >
              <span className="brand-mark" aria-hidden="true">
                T
              </span>
              <span>
                <span className="font-display block text-[1.08rem] font-bold leading-none tracking-[-0.02em]">
                  Truco
                </span>
                <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  La mesa venezolana
                </span>
              </span>
            </button>

            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
                <span className="status-dot" />
                Caracas · 42 ms
              </div>
              {installPrompt && (
                <Button onClick={installApp} variant="outline" size="sm" className="hidden sm:inline-flex">
                  <Download className="size-3.5" />
                  Instalar
                </Button>
              )}
              <span className="hidden h-6 w-px bg-border sm:block" />
              <Button variant="ghost" size="lg" className="h-10 gap-2 rounded-xl px-2 sm:px-3">
                <CircleUserRound className="size-5" />
                <span className="hidden sm:inline">CantoClaro</span>
              </Button>
            </div>
          </div>
        </header>
      )}

      {view === 'lobby' && (
        <LobbyView
          resumeAvailable={resumeAvailable}
          onResume={resumeGame}
          onCreate={() => setCreateOpen(true)}
          onJoin={joinRoom}
          onJoinCode={joinByCode}
          onQuickPlay={quickPlay}
          onPractice={() => setPracticeOpen(true)}
          onRefresh={() => setToast('Salón actualizado: 4 mesas disponibles.')}
        />
      )}

      {view === 'room' && (
        <RoomView
          room={room}
          config={config}
          ready={ready}
          voiceEnabled={voiceEnabled}
          onBack={() => setView('lobby')}
          onReadyChange={setReady}
          onStart={startGame}
          onOpenVoice={() => setVoiceOpen(true)}
          onOpenRules={() => setRulesOpen(true)}
          onToast={setToast}
        />
      )}

      {view === 'game' && (
        <GameTable
          room={room}
          config={config}
          practiceDifficulty={practiceDifficulty}
          guidedPractice={guidedPractice}
          resumeFromStorage={resumeRequested}
          networkState={networkState}
          voiceEnabled={voiceEnabled}
          muted={muted}
          deafened={deafened}
          onToggleMute={() => setMuted((value) => !value)}
          onToggleDeafen={() => setDeafened((value) => !value)}
          onOpenVoice={() => setVoiceOpen(true)}
          onOpenRules={() => setRulesOpen(true)}
          onOpenReport={() => setReportOpen(true)}
          onLeave={exitGame}
          onToast={setToast}
        />
      )}

      <CreateRoomDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        config={config}
        onConfigChange={setConfig}
        onSubmit={createRoom}
      />
      <PracticeDialog
        open={practiceOpen}
        onOpenChange={setPracticeOpen}
        initialDifficulty={practiceDifficulty}
        onStart={startPractice}
      />
      <VoiceDialog
        open={voiceOpen}
        onOpenChange={setVoiceOpen}
        enabled={voiceEnabled}
        muted={muted}
        deafened={deafened}
        permission={voicePermission}
        onEnable={enableVoice}
        onMuteChange={setMuted}
        onDeafenChange={setDeafened}
      />
      <RulesDialog open={rulesOpen} onOpenChange={setRulesOpen} config={config} />
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        onSubmitted={() => {
          setReportOpen(false);
          setToast('Reporte recibido. Vale_23 quedó silenciado para ti.');
        }}
      />

      {toast && (
        <output className="app-toast" aria-live="polite">
          <CheckIcon />
          {toast}
        </output>
      )}
    </main>
  );
}

function CheckIcon() {
  return (
    <span className="toast-check" aria-hidden="true">
      ✓
    </span>
  );
}

function CreateRoomDialog({
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
        pardaEngine: 'secuencial-online',
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
      <DialogContent showCloseButton={false} className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Nueva mesa</p>
          <DialogTitle className="font-display text-3xl font-bold tracking-[-0.03em]">
            Las reglas primero
          </DialogTitle>
          <DialogDescription>
            El Truco venezolano cambia por región y por casa. Elige un punto de partida y deja
            cada variante visible.
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
                    <small>{format === '2v2' ? 'Parejas fijas · predeterminado' : 'Mano contra Pie'}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="field-group sm:col-span-2">
              <span>Regla base</span>
              <NativeSelect
                aria-label="Regla base"
                value={config.preset}
                onChange={(event) => changePreset(event.target.value as RoomConfig['preset'])}
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
                <NativeSelectOption value="24">24 · clásico</NativeSelectOption>
                <NativeSelectOption value="12">12 · rápida</NativeSelectOption>
                <NativeSelectOption value="32">32 · larga</NativeSelectOption>
              </NativeSelect>
            </div>

            <div className="field-group">
              <span>Serie</span>
              <NativeSelect
                aria-label="Duración de la serie"
                value={config.match}
                onChange={(event) => update('match', event.target.value as RoomConfig['match'])}
                className="w-full [&>select]:h-11 [&>select]:rounded-xl"
              >
                <NativeSelectOption value="un-chico">Un chico</NativeSelectOption>
                <NativeSelectOption value="mejor-de-tres">Mejor de tres chicos</NativeSelectOption>
              </NativeSelect>
            </div>

            <div className="field-group">
              <span>Modo de Flor</span>
              <NativeSelect
                aria-label="Modo de Flor"
                value={config.flor}
                onChange={(event) => update('flor', event.target.value as RoomConfig['flor'])}
                className="w-full [&>select]:h-11 [&>select]:rounded-xl"
              >
                <NativeSelectOption value="a-ley">Con flor · A ley</NativeSelectOption>
                <NativeSelectOption value="off">Sin flor</NativeSelectOption>
                <NativeSelectOption value="por-derecho">Flor por derecho · regional</NativeSelectOption>
              </NativeSelect>
            </div>

            <div className="field-group">
              <span>Primera parda</span>
              <NativeSelect
                aria-label="Regla de primera parda"
                value={config.parda}
                onChange={(event) => update('parda', event.target.value as RoomConfig['parda'])}
                className="w-full [&>select]:h-11 [&>select]:rounded-xl"
              >
                <NativeSelectOption value="abierta">Venezolana abierta</NativeSelectOption>
                <NativeSelectOption value="cerrada">Venezolana cerrada</NativeSelectOption>
              </NativeSelect>
            </div>

            <div className="field-group">
              <span>Resolución de parda</span>
              <NativeSelect
                aria-label="Motor de resolución de primera parda"
                value={config.pardaEngine}
                onChange={(event) =>
                  update(
                    'pardaEngine',
                    event.target.value as RoomConfig['pardaEngine'],
                  )
                }
                className="w-full [&>select]:h-11 [&>select]:rounded-xl"
              >
                <NativeSelectOption value="apilada-clasica">
                  Apilada clásica · mayor arriba
                </NativeSelectOption>
                <NativeSelectOption value="secuencial-online">
                  Tres vueltas · versión en línea
                </NativeSelectOption>
              </NativeSelect>
            </div>

            <div className="field-group">
              <span>Truco en pareja</span>
              <NativeSelect
                aria-label="Truco abierto o cerrado"
                value={config.truco}
                onChange={(event) => update('truco', event.target.value as RoomConfig['truco'])}
                className="w-full [&>select]:h-11 [&>select]:rounded-xl"
              >
                <NativeSelectOption value="abierto">Abierto · una carta del compañero visible</NativeSelectOption>
                <NativeSelectOption value="cerrado">Cerrado · manos privadas</NativeSelectOption>
              </NativeSelect>
            </div>

            <div className="field-group">
              <span>Envite</span>
              <NativeSelect
                aria-label="Modo de Envite"
                value={config.envido}
                onChange={(event) => update('envido', event.target.value as RoomConfig['envido'])}
                className="w-full [&>select]:h-11 [&>select]:rounded-xl"
              >
                <NativeSelectOption value="clasico">Clásico · N más y Falta explícita</NativeSelectOption>
                <NativeSelectOption value="escalera-online">Escalera online simplificada</NativeSelectOption>
              </NativeSelect>
            </div>

            <div className="field-group">
              <span>Juego de cartas</span>
              <NativeSelect
                aria-label="Juego visible o matar tapado"
                value={config.cardPlay}
                onChange={(event) => update('cardPlay', event.target.value as RoomConfig['cardPlay'])}
                className="w-full [&>select]:h-11 [&>select]:rounded-xl"
              >
                <NativeSelectOption value="visible">Todas visibles</NativeSelectOption>
                <NativeSelectOption value="matar-tapado" disabled>
                  Matar tapado · experimental, aún no jugable
                </NativeSelectOption>
              </NativeSelect>
            </div>

            <div className="rule-preview rounded-xl border border-border bg-muted/35 p-4">
              <p className="text-xs font-semibold">Escalera de canto</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Truco 3 · Retruco 6 · Vale nueve 9 · Vale juego
              </p>
            </div>

            <div className="rule-preview rounded-xl border border-border bg-muted/35 p-4">
              <p className="text-xs font-semibold">Flor y Reservada</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Flor paga 3 · Reservada invencible y condicionada. Los modos 4/5 y “cobra todo” quedan experimentales hasta contar con semántica publicada.
              </p>
            </div>

            <div className="switch-row sm:col-span-2">
              <span>
                <strong>Privando al final</strong>
                <small>
                  {config.target === '24'
                    ? 'Se activa exactamente en 23; Envite/Prive se resuelve antes del Truco.'
                    : 'Disponible solo en el chico tradicional de 24 piedras.'}
                </small>
              </span>
              <Switch
                aria-label="Activar Privando"
                checked={config.privando}
                disabled={config.target !== '24'}
                onCheckedChange={(value) => update('privando', value)}
              />
            </div>

            <div className="experimental-row sm:col-span-2" aria-disabled="true">
              <span>
                <strong>Muerte segura / falsa</strong>
                <small>Experimental y desactivada: las fuentes actuales nombran ambas variantes sin publicar la transición completa.</small>
              </span>
              <Badge variant="outline">Pendiente de validar</Badge>
            </div>

            <div className="switch-row sm:col-span-2">
              <span>
                <strong>Mesa privada</strong>
                <small>Código y enlace para invitar.</small>
              </span>
              <Switch
                aria-label="Hacer la mesa privada"
                checked={config.isPrivate}
                onCheckedChange={(value) => update('isPrivate', value)}
              />
            </div>
            <div className="switch-row sm:col-span-2">
              <span>
                <strong>Voz opcional</strong>
                <small>Cada jugador da permiso por separado; todos empiezan silenciados.</small>
              </span>
              <Switch
                aria-label="Permitir voz opcional"
                checked={config.voice}
                onCheckedChange={(value) => update('voice', value)}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Crear mesa</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PracticeDialog({
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
  const [difficulty, setDifficulty] = useState<PracticeDifficulty>(initialDifficulty);
  const [preset, setPreset] = useState<RoomConfig['preset']>('oriental');
  const [target, setTarget] = useState<RoomConfig['target']>('24');
  const [guided, setGuided] = useState(true);

  function updatePreset(next: RoomConfig['preset']) {
    setPreset(next);
    setTarget(next === 'rapida' ? '12' : next === 'competitiva' ? '32' : '24');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <span className="dialog-icon">
            <Bot className="size-5" />
          </span>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Sala de práctica · 1v1</p>
          <DialogTitle className="font-display text-3xl font-bold tracking-[-0.03em]">
            Juega contra Truquito
          </DialogTitle>
          <DialogDescription>
            Sin espera, micrófono ni rating. La IA usa el mismo motor legal y nunca ve tu mano ni las cartas sin repartir.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="field-group">
            <span>Dificultad</span>
            <div className="difficulty-segment" aria-label="Dificultad de Truquito">
              {(['aprendiz', 'criollo', 'maestro'] as PracticeDifficulty[]).map((value) => (
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
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field-group">
              <span>Preset</span>
              <NativeSelect
                aria-label="Preset de práctica"
                value={preset}
                onChange={(event) => updatePreset(event.target.value as RoomConfig['preset'])}
                className="w-full [&>select]:h-11 [&>select]:rounded-xl"
              >
                <NativeSelectOption value="oriental">Oriental clásico</NativeSelectOption>
                <NativeSelectOption value="rapida">Mesa rápida</NativeSelectOption>
                <NativeSelectOption value="competitiva">Competitiva larga</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="field-group">
              <span>Meta</span>
              <NativeSelect
                aria-label="Piedras de práctica"
                value={target}
                onChange={(event) => setTarget(event.target.value as RoomConfig['target'])}
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
              <small>Explica piezas, cuentas, cantos legales y por qué resolvió cada vuelta.</small>
            </span>
            <Switch aria-label="Activar modo guiado" checked={guided} onCheckedChange={setGuided} />
          </div>

          <div className="rules-caveat">
            <Info className="size-4" />
            <p>
              Puedes pausar, adelantar la respuesta de la IA, deshacer una acción, rehacerla, reiniciar la base o pedir un reparto nuevo.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onStart({ difficulty, preset, target, guided })}>
            Empezar práctica
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VoiceDialog({
  open,
  onOpenChange,
  enabled,
  muted,
  deafened,
  permission,
  onEnable,
  onMuteChange,
  onDeafenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabled: boolean;
  muted: boolean;
  deafened: boolean;
  permission: 'idle' | 'requesting' | 'denied';
  onEnable: () => void;
  onMuteChange: (value: boolean) => void;
  onDeafenChange: (value: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <span className="dialog-icon">
            <AudioLines className="size-5" />
          </span>
          <DialogTitle className="font-display text-2xl font-bold">
            {enabled ? 'Tu audio de mesa' : '¿Quieres entrar con voz?'}
          </DialogTitle>
          <DialogDescription>
            {enabled
              ? 'Puedes apagar tu micrófono o dejar de escuchar sin salir de la partida.'
              : 'La voz es opcional. Pediremos acceso al micrófono solo al confirmar y siempre entrarás silenciado.'}
          </DialogDescription>
        </DialogHeader>

        {!enabled ? (
          <>
            <div className="permission-list">
              <p>
                <Mic />
                <span>
                  <strong>Permiso claro</strong>
                  <small>El navegador mostrará su aviso antes de dar acceso.</small>
                </span>
              </p>
              <p>
                <LockKeyhole />
                <span>
                  <strong>Solo esta mesa</strong>
                  <small>El token de voz caduca y está ligado a tu asiento.</small>
                </span>
              </p>
              <p>
                <Info />
                <span>
                  <strong>Los cantos usan botones</strong>
                  <small>El audio nunca decide una jugada ni un puntaje.</small>
                </span>
              </p>
            </div>
            {permission === 'denied' && (
              <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                No pudimos usar el micrófono. Puedes seguir jugando sin voz o revisar el permiso del navegador.
              </p>
            )}
            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Seguir sin voz
              </Button>
              <Button onClick={onEnable} disabled={permission === 'requesting'}>
                <Mic className="size-4" />
                {permission === 'requesting' ? 'Esperando permiso…' : 'Permitir micrófono'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <div className="switch-row">
                <span>
                  <strong>Micrófono</strong>
                  <small>{muted ? 'Nadie te escucha' : 'La mesa puede escucharte'}</small>
                </span>
                <Switch
                  aria-label="Activar micrófono"
                  checked={!muted}
                  onCheckedChange={(value) => onMuteChange(!value)}
                />
              </div>
              <div className="switch-row">
                <span>
                  <strong>Audio de los demás</strong>
                  <small>{deafened ? 'No estás escuchando' : 'Escuchas la mesa'}</small>
                </span>
                <Switch
                  aria-label="Escuchar a los demás"
                  checked={!deafened}
                  onCheckedChange={(value) => onDeafenChange(!value)}
                />
              </div>
            </div>
            <DialogFooter className="mt-2">
              <Button onClick={() => onOpenChange(false)}>Listo</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RulesDialog({
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
      <DialogContent showCloseButton={false} className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Mesa Las Acacias</p>
          <DialogTitle className="font-display text-3xl font-bold">Reglas acordadas</DialogTitle>
          <DialogDescription>
            Preset {config.preset === 'oriental' ? 'Oriental clásico' : config.preset === 'rapida' ? 'Mesa rápida' : 'Competitiva larga'}.
            Es una configuración explícita de esta mesa, no una regla universal.
          </DialogDescription>
        </DialogHeader>
        <dl className="rules-detail-grid">
          <RuleDetail
            label="Formato"
            value={`${config.format === '1v1' ? '2 jugadores · Mano/Pie' : '4 jugadores · parejas fijas'} · ${config.target} piedras · ${config.match === 'mejor-de-tres' ? 'mejor de 3' : 'un chico'}`}
          />
          <RuleDetail label="Baraja" value="Española de 40 · 3 cartas · vira visible" />
          <RuleDetail label="Piezas" value="Perico 11 · Perica 10 de la pinta; si la vira es 11 o 10, el 12 sustituye esa pieza" />
          <RuleDetail label="Truco" value="Sin canto 1 · Truco 3/rehúse 1 · Retruco 6/3 · Vale 9 9/6 · Vale Juego chico/9" />
          <RuleDetail label="Envite" value={config.envido === 'clasico' ? '2 · Quiero y Envido 4 · N más · Falta explícita · empate para Mano' : 'Escalera online · 2/4/Falta · empate para Mano'} />
          <RuleDetail
            label="Flor"
            value={
              config.flor === 'off'
                ? 'Sin flor'
                : config.flor === 'por-derecho'
                  ? 'Flor por derecho · variante regional'
                  : 'Flor a ley · 3 por Flor · Reservada invencible condicionada'
            }
          />
          <RuleDetail
            label="Primera parda"
            value={
              config.pardaEngine === 'secuencial-online'
                ? 'Tres vueltas secuenciales; parda total para Mano'
                : config.parda === 'abierta'
                  ? 'Dos cartas juntas; la mayor arriba; admite repique'
                  : 'Dos cartas juntas; sin canto entre carta y destape'
            }
          />
          <RuleDetail label="Cartas pasadas" value="Activas · cuentan para el Envido, no matan en Truco" />
          <RuleDetail label="Truco abierto/cerrado" value={config.truco === 'abierto' ? 'Abierto · una carta del compañero visible' : 'Cerrado · manos privadas'} />
          <RuleDetail
            label="Tapado"
            value={
              config.cardPlay === 'matar-tapado'
                ? 'Experimental; no automatizado en mesas con rating'
                : 'Todas las cartas visibles'
            }
          />
          <RuleDetail label="Final" value={config.privando ? `Cantando y prive al llegar a ${Number(config.target) - 1}` : 'Sin Privando'} />
          <RuleDetail label="Señas" value="Permitidas, siempre visibles a toda la mesa" />
          <RuleDetail label="Prioridad" value="Flor anula el Envido normal; Flor/Envido/Prive se acreditan antes del Truco; luego se retoma el canto suspendido" />
        </dl>
        <div className="rules-caveat">
          <Info className="size-4" />
          <p>
            Muerte segura/falsa, Flor 4/5 y Reservada “cobra todo” siguen desactivadas: FEVETRU
            las nombra como modalidades, pero aún no publica una semántica ejecutable completa.
          </p>
        </div>
        <DialogFooter>
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

function ReportDialog({
  open,
  onOpenChange,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: () => void;
}) {
  const [block, setBlock] = useState(true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <span className="dialog-icon dialog-icon-danger">
            <ShieldAlert className="size-5" />
          </span>
          <DialogTitle className="font-display text-2xl font-bold">
            Reportar a Vale_23
          </DialogTitle>
          <DialogDescription>
            El reporte incluye el registro de acciones de esta base. La voz no se guarda.
          </DialogDescription>
        </DialogHeader>
        <div className="field-group">
          <span>Motivo</span>
          <NativeSelect
            aria-label="Motivo del reporte"
            className="w-full [&>select]:h-11 [&>select]:rounded-xl"
          >
            <NativeSelectOption value="abuse">Insultos o acoso</NativeSelectOption>
            <NativeSelectOption value="cheating">Posible trampa</NativeSelectOption>
            <NativeSelectOption value="voice">Uso indebido de la voz</NativeSelectOption>
            <NativeSelectOption value="other">Otro</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="field-group">
          <span>Cuéntanos qué pasó</span>
          <Textarea
            aria-label="Descripción del reporte"
            className="min-h-24 rounded-xl"
            placeholder="Incluye el momento o la acción…"
          />
        </div>
        <div className="flex min-h-11 items-center gap-3 rounded-xl border border-border p-3">
          <Checkbox
            aria-label="Silenciar y bloquear para mí"
            checked={block}
            onCheckedChange={setBlock}
          />
          <span>
            <strong className="block text-sm">Silenciar y bloquear para mí</strong>
            <small className="block text-xs text-muted-foreground">Dejarás de oír y leer a este jugador.</small>
          </span>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onSubmitted}>
            Enviar reporte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
