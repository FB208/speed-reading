import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { isAuthenticated, logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // 路由变化时自动收起菜单
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate('/login');
  };

  const handleLinkClick = () => {
    setMenuOpen(false);
  };

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <Link to="/" className="navbar-brand" onClick={handleLinkClick}>
          快速阅读
        </Link>

        <button 
          className={`navbar-toggle ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="切换导航菜单"
        >
          <span className="navbar-toggle-icon"></span>
        </button>

        <div className={`navbar-nav ${menuOpen ? 'open' : ''}`}>
          {isAuthenticated ? (
            <>
              <Link to="/books" className="navbar-link" onClick={handleLinkClick}>
                书籍列表
              </Link>
              <Link to="/upload" className="navbar-link" onClick={handleLinkClick}>
                上传书籍
              </Link>
              <Link to="/history" className="navbar-link" onClick={handleLinkClick}>
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
              <Link to="/login" className="navbar-link" onClick={handleLinkClick}>
                登录
              </Link>
              <Link 
                to="/register" 
                className="navbar-btn navbar-btn-primary"
                onClick={handleLinkClick}
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
