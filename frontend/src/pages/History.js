import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { readingAPI } from '../services/api';

const History = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await readingAPI.getTestResults();
      setResults(response.data);
    } catch (err) {
      setError('获取历史记录失败');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs}秒`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div className="container">
      <h1 style={{ marginBottom: '24px' }}>测试历史</h1>

      {error && <div className="error-message">{error}</div>}

      {results.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <p>还没有测试记录</p>
          <Link to="/books" className="btn btn-primary" style={{ marginTop: '16px' }}>
            去阅读书籍
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {results.map((result) => (
            <div key={result.id} className="card">
              <div 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>
                    段落 #{result.paragraph_id}
                  </div>
                  <div style={{ color: '#666', fontSize: '14px' }}>
                    {formatDate(result.created_at)}
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                      {result.words_per_minute}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>字/分钟</div>
                  </div>
                  
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                      {result.comprehension_rate}%
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>理解程度</div>
                  </div>
                  
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fa8c16' }}>
                      {result.correct_count}/{result.total_questions}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>答对</div>
                  </div>
                  
                  <Link 
                    to={`/result/${result.id}`}
                    className="btn btn-primary"
                    style={{ textDecoration: 'none' }}
                  >
                    查看详情
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default History;
