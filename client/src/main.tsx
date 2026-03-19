import ReactDOM from 'react-dom/client';
import App from './App';
// Import theme variables first, then component styles
import './styles/theme-octane.css';
//import './styles/theme-octane-debug.css'
//import './styles/theme-vibe.css';
import './styles/app.css';
import './styles/scene-outliner.css';
import './styles/node-graph.css';
import './styles/node-inspector.css';
import './styles/render-viewport.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found in index.html');
ReactDOM.createRoot(root).render(<App />);
