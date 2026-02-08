import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { bookshelfAPI } from '../services/api';

const API_BASE = process.env.REACT_APP_API_BASE_URL ?? '';

const MyBookshelf = () => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removingBookId, setRemovingBookId] = useState(null);

  useEffect(() => {
    fetchBookshelf();
  }, []);

  const fetchBookshelf = async () => {
    try {
      setLoading(true);
      const response = await bookshelfAPI.getMyBookshelf();
      setBooks(response.data);
    } catch (err) {
      setError('获取我的书架失败');
    } finally {
      setLoading(false);
    }
  };

  const removeFromBookshelf = async (bookId) => {
    if (!window.confirm('确定将这本书移出我的书架吗？')) {
      return;
    }

    try {
      setRemovingBookId(bookId);
      await bookshelfAPI.removeFromBookshelf(bookId);
      setBooks(books.filter((book) => book.id !== bookId));
    } catch (err) {
      setError('移出书架失败');
    } finally {
      setRemovingBookId(null);
    }
  };

  const getCoverUrl = (coverImage) => {
    if (!coverImage) return null;
    if (coverImage.startsWith('http')) return coverImage;
    const normalizedBase = API_BASE.replace(/\/+$/, '');
    return `${normalizedBase}/${coverImage}`;
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>我的书架</h1>
        <Link to="/books" className="btn btn-secondary">
          查看全部书籍
        </Link>
      </div>

      {error && <div className="error-message">{error}</div>}

      {books.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon">📚</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
            书架还是空的，去上传或开始阅读一本书吧
          </p>
          <Link to="/books" className="btn btn-primary">
            去书籍列表
          </Link>
        </div>
      ) : (
        <div className="book-grid">
          {books.map((book) => {
            const coverUrl = getCoverUrl(book.cover_image);

            return (
              <div key={book.id} className="card book-card">
                <div className="book-cover">
                  {coverUrl ? (
                    <img src={coverUrl} alt={book.title} />
                  ) : (
                    <span className="book-cover-placeholder">📖</span>
                  )}
                </div>

                <div className="book-info">
                  <h3>{book.title}</h3>

                  {book.author && <p className="book-author">作者：{book.author}</p>}

                  <p className="book-meta">
                    阅读进度：{book.completed_paragraphs} / {book.total_paragraphs}（{book.progress_percentage}%）
                  </p>

                  <div className="progress-bar" style={{ marginBottom: '12px' }}>
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${book.progress_percentage}%` }}
                    />
                  </div>

                  <div className="book-actions">
                    <Link to={`/read/${book.id}`} className="btn btn-primary">
                      继续阅读
                    </Link>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => removeFromBookshelf(book.id)}
                      disabled={removingBookId === book.id}
                      style={{ color: 'var(--error)', borderColor: 'var(--error)' }}
                    >
                      {removingBookId === book.id ? '移除中...' : '移出书架'}
                    </button>
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

export default MyBookshelf;
