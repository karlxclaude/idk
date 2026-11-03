import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { useStore } from './store';
import './theme.css';

if (import.meta.env.DEV) (window as unknown as { __phenotype: typeof useStore }).__phenotype = useStore;

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
createRoot(root).render(<StrictMode><App /></StrictMode>);
