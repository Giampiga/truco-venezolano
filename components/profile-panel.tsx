'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
type Profile = { handle: string; name: string; bio: string };
type Friend = Profile & { status: string; outgoing: number };
export function ProfilePanel() {
  const [data, setData] = useState<{me: Profile | null; found: Profile | null; friends: Friend[]} | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function load(handle = '') {
    const response = await fetch(`/api/profile?handle=${encodeURIComponent(handle)}`);
    const value = await response.json() as {error?: string; me: Profile | null; found: Profile | null; friends: Friend[]};
    if (!response.ok) throw new Error(value.error);
    setData(value);
    if (handle && !value.found) setNotice('No encontramos ese usuario.');
  }
  useEffect(() => { load().catch(e => setError(e.message)); }, []);
  async function act(input: Record<string, unknown>) {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/profile', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(input) });
      const value = await response.json() as {error?: string; me: Profile | null; found: Profile | null; friends: Friend[]};
      if (!response.ok) throw new Error(value.error);
      await load(); setNotice(input.type === 'save' ? 'Perfil guardado. Tu nombre aparecerá en las mesas.' : 'Lista de amigos actualizada.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void act({type: 'save', ...Object.fromEntries(new FormData(event.currentTarget))}); }
  return <details className="profile-panel"><summary>Mi perfil y amigos</summary>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {data && <>
      <p>{data.me ? `Perfil registrado · @${data.me.handle}` : 'Usas un alias temporal. Crea un perfil para que tus amigos puedan encontrarte.'}</p>
      <form onSubmit={save} key={data.me?.handle ?? 'new'}>
        <label>Usuario único<input name="handle" required pattern="[a-zA-Z0-9_]{3,20}" minLength={3} maxLength={20} defaultValue={data.me?.handle} placeholder="tu_usuario" /></label>
        <label>Nombre de jugador<input name="name" required maxLength={24} defaultValue={data.me?.name} /></label>
        <label>Sobre ti<textarea name="bio" maxLength={160} defaultValue={data.me?.bio} /></label>
        <Button disabled={busy}>Guardar perfil</Button>
      </form>
      <h2>Amigos</h2><p>Busca el @usuario exacto. La otra persona debe aceptar tu solicitud.</p>
      <form onSubmit={async e => { e.preventDefault(); setError(''); try { await load(String(new FormData(e.currentTarget).get('search')).replace(/^@/, '').trim()); } catch (e) { setError((e as Error).message); } }}>
        <label>Buscar jugador<input name="search" required maxLength={20} /></label><Button disabled={busy}>Buscar</Button>
      </form>
      {data.found && <article><strong>{data.found.name} · @{data.found.handle}</strong><p>{data.found.bio}</p>{data.me && data.found.handle !== data.me.handle && <Button disabled={busy || data.friends.some(f => f.handle === data.found!.handle)} onClick={() => void act({type:'request', handle:data.found!.handle})}>Agregar amigo</Button>}</article>}
      {!data.friends.length && <p>Todavía no tienes amigos ni solicitudes.</p>}
      {data.friends.map(friend => <article key={friend.handle}><strong>{friend.name} · @{friend.handle}</strong><p>{friend.bio}</p><p>{friend.status === 'accepted' ? 'Amigos' : friend.outgoing ? 'Solicitud enviada' : 'Quiere ser tu amigo'}</p>
        {friend.status === 'pending' && !friend.outgoing && <Button disabled={busy} onClick={() => void act({type:'accept', handle:friend.handle})}>Aceptar</Button>}
        <Button variant="outline" disabled={busy} onClick={() => void act({type:'remove', handle:friend.handle})}>{friend.status === 'accepted' ? 'Quitar amigo' : friend.outgoing ? 'Cancelar solicitud' : 'Rechazar'}</Button>
      </article>)}
      <Button variant="outline" disabled={busy} onClick={() => void load().catch(e => setError(e.message))}>Actualizar amigos</Button>
    </>}
  </details>;
}
