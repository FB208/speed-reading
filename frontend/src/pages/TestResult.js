import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { readingAPI } from '../services/api';

const TestResult = () => {
  const { resultId } = useParams();
  const navigate = useNavigate();

  const [result, setResult] = useState(null);
  const [answersDetail, setAnswersDetail] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchResultDetail();
  }, [resultId]);

  const fetchResultDetail = async () => {
    try {
      const response = await readingAPI.getTestResultDetail(resultId);
      setResult(response.data.test_result);
      setAnswersDetail(response.data.answers_detail);
    } catch (err) {
      setError('获取测试结果失败');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs}秒`;
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (error) {
    return (
      <div className="container">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ textAlign: 'center', marginBottom: '24px' }}>测试结果</h2>

        {/* 顶部操作按钮 - 最主要操作是"下一节" */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap' }}>
          {result && result.book_id && (
            <Link
              to={`/read/${result.book_id}`}
              className="btn btn-success"
              style={{
                textDecoration: 'none',
                textAlign: 'center',
                flex: '1',
                minWidth: '150px',
                fontSize: '18px',
                padding: '16px 24px'
              }}
            >
              📖 下一节
            </Link>
          )}
          <Link
            to="/books"
            className="btn btn-primary"
            style={{ textDecoration: 'none', textAlign: 'center' }}
          >
            书籍列表
          </Link>
          <Link
            to="/history"
            className="btn btn-secondary"
            style={{ textDecoration: 'none', textAlign: 'center' }}
          >
            历史记录
          </Link>
          <button
            className="btn btn-secondary"
            onClick={() => navigate(-1)}
          >
            返回
          </button>
        </div>

        {result && (
          <div style={{ marginBottom: '32px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                marginBottom: '24px'
              }}
            >
              <div
                style={{
                  background: '#f0f8ff',
                  padding: '20px',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1890ff' }}>
                  {result.words_per_minute}
                </div>
                <div style={{ color: '#666', marginTop: '8px' }}>阅读速度（字/分钟）</div>
              </div>

              <div
                style={{
                  background: '#f6ffed',
                  padding: '20px',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#52c41a' }}>
                  {result.comprehension_rate}%
                </div>
                <div style={{ color: '#666', marginTop: '8px' }}>理解程度</div>
              </div>

              <div
                style={{
                  background: '#fff7e6',
                  padding: '20px',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#fa8c16' }}>
                  {formatTime(result.reading_time_seconds)}
                </div>
                <div style={{ color: '#666', marginTop: '8px' }}>阅读时长</div>
              </div>

              <div
                style={{
                  background: '#f9f0ff',
                  padding: '20px',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#722ed1' }}>
                  {result.correct_count}/{result.total_questions}
                </div>
                <div style={{ color: '#666', marginTop: '8px' }}>答对题数</div>
              </div>
            </div>
          </div>
        )}

        <h3 style={{ marginBottom: '16px' }}>答案详解</h3>

        {answersDetail.map((item, index) => (
          <div
            key={index}
            style={{
              marginBottom: '20px',
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: item.is_correct ? '#f6ffed' : '#fff2f0',
              border: `1px solid ${item.is_correct ? '#b7eb8f' : '#ffccc7'}`
            }}
          >
            <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>
              {index + 1}. {item.question}
            </p>
            <div style={{ paddingLeft: '16px' }}>
              {['A', 'B', 'C', 'D'].map((option) => (
                <div
                  key={option}
                  style={{
                    padding: '4px 8px',
                    marginBottom: '4px',
                    borderRadius: '4px',
                    backgroundColor:
                      option === item.correct_answer ? '#b7eb8f' :
                      (option === item.user_answer && !item.is_correct) ? '#ffccc7' : 'transparent',
                    fontWeight: option === item.correct_answer ? 'bold' : 'normal'
                  }}
                >
                  {option}. {item.options[option]}
                  {option === item.correct_answer && ' ✓'}
                  {option === item.user_answer && !item.is_correct && ' ✗'}
                </div>
              ))}
            </div>
            <div style={{ marginTop: '8px', fontSize: '14px' }}>
              你的答案：{item.user_answer} | 正确答案：{item.correct_answer}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TestResult;
