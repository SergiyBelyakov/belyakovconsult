// Заявка «Такий дашборд на ваших даних»: та сама форма Formspree, що й на сайті, з міткою джерела.
import { useState } from 'react';
import { Button, Modal } from './ui.jsx';
import { Icon } from './icons.jsx';

export const FORM_ENDPOINT = 'https://formspree.io/f/xykwoaql';

function utm() {
  try {
    const q = new URLSearchParams(location.search);
    return ['utm_source', 'utm_medium', 'utm_campaign'].reduce((o, k) => (q.get(k) ? { ...o, [k]: q.get(k) } : o), {});
  } catch { return {}; }
}

export function LeadModal({ T, lang, where, onClose, onSent }) {
  const [state, setState] = useState('idle');
  const submit = async e => {
    e.preventDefault();
    const form = e.currentTarget;
    if (form.elements._gotcha.value) return;
    setState('sending');
    const data = new FormData(form);
    data.append('_subject', T.lead.subject);
    data.append('source', 'dashboard-demo');
    data.append('cta', where || 'unknown');
    data.append('lang', lang);
    data.append('page', location.origin + location.pathname + location.hash);
    Object.entries(utm()).forEach(([k, v]) => data.append(k, v));
    try {
      const r = await fetch(FORM_ENDPOINT, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(String(r.status));
      setState('ok');
      onSent && onSent();
    } catch {
      setState('fail');
    }
  };
  return (
    <Modal title={T.lead.title} onClose={onClose} T={T}>
      {state === 'ok' ? (
        <div className="lead-done">
          <span className="lead-ok"><Icon name="check" size={22} /></span>
          <p>{T.lead.ok}</p>
          <Button onClick={onClose}>{T.close}</Button>
        </div>
      ) : (
        <form className="lead-form" onSubmit={submit}>
          <p className="lead-text">{T.lead.text}</p>
          <label><span>{T.lead.name}</span><input name="name" autoComplete="name" required autoFocus /></label>
          <label><span>{T.lead.email}</span><input name="email" type="email" autoComplete="email" required /></label>
          <label><span>{T.lead.org} <em>{T.lead.orgHint}</em></span><input name="organization" autoComplete="organization" /></label>
          <label><span>{T.lead.message}</span><textarea name="message" rows="4" required placeholder={T.lead.messagePh} /></label>
          <input type="text" name="_gotcha" tabIndex="-1" autoComplete="off" className="hp" aria-hidden="true" />
          {state === 'fail' && <p className="lead-fail" role="alert">{T.lead.fail}</p>}
          <div className="lead-actions">
            <Button kind="primary" type="submit" icon="mail" disabled={state === 'sending'}>{state === 'sending' ? T.lead.sending : T.lead.send}</Button>
          </div>
          <p className="lead-note">{T.lead.note}</p>
        </form>
      )}
    </Modal>
  );
}
