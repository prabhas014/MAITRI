import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { motion } from 'framer-motion';
import { Rocket } from 'lucide-react';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        await login(username, password);
        navigate('/');
      } else {
        await register(username, password);
        setIsLogin(true);
        setError('Registration successful! Please login.');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-space-900">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="glass-card p-10 rounded-2xl w-full max-w-md z-10 border-t border-white/20"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-4 border border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
            <Rocket className="text-blue-400" size={32} />
          </div>
          <h1 className="text-3xl font-bold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            MAITRI
          </h1>
          <p className="text-xs text-gray-400 mt-2 text-center uppercase tracking-widest">Astronaut Authentication System</p>
        </div>

        {error && (
          <div className={`p-3 rounded-lg mb-6 text-sm ${error.includes('successful') ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium tracking-wide text-gray-300 mb-2">ASTRONAUT ID</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all font-mono"
              required
              placeholder="e.g. CommanderShepard"
            />
          </div>
          <div>
            <label className="block text-sm font-medium tracking-wide text-gray-300 mb-2">ACCESS CODE</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all font-mono"
              required
              placeholder="••••••••"
            />
          </div>
          
          <button 
            type="submit"
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium tracking-widest uppercase rounded-lg shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all transform hover:scale-[1.02]"
          >
            {isLogin ? 'Initialize Uplink' : 'Register Profile'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-wider text-xs"
          >
            {isLogin ? "Request Registration" : "Return to Uplink"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
