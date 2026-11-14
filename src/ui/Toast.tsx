import { useEffect, useState } from 'react';

let push: (msg: string) => void = () => {};
export const toast = (msg: string) => push(msg);

export function Toast() {
  const [msg, setMsg] = useState<{ text: string; id: number } | null>(null);
  useEffect(() => {
    push = (text) => setMsg({ text, id: Date.now() });
    return () => { push = () => {}; };
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), 2200);
    return () => window.clearTimeout(t);
  }, [msg]);
  return <div className={`toast${msg ? ' is-on' : ''}`} role="status" aria-live="polite">{msg?.text}</div>;
}
