import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const emptyPost = {
  title: "",
  slug: "",
  summary: "",
  status: "draft",
  column: "",
  markdown: "# 新文章\n\n"
};

function slugify(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-|-$/g, "")
    .replace(/[\u4e00-\u9fa5]/g, "");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "请求失败。");
  return data;
}

function TextInput({ label, value, onChange, placeholder }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value || ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectInput({ label, value, onChange, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value || ""} onChange={(event) => onChange(event.target.value)}>{children}</select>
    </label>
  );
}

function moveItem(list, from, to) {
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

function PostEditor({ state, refresh, selectedSlug, setSelectedSlug }) {
  const existing = state.posts.find((post) => post.slug === selectedSlug);
  const [post, setPost] = useState(existing || { ...emptyPost, column: state.columns[0]?.slug || "" });
  const [mode, setMode] = useState("edit");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setPost(existing || { ...emptyPost, column: state.columns[0]?.slug || "" });
    setMode("edit");
  }, [selectedSlug, existing, state.columns]);

  function update(key, value) {
    setPost((current) => {
      const next = { ...current, [key]: value };
      if (key === "title" && !current.slug) next.slug = slugify(value);
      return next;
    });
  }

  async function save(status = post.status) {
    setMessage("");
    const payload = { ...post, status };
    const result = await api("/api/posts", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setSelectedSlug(result.post.slug);
    await refresh();
    setMessage(status === "published" ? "已发布到 content/posts。" : "已保存到本地草稿。");
  }

  async function onPaste(event) {
    const file = [...event.clipboardData.files].find((item) => item.type.startsWith("image/"));
    if (!file) return;
    event.preventDefault();
    const reader = new FileReader();
    reader.onload = async () => {
      const result = await api("/api/uploads", {
        method: "POST",
        body: JSON.stringify({ filename: file.name || "pasted-image.png", dataUrl: reader.result })
      });
      update("markdown", `${post.markdown}\n\n![图片说明](${result.path})\n`);
    };
    reader.readAsDataURL(file);
  }

  return (
    <main className="workspace">
      <div className="toolbar">
        <div>
          <strong>文章编辑</strong>
          <span>{message}</span>
        </div>
        <div className="actions">
          <button onClick={() => setMode(mode === "edit" ? "preview" : "edit")}>{mode === "edit" ? "预览" : "编辑"}</button>
          <button onClick={() => save("draft")}>保存草稿</button>
          <button className="primary" onClick={() => save("published")}>发布</button>
        </div>
      </div>

      <div className="meta-grid">
        <TextInput label="标题" value={post.title} onChange={(value) => update("title", value)} />
        <TextInput label="Slug" value={post.slug} onChange={(value) => update("slug", value)} />
        <SelectInput label="专栏" value={post.column} onChange={(value) => update("column", value)}>
          {state.columns.map((column) => <option key={column.slug} value={column.slug}>{column.name}</option>)}
        </SelectInput>
        <SelectInput label="状态" value={post.status} onChange={(value) => update("status", value)}>
          <option value="draft">草稿</option>
          <option value="published">已发布</option>
        </SelectInput>
      </div>
      <TextInput label="摘要" value={post.summary} onChange={(value) => update("summary", value)} />

      {mode === "edit" ? (
        <textarea className="editor" value={post.markdown} onPaste={onPaste} onChange={(event) => update("markdown", event.target.value)} />
      ) : (
        <article className="preview">
          {post.markdown.split("\n").map((line, index) => {
            if (line.startsWith("# ")) return <h1 key={index}>{line.slice(2)}</h1>;
            if (line.startsWith("## ")) return <h2 key={index}>{line.slice(3)}</h2>;
            if (line.startsWith("> [!")) return null;
            if (line.startsWith("> ")) return <blockquote key={index}>{line.slice(2)}</blockquote>;
            if (!line.trim()) return <br key={index} />;
            return <p key={index}>{line}</p>;
          })}
        </article>
      )}
    </main>
  );
}

function PostsSidebar({ state, selectedSlug, setSelectedSlug, setSection }) {
  const published = state.posts.filter((post) => post.status === "published");
  const drafts = state.posts.filter((post) => post.status !== "published");

  return (
    <aside className="sidebar">
      <div className="brand">本地后台<span>写作台</span></div>
      <nav>
        <button className="active" onClick={() => setSection("posts")}>文章</button>
        <button onClick={() => setSection("columns")}>专栏</button>
        <button onClick={() => setSection("archive")}>资料存档</button>
        <button onClick={() => setSection("library")}>图书馆</button>
      </nav>
      <button className="new-button" onClick={() => setSelectedSlug("")}>新建文章</button>
      <h3>草稿</h3>
      {drafts.map((post) => (
        <button key={post.slug} className={selectedSlug === post.slug ? "doc active-doc" : "doc"} onClick={() => setSelectedSlug(post.slug)}>{post.title}</button>
      ))}
      <h3>已发布</h3>
      {published.map((post) => (
        <button key={post.slug} className={selectedSlug === post.slug ? "doc active-doc" : "doc"} onClick={() => setSelectedSlug(post.slug)}>{post.title}</button>
      ))}
    </aside>
  );
}

