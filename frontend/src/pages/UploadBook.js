import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { booksAPI } from '../services/api';

const UploadBook = () => {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [coverPreview, setCoverPreview] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState('');
  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);
  
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const allowedExtensions = ['.txt', '.docx', '.epub', '.mobi', '.pdf'];
      const fileExt = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
      if (!allowedExtensions.includes(fileExt)) {
        setError(`仅支持 ${allowedExtensions.join(', ')} 格式的文件`);
        setFile(null);
        return;
      }
      
      setFile(selectedFile);
      setError('');
      setUploadProgress(0);
      
      if (!title) {
        const fileName = selectedFile.name.replace(/\.[^/.]+$/, '');
        setTitle(fileName);
      }
    }
  };

  const handleCoverChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(selectedFile.type)) {
        setError('封面仅支持 JPG、PNG、GIF、WebP 格式');
        return;
      }
      
      setCoverFile(selectedFile);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverPreview(reader.result);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleRemoveCover = () => {
    setCoverFile(null);
    setCoverPreview(null);
    if (coverInputRef.current) {
      coverInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      setError('请选择要上传的文件');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setUploadProgress(0);
    setProcessingStep('正在上传文件...');

    try {
      const response = await booksAPI.uploadBookWithCover(
        file, 
        title, 
        author,
        coverFile,
        (progress) => {
          setUploadProgress(progress);
          if (progress < 100) {
            setProcessingStep(`正在上传文件... ${progress}%`);
          } else {
            setProcessingStep('文件上传完成，正在处理内容...');
          }
        }
      );
      
      setSuccess(`书籍《${response.data.title}》上传成功！共处理 ${response.data.total_paragraphs} 个段落`);
      
      setTimeout(() => {
        navigate('/books');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || '上传失败，请重试');
      setProcessingStep('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: '600px', margin: '40px auto' }}>
        <h2 style={{ 
          marginBottom: '24px',
          color: 'var(--text-heading)',
          fontSize: '22px'
        }}>
          上传书籍
        </h2>
        
        {error && <div className="error-message" style={{ marginBottom: '16px' }}>{error}</div>}
        {success && <div className="success-message" style={{ marginBottom: '16px' }}>{success}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">选择文件（支持 .txt, .docx, .epub, .mobi, .pdf）</label>
            <input
              type="file"
              accept=".txt,.docx,.epub,.mobi,.pdf"
              onChange={handleFileChange}
              className="form-input"
              style={{ padding: '10px' }}
              disabled={loading}
              ref={fileInputRef}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">书名</label>
            <input
              type="text"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="请输入书名"
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">作者（选填）</label>
            <input
              type="text"
              className="form-input"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="请输入作者"
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">封面图片（选填，不上传则自动从文件中提取）</label>
            <div style={{ 
              display: 'flex', 
              alignItems: 'flex-start', 
              gap: '16px',
              flexWrap: 'wrap'
            }}>
              <div style={{ flex: '0 0 120px' }}>
                <div 
                  style={{
                    width: '120px',
                    height: '160px',
                    backgroundColor: 'var(--paper-bg)',
                    border: '2px dashed var(--paper-dark)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    overflow: 'hidden'
                  }}
                  onClick={() => coverInputRef.current?.click()}
                >
                  {coverPreview ? (
                    <img 
                      src={coverPreview} 
                      alt="封面预览" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ fontSize: '32px', color: 'var(--text-muted)' }}>📖</span>
                  )}
                </div>
                
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleCoverChange}
                  style={{ display: 'none' }}
                  ref={coverInputRef}
                />
                
                {coverPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveCover}
                    style={{
                      marginTop: '8px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--error)',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    移除封面
                  </button>
                )}
              </div>
              
              <div style={{ flex: 1, minWidth: '200px' }}>
                <p style={{ 
                  color: 'var(--text-secondary)', 
                  fontSize: '14px',
                  lineHeight: '1.6',
                  margin: 0
                }}>
                  支持 JPG、PNG、GIF、WebP 格式<br/>
                  建议尺寸：200×300 像素左右<br/>
                  如不上传，系统将从 EPUB/Mobi 文件中自动提取封面
                </p>
              </div>
            </div>
          </div>
          
          {loading && (
            <div style={{ marginBottom: '24px' }}>
              <div className="progress-bar" style={{ height: '8px' }}>
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <div style={{ 
                textAlign: 'center', 
                marginTop: '12px',
                color: 'var(--text-secondary)',
                fontSize: '14px'
              }}>
                {processingStep}
              </div>
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/books')}
              disabled={loading}
              style={{ flex: 1 }}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ flex: 1 }}
            >
              {loading ? '上传中...' : '上传'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadBook;
