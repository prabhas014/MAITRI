import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../hooks/useAuth';

// Maximum number of prior turns to send as history context.
// Keeps token usage reasonable while giving MAITRI solid conversational memory.
const MAX_HISTORY_TURNS = 10;

export default function Chat() {
  const { token } = useAuth();
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hey! I'm MAITRI — your wellness companion. How are you feeling right now? 😊" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };

    // Capture the full message list before updating state,
    // so we can slice the history to send to the backend.
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    // Build the history slice: all messages before the current one,
    // limited to MAX_HISTORY_TURNS turns (each turn = 1 message).
    // We skip the very first system greeting (index 0) from history
    // since the backend system prompt already handles the opening.
    const historySlice = updatedMessages
      .slice(1, -1)                          // skip initial greeting + current message
      .slice(-MAX_HISTORY_TURNS)             // cap at last N turns
      .map(({ role, content }) => ({ role, content }));

    try {
      const authToken = token || localStorage.getItem('token') || 'dummy_token';
      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};

      const res = await axios.post('http://localhost:8000/api/chat/', {
        role: 'user',
        content: userMessage.content,
        history: historySlice,             // send prior conversation for memory
      }, { headers });

      setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Hmm, I'm having trouble reaching my systems right now. Give it a moment and try again — I'll be right here."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-white tracking-wide flex items-center gap-3">
          <Sparkles className="text-purple-400" /> AI INTERFACE
        </h1>
        <p className="text-gray-400 text-sm mt-1 uppercase tracking-widest">Natural Language Query System</p>
      </header>

      <div className="flex-1 glass-card rounded-2xl flex flex-col overflow-hidden border-t border-white/10">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={clsx(
                "flex max-w-[80%] gap-4",
                msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
              )}
            >
              <div className={clsx(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-lg",
                msg.role === 'user'
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                  : "bg-purple-600/20 text-purple-400 border border-purple-500/30"
              )}>
                {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
              </div>
              <div className={clsx(
                "p-4 rounded-2xl leading-relaxed text-sm tracking-wide shadow-sm border whitespace-pre-wrap",
                msg.role === 'user'
                  ? "bg-blue-600/10 text-blue-50 border-blue-500/20 rounded-tr-none"
                  : "bg-black/40 text-gray-200 border-white/5 rounded-tl-none"
              )}>
                {msg.content}
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex gap-4 max-w-[80%]"
            >
              <div className="w-10 h-10 rounded-full bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
                <Bot size={20} />
              </div>
              <div className="p-4 rounded-2xl bg-black/40 border border-white/5 rounded-tl-none flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-black/40 border-t border-white/5">
          <form onSubmit={handleSend} className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Talk to MAITRI..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-6 pr-16 text-white focus:outline-none focus:border-purple-500/50 transition-colors placeholder:text-gray-500 font-mono text-sm"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-2 p-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
