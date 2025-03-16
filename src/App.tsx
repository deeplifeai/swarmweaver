import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import Index from './pages/Index';
import { ThemeProvider } from './components/ThemeProvider';
import { AgentServiceProvider } from './store/useAgentState.tsx';

function App() {
  return (
    <ThemeProvider>
      <AgentServiceProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Index />} />
          </Routes>
          <Toaster position="bottom-right" />
        </Router>
      </AgentServiceProvider>
    </ThemeProvider>
  );
}

export default App;
