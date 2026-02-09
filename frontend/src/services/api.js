import axios from 'axios';

// 解析 API 基础地址
// 1) 显式配置 REACT_APP_API_BASE_URL 时优先使用
// 2) 生产环境默认走同源 /api（避免与前端路由冲突）
// 3) 本地开发默认直连后端 http://localhost:8000
const resolveApiBaseUrl = () => {
  const configuredBaseUrl = process.env.REACT_APP_API_BASE_URL;
  if (configuredBaseUrl && configuredBaseUrl.trim() !== '') {
    return configuredBaseUrl.trim().replace(/\/+$/, '');
  }

  if (process.env.NODE_ENV === 'production') {
    return '/api';
  }

  return 'http://localhost:8000';
};

export const API_BASE_URL = resolveApiBaseUrl();

// 创建axios实例
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加token
api.interceptors.request.use(
  (config) => {
    const url = config.url || '';
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register');
    if (isAuthEndpoint) {
      return config;
    }

    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register');
    if (error.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 认证相关API
export const authAPI = {
  login: (username, password) => 
    api.post('/auth/login', { username, password }),
  
  register: (username, email, password) => 
    api.post('/auth/register', { username, email, password }),
};

// 书籍相关API
export const booksAPI = {
  getBooks: (skip = 0, limit = 100) => 
    api.get(`/books/?skip=${skip}&limit=${limit}`),
  
  getBook: (bookId) => 
    api.get(`/books/${bookId}`),
  
  uploadBook: (file, title, author, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);
    if (author) formData.append('author', author);
    
    return api.post('/books/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    });
  },
  
  uploadBookWithCover: (file, title, author, cover, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);
    if (author) formData.append('author', author);
    if (cover) formData.append('cover', cover);
    
    return api.post('/books/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    });
  },
  
  getParagraphs: (bookId, skip = 0, limit = 1000) => 
    api.get(`/books/${bookId}/paragraphs?skip=${skip}&limit=${limit}`),
  
  updateParagraph: (bookId, paragraphId, content) => 
    api.put(`/books/${bookId}/paragraphs/${paragraphId}`, { content }),
  
  deleteParagraph: (bookId, paragraphId) => 
    api.delete(`/books/${bookId}/paragraphs/${paragraphId}`),
  
  deleteBook: (bookId) => 
    api.delete(`/books/${bookId}`),
};

export const bookshelfAPI = {
  getMyBookshelf: (skip = 0, limit = 100) =>
    api.get(`/bookshelf/?skip=${skip}&limit=${limit}`),

  removeFromBookshelf: (bookId) =>
    api.delete(`/bookshelf/${bookId}`),
};

// 阅读测试相关API
export const readingAPI = {
  getNextParagraph: (bookId) => 
    api.get(`/reading/next-paragraph/${bookId}`),

  getGuestRandomParagraph: () =>
    api.get('/reading/guest/random-paragraph'),
  
  getQuestions: (paragraphId) => 
    api.get(`/reading/questions/${paragraphId}`),

  getGuestQuestions: (paragraphId) =>
    api.get(`/reading/guest/questions/${paragraphId}`),
  
  submitTest: (paragraphId, readingTimeSeconds, answers) => 
    api.post('/reading/submit-test', {
      paragraph_id: paragraphId,
      reading_time_seconds: readingTimeSeconds,
      answers: answers,
    }),

  submitGuestTest: (paragraphId, readingTimeSeconds, answers) =>
    api.post('/reading/guest/submit-test', {
      paragraph_id: paragraphId,
      reading_time_seconds: readingTimeSeconds,
      answers: answers,
    }),
  
  getTestResults: (skip = 0, limit = 50) => 
    api.get(`/reading/results?skip=${skip}&limit=${limit}`),
  
  getTestResultDetail: (resultId) => 
    api.get(`/reading/results/${resultId}`),
  
  deleteTestResult: (resultId) => 
    api.delete(`/reading/results/${resultId}`),
  
  deleteBookResults: (bookId) => 
    api.delete(`/reading/clear-book/${bookId}`),
  
  getReadingProgress: (bookId) => 
    api.get(`/reading/progress/${bookId}`),
};

export default api;
