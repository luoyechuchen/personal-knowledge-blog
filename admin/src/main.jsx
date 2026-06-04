import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { pinyin } from "pinyin-pro";
import "./styles.css";

const emptyPost = {
  title: "",
  slug: "",
  summary: "",
  status: "draft",
  column: "",
  markdown: "# 新文章\n\n"
};

const publishCommands = `cd /Users/luoyechuchen/Documents/coding
git status
git add content public/uploads
git commit -m "Publish blog update"
git push`;

function slugify(text) {
  const withPinyin = String(text || "").replace(/[\u4e00-\u9fff]+/g, (match) =>
    pinyin(match, { toneType: "none", type: "array" }).join("-")
  );

  return withPinyin
    .normalize("NFKD")
    .trim()
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function fallbackSlug(prefix = "post") {
  return `${prefix}-${Date.now()}`;
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

function columnName(columns, slug) {
  return columns.find((column) => column.slug === slug)?.name || "未归类";
}

function formatStatus(status) {
  return status === "published" ? "已发布" : "草稿";
}

function TextInput({ label, value, onChange, placeholder }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value || ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextAreaInput({ label, value, onChange, placeholder, rows = 7 }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea
        className="text-area"
        rows={rows}
        value={value || ""}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
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

function recentValue(item) {
  const value = item?.updatedAt || item?.savedAt || item?.createdAt || item?.publishedAt || "";
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

function sortRecentFirst(items) {
  return [...items].sort((a, b) => recentValue(b) - recentValue(a));
}

let columnDraftId = 0;

function attachColumnDraftIds(columns) {
  return columns.map((column) => ({
    ...column,
    _draftId: column._draftId || `column-draft-${columnDraftId += 1}`
  }));
}

function cleanColumns(columns) {
  return columns.map(({ _draftId, ...column }) => column);
}

function GitPublishNotice({ visible, message }) {
  const [copied, setCopied] = useState(false);
  if (!visible) return null;

  async function copyCommands() {
    await navigator.clipboard.writeText(publishCommands);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="git-notice">
      <div>
        <strong>{message || "有未提交改动"}</strong>
        <span>本地内容已经变化。请另开一个新终端，复制下面命令运行后，公开网站才会更新。</span>
      </div>
      <pre>{publishCommands}</pre>
      <button onClick={copyCommands}>{copied ? "已复制" : "复制提交命令"}</button>
    </div>
  );
}

function Sidebar({ state, section, setSection, setPostsView, setSelectedSlug }) {
  const recent = [...state.posts].slice(0, 8);
  const navItems = [
    ["posts", "文章"],
    ["columns", "专栏"],
    ["archive", "资料存档"],
    ["library", "图书馆"]
  ];

  function openSection(nextSection) {
    setSection(nextSection);
    if (nextSection === "posts") setPostsView("list");
  }

  function newPost() {
    setSection("posts");
    setSelectedSlug("");
    setPostsView("editor");
  }

  function editPost(slug) {
    setSection("posts");
    setSelectedSlug(slug);
    setPostsView("editor");
  }

  return (
    <aside className="sidebar">
      <div className="brand">本地后台<span>写作台</span></div>
      <nav>
        {navItems.map(([key, label]) => (
          <button key={key} className={section === key || (key === "posts" && section === "homeFeatured") ? "active" : ""} onClick={() => openSection(key)}>
            {label}
          </button>
        ))}
      </nav>
      <button className="new-button" onClick={newPost}>新建文章</button>
      <h3>最近文章</h3>
      {recent.map((post) => (
        <button key={post.slug} className="doc" onClick={() => editPost(post.slug)}>
          {post.title}
          <span>{formatStatus(post.status)}</span>
        </button>
      ))}
    </aside>
  );
}

function PostsManager({ state, refresh, selectedSlug, setSelectedSlug, postsView, setPostsView, setSection }) {
  const [message, setMessage] = useState("");
  const [gitDirty, setGitDirty] = useState(false);
  const posts = [...state.posts].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

  function editPost(slug) {
    setSelectedSlug(slug);
    setPostsView("editor");
  }

  function newPost() {
    setSelectedSlug("");
    setPostsView("editor");
  }

  async function deletePost(post) {
    if (!confirm(`确认删除《${post.title || "未命名文章"}》？`)) return;
    setMessage("删除中...");
    try {
      await api(`/api/posts/${post.slug}`, { method: "DELETE" });
      await refresh();
      setSelectedSlug("");
      setPostsView("list");
      setGitDirty(true);
      setMessage("已删除文章 · 尚未提交 Git");
    } catch (error) {
      setMessage(`删除失败：${error.message}`);
    }
  }

  if (postsView === "editor") {
    return (
      <PostEditor
        state={state}
        refresh={refresh}
        selectedSlug={selectedSlug}
        setSelectedSlug={setSelectedSlug}
        setPostsView={setPostsView}
        setParentMessage={setMessage}
        setParentGitDirty={setGitDirty}
      />
    );
  }

  return (
    <main className="workspace">
      <div className="toolbar">
        <div>
          <strong>文章管理</strong>
          <span>{message || "管理文章本体；首页推荐和专栏排序在各自页面调整。"}</span>
        </div>
        <div className="actions">
          <button onClick={() => setSection("homeFeatured")}>首页推荐</button>
          <button className="primary" onClick={newPost}>新建文章</button>
        </div>
      </div>

      <GitPublishNotice visible={gitDirty} message="文章内容有未提交改动" />

      <div className="post-admin-table">
        <div className="post-admin-row post-admin-head">
          <span>标题</span>
          <span>状态</span>
          <span>专栏</span>
          <span>更新</span>
          <span>操作</span>
        </div>
        {posts.map((post) => (
          <div className="post-admin-row" key={`${post.location}-${post.slug}`}>
            <strong>{post.title}</strong>
            <span>{formatStatus(post.status)}</span>
            <span>{columnName(state.columns, post.column)}</span>
            <span>{post.updatedAt || post.createdAt || "-"}</span>
            <span className="row-actions">
              <button onClick={() => editPost(post.slug)}>编辑</button>
              <button className="danger" onClick={() => deletePost(post)}>删除</button>
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}

function PostEditor({ state, refresh, selectedSlug, setSelectedSlug, setPostsView, setParentMessage, setParentGitDirty }) {
  const existing = state.posts.find((post) => post.slug === selectedSlug);
  const isNew = !existing;
  const [post, setPost] = useState(existing || { ...emptyPost, column: state.columns[0]?.slug || "" });
  const [mode, setMode] = useState("edit");
  const [message, setMessage] = useState(isNew ? "正在新建文章" : "");
  const [dirty, setDirty] = useState(false);
  const [gitDirty, setGitDirty] = useState(false);

  useEffect(() => {
    const nextPost = existing || { ...emptyPost, column: state.columns[0]?.slug || "" };
    setPost(nextPost);
    setMode("edit");
    setMessage(existing ? "" : "正在新建文章");
    setDirty(false);
    setGitDirty(false);
  }, [selectedSlug, existing, state.columns]);

  function update(key, value) {
    setPost((current) => {
      const next = { ...current, [key]: value };
      if (key === "title" && !current.slug) next.slug = slugify(value);
      if (key === "slug") next.slug = slugify(value);
      return next;
    });
    setDirty(true);
    setMessage("有未保存修改");
  }

  async function save(status = post.status) {
    setMessage(status === "published" ? "发布中..." : "保存中...");
    try {
      if (!post.title.trim()) throw new Error("标题不能为空。");
      const slug = slugify(post.slug || post.title) || fallbackSlug("post");
      const postToSave = { ...post, slug };
      if (existing?.status === "published" && status === "draft" && !confirm("这会把已发布文章移回草稿，并从公开内容区删除。确定继续吗？")) {
        setMessage("已取消");
        return;
      }
      if (existing?.status === "published" && existing.slug !== slug && !confirm("修改已发布文章的 Slug 会改变文章网址。确定继续吗？")) {
        setMessage("已取消");
        return;
      }

      const result = await api("/api/posts", {
        method: "POST",
        body: JSON.stringify({ ...postToSave, status, originalSlug: existing?.slug || "" })
      });
      setPost(result.post);
      setSelectedSlug(result.post.slug);
      await refresh();
      setDirty(false);
      setGitDirty(true);
      setParentGitDirty(true);
      const nextMessage = status === "published"
        ? `已发布到本地内容区 · ${new Date().toLocaleTimeString()} · 尚未提交 Git`
        : `已保存草稿 · ${new Date().toLocaleTimeString()}`;
      setMessage(nextMessage);
      setParentMessage(nextMessage);
    } catch (error) {
      setMessage(`${status === "published" ? "发布" : "保存"}失败：${error.message}`);
    }
  }

  async function deleteCurrentPost() {
    if (!existing) {
      setPostsView("list");
      return;
    }
    if (!confirm(`确认删除《${existing.title || "未命名文章"}》？`)) return;
    setMessage("删除中...");
    try {
      await api(`/api/posts/${existing.slug}`, { method: "DELETE" });
      await refresh();
      setSelectedSlug("");
      setPostsView("list");
      setParentGitDirty(true);
      setParentMessage("已删除文章 · 尚未提交 Git");
    } catch (error) {
      setMessage(`删除失败：${error.message}`);
    }
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
          <strong>{isNew ? "新建文章" : "编辑文章"}</strong>
          <span>{message || (dirty ? "有未保存修改" : "编辑 Markdown 正文和发布信息")}</span>
        </div>
        <div className="actions">
          <button onClick={() => setPostsView("list")}>返回列表</button>
          <button onClick={() => setMode(mode === "edit" ? "preview" : "edit")}>{mode === "edit" ? "预览" : "编辑"}</button>
          <button onClick={() => save("draft")}>保存草稿</button>
          <button className="primary" onClick={() => save("published")}>发布文章</button>
          <button className="danger" onClick={deleteCurrentPost}>删除</button>
        </div>
      </div>

      <GitPublishNotice visible={gitDirty} message="文章已改变但尚未提交 Git" />

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

function HomeFeaturedManager({ state, refresh, setSection }) {
  const [order, setOrder] = useState(state.orders.homeFeatured || []);
  const [dragIndex, setDragIndex] = useState(null);
  const [message, setMessage] = useState("");
  const publishedPosts = state.posts.filter((post) => post.status === "published");
  const postMap = new Map(publishedPosts.map((post) => [post.slug, post]));
  const featuredPosts = order.map((slug) => postMap.get(slug)).filter(Boolean);
  const featuredSet = new Set(featuredPosts.map((post) => post.slug));
  const availablePosts = publishedPosts.filter((post) => !featuredSet.has(post.slug));

  function updateOrder(from, to) {
    setOrder(moveItem(featuredPosts.map((post) => post.slug), from, to));
    setMessage("有未保存排序");
  }

  function dropOrder(to) {
    if (dragIndex === null || dragIndex === to) return;
    updateOrder(dragIndex, to);
    setDragIndex(null);
  }

  function addPost(slug) {
    setOrder([...featuredPosts.map((post) => post.slug), slug]);
    setMessage("有未保存排序");
  }

  function removePost(slug) {
    setOrder(featuredPosts.map((post) => post.slug).filter((item) => item !== slug));
    setMessage("有未保存排序");
  }

  async function saveOrder() {
    setMessage("保存中...");
    await api("/api/orders/home-featured", {
      method: "POST",
      body: JSON.stringify({ slugs: featuredPosts.map((post) => post.slug) })
    });
    await refresh();
    setMessage(`已保存首页推荐排序 · ${new Date().toLocaleTimeString()}`);
  }

  return (
    <main className="workspace">
      <div className="toolbar">
        <div>
          <strong>首页推荐</strong>
          <span>{message || "这里控制首页“推荐”视图的全局文章顺序，不影响专栏排序。"}</span>
        </div>
        <div className="actions">
          <button onClick={() => setSection("posts")}>回到文章</button>
          <button className="primary" onClick={saveOrder}>保存排序</button>
        </div>
      </div>

      <div className="split">
        <section>
          <h2>推荐中</h2>
          <p className="hint">拖动左侧手柄调整首页推荐顺序。</p>
          {featuredPosts.length === 0 && <p className="empty-state">暂无推荐文章，前台会回退显示最新文章。</p>}
          {featuredPosts.map((post, index) => (
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
              <button disabled={index === featuredPosts.length - 1} onClick={() => updateOrder(index, index + 1)}>下移</button>
              <button onClick={() => removePost(post.slug)}>移除</button>
            </div>
          ))}
        </section>
        <section>
          <h2>未推荐</h2>
          <p className="hint">添加到推荐不会删除或改变文章本身。</p>
          {availablePosts.map((post) => (
            <div className="add-row" key={post.slug}>
              <div>
                <strong>{post.title}</strong>
                <span>{columnName(state.columns, post.column)} · {post.publishedAt || "未发布"}</span>
              </div>
              <button onClick={() => addPost(post.slug)}>添加</button>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

function ColumnsManager({ state, refresh, setSection }) {
  const [columns, setColumns] = useState(() => attachColumnDraftIds(state.columns));
  const [orders, setOrders] = useState(state.orders.columns);
  const [active, setActive] = useState(state.columns[0]?.slug || "");
  const [dragIndex, setDragIndex] = useState(null);
  const [message, setMessage] = useState("");
  const [gitDirty, setGitDirty] = useState(false);
  const activeColumn = columns.find((column) => column.slug === active);
  const activePosts = state.posts.filter((post) => post.status === "published" && post.column === active);
  const orderedPosts = useMemo(() => {
    const order = orders[active] || [];
    const orderMap = new Map(order.map((slug, index) => [slug, index]));
    return [...activePosts].sort((a, b) => (orderMap.get(a.slug) ?? 9999) - (orderMap.get(b.slug) ?? 9999));
  }, [activePosts, orders, active]);

  async function saveColumns() {
    setMessage("保存中...");
    try {
      await api("/api/columns", { method: "POST", body: JSON.stringify({ columns: cleanColumns(columns) }) });
      await refresh();
      setGitDirty(true);
      setMessage(`已保存专栏 · ${new Date().toLocaleTimeString()} · 尚未提交 Git`);
    } catch (error) {
      setMessage(`保存失败：${error.message}`);
    }
  }

  async function saveOrder() {
    setMessage("保存中...");
    try {
      await api(`/api/orders/columns/${active}`, { method: "POST", body: JSON.stringify({ slugs: orderedPosts.map((post) => post.slug) }) });
      await refresh();
      setGitDirty(true);
      setMessage(`已保存排序 · ${new Date().toLocaleTimeString()} · 尚未提交 Git`);
    } catch (error) {
      setMessage(`保存失败：${error.message}`);
    }
  }

  async function deleteColumn(column) {
    if (!confirm(`确认删除专栏「${column.name || column.slug}」？文章不会被删除，只会变成未归类。`)) return;
    setMessage("删除中...");
    try {
      const result = await api(`/api/columns/${column.slug}`, { method: "DELETE" });
      const nextColumns = attachColumnDraftIds(result.state.columns);
      setColumns(nextColumns);
      setOrders(result.state.orders.columns);
      setActive((current) => current === column.slug ? nextColumns[0]?.slug || "" : current);
      await refresh();
      setGitDirty(true);
      setMessage(`已删除专栏 · ${new Date().toLocaleTimeString()} · 尚未提交 Git`);
    } catch (error) {
      setMessage(`删除失败：${error.message}`);
    }
  }

  function addColumn() {
    const nextColumn = { name: "新专栏", slug: `column-${Date.now()}`, description: "", _draftId: `column-draft-${columnDraftId += 1}` };
    setColumns([nextColumn, ...columns]);
    setActive(nextColumn.slug);
    setMessage("已新增专栏，记得保存");
  }

  function updateOrder(from, to) {
    const current = orderedPosts.map((post) => post.slug);
    setOrders({ ...orders, [active]: moveItem(current, from, to) });
    setMessage("有未保存排序");
  }

  function dropOrder(to) {
    if (dragIndex === null || dragIndex === to) return;
    updateOrder(dragIndex, to);
    setDragIndex(null);
  }

  return (
    <main className="workspace">
      <div className="toolbar">
        <div>
          <strong>专栏</strong>
          <span>{message || "管理专栏信息和专栏内部阅读顺序。"}</span>
        </div>
        <div className="actions">
          <button onClick={() => setSection("posts")}>回到文章</button>
          <button onClick={addColumn}>新增专栏</button>
          <button onClick={saveColumns}>保存专栏</button>
          <button className="primary" onClick={saveOrder}>保存排序</button>
        </div>
      </div>
      <GitPublishNotice visible={gitDirty} message="专栏有未提交改动" />
      <div className="split">
        <section>
          {columns.map((column, index) => (
            <div className="card" key={column._draftId}>
              <TextInput label="名称" value={column.name} onChange={(value) => {
                const next = [...columns];
                next[index] = { ...column, name: value };
                setColumns(next);
                setMessage("有未保存专栏修改");
              }} />
              <TextInput label="Slug" value={column.slug} onChange={(value) => {
                const next = [...columns];
                const previousSlug = column.slug;
                next[index] = { ...column, slug: value };
                setColumns(next);
                if (active === previousSlug) setActive(value);
                setOrders((current) => {
                  if (!previousSlug || previousSlug === value || !current[previousSlug]) return current;
                  const nextOrders = { ...current, [value]: current[previousSlug] };
                  delete nextOrders[previousSlug];
                  return nextOrders;
                });
                setMessage("有未保存专栏修改");
              }} />
              <TextInput label="描述" value={column.description} onChange={(value) => {
                const next = [...columns];
                next[index] = { ...column, description: value };
                setColumns(next);
                setMessage("有未保存专栏修改");
              }} />
              <div className="row-actions">
                <button onClick={() => setActive(column.slug)}>{active === column.slug ? "正在排序" : "排序此专栏"}</button>
                <button className="danger" onClick={() => deleteColumn(column)}>删除专栏</button>
              </div>
            </div>
          ))}
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
  const [message, setMessage] = useState("");
  const [gitDirty, setGitDirty] = useState(false);
  const keys = field === "library" ? ["title", "author"] : ["title", "author", "url", "source", "note", "savedAt"];

  function addRow() {
    setRows([Object.fromEntries(keys.map((key) => [key, ""])), ...rows]);
    setMessage("已新增一行，记得保存");
  }

  async function save() {
    setMessage("保存中...");
    await api(`/${field === "library" ? "api/library" : "api/archive"}`, {
      method: "POST",
      body: JSON.stringify({ [field]: rows })
    });
    await refresh();
    setMessage(`已保存 · ${new Date().toLocaleTimeString()}`);
    setGitDirty(true);
  }

  return (
    <main className="workspace">
      <div className="toolbar">
        <div>
          <strong>{title}</strong>
          <span>{message}</span>
        </div>
        <div className="actions">
          <button onClick={() => setSection("posts")}>回到文章</button>
          <button onClick={addRow}>新增</button>
          <button className="primary" onClick={save}>保存</button>
        </div>
      </div>
      <GitPublishNotice visible={gitDirty} message={`${title}有未提交改动`} />
      <div className="data-table">
        {rows.map((row, rowIndex) => (
          <div className="data-row" key={rowIndex}>
            {keys.map((key) => (
              <TextInput key={key} label={key} value={row[key]} onChange={(value) => {
                const next = [...rows];
                next[rowIndex] = { ...row, [key]: value };
                setRows(next);
                setMessage("有未保存修改");
              }} />
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}

function ArchiveManager({ state, refresh, setSection }) {
  const [rows, setRows] = useState(() => sortRecentFirst(state.archive));
  const [expandedRows, setExpandedRows] = useState(() => new Set());
  const [message, setMessage] = useState("");
  const [gitDirty, setGitDirty] = useState(false);

  function updateRow(index, key, value) {
    const next = [...rows];
    next[index] = { ...next[index], [key]: value };
    if (key === "title" && !next[index].slug) {
      const slug = slugify(value) || `archive-${Date.now()}`;
      next[index].slug = slug;
    }
    setRows(next);
    setMessage("有未保存修改");
  }

  function addExternalItem() {
    setRows([
      {
        title: "",
        author: "",
        url: "",
        source: "外部文章",
        note: "",
        savedAt: new Date().toISOString().slice(0, 10)
      },
      ...rows
    ]);
    setMessage("已新增外部链接资料，记得保存");
  }

  function addMarkdownItem() {
    const slug = `archive-${Date.now()}`;
    setRows([
      {
        title: "",
        author: "",
        slug,
        url: "",
        source: "本地原文",
        note: "",
        savedAt: new Date().toISOString().slice(0, 10),
        contentMarkdown: "# 标题\n\n在这里粘贴 Markdown 原文。"
      },
      ...rows
    ]);
    setExpandedRows(new Set([0]));
    setMessage("已展开 Markdown 原文框，上传后会生成前台阅读页");
  }

  function removeRow(index) {
    if (!confirm(`确认删除《${rows[index].title || "未命名资料"}》？`)) return;
    setRows(rows.filter((_row, rowIndex) => rowIndex !== index));
    setMessage("已删除，保存后生效");
  }

  function toggleMarkdown(index) {
    const next = new Set(expandedRows);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setExpandedRows(next);
  }

  async function save() {
    setMessage("保存中...");
    const archive = rows.map((row) => {
      if (!Object.prototype.hasOwnProperty.call(row, "contentMarkdown")) return row;
      return {
        ...row,
        slug: slugify(row.slug || row.title) || `archive-${Date.now()}`
      };
    });

    await api("/api/archive", {
      method: "POST",
      body: JSON.stringify({ archive })
    });
    setRows(archive);
    await refresh();
    setMessage(`已保存 · ${new Date().toLocaleTimeString()}`);
    setGitDirty(true);
  }

  return (
    <main className="workspace">
      <div className="toolbar">
        <div>
          <strong>资料存档</strong>
          <span>{message}</span>
        </div>
        <div className="actions">
          <button onClick={() => setSection("posts")}>回到文章</button>
          <button onClick={addExternalItem}>新增链接资料</button>
          <button onClick={addMarkdownItem}>上传原文资料</button>
          <button className="primary" onClick={save}>保存资料库</button>
        </div>
      </div>
      <GitPublishNotice visible={gitDirty} message="资料库有未提交改动" />

      <div className="data-table">
        {rows.map((row, rowIndex) => {
          const hasMarkdown = Object.prototype.hasOwnProperty.call(row, "contentMarkdown");
          return (
            <div className="data-row archive-editor-row" key={`${row.slug || row.url || "archive"}-${rowIndex}`}>
              <div className="archive-row-header">
                <strong>{row.title || "未命名资料"}</strong>
                <div className="actions">
                  <button onClick={() => {
                    if (!hasMarkdown) updateRow(rowIndex, "contentMarkdown", "# 标题\n\n在这里粘贴 Markdown 原文。");
                    toggleMarkdown(rowIndex);
                  }}>
                    {expandedRows.has(rowIndex) ? "收起原文" : hasMarkdown ? "编辑原文" : "添加原文"}
                  </button>
                  <button onClick={() => removeRow(rowIndex)}>删除</button>
                </div>
              </div>

              <div className="archive-fields">
                <TextInput label="标题" value={row.title} onChange={(value) => updateRow(rowIndex, "title", value)} />
                <TextInput label="作者" value={row.author} onChange={(value) => updateRow(rowIndex, "author", value)} />
                <TextInput label="Slug" value={row.slug} placeholder="仅本地原文需要" onChange={(value) => updateRow(rowIndex, "slug", value)} />
                <TextInput label="网址" value={row.url} placeholder="可留空" onChange={(value) => updateRow(rowIndex, "url", value)} />
                <TextInput label="来源" value={row.source} onChange={(value) => updateRow(rowIndex, "source", value)} />
                <TextInput label="保存日期" value={row.savedAt} onChange={(value) => updateRow(rowIndex, "savedAt", value)} />
              </div>

              <TextAreaInput
                label="备注"
                rows={3}
                value={row.note}
                onChange={(value) => updateRow(rowIndex, "note", value)}
              />

              {expandedRows.has(rowIndex) && (
                <TextAreaInput
                  label="Markdown 原文"
                  rows={14}
                  value={row.contentMarkdown}
                  placeholder="# 标题\n\n在这里粘贴 Markdown 原文。"
                  onChange={(value) => updateRow(rowIndex, "contentMarkdown", value)}
                />
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

function App() {
  const [state, setState] = useState(null);
  const [section, setSection] = useState("posts");
  const [postsView, setPostsView] = useState("list");
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
      <Sidebar
        state={state}
        section={section}
        setSection={setSection}
        setPostsView={setPostsView}
        setSelectedSlug={setSelectedSlug}
      />
      {section === "posts" && (
        <PostsManager
          state={state}
          refresh={refresh}
          selectedSlug={selectedSlug}
          setSelectedSlug={setSelectedSlug}
          postsView={postsView}
          setPostsView={setPostsView}
          setSection={setSection}
        />
      )}
      {section === "homeFeatured" && <HomeFeaturedManager state={state} refresh={refresh} setSection={setSection} />}
      {section === "columns" && <ColumnsManager state={state} refresh={refresh} setSection={setSection} />}
      {section === "archive" && <ArchiveManager state={state} refresh={refresh} setSection={setSection} />}
      {section === "library" && <JsonListManager title="图书馆" field="library" state={state} refresh={refresh} setSection={setSection} />}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
