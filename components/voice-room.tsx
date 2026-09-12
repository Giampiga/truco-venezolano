'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Headphones,
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  VolumeX,
  Video,
  VideoOff,
} from 'lucide-react';
import type { Room, RemoteParticipant, Track } from 'livekit-client';
import { Button } from '@/components/ui/button';
import { roomRequest } from '@/hooks/use-room';

type VoiceMember = {
  id: string;
  name: string;
  speaking: boolean;
  muted: boolean;
  camera?: Track;
  local: boolean;
};
export function VoiceRoom({
  roomId,
  enabled,
  cameraAllowed = false,
}: {
  roomId: string;
  enabled: boolean;
  cameraAllowed?: boolean;
}) {
  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const deafRef = useRef(false);
  const [status, setStatus] = useState('disconnected');
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [members, setMembers] = useState<VoiceMember[]>([]);
  const [needsAudio, setNeedsAudio] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [device, setDevice] = useState('default');
  const [busy, setBusy] = useState(false);
  function leave() {
    generation.current++;
    const room = roomRef.current;
    roomRef.current = null;
    room?.removeAllListeners();
    void room?.disconnect(true);
    audioRef.current?.replaceChildren();
    setStatus('disconnected');
    setMuted(true);
    setCameraOn(false);
    setMembers([]);
    setNeedsAudio(false);
    setBusy(false);
    setDevice('default');
    setDevices([]);
  }
  useEffect(
    () => () => {
      generation.current++;
      const room = roomRef.current;
      roomRef.current = null;
      room?.removeAllListeners();
      void room?.disconnect(true);
    },
    [roomId],
  );
  useEffect(() => {
    if (!enabled) {
      const timer = setTimeout(leave, 0);
      return () => clearTimeout(timer);
    }
  }, [enabled]);
  async function join() {
    if (roomRef.current || status === 'connecting') return;
    const attempt = ++generation.current;
    setStatus('connecting');
    setError('');
    try {
      const [{ Room, RoomEvent, Track }, credentials] = await Promise.all([
        import('livekit-client'),
        roomRequest<{ serverUrl: string; token: string }>(
          `/api/rooms/${roomId}/voice`,
          {},
        ),
      ]);
      if (attempt !== generation.current) return;
      const room = new Room({
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      roomRef.current = room;
      const refresh = () => {
        if (roomRef.current !== room) return;
        setMembers(
          [room.localParticipant, ...room.remoteParticipants.values()].map(
            (p) => ({
              id: p.identity,
              name: p.name || p.identity,
              speaking: p.isSpeaking,
              muted: !p.isMicrophoneEnabled,
              camera: p.isCameraEnabled
                ? p.getTrackPublication(Track.Source.Camera)?.track
                : undefined,
              local: p === room.localParticipant,
            }),
          ),
        );
        setMuted(!room.localParticipant.isMicrophoneEnabled);
        setCameraOn(room.localParticipant.isCameraEnabled);
      };
      const volume = (participant: RemoteParticipant) =>
        participant.setVolume(deafRef.current ? 0 : 1);
      room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
        if (roomRef.current !== room) return;
        if (track.kind === Track.Kind.Audio) {
          volume(participant);
          audioRef.current?.appendChild(track.attach());
        }
        refresh();
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((element) => element.remove());
        refresh();
      });
      room.on(RoomEvent.ParticipantConnected, (participant) => {
        volume(participant);
        refresh();
      });
      for (const event of [
        RoomEvent.ParticipantDisconnected,
        RoomEvent.ActiveSpeakersChanged,
        RoomEvent.TrackMuted,
        RoomEvent.TrackUnmuted,
        RoomEvent.LocalTrackPublished,
        RoomEvent.LocalTrackUnpublished,
      ])
        room.on(event, refresh);
      room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        if (roomRef.current === room) setNeedsAudio(!room.canPlaybackAudio);
      });
      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        if (roomRef.current === room) setStatus(state);
      });
      room.on(RoomEvent.Disconnected, () => {
        if (roomRef.current === room) {
          roomRef.current = null;
          setStatus('disconnected');
          setBusy(false);
          setMembers([]);
          setMuted(true);
          setCameraOn(false);
          setDevice('default');
          setDevices([]);
          audioRef.current?.replaceChildren();
        }
      });
      const refreshDevices = async () => {
        try {
          const inputs = await Room.getLocalDevices('audioinput', false);
          if (roomRef.current === room) {
            setDevices(inputs);
            setDevice(room.getActiveDevice('audioinput') || 'default');
          }
        } catch {
          /* Listening works even when device enumeration is blocked. */
        }
      };
      room.on(RoomEvent.MediaDevicesChanged, () => void refreshDevices());
      room.on(RoomEvent.ActiveDeviceChanged, () => void refreshDevices());
      await room.connect(credentials.serverUrl, credentials.token);
      if (attempt !== generation.current) {
        await room.disconnect(true);
        return;
      }
      room.remoteParticipants.forEach(volume);
      refresh();
      setStatus('connected');
      setNeedsAudio(!room.canPlaybackAudio);
      void refreshDevices();
    } catch (error) {
      if (attempt !== generation.current) return;
      leave();
      setError(
        error instanceof Error ? error.message : 'No se pudo conectar la voz.',
      );
    }
  }
  async function toggleMic() {
    const room = roomRef.current;
    if (!room || busy) return;
    setBusy(true);
    setError('');
    try {
      await room.localParticipant.setMicrophoneEnabled(muted);
      if (roomRef.current !== room) {
        await room.disconnect(true);
        return;
      }
      setMuted(!room.localParticipant.isMicrophoneEnabled);
      try {
        const { Room } = await import('livekit-client');
        const inputs = await Room.getLocalDevices('audioinput', false);
        if (roomRef.current === room) {
          setDevices(inputs);
          setDevice(room.getActiveDevice('audioinput') || 'default');
        }
      } catch {
        /* Microphone publication succeeded; enumeration is optional. */
      }
    } catch {
      if (roomRef.current === room)
        setError(
          'No pudimos abrir el micrófono. Revisa el permiso del navegador; puedes seguir escuchando.',
        );
    } finally {
      if (roomRef.current === room) setBusy(false);
    }
  }
  async function toggleCamera() {
    const room = roomRef.current;
    if (!room || busy || !cameraAllowed) return;
    setBusy(true);
    setError('');
    try {
      await room.localParticipant.setCameraEnabled(!cameraOn);
      if (roomRef.current !== room) {
        await room.disconnect(true);
        return;
      }
      setCameraOn(room.localParticipant.isCameraEnabled);
    } catch {
      if (roomRef.current === room)
        setError(
          'No pudimos abrir la cámara. Revisa el permiso del navegador; puedes seguir por voz.',
        );
    } finally {
      if (roomRef.current === room) setBusy(false);
    }
  }
  function toggleDeafen() {
    const next = !deafened;
    deafRef.current = next;
    setDeafened(next);
    roomRef.current?.remoteParticipants.forEach((participant) =>
      participant.setVolume(next ? 0 : 1),
    );
  }
  async function changeDevice(id: string) {
    const room = roomRef.current;
    if (!room) return;
    try {
      if (!(await room.switchActiveDevice('audioinput', id))) throw new Error();
      if (roomRef.current === room) setDevice(id);
    } catch {
      if (roomRef.current === room)
        setError('No pudimos cambiar el micrófono. Prueba otro dispositivo.');
    }
  }
  const connected =
    status === 'connected' ||
    status === 'reconnecting' ||
    status === 'signalReconnecting';
  return (
    <section className="voice-room" aria-label="Voz de la mesa">
      <div className="panel-heading">
        <Headphones size={18} />
        <h2>{cameraAllowed ? 'Voz y cámara' : 'La voz de la mesa'}</h2>
        <span
          className={`connection-light ${status === 'connected' ? 'online' : ''}`}
        />
      </div>
      {!connected ? (
        <>
          <p>
            {enabled
              ? 'Entra a escuchar. Micrófono y cámara empiezan apagados.'
              : 'El anfitrión desactivó la voz para esta mesa.'}
          </p>
          <Button
            className="w-full"
            onClick={join}
            disabled={!enabled || status === 'connecting'}
          >
            <Headphones size={16} />
            {status === 'connecting' ? 'Conectando…' : 'Entrar a la voz'}
          </Button>
          {status === 'connecting' && (
            <Button variant="ghost" onClick={leave}>
              Cancelar
            </Button>
          )}
        </>
      ) : (
        <>
          <p className="voice-connection">
            {status === 'connected'
              ? `${members.length} en el canal · ${muted ? 'tu micrófono está apagado' : 'te pueden escuchar'}`
              : 'Reconectando la voz…'}
          </p>
          <div className="voice-members">
            {members.map((member) => (
              <div
                key={member.id}
                className={`${member.speaking ? 'speaking' : ''} ${member.camera ? 'has-camera' : ''}`}
              >
                {member.camera && (
                  <CameraTrack
                    track={member.camera}
                    local={member.local}
                    name={member.name}
                  />
                )}
                <span>{member.name.slice(0, 1)}</span>
                <b>{member.name}</b>
                {member.muted ? <MicOff size={14} /> : <Mic size={14} />}
              </div>
            ))}
          </div>
          <div className="voice-controls">
            {cameraAllowed && (
              <Button
                variant={cameraOn ? 'default' : 'outline'}
                disabled={busy || status !== 'connected'}
                onClick={toggleCamera}
                aria-pressed={cameraOn}
                aria-label={cameraOn ? 'Apagar cámara' : 'Activar cámara'}
              >
                {cameraOn ? <Video /> : <VideoOff />}
              </Button>
            )}
            <Button
              variant={muted ? 'outline' : 'default'}
              disabled={busy || status !== 'connected'}
              onClick={toggleMic}
              aria-pressed={!muted}
              aria-label={muted ? 'Activar micrófono' : 'Silenciar micrófono'}
            >
              {muted ? <MicOff /> : <Mic />}
            </Button>
            <Button
              variant="outline"
              onClick={toggleDeafen}
              aria-pressed={deafened}
              aria-label={deafened ? 'Activar sonido' : 'Dejar de escuchar'}
            >
              {deafened ? <VolumeX /> : <Volume2 />}
            </Button>
            <Button
              variant="outline"
              onClick={leave}
              aria-label="Salir de la voz"
            >
              <PhoneOff />
            </Button>
          </div>
          {devices.length > 1 && (
            <label className="device-picker">
              Micrófono
              <select
                value={device}
                onChange={(event) => void changeDevice(event.target.value)}
              >
                {devices.map((input, i) => (
                  <option key={input.deviceId} value={input.deviceId}>
                    {input.label || `Micrófono ${i + 1}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          {needsAudio && (
            <Button
              variant="secondary"
              onClick={() =>
                void roomRef.current
                  ?.startAudio()
                  .catch(() =>
                    setError(
                      'El navegador bloqueó el sonido. Vuelve a intentarlo.',
                    ),
                  )
              }
            >
              Activar sonido del navegador
            </Button>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      <div ref={audioRef} hidden />
    </section>
  );
}

function CameraTrack({
  track,
  local,
  name,
}: {
  track: Track;
  local: boolean;
  name: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    track.attach(video);
    return () => {
      track.detach(video);
    };
  }, [track]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      aria-label={`Cámara de ${name}`}
      className={local ? 'local-camera' : ''}
    />
  );
}
