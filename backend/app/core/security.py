import hashlib
import secrets
from jose import JWTError, jwt
from datetime import datetime, timedelta
from app.core.config import settings


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    return hash_password(plain_password) == hashed_password


def hash_password(password: str) -> str:
    """使用SHA256哈希密码（用于开发环境）"""
    # 添加随机盐值使哈希更安全
    salt = "speed_reading_salt_2024"
    salted_password = password + salt
    return hashlib.sha256(salted_password.encode()).hexdigest()


def create_access_token(data: dict, expires_delta: timedelta = None):
    """创建访问令牌，支持配置为不过期"""
    to_encode = data.copy()
    expire = None
    if expires_delta is not None:
        expire = datetime.utcnow() + expires_delta
    elif settings.ACCESS_TOKEN_EXPIRE_MINUTES > 0:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    if expire is not None:
        to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        return payload
    except JWTError:
        return None
