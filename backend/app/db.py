from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://doujin:doujin@localhost:5432/doujinshelf")

if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(DATABASE_URL, future=True, echo=False)
SessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)
