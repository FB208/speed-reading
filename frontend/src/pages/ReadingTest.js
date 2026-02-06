import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { readingAPI } from '../services/api';

const ReadingTest = () => {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
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
  }, [bookId]);

  const fetchNextParagraph = async () => {
    try {
      setLoading(true);
      const response = await readingAPI.getNextParagraph(bookId);
      
      if (response.data.paragraph) {
        setParagraph(response.data.paragraph);
        setProgress(response.data.progress);
        // 检查问题是否已经准备好
        if (response.data.questions_ready) {
          // 问题已存在，直接获取
          fetchQuestions(response.data.paragraph.id);
        }
      } else {
        // 书籍已完成
        setParagraph(null);
        setProgress(response.data.progress);
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
      const response = await readingAPI.getQuestions(paragraphId);
      
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
      const response = await readingAPI.submitTest(
        paragraph.id,
        readingTimeSeconds,
        formattedAnswers
      );
      
      // 跳转到结果页面
      navigate(`/result/${response.data.id}`);
    } catch (err) {
      setError('提交测试失败');
      setSubmitting(false);
    }
  };

  // 跳过测试保存历史记录并进入结果页
  const skipTest = async () => {
    const currentReadingTimeSeconds = Math.floor((Date.now() - startTime) / 1000);
    const currentWordCount = paragraph?.content ? paragraph.content.length : 0;
    
    // 计算阅读速度（字/分钟）
    const currentWordsPerMinute = currentReadingTimeSeconds > 0 
      ? Math.round((currentWordCount / currentReadingTimeSeconds) * 60)
      : 0;
    
    setSubmitting(true);
    
    try {
      // 保存跳过的历史记录 - 使用submitTest API
      await readingAPI.submitTest(
        paragraph.id,
        currentReadingTimeSeconds,
        []  // 跳过没有答案
      );
      
      // 跳转到结果页
      navigate(`/result/${paragraph.id}?bookId=${bookId}&time=${currentReadingTimeSeconds}&wordCount=${currentWordCount}&speed=${currentWordsPerMinute}&skipped=true`);
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
          <h2>恭喜！</h2>
          <p style={{ margin: '20px 0' }}>你已经完成了这本书的所有段落</p>
          {progress && (
            <p style={{ color: '#666' }}>
              完成进度：{progress.completed} / {progress.total}
            </p>
          )}
          <button
            className="btn btn-primary"
            onClick={() => navigate('/books')}
            style={{ marginTop: '20px' }}
          >
            返回书籍列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {progress && (
        <div style={{ marginBottom: '20px', color: '#666' }}>
          进度：{progress.completed} / {progress.total} 段落
        </div>
      )}

      {!isReading && !showQuestions && (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <h3>准备开始阅读</h3>
          <p style={{ margin: '20px 0', color: '#666' }}>
            点击开始后，系统会记录你的阅读时间。
            <br />
            阅读完成后，需要回答5道理解题。
          </p>
          <button className="btn btn-primary" onClick={startReading}>
            开始阅读
          </button>
        </div>
      )}

      {isReading && (
        <div className="card">
          <div style={{
            position: 'sticky',
            top: '0',
            backgroundColor: '#fff',
            padding: '12px 0',
            borderBottom: '2px solid #1890ff',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: '100'
          }}>
            <span style={{ fontSize: '14px', color: '#666' }}>阅读计时</span>
            <span style={{ 
              fontSize: '24px', 
              fontWeight: 'bold', 
              color: '#1890ff',
              fontFamily: 'monospace'
            }}>
              ⏱️ {formatElapsedTime(elapsedTime)}
            </span>
          </div>
          <div 
            className="rich-text-content"
            style={{ 
              lineHeight: '1.8', 
              fontSize: '18px',
              marginBottom: '24px'
            }}
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
            borderBottom: '1px solid #e8e8e8'
          }}>
            <h3 style={{ margin: 0 }}>阅读理解测试</h3>
            <button
              onClick={skipTest}
              style={{
                padding: '8px 16px',
                backgroundColor: '#ff4d4f',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#ff7875';
                e.target.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#ff4d4f';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              跳过答题
            </button>
          </div>
          
          {questionsLoading && questionsStatus === 'generating' && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤔</div>
              <p style={{ color: '#666', fontSize: '16px' }}>
                AI正在根据文本内容生成问题...
                <br />
                <span style={{ fontSize: '14px' }}>请稍候，马上就好</span>
              </p>
              <div style={{ 
                width: '200px', 
                height: '4px', 
                backgroundColor: '#f0f0f0',
                margin: '20px auto',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#1890ff',
                  animation: 'loading 1.5s infinite ease-in-out',
                  transformOrigin: 'left'
                }} />
              </div>
              <style>{`
                @keyframes loading {
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
                  <p style={{ fontWeight: 'bold', marginBottom: '12px' }}>
                    {index + 1}. {question.question_text}
                  </p>
                  <div style={{ paddingLeft: '20px' }}>
                    {['A', 'B', 'C', 'D'].map((option) => (
                      <label 
                        key={option}
                        style={{ 
                          display: 'block', 
                          marginBottom: '8px',
                          cursor: 'pointer',
                          padding: '8px',
                          borderRadius: '4px',
                          backgroundColor: answers[question.id] === option ? '#e6f7ff' : 'transparent'
                        }}
                      >
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          value={option}
                          checked={answers[question.id] === option}
                          onChange={() => handleAnswerChange(question.id, option)}
                          style={{ marginRight: '8px' }}
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
