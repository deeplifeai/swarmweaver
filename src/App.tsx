import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import HomePage from './pages/HomePage';
import { ThemeProvider } from './components/ThemeProvider';
import { AgentServiceProvider } from './store/useAgentState';

function App() {
  return (
    <ThemeProvider>
      <AgentServiceProvider>
        <Router>
          <Routes>
            <Route path="/" element={<HomePage />} />
          </Routes>
          <Toaster position="bottom-right" />
        </Router>
      </AgentServiceProvider>
    </ThemeProvider>
  );
}

export default App;
