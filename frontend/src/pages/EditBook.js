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
      // 更新本地数据
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
      // 从列表中移除
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1>编辑书籍</h1>
          <h2 style={{ color: '#666', fontSize: '18px', marginTop: '8px' }}>{book?.title}</h2>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
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
            className="btn" 
            style={{ backgroundColor: '#ff4d4f', color: 'white' }}
            onClick={handleDeleteBook}
          >
            删除书籍
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '20px', color: '#666' }}>
        共 {paragraphs.length} 个段落
      </div>

      {paragraphs.map((paragraph, index) => (
        <div key={paragraph.id} className="card" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
              段落 #{index + 1}
            </span>
            <span style={{ color: '#999', fontSize: '14px' }}>
              {paragraph.word_count} 字
            </span>
          </div>

          {editingId === paragraph.id ? (
            <div>
              <textarea
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '200px',
                  padding: '12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  fontSize: '16px',
                  lineHeight: '1.6',
                  resize: 'vertical',
                  marginBottom: '12px'
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
                  lineHeight: '1.6', 
                  marginBottom: '12px',
                  maxHeight: '300px',
                  overflow: 'auto',
                  padding: '12px',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '4px'
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
                  style={{ color: '#ff4d4f', borderColor: '#ff4d4f' }}
                >
                  {deleting === paragraph.id ? '删除中...' : '删除'}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {paragraphs.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <p>暂无段落</p>
        </div>
      )}
    </div>
  );
};

export default EditBook;