function ColumnsManager({ state, refresh, setSection }) {
  const [columns, setColumns] = useState(state.columns);
  const [orders, setOrders] = useState(state.orders.columns);
  const [active, setActive] = useState(state.columns[0]?.slug || "");
  const [dragIndex, setDragIndex] = useState(null);
  const activeColumn = columns.find((column) => column.slug === active);
  const activePosts = state.posts.filter((post) => post.status === "published" && post.column === active);
  const orderedPosts = useMemo(() => {
    const order = orders[active] || [];
    const orderMap = new Map(order.map((slug, index) => [slug, index]));
    return [...activePosts].sort((a, b) => (orderMap.get(a.slug) ?? 9999) - (orderMap.get(b.slug) ?? 9999));
  }, [activePosts, orders, active]);

  async function saveColumns() {
    await api("/api/columns", { method: "POST", body: JSON.stringify({ columns }) });
    await refresh();
  }

  async function saveOrder() {
    await api(`/api/orders/columns/${active}`, { method: "POST", body: JSON.stringify({ slugs: orderedPosts.map((post) => post.slug) }) });
    await refresh();
  }

  function updateOrder(from, to) {
    const current = orderedPosts.map((post) => post.slug);
    setOrders({ ...orders, [active]: moveItem(current, from, to) });
  }

  function dropOrder(to) {
    if (dragIndex === null || dragIndex === to) return;
    updateOrder(dragIndex, to);
    setDragIndex(null);
  }

  return (
    <main className="workspace">
      <div className="toolbar">
        <strong>专栏</strong>
        <div className="actions">
          <button onClick={() => setSection("posts")}>回到文章</button>
          <button onClick={saveColumns}>保存专栏</button>
          <button className="primary" onClick={saveOrder}>保存排序</button>
        </div>
      </div>
      <div className="split">
        <section>
          {columns.map((column, index) => (
            <div className="card" key={column.slug}>
              <TextInput label="名称" value={column.name} onChange={(value) => {
                const next = [...columns];
                next[index] = { ...column, name: value };
                setColumns(next);
              }} />
              <TextInput label="Slug" value={column.slug} onChange={(value) => {
                const next = [...columns];
                next[index] = { ...column, slug: value };
                setColumns(next);
              }} />
              <TextInput label="描述" value={column.description} onChange={(value) => {
                const next = [...columns];
                next[index] = { ...column, description: value };
                setColumns(next);
              }} />
              <button onClick={() => setActive(column.slug)}>{active === column.slug ? "正在排序" : "排序此专栏"}</button>
            </div>
          ))}
          <button onClick={() => setColumns([...columns, { name: "新专栏", slug: `column-${columns.length + 1}`, description: "" }])}>新增专栏</button>
        </section>
        <section>
          <h2>{activeColumn?.name || "选择专栏"}</h2>
          <p className="hint">拖动左侧手柄调整“我的推荐排序”。</p>
          {orderedPosts.map((post, index) => (
            <div
              className="order-row"
              draggable
              key={post.slug}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dropOrder(index)}
            >
              <span className="drag-handle">☰</span>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{post.title}</strong>
              <button disabled={index === 0} onClick={() => updateOrder(index, index - 1)}>上移</button>
              <button disabled={index === orderedPosts.length - 1} onClick={() => updateOrder(index, index + 1)}>下移</button>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

function JsonListManager({ title, field, state, refresh, setSection }) {
  const [rows, setRows] = useState(state[field]);
  const keys = field === "library" ? ["title", "author"] : ["title", "author", "url", "source", "note", "savedAt"];

  async function save() {
    await api(`/${field === "library" ? "api/library" : "api/archive"}`, {
      method: "POST",
      body: JSON.stringify({ [field]: rows })
    });
    await refresh();
  }

  return (
    <main className="workspace">
      <div className="toolbar">
        <strong>{title}</strong>
        <div className="actions">
          <button onClick={() => setSection("posts")}>回到文章</button>
          <button className="primary" onClick={save}>保存</button>
        </div>
      </div>
      <div className="data-table">
        {rows.map((row, rowIndex) => (
          <div className="data-row" key={rowIndex}>
            {keys.map((key) => (
              <TextInput key={key} label={key} value={row[key]} onChange={(value) => {
                const next = [...rows];
                next[rowIndex] = { ...row, [key]: value };
                setRows(next);
              }} />
            ))}
          </div>
        ))}
      </div>
      <button onClick={() => setRows([...rows, Object.fromEntries(keys.map((key) => [key, ""]))])}>新增</button>
    </main>
  );
}

function App() {
  const [state, setState] = useState(null);
  const [section, setSection] = useState("posts");
  const [selectedSlug, setSelectedSlug] = useState("");

  async function refresh() {
    const next = await api("/api/state");
    setState(next);
  }

  useEffect(() => {
    refresh();
  }, []);

  if (!state) return <div className="loading">正在打开本地写作台...</div>;

  return (
    <div className="admin-shell">
      <PostsSidebar state={state} selectedSlug={selectedSlug} setSelectedSlug={setSelectedSlug} setSection={setSection} />
      {section === "posts" && <PostEditor state={state} refresh={refresh} selectedSlug={selectedSlug} setSelectedSlug={setSelectedSlug} />}
      {section === "columns" && <ColumnsManager state={state} refresh={refresh} setSection={setSection} />}
      {section === "archive" && <JsonListManager title="资料存档" field="archive" state={state} refresh={refresh} setSection={setSection} />}
      {section === "library" && <JsonListManager title="图书馆" field="library" state={state} refresh={refresh} setSection={setSection} />}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
