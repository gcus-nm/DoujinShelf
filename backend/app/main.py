from __future__ import annotations

import json
import os
import uuid
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.db import SessionLocal, engine
from app.models import Author, Base, Circle, Event, Tag, Work, work_tags

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

app = FastAPI(title="DoujinShelf API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in CORS_ORIGINS if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


class WorkOut(BaseModel):
    id: int
    title: str
    author: dict | None
    circle: dict | None
    purchase_event: dict | None
    is_r18: bool
    summary: str | None
    purchase_date: date | None
    price: float | None
    extra: dict
    tags: list[str]
    cover_image_url: str | None

    class Config:
        from_attributes = True


async def get_session():
    async with SessionLocal() as session:
        yield session


@app.on_event("startup")
async def on_startup() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@app.get("/health")
async def health() -> dict:
    return {"ok": True}


def _work_to_out(work: Work) -> WorkOut:
    cover_url = f"/uploads/{Path(work.cover_image_path).name}" if work.cover_image_path else None
    return WorkOut(
        id=work.id,
        title=work.title,
        author={"id": work.author.id, "name": work.author.name} if work.author else None,
        circle={"id": work.circle.id, "name": work.circle.name} if work.circle else None,
        purchase_event={"id": work.purchase_event.id, "name": work.purchase_event.name}
        if work.purchase_event
        else None,
        is_r18=bool(work.is_r18),
        summary=work.summary,
        purchase_date=work.purchase_date,
        price=float(work.price) if work.price is not None else None,
        extra=work.extra or {},
        tags=[t.name for t in work.tags],
        cover_image_url=cover_url,
    )


async def _cleanup_empty_relations(
    session, author_id: int | None, circle_id: int | None, event_id: int | None
) -> None:
    if author_id:
        count = (await session.execute(select(func.count(Work.id)).where(Work.author_id == author_id))).scalar()
        if (count or 0) == 0:
            author = (await session.execute(select(Author).where(Author.id == author_id))).scalars().first()
            if author:
                await session.delete(author)
    if circle_id:
        count = (await session.execute(select(func.count(Work.id)).where(Work.circle_id == circle_id))).scalar()
        if (count or 0) == 0:
            circle = (await session.execute(select(Circle).where(Circle.id == circle_id))).scalars().first()
            if circle:
                await session.delete(circle)
    if event_id:
        count = (
            await session.execute(select(func.count(Work.id)).where(Work.purchase_event_id == event_id))
        ).scalar()
        if (count or 0) == 0:
            event = (await session.execute(select(Event).where(Event.id == event_id))).scalars().first()
            if event:
                await session.delete(event)


async def _cleanup_empty_tags(session, tag_ids: list[int]) -> None:
    for tag_id in tag_ids:
        count = (
            await session.execute(
                select(func.count(work_tags.c.work_id)).where(work_tags.c.tag_id == tag_id)
            )
        ).scalar()
        if (count or 0) == 0:
            tag = (await session.execute(select(Tag).where(Tag.id == tag_id))).scalars().first()
            if tag:
                await session.delete(tag)


async def _load_work(session, work_id: int) -> Work | None:
    result = await session.execute(
        select(Work)
        .where(Work.id == work_id)
        .options(
            selectinload(Work.tags),
            selectinload(Work.author),
            selectinload(Work.circle),
            selectinload(Work.purchase_event),
        )
    )
    return result.scalars().first()


async def _get_or_create_tags(session, tag_names: list[str]) -> list[Tag]:
    if not tag_names:
        return []

    existing = (await session.execute(select(Tag).where(Tag.name.in_(tag_names)))).scalars().all()
    existing_map = {t.name: t for t in existing}
    tags = []
    for name in tag_names:
        if name in existing_map:
            tags.append(existing_map[name])
        else:
            tag = Tag(name=name)
            session.add(tag)
            tags.append(tag)
    return tags


async def _get_or_create_author(session, name: str | None) -> Author | None:
    if not name or not name.strip():
        return None
    value = name.strip()
    existing = (await session.execute(select(Author).where(Author.name == value))).scalars().first()
    if existing:
        return existing
    author = Author(name=value)
    session.add(author)
    return author


async def _get_or_create_circle(session, name: str | None) -> Circle | None:
    if not name or not name.strip():
        return None
    value = name.strip()
    existing = (await session.execute(select(Circle).where(Circle.name == value))).scalars().first()
    if existing:
        return existing
    circle = Circle(name=value)
    session.add(circle)
    return circle


async def _get_or_create_event(session, name: str | None) -> Event | None:
    if not name or not name.strip():
        return None
    value = name.strip()
    existing = (await session.execute(select(Event).where(Event.name == value))).scalars().first()
    if existing:
        return existing
    event = Event(name=value)
    session.add(event)
    return event


def _parse_tags(tags: str | None) -> list[str]:
    if not tags:
        return []
    return [t.strip() for t in tags.split(",") if t.strip()]


def _parse_extra(extra: str | None) -> dict:
    if not extra:
        return {}
    try:
        return json.loads(extra)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"extra JSON is invalid: {exc.msg}")


