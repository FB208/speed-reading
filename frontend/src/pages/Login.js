import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // 兼容浏览器自动填充：提交时直接从表单读取最新值
    const formDataObj = new FormData(e.currentTarget);
    const username = String(formDataObj.get('username') || '').trim();
    const password = String(formDataObj.get('password') || '');

    try {
      const response = await authAPI.login(username, password);
      const { access_token } = response.data;
      
      login(access_token, { username });
      
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card auth-card">
        <div className="auth-header">
          <div className="auth-icon">📖</div>
          <h2 className="auth-title">欢迎回来</h2>
          <p className="auth-subtitle">登录以继续你的阅读之旅</p>
        </div>
        
        {error && <div className="error-message" style={{ marginBottom: '20px' }}>{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">用户名</label>
            <input
              type="text"
              name="username"
              autoComplete="username"
              className="form-input"
              value={formData.username}
              onChange={handleChange}
              placeholder="请输入用户名"
              required
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">密码</label>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              className="form-input"
              value={formData.password}
              onChange={handleChange}
              placeholder="请输入密码"
              required
            />
          </div>
          
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
        
        <p className="auth-footer">
          还没有账号？{' '}
          <Link to="/register">立即注册</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
