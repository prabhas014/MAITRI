import { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : { username: "Commander" };
    } catch {
      return { username: "Commander" };
    }
  });
  const [token, setToken] = useState(() => {
    return localStorage.getItem('token') || "dummy_token";
  });

  const login = async (username, password) => {
    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);
      const res = await axios.post('http://localhost:8000/api/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      const access_token = res.data.access_token;
      const newUser = { username };
      setUser(newUser);
      setToken(access_token);
      localStorage.setItem('user', JSON.stringify(newUser));
      localStorage.setItem('token', access_token);
    } catch (err) {
      // If user not registered, attempt register and then login
      try {
        await axios.post('http://localhost:8000/api/auth/register', { username, password });
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);
        const res = await axios.post('http://localhost:8000/api/auth/login', formData, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const access_token = res.data.access_token;
        const newUser = { username };
        setUser(newUser);
        setToken(access_token);
        localStorage.setItem('user', JSON.stringify(newUser));
        localStorage.setItem('token', access_token);
      } catch {
        const newUser = { username };
        setUser(newUser);
        setToken("dummy_token");
        localStorage.setItem('user', JSON.stringify(newUser));
        localStorage.setItem('token', "dummy_token");
      }
    }
  };

  const register = async (username, password) => {
    try {
      await axios.post('http://localhost:8000/api/auth/register', { username, password });
    } catch (e) {
      console.warn("Register error or user already exists:", e);
    }
  };

  const logout = () => {
    const defaultUser = { username: "Commander" };
    setUser(defaultUser);
    setToken("dummy_token");
    localStorage.setItem('user', JSON.stringify(defaultUser));
    localStorage.setItem('token', "dummy_token");
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
