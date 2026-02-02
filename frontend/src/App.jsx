import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

function emptyExtraRow() {
  return { key: "", value: "" };
}

export default function App() {
  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("form");
  const [cardSize, setCardSize] = useState("m");
  const [filters, setFilters] = useState({
    title: "",
    author: "",
    circle: "",
    summary: "",
    purchase_event: "",
    tags: "",
    extra: "",
    price_min: "",
    price_max: "",
    date_from: "",
    date_to: "",
    is_r18: "all"
  });
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: "",
    author_name: "",
    circle_name: "",
    is_r18: false,
    summary: "",
    purchase_date: "",
    purchase_event_name: "",
    price: "",
    tags: "",
    extra: [emptyExtraRow()],
    cover: null
  });
  const [authors, setAuthors] = useState([]);
  const [circles, setCircles] = useState([]);
  const [events, setEvents] = useState([]);
  const [tagsList, setTagsList] = useState([]);

  const extraJson = useMemo(() => {
    const obj = {};
    for (const row of form.extra) {
      if (row.key.trim()) obj[row.key.trim()] = row.value;
    }
    return obj;
  }, [form.extra]);

  const filteredWorks = useMemo(() => {
    const q = (v) => (v || "").toString().toLowerCase();
    const contains = (base, term) => q(base).includes(q(term));
    const dateVal = (v) => (v ? new Date(v).getTime() : null);
    const minPrice = filters.price_min !== "" ? Number(filters.price_min) : null;
    const maxPrice = filters.price_max !== "" ? Number(filters.price_max) : null;
    const fromDate = filters.date_from ? dateVal(filters.date_from) : null;
    const toDate = filters.date_to ? dateVal(filters.date_to) : null;

    return works.filter((w) => {
      if (filters.title && !contains(w.title, filters.title)) return false;
      if (filters.author && !contains(w.author?.name, filters.author)) return false;
      if (filters.circle && !contains(w.circle?.name, filters.circle)) return false;
      if (filters.summary && !contains(w.summary, filters.summary)) return false;
      if (filters.purchase_event && !contains(w.purchase_event?.name, filters.purchase_event)) return false;
      if (filters.tags) {
        const anyTag = (w.tags || []).some((t) => contains(t, filters.tags));
        if (!anyTag) return false;
      }
      if (filters.extra) {
        const extraText = JSON.stringify(w.extra || {});
        if (!contains(extraText, filters.extra)) return false;
      }
      if (minPrice !== null) {
        if (w.price == null || Number(w.price) < minPrice) return false;
      }
      if (maxPrice !== null) {
        if (w.price == null || Number(w.price) > maxPrice) return false;
      }
      if (fromDate !== null) {
        const d = dateVal(w.purchase_date);
        if (d == null || d < fromDate) return false;
      }
      if (toDate !== null) {
        const d = dateVal(w.purchase_date);
        if (d == null || d > toDate) return false;
      }
      if (filters.is_r18 !== "all") {
        const flag = filters.is_r18 === "true";
        if (Boolean(w.is_r18) !== flag) return false;
      }
      return true;
    });
  }, [works, filters]);

  async function loadWorks() {
    setLoading(true);
    const res = await fetch(`${API_BASE}/works`);
    const data = await res.json();
    setWorks(data);
    setLoading(false);
  }

  async function loadPeople() {
    const [aRes, cRes, eRes, tRes] = await Promise.all([
      fetch(`${API_BASE}/authors`),
      fetch(`${API_BASE}/circles`),
      fetch(`${API_BASE}/events`),
      fetch(`${API_BASE}/tags`)
    ]);
    setAuthors(await aRes.json());
    setCircles(await cRes.json());
    setEvents(await eRes.json());
    setTagsList(await tRes.json());
  }

  useEffect(() => {
    loadWorks();
    loadPeople();
  }, []);

  function updateField(e) {
    const { name, value, type, checked } = e.target;
    const nextValue = type === "checkbox" ? checked : value;
    setForm((f) => ({ ...f, [name]: nextValue }));
  }

  function updateFilter(e) {
    const { name, value } = e.target;
    setFilters((f) => ({ ...f, [name]: value }));
  }

  function applyAuthorFilter(name) {
    setFilters((f) => ({ ...f, author: name || "", circle: "" }));
    setView("works");
  }

  function applyCircleFilter(name) {
    setFilters((f) => ({ ...f, circle: name || "", author: "" }));
    setView("works");
  }

  function applyEventFilter(name) {
    setFilters((f) => ({ ...f, purchase_event: name || "" }));
    setView("works");
  }

  function applyTagFilter(name) {
    setFilters((f) => ({ ...f, tags: name || "" }));
    setView("works");
  }

  function updateExtra(index, key, value) {
    setForm((f) => {
      const next = [...f.extra];
      next[index] = { ...next[index], [key]: value };
      return { ...f, extra: next };
    });
  }

  function addExtraRow() {
    setForm((f) => ({ ...f, extra: [...f.extra, emptyExtraRow()] }));
  }

  function removeExtraRow(index) {
    setForm((f) => {
      const next = f.extra.filter((_, i) => i !== index);
      return { ...f, extra: next.length ? next : [emptyExtraRow()] };
    });
  }

  async function submit(e) {
    e.preventDefault();
    const fd = new FormData();
    const appendIf = (key, value) => {
      if (value !== undefined && value !== null && value !== "") {
        fd.append(key, value);
      }
    };
    fd.append("title", form.title);
    appendIf("author_name", form.author_name);
    appendIf("circle_name", form.circle_name);
    fd.append("is_r18", form.is_r18 ? "true" : "false");
    appendIf("summary", form.summary);
    appendIf("purchase_date", form.purchase_date);
    appendIf("purchase_event_name", form.purchase_event_name);
    appendIf("price", form.price);
    appendIf("tags", form.tags);
    fd.append("extra", JSON.stringify(extraJson));
    if (form.cover) fd.append("cover", form.cover);

    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `${API_BASE}/works/${editingId}` : `${API_BASE}/works`;
    await fetch(url, { method, body: fd });

    setForm({
      title: "",
      author_name: "",
      circle_name: "",
      is_r18: false,
      summary: "",
      purchase_date: "",
      purchase_event_name: "",
      price: "",
      tags: "",
      extra: [emptyExtraRow()],
      cover: null
    });
    setEditingId(null);
    await loadWorks();
    await loadPeople();
  }

  function startEdit(work) {
    setEditingId(work.id);
    setForm({
      title: work.title || "",
      author_name: work.author?.name || "",
      circle_name: work.circle?.name || "",
      is_r18: Boolean(work.is_r18),
      summary: work.summary || "",
      purchase_date: work.purchase_date || "",
      purchase_event_name: work.purchase_event?.name || "",
      price: work.price != null ? String(work.price) : "",
      tags: (work.tags || []).join(","),
      extra: work.extra && Object.keys(work.extra).length
        ? Object.entries(work.extra).map(([key, value]) => ({ key, value: String(value) }))
        : [emptyExtraRow()],
      cover: null
    });
    setView("form");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({
      title: "",
      author_name: "",
      circle_name: "",
      is_r18: false,
      summary: "",
      purchase_date: "",
      purchase_event_name: "",
      price: "",
      tags: "",
      extra: [emptyExtraRow()],
      cover: null
    });
  }

  async function removeWork(id) {
    if (!confirm("この作品を削除しますか？")) return;
    await fetch(`${API_BASE}/works/${id}`, { method: "DELETE" });
    await loadWorks();
  }

  return (
    <div className="page">
      <header className="hero">
        <div>
          <h1>DoujinShelf</h1>
          <p>同人誌コレクションをスマートに整理</p>
        </div>
        <nav className="nav">
          <button
            className={view === "form" ? "nav-btn active" : "nav-btn"}
            type="button"
            onClick={() => setView("form")}
          >
            登録
          </button>
          <button
            className={view === "works" ? "nav-btn active" : "nav-btn"}
            type="button"
            onClick={() => setView("works")}
          >
            作品一覧
          </button>
          <button
            className={view === "authors" ? "nav-btn active" : "nav-btn"}
            type="button"
            onClick={() => setView("authors")}
          >
            作者一覧
          </button>
          <button
            className={view === "circles" ? "nav-btn active" : "nav-btn"}
            type="button"
            onClick={() => setView("circles")}
          >
            サークル一覧
          </button>
          <button
            className={view === "events" ? "nav-btn active" : "nav-btn"}
            type="button"
            onClick={() => setView("events")}
          >
            イベント一覧
          </button>
          <button
            className={view === "tags" ? "nav-btn active" : "nav-btn"}
            type="button"
            onClick={() => setView("tags")}
          >
            タグ一覧
          </button>
        </nav>
      </header>

      {view === "form" && (
        <section className="panel">
          <h2>{editingId ? "編集" : "新規登録"}</h2>
          <form className="form" onSubmit={submit}>
            <div className="grid">
              <label>
                作品名
                <input name="title" value={form.title} onChange={updateField} required />
              </label>
              <label>
                作者
                <input
                  name="author_name"
                  value={form.author_name}
                  onChange={updateField}
                  list="author-list"
                />
              </label>
              <label>
                サークル
                <input
                  name="circle_name"
                  value={form.circle_name}
                  onChange={updateField}
                  list="circle-list"
                />
              </label>
              <label className="checkbox">
                <input type="checkbox" name="is_r18" checked={form.is_r18} onChange={updateField} />
                R-18
              </label>
              <label>
                購入日
                <input type="date" name="purchase_date" value={form.purchase_date} onChange={updateField} />
              </label>
            <label>
              購入イベント
              <input
                name="purchase_event_name"
                value={form.purchase_event_name}
                onChange={updateField}
                list="event-list"
              />
            </label>
            <label>
              購入価格
              <input type="number" step="0.01" max="99999999.99" name="price" value={form.price} onChange={updateField} />
            </label>
            </div>

            <label>
              作品概要
              <textarea name="summary" value={form.summary} onChange={updateField} />
            </label>

            <label>
              タグ（カンマ区切り）
              <input name="tags" value={form.tags} onChange={updateField} />
            </label>

            <div className="extra">
              <div className="extra-header">
                <span>自由項目</span>
                <button type="button" onClick={addExtraRow}>追加</button>
              </div>
              {form.extra.map((row, i) => (
                <div className="extra-row" key={i}>
                  <input
                    placeholder="キー"
                    value={row.key}
                    onChange={(e) => updateExtra(i, "key", e.target.value)}
                  />
                  <input
                    placeholder="値"
                    value={row.value}
                    onChange={(e) => updateExtra(i, "value", e.target.value)}
                  />
                  <button type="button" onClick={() => removeExtraRow(i)}>削除</button>
                </div>
              ))}
            </div>

            <label className="file">
              表紙画像（1枚）
              <input type="file" accept="image/*" onChange={(e) => setForm((f) => ({ ...f, cover: e.target.files[0] }))} />
            </label>

            <div className="actions">
              <button type="submit" className="primary">{editingId ? "更新" : "登録"}</button>
              {editingId && (
                <button type="button" className="secondary" onClick={cancelEdit}>
                  キャンセル
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      {view === "works" && (
        <section className="panel">
          <div className="panel-head">
            <h2>作品一覧</h2>
            <div className="size-toggle">
              <button
                className={cardSize === "s" ? "size-btn active" : "size-btn"}
                type="button"
                onClick={() => setCardSize("s")}
              >
                小
              </button>
              <button
                className={cardSize === "m" ? "size-btn active" : "size-btn"}
                type="button"
                onClick={() => setCardSize("m")}
              >
                中
              </button>
              <button
                className={cardSize === "l" ? "size-btn active" : "size-btn"}
                type="button"
                onClick={() => setCardSize("l")}
              >
                大
              </button>
            </div>
          </div>
          <div className="filters">
            <div className="grid">
              <label>
                作品名
                <input name="title" value={filters.title} onChange={updateFilter} />
              </label>
              <label>
                作者
                <input name="author" value={filters.author} onChange={updateFilter} />
              </label>
              <label>
                サークル
                <input name="circle" value={filters.circle} onChange={updateFilter} />
              </label>
              <label>
                作品概要
                <input name="summary" value={filters.summary} onChange={updateFilter} />
              </label>
              <label>
                購入イベント
                <input name="purchase_event" value={filters.purchase_event} onChange={updateFilter} />
              </label>
              <label>
                タグ
                <input name="tags" value={filters.tags} onChange={updateFilter} />
              </label>
              <label>
                自由項目
                <input name="extra" value={filters.extra} onChange={updateFilter} />
              </label>
              <label>
                価格
                <div className="range">
                  <input type="number" step="0.01" name="price_min" value={filters.price_min} onChange={updateFilter} placeholder="最小" />
                  <span className="range-sep">〜</span>
                  <input type="number" step="0.01" name="price_max" value={filters.price_max} onChange={updateFilter} placeholder="最大" />
                </div>
              </label>
              <label>
                購入日
                <div className="range">
                  <input type="date" name="date_from" value={filters.date_from} onChange={updateFilter} />
                  <span className="range-sep">〜</span>
                  <input type="date" name="date_to" value={filters.date_to} onChange={updateFilter} />
                </div>
              </label>
              <label>
                R-18
                <select name="is_r18" value={filters.is_r18} onChange={updateFilter}>
                  <option value="all">指定なし</option>
                  <option value="true">R-18のみ</option>
                  <option value="false">一般のみ</option>
                </select>
              </label>
            </div>
          </div>
          {loading ? (
            <p>読み込み中...</p>
          ) : (
            <div className={`cards cards-${cardSize}`}>
              {filteredWorks.map((w) => (
                <article className="card" key={w.id}>
                  {w.cover_image_url ? (
                    <img src={`${API_BASE}${w.cover_image_url}`} alt="cover" />
                  ) : (
                    <div className="placeholder">NO IMAGE</div>
                  )}
                  <div className="card-body">
                    <h3>{w.title}</h3>
                    {w.summary && <p>{w.summary}</p>}
                    {(w.author || w.circle) && (
                      <p className="byline">
                        {w.author?.name && <span>作者: {w.author.name}</span>}
                        {w.circle?.name && <span>サークル: {w.circle.name}</span>}
                      </p>
                    )}
                    {w.is_r18 && <span className="badge">R-18</span>}
                    <div className="card-actions">
                      <button className="secondary" type="button" onClick={() => startEdit(w)}>
                        編集
                      </button>
                      <button className="danger" type="button" onClick={() => removeWork(w.id)}>
                        削除
                      </button>
                    </div>
                    <div className="meta">
                      {w.purchase_date && <span>購入日: {w.purchase_date}</span>}
                      {w.purchase_event?.name && <span>イベント: {w.purchase_event.name}</span>}
                      {w.price != null && <span>価格: {w.price}</span>}
                    </div>
                    {w.tags?.length ? (
                      <div className="tags">
                        {w.tags.map((t) => (
                          <span key={t} className="tag">{t}</span>
                        ))}
                      </div>
                    ) : null}
                    {w.extra && Object.keys(w.extra).length ? (
                      <ul className="extra-list">
                        {Object.entries(w.extra).map(([k, v]) => (
                          <li key={k}>
                            <strong>{k}</strong>: {String(v)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {view === "authors" && (
        <section className="panel">
          <h2>作者一覧</h2>
          <div className="list">
            {authors.map((a) => (
              <button
                className="list-item list-link"
                key={a.id}
                type="button"
                onClick={() => applyAuthorFilter(a.name)}
              >
                <span>{a.name}</span>
                <span className="count">{a.work_count}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {view === "circles" && (
        <section className="panel">
          <h2>サークル一覧</h2>
          <div className="list">
            {circles.map((c) => (
              <button
                className="list-item list-link"
                key={c.id}
                type="button"
                onClick={() => applyCircleFilter(c.name)}
              >
                <span>{c.name}</span>
                <span className="count">{c.work_count}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {view === "events" && (
        <section className="panel">
          <h2>イベント一覧</h2>
          <div className="list">
            {events.map((e) => (
              <button
                className="list-item list-link"
                key={e.id}
                type="button"
                onClick={() => applyEventFilter(e.name)}
              >
                <span>{e.name}</span>
                <span className="count">{e.work_count}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {view === "tags" && (
        <section className="panel">
          <h2>タグ一覧</h2>
          <div className="list">
            {tagsList.map((t) => (
              <button
                className="list-item list-link"
                key={t.id}
                type="button"
                onClick={() => applyTagFilter(t.name)}
              >
                <span>{t.name}</span>
                <span className="count">{t.work_count}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <datalist id="author-list">
        {authors.map((a) => (
          <option key={a.id} value={a.name} />
        ))}
      </datalist>
      <datalist id="circle-list">
        {circles.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
      <datalist id="event-list">
        {events.map((e) => (
          <option key={e.id} value={e.name} />
        ))}
      </datalist>
    </div>
  );
}
