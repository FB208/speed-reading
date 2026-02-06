# Agent Guidelines for Speed Reading App

This is a full-stack speed reading application with a FastAPI backend and React frontend.

## Project Structure

```
backend/          # FastAPI Python backend
├── app/
│   ├── api/      # API routes (auth, books, reading)
│   ├── core/     # Config, security settings
│   ├── db/       # Database connection
│   ├── models/   # SQLAlchemy models & Pydantic schemas
│   ├── services/ # Business logic
│   └── utils/    # Utility functions
└── requirements.txt

frontend/         # React frontend (Create React App)
├── src/
│   ├── components/  # Reusable components (Navbar, etc.)
│   ├── context/     # React context (AuthContext)
│   ├── pages/       # Page components
│   ├── services/    # API client (api.js)
│   └── styles/      # CSS files
└── package.json
```

## Build & Development Commands

### Backend (Python)
```bash
cd backend
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Start development server
uvicorn app.main:app --reload

# Run all tests (if pytest configured)
pytest

# Run single test file
pytest path/to/test_file.py

# Run single test function
pytest path/to/test_file.py::test_function_name
```

### Frontend (React)
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build

# Run all tests
npm test

# Run single test file
npm test -- path/to/test.test.js

# Run single test by name
npm test -- --testNamePattern="test name"
```

## Code Style Guidelines

### Python (Backend)

**Imports:**
- Standard library first
- Third-party packages next
- Local modules last (from app.*)
- Group imports with blank lines between groups

```python
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models import models
```

**Naming:**
- `snake_case` for variables, functions, file names
- `PascalCase` for class names
- `UPPER_CASE` for constants

**Functions:**
- Use type hints for parameters and return types
- Add docstrings for route handlers (in Chinese)
- Use FastAPI dependency injection with `Depends`

```python
@router.post("/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """用户注册"""
    # implementation
```

**Error Handling:**
- Use `HTTPException` with appropriate status codes
- Provide meaningful error messages in Chinese

```python
raise HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST,
    detail="用户名已存在"
)
```

**SQLAlchemy Models:**
- Use declarative base style
- Define relationships with `back_populates`
- Include type hints in Column definitions

### JavaScript/React (Frontend)

**Imports:**
- React imports first
- Third-party libraries next
- Local components/modules last
- Use relative paths with `../` for parent directories

```javascript
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
```

**Naming:**
- `PascalCase` for components and component files
- `camelCase` for variables, functions, hooks
- `UPPER_CASE` for constants

**Components:**
- Use functional components with hooks
- Destructure props when possible
- Use inline styles with style objects

```javascript
const Navbar = () => {
  const { isAuthenticated, logout, user } = useAuth();
  
  return (
    <nav style={{ backgroundColor: '#1890ff' }}>
      {/* JSX */}
    </nav>
  );
};

export default Navbar;
```

**Comments:**
- Use Chinese for user-facing text and comments
- Keep comments concise and meaningful

**State Management:**
- Use React Context for global state (AuthContext)
- Use `useState` and `useEffect` for local state
- Custom hooks extracted to context files

## Database & External Services

- **Database:** MySQL with SQLAlchemy ORM
- **Cache/Task Queue:** Redis + Celery
- **AI Integration:** OpenAI API for generating questions
- **Authentication:** JWT tokens stored in localStorage

## Important Notes

- Backend runs on port 8000, frontend on port 3000
- Frontend proxy configured to forward API calls to backend
- CORS configured for localhost development
- File uploads stored in `backend/uploads/`
- Always activate virtual environment before running backend
- Use Chinese for all user-facing strings and comments
