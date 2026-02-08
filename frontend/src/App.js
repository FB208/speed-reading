import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import BookList from './pages/BookList';
import UploadBook from './pages/UploadBook';
import EditBook from './pages/EditBook';
import ReadingTest from './pages/ReadingTest';
import TestResult from './pages/TestResult';
import History from './pages/History';
import MyBookshelf from './pages/MyBookshelf';

// 受保护的路由组件
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <div className="loading">加载中...</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// 首页组件
const Home = () => {
  const { isAuthenticated } = useAuth();
  
  return (
    <div className="container">
      <div className="card home-hero">
        <h1 className="home-title">快速阅读</h1>
        <p className="home-desc">
          测试你的阅读速度和理解能力<br />
          通过科学的阅读训练，提升你的阅读效率
        </p>
        
        {isAuthenticated ? (
          <div className="home-actions">
            <Link to="/books" className="btn btn-primary">
              开始阅读
            </Link>
            <Link to="/upload" className="btn btn-secondary">
              上传书籍
            </Link>
          </div>
        ) : (
          <div className="home-actions">
            <Link to="/login" className="btn btn-primary">
              登录
            </Link>
            <Link to="/register" className="btn btn-secondary">
              注册
            </Link>
          </div>
        )}
        
        <div className="home-features">
          <div className="home-feature-card">
            <div className="home-feature-icon">📚</div>
            <h3 className="home-feature-title">上传书籍</h3>
            <p className="home-feature-desc">
              支持 txt、docx、epub、mobi、pdf 格式
            </p>
          </div>
          <div className="home-feature-card">
            <div className="home-feature-icon">⏱️</div>
            <h3 className="home-feature-title">计时阅读</h3>
            <p className="home-feature-desc">
              记录你的阅读速度
            </p>
          </div>
          <div className="home-feature-card">
            <div className="home-feature-icon">📝</div>
            <h3 className="home-feature-title">理解测试</h3>
            <p className="home-feature-desc">
              AI生成阅读理解题
            </p>
          </div>
          <div className="home-feature-card">
            <div className="home-feature-icon">📊</div>
            <h3 className="home-feature-title">统计分析</h3>
            <p className="home-feature-desc">
              追踪你的阅读进步
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div style={{ 
          minHeight: '100vh', 
          display: 'flex', 
          flexDirection: 'column',
          backgroundColor: 'var(--paper-bg)'
        }}>
          <Navbar />
          <div style={{ flex: 1, padding: '16px 0' }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route 
                path="/books" 
                element={
                  <ProtectedRoute>
                    <BookList />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/upload" 
                element={
                  <ProtectedRoute>
                    <UploadBook />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/edit/:bookId" 
                element={
                  <ProtectedRoute>
                    <EditBook />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/read/:bookId" 
                element={
                  <ProtectedRoute>
                    <ReadingTest />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/result/:resultId" 
                element={
                  <ProtectedRoute>
                    <TestResult />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/history" 
                element={
                  <ProtectedRoute>
                    <History />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/bookshelf" 
                element={
                  <ProtectedRoute>
                    <MyBookshelf />
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </div>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
