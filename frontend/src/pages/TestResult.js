import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import { readingAPI } from '../services/api';
import '../styles/test-result.css';

const TestResult = ({ isGuestMode = false }) => {
  const { resultId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [result, setResult] = useState(null);
  const [answersDetail, setAnswersDetail] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSkipped, setIsSkipped] = useState(false);
  const [skippedData, setSkippedData] = useState(null);

  useEffect(() => {
    if (isGuestMode) {
      const guestData = location.state;
      if (!guestData?.test_result) {
        setError('游客结果不存在，请重新开始阅读');
        setLoading(false);
        return;
      }

      setResult(guestData.test_result);
      setAnswersDetail(guestData.answers_detail || []);
      setIsSkipped(guestData.test_result.skipped === true);
      setLoading(false);
      return;
    }

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
  }, [isGuestMode, location.state, resultId, searchParams]);

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
    <div className="container result-page-container">
      <div className="card result-card">
        <div className="result-page-header">
          <p className="result-page-subtitle">阅读表现报告</p>
          <p className="result-page-desc">
            {isSkipped
              ? '本次你选择了跳过答题，系统已记录阅读速度与阅读时长。'
              : '这里展示本次阅读表现和答题解析，可随时通过底部工具条继续下一步。'}
          </p>
        </div>

        {result && (
          <div className="result-metrics-wrap">
            <div className="result-metrics-grid">
              {/* 阅读速度 - 总是显示 */}
              <div className="result-metric-card result-metric-card-speed">
                <div className="result-metric-value result-metric-value-speed">
                  {isSkipped && !isGuestMode ? (
                    <span className="result-skip-tag">跳过测试</span>
                  ) : (
                    result.words_per_minute
                  )}
                </div>
                <div className="result-metric-label">阅读速度（字/分钟）</div>
              </div>

              {/* 理解程度 - 仅在非跳过时显示 */}
              {!isSkipped && (
                <div className="result-metric-card result-metric-card-comprehension">
                  <div className="result-metric-value result-metric-value-comprehension">
                    {result.comprehension_rate}%
                  </div>
                  <div className="result-metric-label">理解程度</div>
                </div>
              )}

              {/* 阅读时长 - 总是显示 */}
              <div className="result-metric-card result-metric-card-duration">
                <div className="result-metric-value result-metric-value-duration">
                  {formatTime(
                    isSkipped && !isGuestMode
                      ? skippedData?.readingTimeSeconds || 0
                      : result.reading_time_seconds
                  )}
                </div>
                <div className="result-metric-label">阅读时长</div>
              </div>

              {/* 答对题数 - 仅在非跳过时显示 */}
              {!isSkipped && (
                <div className="result-metric-card result-metric-card-correct">
                  <div className="result-metric-value result-metric-value-correct">
                    {result.correct_count}/{result.total_questions}
                  </div>
                  <div className="result-metric-label">答对题数</div>
                </div>
              )}
            </div>
          </div>
        )}

        <h3 className="result-section-title">答案详解</h3>

        {isSkipped ? (
          <div className="result-skipped-panel">
            <div className="result-skipped-icon">⏭️</div>
            <p className="result-skipped-title">
              你已跳过测试，不显示答题详情
            </p>
            <p className="result-skipped-desc">
              阅读速度：已记录 | 理解程度：未测试
            </p>
          </div>
        ) : (
          answersDetail.map((item, index) => (
            <div key={index} className={`result-answer-card ${item.is_correct ? 'is-correct' : 'is-wrong'}`}>
              <p className="result-answer-question">
                {index + 1}. {item.question}
              </p>
              <div className="result-answer-options">
                {['A', 'B', 'C', 'D'].map((option) => (
                  <div
                    key={option}
                    className={`result-answer-option ${
                      option === item.correct_answer
                        ? 'is-correct'
                        : option === item.user_answer && !item.is_correct
                        ? 'is-wrong'
                        : ''
                    }`}
                  >
                    {option}. {item.options[option]}
                    {option === item.correct_answer && ' ✓'}
                    {option === item.user_answer && !item.is_correct && ' ✗'}
                  </div>
                ))}
              </div>
              <div className="result-answer-summary">
                你的答案：{item.user_answer} | 正确答案：{item.correct_answer}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="result-floating-toolbar" role="toolbar" aria-label="测试结果操作栏">
        <div className="result-floating-toolbar-inner">
          <div className="result-floating-toolbar-shell">
             {isGuestMode ? (
               <Link
                 to="/guest/read"
                 className="result-tool-btn result-tool-btn-main"
               >
                 下一节
               </Link>
             ) : result && result.book_id && (
               <Link
                 to={`/read/${result.book_id}`}
                 className="result-tool-btn result-tool-btn-main"
               >
                 下一节
               </Link>
             )}
            <Link to={isGuestMode ? '/' : '/books'} className="result-tool-btn">
              {isGuestMode ? '首页' : '书籍列表'}
            </Link>
            {!isGuestMode && (
              <Link to="/history" className="result-tool-btn">
                历史记录
              </Link>
            )}
            <button
              type="button"
              className="result-tool-btn"
              onClick={() => navigate(-1)}
            >
              返回
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestResult;
