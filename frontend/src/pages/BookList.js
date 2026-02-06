import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { booksAPI } from '../services/api';

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

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>书籍列表</h1>
        <Link to="/upload" className="btn btn-primary">
          上传书籍
        </Link>
      </div>

      {error && <div className="error-message">{error}</div>}

      {books.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <p>还没有书籍，点击上方按钮上传第一本书吧！</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {books.map((book) => (
            <div key={book.id} className="card">
              <h3 style={{ marginBottom: '8px' }}>{book.title}</h3>
              {book.author && <p style={{ color: '#666', marginBottom: '8px' }}>作者：{book.author}</p>}
              <p style={{ color: '#999', fontSize: '14px', marginBottom: '16px' }}>
                共 {book.total_paragraphs} 个段落
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Link 
                  to={`/read/${book.id}`} 
                  className="btn btn-primary"
                  style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}
                >
                  开始阅读
                </Link>
                <Link 
                  to={`/edit/${book.id}`} 
                  className="btn btn-secondary"
                  style={{ textAlign: 'center', textDecoration: 'none' }}
                >
                  编辑
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BookList;
