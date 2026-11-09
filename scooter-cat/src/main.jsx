import { createRoot } from 'react-dom/client';
import './icons.js';
import App from './App.jsx';
import './styles.css';

const script = document.currentScript || document.querySelector('script[data-scooter-cat]');
const BASE = new URL('./', script ? script.src : location.href).href;
const root = document.getElementById('root');
const lang = ['uk', 'en'].includes(document.documentElement.lang) ? document.documentElement.lang : 'uk';

createRoot(root).render(<App initialLang={lang} base={BASE} onSite={root.dataset.site === '1'} view={root.dataset.view === 'rating' ? 'rating' : 'game'} />);
