import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { booksAPI } from '../services/api';

const UploadBook = () => {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState('');
  
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // 检查文件类型
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
      
      // 自动填充标题（从文件名提取）
      if (!title) {
        const fileName = selectedFile.name.replace(/\.[^/.]+$/, '');
        setTitle(fileName);
      }
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
      // 上传文件并显示进度
      const response = await booksAPI.uploadBook(
        file, 
        title, 
        author,
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
        <h2 style={{ marginBottom: '24px' }}>上传书籍</h2>
        
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
              style={{ padding: '8px' }}
              disabled={loading}
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
          
          {/* 进度条 */}
          {loading && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ 
                width: '100%', 
                height: '20px', 
                backgroundColor: '#f0f0f0', 
                borderRadius: '10px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${uploadProgress}%`,
                  height: '100%',
                  backgroundColor: '#1890ff',
                  transition: 'width 0.3s ease',
                  borderRadius: '10px'
                }} />
              </div>
              <div style={{ 
                textAlign: 'center', 
                marginTop: '8px',
                color: '#666',
                fontSize: '14px'
              }}>
                {processingStep}
              </div>
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/books')}
              disabled={loading}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
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
