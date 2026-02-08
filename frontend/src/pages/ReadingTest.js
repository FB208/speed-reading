import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { readingAPI } from '../services/api';

const ReadingTest = ({ isGuestMode = false }) => {
  const { bookId } = useParams();
  const navigate = useNavigate();
  
  const [paragraph, setParagraph] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isReading, setIsReading] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsStatus, setQuestionsStatus] = useState(''); // 'loading', 'generating', 'ready'
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  
  const pollIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);

  useEffect(() => {
    fetchNextParagraph();
    
    // 清理
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [bookId, isGuestMode]);

  const fetchNextParagraph = async () => {
    try {
      setLoading(true);
      setError('');
      const response = isGuestMode
        ? await readingAPI.getGuestRandomParagraph()
        : await readingAPI.getNextParagraph(bookId);
      
      if (response.data.paragraph) {
        setParagraph(response.data.paragraph);
        setProgress(isGuestMode ? null : response.data.progress);
        // 检查问题是否已经准备好
        if (response.data.questions_ready) {
          // 问题已存在，直接获取
          fetchQuestions(response.data.paragraph.id);
        }
      } else {
        // 书籍已完成
        setParagraph(null);
        setProgress(isGuestMode ? null : response.data.progress);
      }
    } catch (err) {
      setError('获取段落失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestions = async (paragraphId) => {
    try {
      setQuestionsLoading(true);
      const response = isGuestMode
        ? await readingAPI.getGuestQuestions(paragraphId)
        : await readingAPI.getQuestions(paragraphId);
      
      if (response.data.status === 'ready') {
        // 问题已准备好
        setQuestions(response.data.questions);
        setQuestionsStatus('ready');
        setQuestionsLoading(false);
        // 清除轮询
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      } else if (response.data.status === 'generating') {
        // 问题正在生成中
        setQuestionsStatus('generating');
        // 开始轮询
        if (!pollIntervalRef.current) {
          pollIntervalRef.current = setInterval(() => {
            fetchQuestions(paragraphId);
          }, 2000); // 每2秒轮询一次
        }
      }
    } catch (err) {
      setError('获取问题失败');
      setQuestionsLoading(false);
    }
  };

  const formatElapsedTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startReading = () => {
    setIsReading(true);
    setStartTime(Date.now());
    setElapsedTime(0);
    
    // 启动计时器
    timerIntervalRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
  };

  const finishReading = () => {
    setIsReading(false);
    setShowQuestions(true);
    // 停止计时器
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    // 开始获取问题
    if (paragraph) {
      fetchQuestions(paragraph.id);
    }
  };

  const handleAnswerChange = (questionId, answer) => {
    setAnswers({
      ...answers,
      [questionId]: answer,
    });
  };

  const submitTest = async () => {
    // 检查是否回答了所有问题
    if (Object.keys(answers).length !== questions.length) {
      alert('请回答所有问题');
      return;
    }

    setSubmitting(true);
    
    const readingTimeSeconds = Math.floor((Date.now() - startTime) / 1000);
    
    const formattedAnswers = Object.entries(answers).map(([questionId, answer]) => ({
      question_id: parseInt(questionId),
      answer: answer,
    }));

    try {
      if (isGuestMode) {
        const response = await readingAPI.submitGuestTest(
          paragraph.id,
          readingTimeSeconds,
          formattedAnswers
        );
        navigate('/guest/result', { state: response.data });
      } else {
        const response = await readingAPI.submitTest(
          paragraph.id,
          readingTimeSeconds,
          formattedAnswers
        );
        navigate(`/result/${response.data.id}`);
      }
    } catch (err) {
      setError('提交测试失败');
      setSubmitting(false);
    }
  };

  // 跳过测试保存历史记录并进入结果页
  const skipTest = async () => {
    const currentReadingTimeSeconds = Math.floor((Date.now() - startTime) / 1000);
    
    setSubmitting(true);
    
    try {
      if (isGuestMode) {
        const response = await readingAPI.submitGuestTest(
          paragraph.id,
          currentReadingTimeSeconds,
          []
        );
        navigate('/guest/result', { state: response.data });
      } else {
        // 保存跳过的历史记录 - 使用submitTest API
        const response = await readingAPI.submitTest(
          paragraph.id,
          currentReadingTimeSeconds,
          []  // 跳过没有答案
        );
        // 使用返回的测试结果 ID 跳转
        navigate(`/result/${response.data.id}?skipped=true`);
      }
    } catch (err) {
      setError('保存跳过记录失败');
      console.error('保存跳过记录失败:', err);
    } finally {
      setSubmitting(false);
    }
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

  if (!paragraph) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <h2 style={{ color: 'var(--text-heading)' }}>恭喜！</h2>
          <p style={{ margin: '20px 0', color: 'var(--text-secondary)' }}>
            {isGuestMode ? '暂时没有可用段落，请稍后再试' : '你已经完成了这本书的所有段落'}
          </p>
          {!isGuestMode && progress && (
            <p style={{ color: 'var(--text-secondary)' }}>
              完成进度：{progress.completed} / {progress.total}
            </p>
          )}
          <button
            className="btn btn-primary"
            onClick={() => navigate(isGuestMode ? '/' : '/books')}
            style={{ marginTop: '20px' }}
          >
            {isGuestMode ? '返回首页' : '返回书籍列表'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {!isGuestMode && progress && (
        <div style={{ marginBottom: '20px', color: 'var(--text-secondary)', fontSize: '14px' }}>
          进度：{progress.completed} / {progress.total} 段落
        </div>
      )}

      {!isReading && !showQuestions && (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <h3 style={{ color: 'var(--text-heading)' }}>准备开始阅读</h3>
          <p style={{ margin: '20px 0', color: 'var(--text-secondary)' }}>
            点击开始后，系统会记录你的阅读时间。
            <br />
            阅读完成后，需要回答5道理解题。
            {isGuestMode && (
              <>
                <br />
                游客模式不会保存历史记录和阅读进度。
              </>
            )}
          </p>
          <button className="btn btn-primary" onClick={startReading}>
            开始阅读
          </button>
        </div>
      )}

      {isReading && (
        <div className="card">
          <div className="reading-timer">
            <span className="reading-timer-label">阅读计时</span>
            <span className="reading-timer-value">
              {formatElapsedTime(elapsedTime)}
            </span>
          </div>
          <div 
            className="rich-text-content"
            style={{ marginBottom: '24px' }}
            dangerouslySetInnerHTML={{ __html: paragraph.content }}
          />
          <button 
            className="btn btn-success" 
            onClick={finishReading}
            style={{ width: '100%' }}
          >
            我已完成阅读
          </button>
        </div>
      )}

      {showQuestions && (
        <div className="card">
          {/* 跳过答题按钮 - 放置在答题界面顶部 */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '24px',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--paper-dark)',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <h3 style={{ margin: 0, color: 'var(--text-heading)' }}>阅读理解测试</h3>
            <button
              className="btn btn-danger"
              onClick={skipTest}
              style={{ fontSize: '14px', padding: '8px 16px' }}
            >
              跳过答题
            </button>
          </div>
          
          {questionsLoading && questionsStatus === 'generating' && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤔</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>
                正在准备题...
                <br />
                <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>请稍候，马上就好</span>
              </p>
              <div style={{ 
                width: '200px', 
                height: '4px', 
                backgroundColor: 'var(--paper-dark)',
                margin: '20px auto',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: 'var(--accent-primary)',
                  animation: 'loadingBar 1.5s infinite ease-in-out',
                  transformOrigin: 'left'
                }} />
              </div>
              <style>{`
                @keyframes loadingBar {
                  0% { transform: scaleX(0); }
                  50% { transform: scaleX(1); }
                  100% { transform: scaleX(0); transform-origin: right; }
                }
              `}</style>
            </div>
          )}
          
          {!questionsLoading && questionsStatus === 'ready' && questions.length > 0 && (
            <>
              {questions.map((question, index) => (
                <div key={question.id} style={{ marginBottom: '24px' }}>
                  <p style={{ fontWeight: 600, marginBottom: '12px', color: 'var(--text-heading)' }}>
                    {index + 1}. {question.question_text}
                  </p>
                  <div style={{ paddingLeft: '12px' }}>
                    {['A', 'B', 'C', 'D'].map((option) => (
                      <label 
                        key={option}
                        className="question-option"
                        style={{ 
                          backgroundColor: answers[question.id] === option 
                            ? 'rgba(122, 106, 90, 0.08)' 
                            : 'transparent',
                          borderColor: answers[question.id] === option 
                            ? 'var(--accent-primary)' 
                            : 'var(--paper-dark)'
                        }}
                      >
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          value={option}
                          checked={answers[question.id] === option}
                          onChange={() => handleAnswerChange(question.id, option)}
                        />
                        {option}. {question[`option_${option.toLowerCase()}`]}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              
              <button
                className="btn btn-primary"
                onClick={submitTest}
                disabled={submitting}
                style={{ width: '100%', marginTop: '20px' }}
              >
                {submitting ? '提交中...' : '提交答案'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ReadingTest;