def _parse_price(value: str | None) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        price = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise HTTPException(status_code=400, detail="price is invalid")
    if price.copy_abs() >= Decimal("100000000"):
        raise HTTPException(status_code=400, detail="price is too large")
    return price


async def _save_upload(file: UploadFile | None) -> str | None:
    if not file:
        return None
    ext = Path(file.filename or "").suffix or ".bin"
    name = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / name
    content = await file.read()
    dest.write_bytes(content)
    return str(dest)


@app.get("/works", response_model=list[WorkOut])
async def list_works(session=Depends(get_session)):
    result = await session.execute(
        select(Work)
        .options(
            selectinload(Work.tags),
            selectinload(Work.author),
            selectinload(Work.circle),
            selectinload(Work.purchase_event),
        )
        .order_by(Work.id.desc())
    )
    works = result.scalars().all()
    return [_work_to_out(w) for w in works]


@app.get("/works/{work_id}", response_model=WorkOut)
async def get_work(work_id: int, session=Depends(get_session)):
    work = await _load_work(session, work_id)
    if not work:
        raise HTTPException(status_code=404, detail="not found")
    return _work_to_out(work)


@app.post("/works", response_model=WorkOut)
async def create_work(
    title: str = Form(...),
    author_name: str | None = Form(None),
    circle_name: str | None = Form(None),
    is_r18: bool = Form(False),
    summary: str | None = Form(None),
    purchase_date: date | None = Form(None),
    purchase_event_name: str | None = Form(None),
    price: str | None = Form(None),
    tags: str | None = Form(None),
    extra: str | None = Form(None),
    cover: UploadFile | None = File(None),
    session=Depends(get_session),
):
    work = Work(
        title=title,
        author=await _get_or_create_author(session, author_name),
        circle=await _get_or_create_circle(session, circle_name),
        purchase_event=await _get_or_create_event(session, purchase_event_name),
        is_r18=is_r18,
        summary=summary,
        purchase_date=purchase_date,
        price=_parse_price(price),
        extra=_parse_extra(extra),
        cover_image_path=await _save_upload(cover),
    )
    work.tags = await _get_or_create_tags(session, _parse_tags(tags))
    session.add(work)
    await session.commit()
    await session.refresh(work)

    work = await _load_work(session, work.id)
    return _work_to_out(work)


