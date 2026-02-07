import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { booksAPI } from '../services/api';

const API_BASE = 'http://localhost:8000';

const BookList = () => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    try {
      const response = await booksAPI.getBooks();
      setBooks(response.data);
    } catch (err) {
      setError('获取书籍列表失败');
    } finally {
      setLoading(false);
    }
  };

  const getCoverUrl = (coverImage) => {
    if (!coverImage) return null;
    if (coverImage.startsWith('http')) return coverImage;
    return `${API_BASE}/${coverImage}`;
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>书籍列表</h1>
        <Link to="/upload" className="btn btn-primary">
          上传书籍
        </Link>
      </div>

      {error && <div className="error-message">{error}</div>}

      {books.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon">📚</div>
          <p style={{ color: 'var(--text-secondary)' }}>
            还没有书籍，点击上方按钮上传第一本书吧！
          </p>
        </div>
      ) : (
        <div className="book-grid">
          {books.map((book) => {
            const coverUrl = getCoverUrl(book.cover_image);
            
            return (
              <div 
                key={book.id} 
                className="card book-card"
              >
                {/* 封面 */}
                <div className="book-cover">
                  {coverUrl ? (
                    <img 
                      src={coverUrl} 
                      alt={book.title}
                    />
                  ) : (
                    <span className="book-cover-placeholder">📖</span>
                  )}
                </div>
                
                {/* 信息 */}
                <div className="book-info">
                  <h3>{book.title}</h3>
                  
                  {book.author && (
                    <p className="book-author">
                      作者：{book.author}
                    </p>
                  )}
                  
                  <p className="book-meta">
                    共 {book.total_paragraphs} 个段落
                  </p>
                  
                  <div className="book-actions">
                    <Link 
                      to={`/read/${book.id}`} 
                      className="btn btn-primary"
                    >
                      开始阅读
                    </Link>
                    <Link 
                      to={`/edit/${book.id}`} 
                      className="btn btn-secondary"
                    >
                      编辑
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BookList;
