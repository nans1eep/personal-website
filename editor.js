(() => {
  "use strict";

  const form = document.querySelector("#article-form");

  if (!form) return;

  const status = document.querySelector("#editor-status");
  const preview = document.querySelector("#editor-preview");
  const coverInput = document.querySelector("#cover-file");
  const coverPreview = document.querySelector("#cover-preview");
  const articleFileInput = document.querySelector("#article-file");
  const today = new Date();
  const localDate = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
  ].join("-");
  let coverData = "";
  let currentArticleId = "";

  form.elements.date.value = localDate;

  const escapeHtml = (value = "") =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const setStatus = (message, type = "") => {
    status.textContent = message;
    status.dataset.type = type;
  };

  const getDrafts = () => {
    try {
      return JSON.parse(localStorage.getItem("portfolioArticleDrafts") || "{}");
    } catch {
      return {};
    }
  };

  const categoryFilters = {
    "财务实践": "finance",
    "数据分析": "data",
    "数据表达": "data",
    "AI 应用": "ai",
    "学习记录": "ai"
  };

  const defaultCovers = {
    "财务实践": "assets/images/article-budget.svg",
    "数据分析": "assets/images/article-market.svg",
    "数据表达": "assets/images/article-numbers.svg",
    "AI 应用": "assets/images/article-ai.svg",
    "学习记录": "assets/images/article-ai.svg"
  };

  function inlineMarkdown(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");
  }

  function markdownToHtml(source) {
    const lines = source.replace(/\r/g, "").split("\n");
    const output = [];
    let listOpen = false;

    const closeList = () => {
      if (!listOpen) return;
      output.push("</ul>");
      listOpen = false;
    };

    lines.forEach((rawLine) => {
      const line = rawLine.trim();

      if (!line || /^#\s+/.test(line)) {
        closeList();
        return;
      }

      if (/^##\s+/.test(line)) {
        closeList();
        output.push(`<h2>${inlineMarkdown(line.replace(/^##\s+/, ""))}</h2>`);
        return;
      }

      if (/^>\s+/.test(line)) {
        closeList();
        output.push(`<blockquote>${inlineMarkdown(line.replace(/^>\s+/, ""))}</blockquote>`);
        return;
      }

      if (/^[-*]\s+/.test(line)) {
        if (!listOpen) {
          output.push("<ul>");
          listOpen = true;
        }
        output.push(`<li>${inlineMarkdown(line.replace(/^[-*]\s+/, ""))}</li>`);
        return;
      }

      closeList();
      output.push(`<p>${inlineMarkdown(line)}</p>`);
    });

    closeList();
    return output.join("\n");
  }

  function articleFromForm() {
    const data = new FormData(form);
    const title = String(data.get("title") || "").trim();
    const bodySource = String(data.get("body") || "").trim();
    const date = String(data.get("date") || localDate);
    const category = String(data.get("category") || "学习记录");

    if (!title) throw new Error("请先填写文章标题。");
    if (!bodySource) throw new Error("请先填写文章正文。");

    const article = {
      title,
      category,
      filter: categoryFilters[category] || "other",
      date: date.replaceAll("-", "."),
      datetime: date,
      readTime: String(data.get("readTime") || "阅读文章").trim(),
      cover: coverData || defaultCovers[category] || "assets/images/article-numbers.svg",
      deck: String(data.get("deck") || "").trim(),
      body: markdownToHtml(bodySource)
    };

    return { article, bodySource };
  }

  function renderPreview(article) {
    preview.innerHTML = `
      <div class="editor-preview-cover">
        <img src="${escapeHtml(article.cover)}" alt="${escapeHtml(article.title)}文章封面">
      </div>
      <div class="article-meta">
        <span>${escapeHtml(article.category)}</span>
        <time datetime="${escapeHtml(article.datetime)}">${escapeHtml(article.date)}</time>
        <span>${escapeHtml(article.readTime)}</span>
      </div>
      <h2>${escapeHtml(article.title)}</h2>
      <p class="editor-preview-deck">${escapeHtml(article.deck)}</p>
      <div class="article-body editor-preview-body">${article.body}</div>
    `;
  }

  function updatePreview() {
    try {
      const { article } = articleFromForm();
      renderPreview(article);
      setStatus("预览已更新。", "success");
      return article;
    } catch (error) {
      setStatus(error.message, "error");
      return null;
    }
  }

  function saveDraft(article) {
    if (!currentArticleId) currentArticleId = `article-${Date.now()}`;
    const drafts = getDrafts();
    drafts[currentArticleId] = article;
    localStorage.setItem("portfolioArticleDrafts", JSON.stringify(drafts));
    window.siteArticles = { ...(window.siteArticles || {}), [currentArticleId]: article };
  }

  function combinedArticles(article) {
    const allArticles = { ...(window.siteArticles || {}), ...getDrafts() };
    if (article) {
      if (!currentArticleId) currentArticleId = `article-${Date.now()}`;
      allArticles[currentArticleId] = article;
    }
    return allArticles;
  }

  function serializeArticles(articles) {
    return `window.siteArticles = ${JSON.stringify(articles, null, 2)};\n`;
  }

  function downloadData(articles) {
    const blob = new Blob([serializeArticles(articles)], {
      type: "text/javascript;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "articles-data.js";
    link.click();
    URL.revokeObjectURL(url);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    updatePreview();
  });

  document.querySelector("#save-draft").addEventListener("click", () => {
    const article = updatePreview();
    if (!article) return;
    saveDraft(article);
    setStatus("草稿已保存到当前浏览器，现在可以前往文章页查看。", "success");
  });

  document.querySelector("#download-data").addEventListener("click", () => {
    const article = updatePreview();
    if (!article) return;
    saveDraft(article);
    downloadData(combinedArticles(article));
    setStatus("文章数据已下载。用下载的文件替换项目根目录中的 articles-data.js。", "success");
  });

  document.querySelector("#write-site-file").addEventListener("click", async () => {
    const article = updatePreview();
    if (!article) return;
    saveDraft(article);
    const content = serializeArticles(combinedArticles(article));

    if ("showSaveFilePicker" in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: "articles-data.js",
          types: [{ description: "JavaScript 数据文件", accept: { "text/javascript": [".js"] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        setStatus("文章数据已保存。请刷新文章页确认显示，再上传更新后的网站文件。", "success");
        return;
      } catch (error) {
        if (error.name === "AbortError") {
          setStatus("已取消文件保存。", "");
          return;
        }
      }
    }

    downloadData(combinedArticles(article));
    setStatus("当前浏览器不支持直接写入，文章数据已改为下载。", "success");
  });

  articleFileInput.addEventListener("change", async () => {
    const file = articleFileInput.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.replace(/\r/g, "").split("\n");
      const firstContentIndex = lines.findIndex((line) => line.trim());
      if (firstContentIndex >= 0 && /^#\s+/.test(lines[firstContentIndex].trim())) {
        form.elements.title.value = lines[firstContentIndex].replace(/^#\s+/, "").trim();
        lines.splice(firstContentIndex, 1);
      }
      form.elements.body.value = lines.join("\n").trim();
      updatePreview();
      setStatus(`已导入 ${file.name}。`, "success");
    } catch {
      setStatus("无法读取这个文件，请确认它是 Markdown 或纯文本。", "error");
    }
  });

  coverInput.addEventListener("change", async () => {
    const file = coverInput.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const image = await new Promise((resolve, reject) => {
        const loadedImage = new Image();
        loadedImage.onload = () => resolve(loadedImage);
        loadedImage.onerror = reject;
        loadedImage.src = dataUrl;
      });
      const maxWidth = 1200;
      const scale = Math.min(1, maxWidth / image.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      coverData = canvas.toDataURL("image/jpeg", 0.82);
      coverPreview.querySelector("img").src = coverData;
      coverPreview.hidden = false;
      setStatus(`已添加封面 ${file.name}。`, "success");
    } catch {
      setStatus("无法读取这张封面图片。", "error");
    }
  });

  form.addEventListener("input", () => {
    setStatus("");
  });
})();