@app.put("/works/{work_id}", response_model=WorkOut)
async def update_work(
    work_id: int,
    title: str = Form(...),
    author_name: str | None = Form(None),
    circle_name: str | None = Form(None),
    is_r18: bool = Form(False),
    summary: str | None = Form(None),
    purchase_date: date | None = Form(None),
    purchase_event_name: str | None = Form(None),
    price: str | None = Form(None),
    tags: str | None = Form(None),
    extra: str | None = Form(None),
    cover: UploadFile | None = File(None),
    session=Depends(get_session),
):
    work = await _load_work(session, work_id)
    if not work:
        raise HTTPException(status_code=404, detail="not found")

    old_author_id = work.author_id
    old_circle_id = work.circle_id
    old_event_id = work.purchase_event_id
    old_tag_ids = [t.id for t in work.tags]

    work.title = title
    work.author = await _get_or_create_author(session, author_name)
    work.circle = await _get_or_create_circle(session, circle_name)
    work.purchase_event = await _get_or_create_event(session, purchase_event_name)
    work.is_r18 = is_r18
    work.summary = summary
    work.purchase_date = purchase_date
    work.price = _parse_price(price)
    work.extra = _parse_extra(extra)

    if cover:
        work.cover_image_path = await _save_upload(cover)

    work.tags = await _get_or_create_tags(session, _parse_tags(tags))

    await session.commit()
    await session.refresh(work)

    await _cleanup_empty_relations(session, old_author_id, old_circle_id, old_event_id)
    await _cleanup_empty_tags(session, old_tag_ids)
    await session.commit()

    work = await _load_work(session, work.id)
    return _work_to_out(work)


class NameItem(BaseModel):
    id: int
    name: str
    work_count: int


@app.get("/authors", response_model=list[NameItem])
async def list_authors(session=Depends(get_session)):
    result = await session.execute(
        select(Author.id, Author.name, func.count(Work.id))
        .select_from(Author)
        .join(Work, Work.author_id == Author.id, isouter=True)
        .group_by(Author.id)
        .order_by(Author.name.asc())
    )
    return [
        NameItem(id=row[0], name=row[1], work_count=row[2])
        for row in result.all()
    ]


@app.get("/circles", response_model=list[NameItem])
async def list_circles(session=Depends(get_session)):
    result = await session.execute(
        select(Circle.id, Circle.name, func.count(Work.id))
        .select_from(Circle)
        .join(Work, Work.circle_id == Circle.id, isouter=True)
        .group_by(Circle.id)
        .order_by(Circle.name.asc())
    )
    return [
        NameItem(id=row[0], name=row[1], work_count=row[2])
        for row in result.all()
    ]


@app.get("/events", response_model=list[NameItem])
async def list_events(session=Depends(get_session)):
    result = await session.execute(
        select(Event.id, Event.name, func.count(Work.id))
        .select_from(Event)
        .join(Work, Work.purchase_event_id == Event.id, isouter=True)
        .group_by(Event.id)
        .order_by(Event.name.asc())
    )
    return [
        NameItem(id=row[0], name=row[1], work_count=row[2])
        for row in result.all()
    ]


@app.get("/tags", response_model=list[NameItem])
async def list_tags(session=Depends(get_session)):
    result = await session.execute(
        select(Tag.id, Tag.name, func.count(Work.id))
        .select_from(Tag)
        .join(work_tags, work_tags.c.tag_id == Tag.id, isouter=True)
        .join(Work, Work.id == work_tags.c.work_id, isouter=True)
        .group_by(Tag.id)
        .order_by(Tag.name.asc())
    )
    return [
        NameItem(id=row[0], name=row[1], work_count=row[2])
        for row in result.all()
    ]


@app.delete("/works/{work_id}")
async def delete_work(work_id: int, session=Depends(get_session)):
    result = await session.execute(
        select(Work)
        .where(Work.id == work_id)
        .options(selectinload(Work.tags))
    )
    work = result.scalars().first()
    if not work:
        raise HTTPException(status_code=404, detail="not found")
    old_author_id = work.author_id
    old_circle_id = work.circle_id
    old_event_id = work.purchase_event_id
    old_tag_ids = [t.id for t in work.tags]
    await session.delete(work)
    await session.commit()
    await _cleanup_empty_relations(session, old_author_id, old_circle_id, old_event_id)
    await _cleanup_empty_tags(session, old_tag_ids)
    await session.commit()
    return {"ok": True}
