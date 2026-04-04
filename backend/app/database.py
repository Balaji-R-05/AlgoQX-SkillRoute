import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base

load_dotenv()

# Make sure we use the asyncpg driver
DATABASE_URL = os.getenv("DATABASE_URL", "")

# Support replacing standard postgres URLs with the asyncpg driver
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://") and "asyncpg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# asyncpg doesn't support 'sslmode' as a query parameter.
# We strip it and pass ssl=True in connect_args if needed.
connect_args = {}
if "sslmode=require" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("sslmode=require", "")
    connect_args["ssl"] = "require"
if "channel_binding=require" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("channel_binding=require", "")

# Clean up any trailing ? or &
DATABASE_URL = DATABASE_URL.rstrip("?&").replace("?&", "?").replace("&&", "&")

if not DATABASE_URL:
    # Use a dummy for initial load if missing, but it will fail on connections
    DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres"

engine = create_async_engine(DATABASE_URL, echo=False, connect_args=connect_args)
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    """Dependency for providing database sessions."""
    async with AsyncSessionLocal() as session:
        yield session
