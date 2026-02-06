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
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '28px' 
      }}>
        <h1 style={{ 
          color: 'var(--text-heading)',
          fontSize: '26px',
          fontWeight: 600
        }}>
          书籍列表
        </h1>
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
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
          gap: '24px' 
        }}>
          {books.map((book) => {
            const coverUrl = getCoverUrl(book.cover_image);
            
            return (
              <div 
                key={book.id} 
                className="card"
                style={{ 
                  display: 'flex', 
                  flexDirection: 'row',
                  padding: '20px',
                  gap: '20px'
                }}
              >
                {/* 封面 */}
                <div style={{ 
                  flex: '0 0 100px',
                  height: '130px',
                  backgroundColor: 'var(--paper-bg)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--paper-dark)'
                }}>
                  {coverUrl ? (
                    <img 
                      src={coverUrl} 
                      alt={book.title}
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover' 
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: '36px' }}>📖</span>
                  )}
                </div>
                
                {/* 信息 */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ 
                    marginBottom: '8px',
                    color: 'var(--text-heading)',
                    fontSize: '17px',
                    fontWeight: 600,
                    lineHeight: '1.3'
                  }}>
                    {book.title}
                  </h3>
                  
                  {book.author && (
                    <p style={{ 
                      color: 'var(--text-secondary)', 
                      marginBottom: '6px',
                      fontSize: '13px'
                    }}>
                      作者：{book.author}
                    </p>
                  )}
                  
                  <p style={{ 
                    color: 'var(--text-muted)', 
                    fontSize: '13px',
                    marginBottom: '12px'
                  }}>
                    共 {book.total_paragraphs} 个段落
                  </p>
                  
                  <div style={{ 
                    display: 'flex', 
                    gap: '8px', 
                    marginTop: 'auto' 
                  }}>
                    <Link 
                      to={`/read/${book.id}`} 
                      className="btn btn-primary"
                      style={{ 
                        flex: 1, 
                        textAlign: 'center', 
                        textDecoration: 'none',
                        fontSize: '14px',
                        padding: '8px 12px'
                      }}
                    >
                      开始阅读
                    </Link>
                    <Link 
                      to={`/edit/${book.id}`} 
                      className="btn btn-secondary"
                      style={{ 
                        textAlign: 'center', 
                        textDecoration: 'none',
                        fontSize: '14px',
                        padding: '8px 12px'
                      }}
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
