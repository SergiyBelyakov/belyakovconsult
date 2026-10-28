import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// Папка з ресурсами дашборду: поруч зі скриптом (assets/), тож сторінки трьома мовами беруть одні й ті самі файли.
const script = document.currentScript || document.querySelector('script[data-dashboard]');
const BASE = new URL('./', script ? script.src : location.href).href;
const root = document.getElementById('root');
const lang = ['uk', 'en', 'pt'].includes(document.documentElement.lang) ? document.documentElement.lang : 'uk';

createRoot(root).render(<App initialLang={lang} base={BASE} onSite={root.dataset.site === '1'} />);
