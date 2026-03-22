import ReactDOM from 'react-dom/client';
import App from './App';
import { octaneCacheService } from './services/OctaneCacheService';

// Pre-fetch API cache (non-blocking — app works with hardcoded defaults while loading)
octaneCacheService.initialize();

// Import all themes — runtime switching via data-theme attribute on <html>
// Octane is default (its CSS targets both :root and [data-theme='octane'])
import './styles/theme-octane.css';
import './styles/theme-vibe.css';
import './styles/theme-octane-debug.css';
import './styles/app.css';
import './styles/scene-outliner.css';
import './styles/node-graph.css';
import './styles/node-inspector.css';
import './styles/render-viewport.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found in index.html');
ReactDOM.createRoot(root).render(<App />);
