import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
      <div className="card" style={{ textAlign: 'center', padding: '60px 40px' }}>
        <h1 style={{ fontSize: '36px', marginBottom: '24px', color: '#1890ff' }}>
          快速阅读
        </h1>
        <p style={{ fontSize: '18px', color: '#666', marginBottom: '32px', lineHeight: '1.6' }}>
          测试你的阅读速度和理解能力<br />
          通过科学的阅读训练，提升你的阅读效率
        </p>
        
        {isAuthenticated ? (
          <div>
            <a href="/books" className="btn btn-primary" style={{ marginRight: '12px' }}>
              开始阅读
            </a>
            <a href="/upload" className="btn btn-secondary">
              上传书籍
            </a>
          </div>
        ) : (
          <div>
            <a href="/login" className="btn btn-primary" style={{ marginRight: '12px' }}>
              登录
            </a>
            <a href="/register" className="btn btn-secondary">
              注册
            </a>
          </div>
        )}
        
        <div style={{ marginTop: '48px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
          <div style={{ padding: '20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📚</div>
            <h3 style={{ marginBottom: '8px' }}>上传书籍</h3>
            <p style={{ color: '#666' }}>支持 .txt、.docx、.epub、.mobi、.pdf 格式</p>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>⏱️</div>
            <h3 style={{ marginBottom: '8px' }}>计时阅读</h3>
            <p style={{ color: '#666' }}>记录你的阅读速度</p>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📝</div>
            <h3 style={{ marginBottom: '8px' }}>理解测试</h3>
            <p style={{ color: '#666' }}>AI生成阅读理解题</p>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📊</div>
            <h3 style={{ marginBottom: '8px' }}>统计分析</h3>
            <p style={{ color: '#666' }}>追踪你的阅读进步</p>
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
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Navbar />
          <div style={{ flex: 1, padding: '20px 0' }}>
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
            </Routes>
          </div>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
