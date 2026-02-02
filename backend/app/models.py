from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Table, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

work_tags = Table(
    "work_tags",
    Base.metadata,
    Column("work_id", Integer, ForeignKey("works.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Work(Base):
    __tablename__ = "works"

    id = Column(Integer, primary_key=True)
    title = Column(String(200), nullable=False)
    author_id = Column(Integer, ForeignKey("authors.id"), nullable=True)
    circle_id = Column(Integer, ForeignKey("circles.id"), nullable=True)
    purchase_event_id = Column(Integer, ForeignKey("events.id"), nullable=True)
    is_r18 = Column(Boolean, nullable=False, default=False)
    summary = Column(Text, nullable=True)
    purchase_date = Column(Date, nullable=True)
    price = Column(Numeric(10, 2), nullable=True)
    extra = Column(JSONB, nullable=False, default=dict)
    cover_image_path = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    tags = relationship("Tag", secondary=work_tags, back_populates="works")
    author = relationship("Author", back_populates="works")
    circle = relationship("Circle", back_populates="works")
    purchase_event = relationship("Event", back_populates="works")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)

    works = relationship("Work", secondary=work_tags, back_populates="tags")


class Author(Base):
    __tablename__ = "authors"

    id = Column(Integer, primary_key=True)
    name = Column(String(200), unique=True, nullable=False)

    works = relationship("Work", back_populates="author")


class Circle(Base):
    __tablename__ = "circles"

    id = Column(Integer, primary_key=True)
    name = Column(String(200), unique=True, nullable=False)

    works = relationship("Work", back_populates="circle")


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True)
    name = Column(String(200), unique=True, nullable=False)

    works = relationship("Work", back_populates="purchase_event")
