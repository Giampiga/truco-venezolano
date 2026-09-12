'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AccountLabel } from '@/components/account-label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
type Message = {id:number;author:string;handle:string|null;message:string;at:number;own:number};
export function GlobalChat({name}: {name:string}) {
  const [messages,setMessages] = useState<Message[]>([]);
  const [text,setText] = useState('');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const scroll = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  async function refresh(signal?: AbortSignal) {
    const response = await fetch('/api/chat', {signal});
    const data = await response.json() as {messages:Message[];error?:string};
    if (!response.ok) throw new Error(data.error);
    setMessages(data.messages); setLoading(false);
  }
  useEffect(() => {
    const controller = new AbortController();
    const poll = () => { if (!document.hidden) refresh(controller.signal).catch(e => { if (!controller.signal.aborted) {setError(e.message);setLoading(false);} }); };
    poll(); const timer = setInterval(poll, 4000);
    return () => {controller.abort();clearInterval(timer);};
  }, []);
  useEffect(() => { if (stick.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; }, [messages]);
  async function send(event:FormEvent) {
    event.preventDefault(); if (busy || !text.trim()) return;
    setBusy(true);setError('');
    try {
      const response = await fetch('/api/chat', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),name,text})});
      const result = await response.json() as {error?:string};
      if (!response.ok) throw new Error(result.error);
      setText('');stick.current=true;await refresh();
    } catch (e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  return <section className="room-chat global-chat" aria-label="Chat global">
    <div className="panel-heading"><h2>Chat global</h2></div>
    <p className="canto-help">Habla con todos los jugadores del salón. Los mensajes son visibles para quienes tienen acceso al sitio.</p>
    <div className="chat-scroll" role="log" aria-live="polite" aria-label="Mensajes del chat global" ref={scroll} onScroll={() => { const el=scroll.current; if(el) stick.current=el.scrollHeight-el.scrollTop-el.clientHeight<50; }}>
      {loading ? <p>Cargando mensajes…</p> : !messages.length ? <p>El salón está tranquilo. ¡Saluda!</p> : messages.map(m => <article key={m.id} className={m.own?'own-message':''}>
        <div><strong>{m.own ? `${m.author} (tú)` : m.author}</strong><AccountLabel handle={m.handle ?? undefined}/><time dateTime={new Date(m.at).toISOString()}>{new Date(m.at).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}</time></div><p>{m.message}</p>
      </article>)}
    </div>
    {error && <p role="alert">{error}</p>}
    <form onSubmit={send}><Input aria-label="Mensaje al chat global" placeholder="Escribe al salón…" value={text} onChange={e=>setText(e.target.value)} maxLength={300}/><Button type="submit" disabled={busy || !text.trim()}>Enviar</Button></form>
  </section>;
}
