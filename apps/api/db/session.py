from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from apps.api.config import settings

# pool_pre_ping: Neon closes idle connections when the database sleeps, so check
# a pooled connection before using it instead of failing the first request.
engine = create_async_engine(settings.async_database_url, future=True, echo=False, pool_pre_ping=True)
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

