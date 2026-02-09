import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { booksAPI, API_BASE_URL } from '../services/api';

const BookList = () => {
  const [books, setBooks] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
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
    const normalizedBase = API_BASE_URL.replace(/\/+$/, '');
    return `${normalizedBase}/${coverImage}`;
  };

  const normalizedKeyword = keyword.trim().toLowerCase();
  const filteredBooks = books.filter((book) => {
    if (onlyMine && !book.is_uploaded_by_me) {
      return false;
    }

    if (!normalizedKeyword) {
      return true;
    }

    const title = (book.title || '').toLowerCase();
    const author = (book.author || '').toLowerCase();
    return title.includes(normalizedKeyword) || author.includes(normalizedKeyword);
  });

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

      <div className="book-filter-bar card">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="form-input"
          placeholder="搜索书名或作者"
        />

        <button
          type="button"
          className={`book-filter-toggle ${onlyMine ? 'active' : ''}`}
          onClick={() => setOnlyMine((prev) => !prev)}
        >
          {onlyMine ? '只看我上传：开' : '只看我上传：关'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {filteredBooks.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon">📚</div>
          <p style={{ color: 'var(--text-secondary)' }}>
            {books.length === 0
              ? '还没有书籍，点击上方按钮上传第一本书吧！'
              : '没有找到符合条件的书籍，试试调整搜索词或筛选条件'}
          </p>
        </div>
      ) : (
        <div className="book-grid">
          {filteredBooks.map((book) => {
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

                  <p className="book-meta">
                    {book.is_uploaded_by_me
                      ? '我上传的'
                      : `上传者：${book.uploaded_by_username || '未知用户'}`}
                  </p>
                   
                  <div className="book-actions">
                    <Link 
                      to={`/read/${book.id}`} 
                      className="btn btn-primary"
                    >
                      开始阅读
                    </Link>
                    {book.can_manage && (
                      <Link 
                        to={`/edit/${book.id}`} 
                        className="btn btn-secondary"
                      >
                        编辑
                      </Link>
                    )}
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
