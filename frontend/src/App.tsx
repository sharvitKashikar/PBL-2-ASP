import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Home from './pages/Home';
import Summarize from './pages/Summarize';
import History from './pages/History';
import Login from './pages/Login';
import Register from './pages/Register';
import { useAuth } from './hooks/useAuth';

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar />
        <main className="flex-1 w-full">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/home" element={<Home />} />
              <Route
                path="/summarize"
                element={isAuthenticated ? <Summarize /> : <Navigate to="/login" />}
              />
              <Route
                path="/history"
                element={isAuthenticated ? <History /> : <Navigate to="/login" />}
              />
              <Route
                path="/login"
                element={!isAuthenticated ? <Login /> : <Navigate to="/home" />}
              />
              <Route
                path="/register"
                element={!isAuthenticated ? <Register /> : <Navigate to="/home" />}
              />
            </Routes>
          </div>
        </main>
        <Toaster position="top-right" />
      </div>
    </Router>
  );
}

export default App;
