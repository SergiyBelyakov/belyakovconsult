import { LANGS } from '../i18n.js';
import { Button, Panel, Segmented } from '../ui.jsx';

export const DEFAULT_LOOK = { glass: 55, glow: 35, motion: true };

export default function Appearance({ ctx }) {
  const { T, look, setLook, lang, switchLang, f } = ctx;
  const slider = (key, name, min, max) => (
    <label className="slider">
      <span>{name}<b>{f.int(look[key])}%</b></span>
      <input type="range" min={min} max={max} value={look[key]} onChange={e => setLook({ ...look, [key]: Number(e.target.value) })} />
    </label>
  );
  return (
    <div className="grid grid-reports">
      <Panel title={T.nav.appearance} sub={T.leads.appearance}>
        {slider('glass', T.glass, 10, 90)}
        {slider('glow', T.glow, 0, 100)}
        <div className="setting-row">
          <span>{T.motion}</span>
          <Segmented value={look.motion ? 'on' : 'off'} onChange={v => setLook({ ...look, motion: v === 'on' })} label={T.motion}
            options={[{ value: 'on', label: T.on }, { value: 'off', label: T.off }]} />
        </div>
        <div className="setting-row">
          <span>{T.language}</span>
          <Segmented value={lang} onChange={switchLang} label={T.language} options={LANGS.map(l => ({ value: l.id, label: l.label }))} />
        </div>
        <div className="report-actions"><Button icon="reset" onClick={() => setLook(DEFAULT_LOOK)}>{T.restore}</Button></div>
      </Panel>
      <Panel title={T.ownData} sub={T.dataNote}>
        <p className="hint mono">{T.csvHint}</p>
      </Panel>
    </div>
  );
}
