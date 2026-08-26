from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from apps.api.config import settings

engine = create_async_engine(settings.DATABASE_URL, future=True, echo=False)
SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

async def get_db():
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

