import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { readingAPI } from '../services/api';
import '../styles/reading-test.css';

const SETTINGS_STORAGE_KEY = 'reading-settings-v1';
const DEFAULT_READING_SETTINGS = {
  readingSpeedWpm: 0,
};

// 将输入值规范为可用的阅读速度（>= 0 的整数）
const normalizeReadingSpeed = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
};

// 判断字符是否为可阅读字符（空白字符不计入阅读进度）
const isReadableCharacter = (char) => /\S/.test(char);

// 将段落文本节点拆分为可逐字高亮的 span
const prepareReadingProgressChars = (containerElement) => {
  if (!containerElement) {
    return [];
  }

  const textNodes = [];
  const walker = document.createTreeWalker(
    containerElement,
    window.NodeFilter.SHOW_TEXT,
    {
      acceptNode: (textNode) => {
        if (!textNode.nodeValue) {
          return window.NodeFilter.FILTER_REJECT;
        }

        const parentTagName = textNode.parentElement?.tagName;
        if (parentTagName === 'SCRIPT' || parentTagName === 'STYLE') {
          return window.NodeFilter.FILTER_REJECT;
        }

        return window.NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  const charElements = [];

  textNodes.forEach((textNode) => {
    const parentNode = textNode.parentNode;
    if (!parentNode) {
      return;
    }

    const fragment = document.createDocumentFragment();
    const textValue = textNode.nodeValue || '';

    Array.from(textValue).forEach((char) => {
      if (!isReadableCharacter(char)) {
        fragment.appendChild(document.createTextNode(char));
        return;
      }

      const charSpan = document.createElement('span');
      charSpan.className = 'reading-progress-char';
      charSpan.textContent = char;
      charSpan.dataset.readingCharIndex = String(charElements.length);
      fragment.appendChild(charSpan);
      charElements.push(charSpan);
    });

    parentNode.replaceChild(fragment, textNode);
  });

  return charElements;
};

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
  const [readingSettings, setReadingSettings] = useState(DEFAULT_READING_SETTINGS);
  const [hasHydratedSettings, setHasHydratedSettings] = useState(false);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  const [totalReadableChars, setTotalReadableChars] = useState(0);
  const [highlightedCharCount, setHighlightedCharCount] = useState(0);
  
  const pollIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const highlightAnimationFrameRef = useRef(null);
  const readingCharElementsRef = useRef([]);
  const appliedHighlightCountRef = useRef(0);
  const partialHighlightIndexRef = useRef(-1);
  const richTextContentRef = useRef(null);

  useEffect(() => {
    // 初始化阅读设置（持久化）
    try {
      const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!storedSettings) {
        return;
      }

      const parsedSettings = JSON.parse(storedSettings);
      setReadingSettings({
        ...DEFAULT_READING_SETTINGS,
        readingSpeedWpm: normalizeReadingSpeed(parsedSettings.readingSpeedWpm),
      });
    } catch (readError) {
      setReadingSettings(DEFAULT_READING_SETTINGS);
    } finally {
      setHasHydratedSettings(true);
    }
  }, []);

  useEffect(() => {
    // 持久化阅读设置
    if (!hasHydratedSettings) {
      return;
    }
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(readingSettings));
  }, [readingSettings, hasHydratedSettings]);

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
      if (highlightAnimationFrameRef.current) {
        window.cancelAnimationFrame(highlightAnimationFrameRef.current);
        highlightAnimationFrameRef.current = null;
      }
    };
  }, [bookId, isGuestMode]);

  useEffect(() => {
    // 每次切换段落后，默认收起设置栏
    setIsSettingsExpanded(false);
  }, [paragraph?.id]);

  useEffect(() => {
    // 在进入阅读时初始化逐字高亮节点
    if (!isReading || !paragraph?.content || !richTextContentRef.current) {
      readingCharElementsRef.current = [];
      appliedHighlightCountRef.current = 0;
      partialHighlightIndexRef.current = -1;
      setTotalReadableChars(0);
      setHighlightedCharCount(0);
      return;
    }

    richTextContentRef.current.innerHTML = paragraph.content;
    const charElements = prepareReadingProgressChars(richTextContentRef.current);
    readingCharElementsRef.current = charElements;
    appliedHighlightCountRef.current = 0;
    partialHighlightIndexRef.current = -1;
    setTotalReadableChars(charElements.length);
    setHighlightedCharCount(0);
  }, [isReading, paragraph?.id, paragraph?.content]);

  const applyReadingCharHighlight = useCallback((nextHighlightCount) => {
    const charElements = readingCharElementsRef.current;
    if (!charElements.length) {
      appliedHighlightCountRef.current = 0;
      partialHighlightIndexRef.current = -1;
      setHighlightedCharCount(0);
      return;
    }

    const safeHighlightCount = Math.max(0, Math.min(nextHighlightCount, charElements.length));
    const fullHighlightedCount = Math.floor(safeHighlightCount);
    const partialFillRate = safeHighlightCount - fullHighlightedCount;
    const previousHighlightCount = appliedHighlightCountRef.current;

    if (fullHighlightedCount > previousHighlightCount) {
      for (let index = previousHighlightCount; index < fullHighlightedCount; index += 1) {
        charElements[index]?.classList.add('active');
      }
    } else if (fullHighlightedCount < previousHighlightCount) {
      for (let index = fullHighlightedCount; index < previousHighlightCount; index += 1) {
        charElements[index]?.classList.remove('active');
      }
    }

    const previousPartialIndex = partialHighlightIndexRef.current;
    if (previousPartialIndex !== -1 && previousPartialIndex !== fullHighlightedCount) {
      const previousPartialChar = charElements[previousPartialIndex];
      if (previousPartialChar) {
        previousPartialChar.classList.remove('partial-active');
        previousPartialChar.style.removeProperty('--reading-char-fill');
      }
      partialHighlightIndexRef.current = -1;
    }

    if (partialFillRate > 0 && fullHighlightedCount < charElements.length) {
      const partialChar = charElements[fullHighlightedCount];
      if (partialChar) {
        partialChar.classList.add('partial-active');
        partialChar.style.setProperty('--reading-char-fill', `${(partialFillRate * 100).toFixed(2)}%`);
        partialHighlightIndexRef.current = fullHighlightedCount;
      }
    } else if (previousPartialIndex !== -1) {
      const previousPartialChar = charElements[previousPartialIndex];
      if (previousPartialChar) {
        previousPartialChar.classList.remove('partial-active');
        previousPartialChar.style.removeProperty('--reading-char-fill');
      }
      partialHighlightIndexRef.current = -1;
    }

    appliedHighlightCountRef.current = fullHighlightedCount;
    setHighlightedCharCount(safeHighlightCount);
  }, []);

  useEffect(() => {
    // 根据阅读速度驱动逐字高亮进度
    if (highlightAnimationFrameRef.current) {
      window.cancelAnimationFrame(highlightAnimationFrameRef.current);
      highlightAnimationFrameRef.current = null;
    }

    if (!isReading || !startTime) {
      applyReadingCharHighlight(0);
      return;
    }

    const speed = readingSettings.readingSpeedWpm;
    if (speed <= 0 || totalReadableChars <= 0) {
      applyReadingCharHighlight(0);
      return;
    }

    const millisecondsPerCharacter = 60000 / speed;

    const updateHighlightProgress = () => {
      const elapsedMs = Date.now() - startTime;
      const nextHighlightCount = Math.min(totalReadableChars, elapsedMs / millisecondsPerCharacter);
      applyReadingCharHighlight(nextHighlightCount);

      if (nextHighlightCount < totalReadableChars) {
        highlightAnimationFrameRef.current = window.requestAnimationFrame(updateHighlightProgress);
      }
    };

    updateHighlightProgress();

    return () => {
      if (highlightAnimationFrameRef.current) {
        window.cancelAnimationFrame(highlightAnimationFrameRef.current);
        highlightAnimationFrameRef.current = null;
      }
    };
  }, [isReading, startTime, totalReadableChars, readingSettings.readingSpeedWpm, applyReadingCharHighlight]);

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
    setIsSettingsExpanded(false);
    appliedHighlightCountRef.current = 0;
    partialHighlightIndexRef.current = -1;
    setHighlightedCharCount(0);
    
    // 启动计时器
    timerIntervalRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
  };

  const finishReading = () => {
    setIsReading(false);
    setShowQuestions(true);
    setIsSettingsExpanded(false);
    // 停止计时器
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (highlightAnimationFrameRef.current) {
      window.cancelAnimationFrame(highlightAnimationFrameRef.current);
      highlightAnimationFrameRef.current = null;
    }
    // 开始获取问题
    if (paragraph) {
      fetchQuestions(paragraph.id);
    }
  };

  // 更新单个阅读设置项
  const handleSettingChange = (settingKey, settingValue) => {
    setReadingSettings((prevSettings) => ({
      ...prevSettings,
      [settingKey]: settingKey === 'readingSpeedWpm'
        ? normalizeReadingSpeed(settingValue)
        : settingValue,
    }));
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
        <div className="card reading-status-card">
          <h2 className="reading-status-title">恭喜！</h2>
          <p className="reading-status-desc">
            {isGuestMode ? '暂时没有可用段落，请稍后再试' : '你已经完成了这本书的所有段落'}
          </p>
          {!isGuestMode && progress && (
            <p className="reading-status-progress">
              完成进度：{progress.completed} / {progress.total}
            </p>
          )}
          <button
            className="btn btn-primary reading-status-action"
            onClick={() => navigate(isGuestMode ? '/' : '/books')}
          >
            {isGuestMode ? '返回首页' : '返回书籍列表'}
          </button>
        </div>
      </div>
    );
  }

  const readingSettingsItems = [
    {
      key: 'readingSpeedWpm',
      label: '阅读速度（字/分钟）',
      type: 'number',
      min: 0,
      step: 10,
      placeholder: '0',
      hint: '设为 0 关闭辅助高亮动画',
      value: readingSettings.readingSpeedWpm,
      presets: [0, 300, 600, 900],
    },
  ];

  const isHighlightEnabled = isReading && readingSettings.readingSpeedWpm > 0 && totalReadableChars > 0;
  const highlightProgressPercent = totalReadableChars > 0
    ? (highlightedCharCount / totalReadableChars) * 100
    : 0;
  const compactSpeedText = readingSettings.readingSpeedWpm > 0
    ? `${readingSettings.readingSpeedWpm} 字/分钟`
    : '辅助高亮已关闭';

  // 渲染阅读设置栏（预留多设置项扩展能力）
  const renderReadingSettingsBar = (idPrefix, className = '') => (
    <div className={`reading-settings-shell ${className}`.trim()}>
      <button
        type="button"
        className={`reading-settings-toggle ${isSettingsExpanded ? 'expanded' : ''}`}
        onClick={() => setIsSettingsExpanded((prevExpanded) => !prevExpanded)}
        aria-expanded={isSettingsExpanded}
        aria-controls={`${idPrefix}-settings-panel`}
      >
        <div className="reading-settings-toggle-main">
          <span className="reading-settings-badge">Lab</span>
          <span className="reading-settings-title">阅读辅助</span>
        </div>
        <div className="reading-settings-compact">
          <span className="reading-settings-speed">{compactSpeedText}</span>
          {isReading && isHighlightEnabled && (
            <span className="reading-settings-progress-text">{`${Math.round(highlightProgressPercent)}%`}</span>
          )}
        </div>
        <span className={`reading-settings-caret ${isSettingsExpanded ? 'expanded' : ''}`}>▾</span>
      </button>

      {isReading && isHighlightEnabled && (
        <div className="reading-settings-mini-progress" aria-hidden="true">
          <span style={{ width: `${highlightProgressPercent}%` }} />
        </div>
      )}

      {isSettingsExpanded && (
        <div id={`${idPrefix}-settings-panel`} className="reading-settings-panel">
          <div className="reading-settings-list">
            {readingSettingsItems.map((settingItem) => (
              <div key={settingItem.key} className="reading-setting-item">
                <label htmlFor={`${idPrefix}-${settingItem.key}`} className="reading-setting-label">
                  {settingItem.label}
                </label>
                <input
                  id={`${idPrefix}-${settingItem.key}`}
                  className="form-input reading-setting-input"
                  type={settingItem.type}
                  min={settingItem.min}
                  step={settingItem.step}
                  placeholder={settingItem.placeholder}
                  value={settingItem.value}
                  onChange={(event) => handleSettingChange(settingItem.key, event.target.value)}
                />
                {Array.isArray(settingItem.presets) && settingItem.presets.length > 0 && (
                  <div className="reading-setting-presets">
                    {settingItem.presets.map((presetValue) => (
                      <button
                        key={presetValue}
                        type="button"
                        className={`reading-setting-chip ${settingItem.value === presetValue ? 'active' : ''}`}
                        onClick={() => handleSettingChange(settingItem.key, presetValue)}
                      >
                        {presetValue === 0 ? '关闭' : presetValue}
                      </button>
                    ))}
                  </div>
                )}
                <p className="reading-setting-hint">{settingItem.hint}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="container">
      {!isGuestMode && progress && (
        <div className="reading-progress-text">
          进度：{progress.completed} / {progress.total} 段落
        </div>
      )}

      {!isReading && !showQuestions && (
        <div className="card reading-start-card">
          <h3 className="reading-start-title">准备开始阅读</h3>
          {renderReadingSettingsBar('setting', 'reading-settings-prestart')}
          <p className="reading-start-desc">
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
          {renderReadingSettingsBar('reading', 'reading-settings-reading')}
          <div
            className={`reading-content-shell reading-content-shell-main ${
              isHighlightEnabled ? 'reading-highlight-enabled' : ''
            }`}
          >
            <div
              ref={richTextContentRef}
              className="rich-text-content reading-progress-content"
              dangerouslySetInnerHTML={{ __html: paragraph.content }}
            />
          </div>
          <button
            className="btn btn-success reading-finish-btn"
            onClick={finishReading}
          >
            我已完成阅读
          </button>
        </div>
      )}

      {showQuestions && (
        <div className="card">
          {/* 跳过答题按钮 - 放置在答题界面顶部 */}
          <div className="reading-question-header">
            <h3 className="reading-question-title">阅读理解测试</h3>
            <button
              className="btn btn-danger reading-skip-btn"
              onClick={skipTest}
            >
              跳过答题
            </button>
          </div>

          {questionsLoading && questionsStatus === 'generating' && (
            <div className="reading-questions-loading">
              <div className="reading-questions-loading-icon">🤔</div>
              <p className="reading-questions-loading-text">
                正在准备题...
                <br />
                <span className="reading-questions-loading-subtext">请稍候，马上就好</span>
              </p>
              <div className="reading-questions-loading-bar">
                <div className="reading-questions-loading-bar-fill" />
              </div>
            </div>
          )}

          {!questionsLoading && questionsStatus === 'ready' && questions.length > 0 && (
            <>
              {questions.map((question, index) => (
                <div key={question.id} className="reading-question-item">
                  <p className="reading-question-text">
                    {index + 1}. {question.question_text}
                  </p>
                  <div className="reading-question-options">
                    {['A', 'B', 'C', 'D'].map((option) => (
                      <label
                        key={option}
                        className={`question-option ${
                          answers[question.id] === option ? 'selected' : ''
                        }`}
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
                className="btn btn-primary reading-submit-btn"
                onClick={submitTest}
                disabled={submitting}
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
