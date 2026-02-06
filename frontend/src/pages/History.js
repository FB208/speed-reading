import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { readingAPI } from '../services/api';

const History = () => {
  const [groupedResults, setGroupedResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [deletingBook, setDeletingBook] = useState(null);
  const [expandedBooks, setExpandedBooks] = useState({});

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await readingAPI.getTestResults();
      // 按书籍分组
      const grouped = {};
      response.data.forEach(result => {
        const bookId = result.book_id || 'unknown';
        const bookTitle = result.book_title || '未知书籍';
        if (!grouped[bookId]) {
          grouped[bookId] = {
            bookId,
            bookTitle,
            results: [],
            totalTests: 0,
            avgSpeed: 0,
            avgComprehension: 0
          };
        }
        grouped[bookId].results.push(result);
      });
      
      // 计算每本书的统计数据
      Object.values(grouped).forEach(group => {
        group.totalTests = group.results.length;
        group.avgSpeed = Math.round(
          group.results.reduce((sum, r) => sum + r.words_per_minute, 0) / group.totalTests
        );
        group.avgComprehension = Math.round(
          group.results.reduce((sum, r) => sum + r.comprehension_rate, 0) / group.totalTests
        );
      });
      
      setGroupedResults(grouped);
      // 默认展开第一个书籍
      const firstBookId = Object.keys(grouped)[0];
      if (firstBookId) {
        setExpandedBooks({ [firstBookId]: true });
      }
    } catch (err) {
      setError('获取历史记录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteResult = async (resultId, bookId) => {
    if (!window.confirm('确定要删除这条记录吗？')) return;
    
    setDeleting(resultId);
    try {
      await readingAPI.deleteTestResult(resultId);
      // 更新本地状态
      setGroupedResults(prev => {
        const updated = { ...prev };
        if (updated[bookId]) {
          updated[bookId].results = updated[bookId].results.filter(r => r.id !== resultId);
          updated[bookId].totalTests = updated[bookId].results.length;
          if (updated[bookId].totalTests === 0) {
            delete updated[bookId];
          } else {
            updated[bookId].avgSpeed = Math.round(
              updated[bookId].results.reduce((sum, r) => sum + r.words_per_minute, 0) / updated[bookId].totalTests
            );
            updated[bookId].avgComprehension = Math.round(
              updated[bookId].results.reduce((sum, r) => sum + r.comprehension_rate, 0) / updated[bookId].totalTests
            );
          }
        }
        return updated;
      });
    } catch (err) {
      setError('删除失败');
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteBook = async (bookId, bookTitle) => {
    if (!window.confirm(`确定要清空《${bookTitle}》的所有阅读记录吗？\n\n这将删除该书籍的所有测试记录和阅读进度，操作不可恢复！`)) return;
    
    setDeletingBook(bookId);
    try {
      await readingAPI.deleteBookResults(bookId);
      setGroupedResults(prev => {
        const updated = { ...prev };
        delete updated[bookId];
        return updated;
      });
    } catch (err) {
      setError('删除失败');
    } finally {
      setDeletingBook(null);
    }
  };

  const toggleBook = (bookId) => {
    setExpandedBooks(prev => ({
      ...prev,
      [bookId]: !prev[bookId]
    }));
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getComprehensionColor = (rate) => {
    if (rate >= 80) return 'var(--success)';
    if (rate >= 60) return 'var(--warning)';
    return 'var(--error)';
  };

  const totalRecords = Object.values(groupedResults).reduce((sum, g) => sum + g.totalTests, 0);

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div className="container">
      <div className="history-page">
        <div className="history-header-section">
          <h1 className="history-title">测试历史</h1>
          <div className="history-summary">
            共 <span className="highlight">{Object.keys(groupedResults).length}</span> 本书，
            <span className="highlight">{totalRecords}</span> 条记录
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {Object.keys(groupedResults).length === 0 ? (
          <div className="card empty-state">
            <div className="empty-state-icon">📊</div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
              还没有测试记录
            </p>
            <Link to="/books" className="btn btn-primary">
              去阅读书籍
            </Link>
          </div>
        ) : (
          <div className="books-list">
            {Object.values(groupedResults).map(group => (
              <div key={group.bookId} className="book-group">
                <div className="book-header" onClick={() => toggleBook(group.bookId)}>
                  <div className="book-info">
                    <span className={`expand-icon ${expandedBooks[group.bookId] ? 'expanded' : ''}`}>▶</span>
                    <span className="book-title">{group.bookTitle}</span>
                    <span className="book-count">{group.totalTests} 条记录</span>
                  </div>
                  <div className="book-stats">
                    <div className="book-stat">
                      <span className="stat-value">{group.avgSpeed}</span>
                      <span className="stat-label">平均字/分</span>
                    </div>
                    <div className="book-stat">
                      <span className="stat-value" style={{ color: getComprehensionColor(group.avgComprehension) }}>
                        {group.avgComprehension}%
                      </span>
                      <span className="stat-label">平均理解度</span>
                    </div>
                    <button
                      className="clear-book-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBook(group.bookId, group.bookTitle);
                      }}
                      disabled={deletingBook === group.bookId}
                      title="清空此书记录"
                    >
                      {deletingBook === group.bookId ? '...' : '清空'}
                    </button>
                  </div>
                </div>
                
                {expandedBooks[group.bookId] && (
                  <div className="book-results">
                    {group.results.map(result => (
                      <div key={result.id} className="result-row">
                        <div className="result-info">
                          <span className="paragraph-num">#{result.paragraph_id}</span>
                          <span className="result-date">{formatDate(result.created_at)}</span>
                        </div>
                        <div className="result-stats">
                          <span className="result-stat">
                            <strong>{Math.round(result.words_per_minute)}</strong> 字/分
                          </span>
                          <span className="result-stat" style={{ color: getComprehensionColor(result.comprehension_rate) }}>
                            <strong>{result.comprehension_rate}%</strong>
                          </span>
                          <span className="result-stat correct">
                            <strong>{result.correct_count}</strong>/{result.total_questions}
                          </span>
                        </div>
                        <div className="result-actions">
                          <Link to={`/result/${result.id}`} className="action-btn" title="查看详情">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                          </Link>
                          <button
                            className="action-btn delete"
                            onClick={() => handleDeleteResult(result.id, group.bookId)}
                            disabled={deleting === result.id}
                            title="删除"
                          >
                            {deleting === result.id ? (
                              <span className="spinner" />
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .history-page {
          max-width: 900px;
          margin: 0 auto;
        }
        
        .history-header-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        
        .history-title {
          font-size: 26px;
          font-weight: 600;
          color: var(--text-heading);
          margin: 0;
        }
        
        .history-summary {
          font-size: 14px;
          color: var(--text-muted);
        }
        
        .history-summary .highlight {
          font-weight: 600;
          color: var(--accent-primary);
        }
        
        .books-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .book-group {
          background: var(--paper-card);
          border-radius: 12px;
          border: 1px solid var(--paper-dark);
          overflow: hidden;
          box-shadow: var(--shadow-paper);
        }
        
        .book-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .book-header:hover {
          background: var(--paper-bg);
        }
        
        .book-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .expand-icon {
          font-size: 10px;
          color: var(--text-muted);
          transition: transform 0.2s;
        }
        
        .expand-icon.expanded {
          transform: rotate(90deg);
        }
        
        .book-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-heading);
        }
        
        .book-count {
          font-size: 13px;
          color: var(--text-muted);
          padding: 2px 10px;
          background: var(--paper-bg);
          border-radius: 10px;
        }
        
        .book-stats {
          display: flex;
          align-items: center;
          gap: 24px;
        }
        
        .book-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }
        
        .book-stat .stat-value {
          font-size: 16px;
          font-weight: 600;
          color: var(--accent-primary);
          font-family: 'SF Mono', monospace;
        }
        
        .book-stat .stat-label {
          font-size: 11px;
          color: var(--text-muted);
        }
        
        .clear-book-btn {
          padding: 6px 14px;
          border: 1px solid var(--error);
          background: transparent;
          color: var(--error);
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .clear-book-btn:hover {
          background: var(--error);
          color: white;
        }
        
        .clear-book-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .book-results {
          border-top: 1px solid var(--paper-dark);
          background: var(--paper-bg);
        }
        
        .result-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 20px 12px 44px;
          border-bottom: 1px solid var(--paper-dark);
          transition: background 0.15s;
        }
        
        .result-row:last-child {
          border-bottom: none;
        }
        
        .result-row:hover {
          background: var(--paper-card);
        }
        
        .result-info {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 140px;
        }
        
        .paragraph-num {
          font-weight: 600;
          color: var(--accent-primary);
          font-size: 14px;
        }
        
        .result-date {
          font-size: 12px;
          color: var(--text-muted);
        }
        
        .result-stats {
          display: flex;
          gap: 32px;
        }
        
        .result-stat {
          font-size: 13px;
          color: var(--text-secondary);
        }
        
        .result-stat strong {
          font-family: 'SF Mono', monospace;
          color: var(--text-heading);
        }
        
        .result-stat.correct strong {
          color: var(--success);
        }
        
        .result-actions {
          display: flex;
          gap: 6px;
        }
        
        .action-btn {
          width: 30px;
          height: 30px;
          border-radius: 6px;
          border: 1px solid var(--paper-dark);
          background: var(--paper-card);
          color: var(--text-secondary);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          text-decoration: none;
        }
        
        .action-btn:hover {
          background: var(--accent-primary);
          border-color: var(--accent-primary);
          color: white;
        }
        
        .action-btn.delete:hover {
          background: var(--error);
          border-color: var(--error);
        }
        
        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .spinner {
          width: 12px;
          height: 12px;
          border: 2px solid var(--paper-dark);
          border-top-color: var(--accent-primary);
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        @media (max-width: 768px) {
          .history-header-section {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
          
          .book-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          
          .book-stats {
            width: 100%;
            justify-content: space-between;
          }
          
          .result-row {
            flex-wrap: wrap;
            padding-left: 20px;
            gap: 8px;
          }
          
          .result-stats {
            flex: 100%;
            gap: 16px;
          }
          
          .result-actions {
            margin-left: auto;
          }
        }
      `}</style>
    </div>
  );
};

export default History;
