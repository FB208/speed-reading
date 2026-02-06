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
    <nav className="navbar">
      <div className="navbar-content">
        <Link to="/" className="navbar-brand">
          快速阅读
        </Link>

        <div className="navbar-nav">
          {isAuthenticated ? (
            <>
              <Link to="/books" className="navbar-link">
                书籍列表
              </Link>
              <Link to="/upload" className="navbar-link">
                上传书籍
              </Link>
              <Link to="/history" className="navbar-link">
                历史记录
              </Link>
              <span className="navbar-user">
                {user?.username}
              </span>
              <button
                onClick={handleLogout}
                className="navbar-btn"
              >
                退出
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="navbar-link">
                登录
              </Link>
              <Link 
                to="/register" 
                className="navbar-btn navbar-btn-primary"
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
