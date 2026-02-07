import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { readingAPI } from '../services/api';

const TestResult = () => {
  const { resultId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [result, setResult] = useState(null);
  const [answersDetail, setAnswersDetail] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSkipped, setIsSkipped] = useState(false);
  const [skippedData, setSkippedData] = useState(null);

  useEffect(() => {
    // 检查是否是跳过的测试
    const skipped = searchParams.get('skipped') === 'true';
    const bookId = searchParams.get('bookId');
    const paragraphId = searchParams.get('paragraphId');
    const time = searchParams.get('time');

    if (skipped && bookId && paragraphId) {
      const readingSpeed = parseInt(searchParams.get('speed')) || 0;
      const readingTime = parseInt(time) || 0;
      
      setIsSkipped(true);
      setSkippedData({
        bookId: parseInt(bookId),
        paragraphId: parseInt(paragraphId),
        readingTimeSeconds: readingTime,
        wordsPerMinute: readingSpeed
      });
      setLoading(false);
      // 为跳过的测试创建一个模拟的result对象用于显示
      setResult({
        words_per_minute: readingSpeed, // 使用计算好的阅读速度
        book_id: parseInt(bookId),
        skipped: true
      });
    } else {
      fetchResultDetail();
    }
  }, [resultId, searchParams]);

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
        <h2 style={{ textAlign: 'center', marginBottom: '24px', color: 'var(--text-heading)' }}>测试结果</h2>

        {/* 顶部操作按钮 - 最主要操作是"下一节" */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          marginBottom: '32px', 
          flexWrap: 'wrap', 
          alignItems: 'center' 
        }}>
          {result && result.book_id && (
            <Link
              to={`/read/${result.book_id}`}
              className="btn btn-success"
              style={{
                textDecoration: 'none',
                textAlign: 'center',
                flex: '1',
                minWidth: '120px',
                fontSize: '17px',
                padding: '14px 24px'
              }}
            >
              下一节
            </Link>
          )}
          <Link
            to="/books"
            className="btn btn-primary"
            style={{ textDecoration: 'none', textAlign: 'center', padding: '12px 20px' }}
          >
            书籍列表
          </Link>
          <Link
            to="/history"
            className="btn btn-secondary"
            style={{ textDecoration: 'none', textAlign: 'center', padding: '12px 20px' }}
          >
            历史记录
          </Link>
          <button
            className="btn btn-secondary"
            onClick={() => navigate(-1)}
            style={{ padding: '12px 20px' }}
          >
            返回
          </button>
        </div>

        {result && (
          <div style={{ marginBottom: '32px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '16px',
                marginBottom: '24px'
              }}
            >
              {/* 阅读速度 - 总是显示 */}
              <div
                style={{
                  background: 'var(--accent-light-bg)',
                  padding: '20px',
                  borderRadius: '8px',
                  textAlign: 'center',
                  border: '1px solid var(--paper-dark)'
                }}
              >
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                  {isSkipped ? (
                    <span style={{ fontSize: '16px', color: 'var(--text-muted)' }}>跳过测试</span>
                  ) : (
                    result.words_per_minute
                  )}
                </div>
                <div style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '13px' }}>阅读速度（字/分钟）</div>
              </div>

              {/* 理解程度 - 仅在非跳过时显示 */}
              {!isSkipped && (
                <div
                  style={{
                    background: 'var(--success-light)',
                    padding: '20px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    border: '1px solid var(--paper-dark)'
                  }}
                >
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--success)' }}>
                    {result.comprehension_rate}%
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '13px' }}>理解程度</div>
                </div>
              )}

              {/* 阅读时长 - 总是显示 */}
              <div
                style={{
                  background: 'var(--warning-light)',
                  padding: '20px',
                  borderRadius: '8px',
                  textAlign: 'center',
                  border: '1px solid var(--paper-dark)'
                }}
              >
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--warning)' }}>
                  {formatTime(isSkipped ? skippedData?.readingTimeSeconds || 0 : result.reading_time_seconds)}
                </div>
                <div style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '13px' }}>阅读时长</div>
              </div>

              {/* 答对题数 - 仅在非跳过时显示 */}
              {!isSkipped && (
                <div
                  style={{
                    background: 'var(--accent-purple-light)',
                    padding: '20px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    border: '1px solid var(--paper-dark)'
                  }}
                >
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-purple)' }}>
                    {result.correct_count}/{result.total_questions}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '13px' }}>答对题数</div>
                </div>
              )}
            </div>
          </div>
        )}

        <h3 style={{ marginBottom: '16px', color: 'var(--text-heading)' }}>答案详解</h3>

        {isSkipped ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px 20px',
            backgroundColor: 'var(--paper-bg)',
            borderRadius: '8px',
            border: '1px solid var(--paper-dark)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏭️</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '16px', margin: 0 }}>
              你已跳过测试，不显示答题详情
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>
              阅读速度：已记录 | 理解程度：未测试
            </p>
          </div>
        ) : (
          answersDetail.map((item, index) => (
            <div
              key={index}
              style={{
                marginBottom: '20px',
                padding: '16px',
                borderRadius: '8px',
                backgroundColor: item.is_correct ? 'var(--success-light)' : 'var(--error-light)',
                border: `1px solid ${item.is_correct ? 'var(--success)' : 'var(--error)'}`
              }}
            >
              <p style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text-heading)' }}>
                {index + 1}. {item.question}
              </p>
              <div style={{ paddingLeft: '12px' }}>
                {['A', 'B', 'C', 'D'].map((option) => (
                  <div
                    key={option}
                    style={{
                      padding: '6px 10px',
                      marginBottom: '4px',
                      borderRadius: '6px',
                      backgroundColor:
                        option === item.correct_answer ? 'var(--success-light)' :
                        (option === item.user_answer && !item.is_correct) ? 'var(--error-light)' : 'transparent',
                      fontWeight: option === item.correct_answer ? 600 : 'normal',
                      color: option === item.correct_answer ? 'var(--success)' : 
                             (option === item.user_answer && !item.is_correct) ? 'var(--error)' : 'var(--text-primary)',
                      border: option === item.correct_answer ? '1px solid var(--success)' : '1px solid transparent'
                    }}
                  >
                    {option}. {item.options[option]}
                    {option === item.correct_answer && ' ✓'}
                    {option === item.user_answer && !item.is_correct && ' ✗'}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                你的答案：{item.user_answer} | 正确答案：{item.correct_answer}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TestResult;
