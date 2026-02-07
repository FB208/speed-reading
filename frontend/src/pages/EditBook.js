import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { booksAPI } from '../services/api';

const EditBook = () => {
  const { bookId } = useParams();
  const navigate = useNavigate();
  
  const [book, setBook] = useState(null);
  const [paragraphs, setParagraphs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    fetchBookData();
  }, [bookId]);

  const fetchBookData = async () => {
    try {
      setLoading(true);
      const [bookRes, paragraphsRes] = await Promise.all([
        booksAPI.getBook(bookId),
        booksAPI.getParagraphs(bookId)
      ]);
      setBook(bookRes.data);
      setParagraphs(paragraphsRes.data);
    } catch (err) {
      setError('获取书籍数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (paragraph) => {
    setEditingId(paragraph.id);
    setEditingContent(paragraph.content);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingContent('');
  };

  const handleSave = async (paragraphId) => {
    setSaving(true);
    try {
      await booksAPI.updateParagraph(bookId, paragraphId, editingContent);
      setParagraphs(paragraphs.map(p => 
        p.id === paragraphId ? { ...p, content: editingContent, word_count: editingContent.length } : p
      ));
      setEditingId(null);
      setEditingContent('');
    } catch (err) {
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (paragraphId) => {
    if (!window.confirm('确定要删除这个段落吗？相关的阅读进度和测试结果也会被删除。')) {
      return;
    }
    
    setDeleting(paragraphId);
    try {
      await booksAPI.deleteParagraph(bookId, paragraphId);
      setParagraphs(paragraphs.filter(p => p.id !== paragraphId));
    } catch (err) {
      alert('删除失败');
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteBook = async () => {
    if (!window.confirm(`确定要删除整本书《${book?.title}》吗？这将删除所有段落、问题和阅读记录。此操作不可恢复！`)) {
      return;
    }
    
    try {
      await booksAPI.deleteBook(bookId);
      navigate('/books');
    } catch (err) {
      alert('删除书籍失败');
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

  return (
    <div className="container">
      <div className="page-header" style={{ alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ 
            color: 'var(--text-heading)',
            fontSize: '24px',
            marginBottom: '8px'
          }}>
            编辑书籍
          </h1>
          <h2 style={{ 
            color: 'var(--text-secondary)', 
            fontSize: '17px',
            fontWeight: 'normal',
            wordBreak: 'break-word'
          }}>
            {book?.title}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', flexShrink: 0 }}>
          <Link to="/books" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
            返回列表
          </Link>
          <button 
            className="btn btn-primary"
            onClick={() => navigate(`/read/${bookId}`)}
          >
            开始阅读
          </button>
          <button 
            className="btn btn-danger"
            onClick={handleDeleteBook}
          >
            删除书籍
          </button>
        </div>
      </div>

      <div style={{ 
        marginBottom: '24px', 
        color: 'var(--text-secondary)',
        fontSize: '14px'
      }}>
        共 {paragraphs.length} 个段落
      </div>

      {paragraphs.map((paragraph, index) => (
        <div key={paragraph.id} className="card" style={{ marginBottom: '20px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'flex-start', 
            marginBottom: '16px'
          }}>
            <span style={{ 
              fontWeight: 600, 
              color: 'var(--accent-primary)',
              fontSize: '15px'
            }}>
              段落 #{index + 1}
            </span>
            <span style={{ 
              color: 'var(--text-muted)', 
              fontSize: '14px'
            }}>
              {paragraph.word_count} 字
            </span>
          </div>

          {editingId === paragraph.id ? (
            <div>
              <textarea
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                className="form-input"
                style={{
                  minHeight: '180px',
                  lineHeight: '1.8',
                  resize: 'vertical',
                  marginBottom: '16px',
                  fontFamily: 'inherit'
                }}
              />
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => handleSave(paragraph.id)}
                  disabled={saving}
                >
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleCancelEdit}
                  disabled={saving}
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div 
                className="rich-text-preview"
                style={{ 
                  lineHeight: '1.8', 
                  marginBottom: '16px',
                  maxHeight: '300px',
                  overflow: 'auto',
                  padding: '16px',
                  backgroundColor: 'var(--paper-bg)',
                  borderRadius: '8px',
                  border: '1px solid var(--paper-dark)'
                }}
                dangerouslySetInnerHTML={{ __html: paragraph.content }}
              />
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => handleEdit(paragraph)}
                >
                  编辑
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleDelete(paragraph.id)}
                  disabled={deleting === paragraph.id}
                  style={{ color: 'var(--error)', borderColor: 'var(--error)' }}
                >
                  {deleting === paragraph.id ? '删除中...' : '删除'}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {paragraphs.length === 0 && (
        <div className="card empty-state">
          <p style={{ color: 'var(--text-secondary)' }}>暂无段落</p>
        </div>
      )}
    </div>
  );
};

export default EditBook;
