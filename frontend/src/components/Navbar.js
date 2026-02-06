import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { isAuthenticated, logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav style={{ 
      backgroundColor: '#1890ff', 
      padding: '0 24px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: '64px'
      }}>
        <Link 
          to="/" 
          style={{ 
            color: 'white', 
            fontSize: '20px', 
            fontWeight: 'bold',
            textDecoration: 'none'
          }}
        >
          快速阅读
        </Link>

        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          {isAuthenticated ? (
            <>
              <Link to="/books" style={{ color: 'white', textDecoration: 'none' }}>
                书籍列表
              </Link>
              <Link to="/upload" style={{ color: 'white', textDecoration: 'none' }}>
                上传书籍
              </Link>
              <Link to="/history" style={{ color: 'white', textDecoration: 'none' }}>
                历史记录
              </Link>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>
                {user?.username}
              </span>
              <button
                onClick={handleLogout}
                style={{
                  background: 'transparent',
                  border: '1px solid white',
                  color: 'white',
                  padding: '6px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                退出
              </button>
            </>
          ) : (
            <>
              <Link to="/login" style={{ color: 'white', textDecoration: 'none' }}>
                登录
              </Link>
              <Link 
                to="/register" 
                style={{ 
                  color: '#1890ff', 
                  background: 'white',
                  padding: '6px 16px',
                  borderRadius: '4px',
                  textDecoration: 'none'
                }}
              >
                注册
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
