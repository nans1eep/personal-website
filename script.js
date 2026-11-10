(() => {
  "use strict";

  const navToggle = document.querySelector(".nav-toggle");
  const primaryNav = document.querySelector(".primary-nav");

  if (navToggle && primaryNav) {
    const setMenu = (open) => {
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.querySelector(".sr-only").textContent = open ? "关闭导航菜单" : "打开导航菜单";
      primaryNav.classList.toggle("is-open", open);
    };

    navToggle.addEventListener("click", () => {
      setMenu(navToggle.getAttribute("aria-expanded") !== "true");
    });

    primaryNav.addEventListener("click", (event) => {
      if (event.target.closest("a")) setMenu(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setMenu(false);
        navToggle.focus();
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 820) setMenu(false);
    });
  }

  document.querySelectorAll("[data-current-year]").forEach((element) => {
    element.textContent = String(new Date().getFullYear());
  });

  try {
    const savedDrafts = JSON.parse(localStorage.getItem("portfolioArticleDrafts") || "{}");
    window.siteArticles = { ...(window.siteArticles || {}), ...savedDrafts };
  } catch {
    window.siteArticles = window.siteArticles || {};
  }

  const escapeHtml = (value = "") =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const articleList = document.querySelector("#article-list");

  if (articleList) {
    const categoryFilters = {
      "财务实践": "finance",
      "数据分析": "data",
      "数据表达": "data",
      "AI 应用": "ai",
      "学习记录": "ai"
    };
    const entries = Object.entries(window.siteArticles || {})
      .filter(([, article]) => article && article.title)
      .sort(([, first], [, second]) => {
        return new Date(second.datetime || 0) - new Date(first.datetime || 0);
      });
    const leadArticle = document.querySelector("#lead-article");
    const articleEmpty = document.querySelector("#article-empty");
    const filterBar = document.querySelector("#article-filters");

    if (entries.length === 0) {
      articleEmpty.hidden = false;
      filterBar.hidden = true;
    } else {
      articleEmpty.hidden = true;
      filterBar.hidden = false;

      if (leadArticle) {
        const [leadId, lead] = entries[0];
        leadArticle.hidden = false;
        leadArticle.href = `article.html?post=${encodeURIComponent(leadId)}`;
        leadArticle.innerHTML = `
          <figure>
            <img src="${escapeHtml(lead.cover || "assets/images/article-numbers.svg")}" alt="${escapeHtml(lead.title)}文章封面" width="1200" height="800">
          </figure>
          <div class="lead-article-copy">
            <div class="article-meta">
              <span>${escapeHtml(lead.category)}</span>
              <time datetime="${escapeHtml(lead.datetime)}">${escapeHtml(lead.date)}</time>
              <span>${escapeHtml(lead.readTime || "阅读文章")}</span>
            </div>
            <h2>${escapeHtml(lead.title)}</h2>
            <p>${escapeHtml(lead.deck || "")}</p>
            <span class="article-link">阅读全文 <span aria-hidden="true">↗</span></span>
          </div>
        `;
      }

      articleList.innerHTML = entries
        .map(([id, article]) => {
          const filter = article.filter || categoryFilters[article.category] || "other";
          return `
            <a class="article-row reveal" href="article.html?post=${encodeURIComponent(id)}" data-category="${escapeHtml(filter)}">
              <figure class="article-row-cover">
                <img src="${escapeHtml(article.cover || "assets/images/article-numbers.svg")}" alt="${escapeHtml(article.title)}文章封面" width="900" height="700">
              </figure>
              <time datetime="${escapeHtml(article.datetime)}">${escapeHtml(article.date)}</time>
              <div class="article-row-main">
                <span class="article-category">${escapeHtml(article.category)}</span>
                <h3>${escapeHtml(article.title)}</h3>
                <p>${escapeHtml(article.deck || "")}</p>
              </div>
              <span class="article-row-arrow" aria-hidden="true">↗</span>
            </a>
          `;
        })
        .join("");
    }
  }

  const homeArticleCards = document.querySelectorAll("[data-home-article-slot]");

  if (homeArticleCards.length) {
    const latestArticles = Object.entries(window.siteArticles || {})
      .filter(([, article]) => article && article.title)
      .sort(([, first], [, second]) => {
        return new Date(second.datetime || 0) - new Date(first.datetime || 0);
      });

    homeArticleCards.forEach((card, index) => {
      const entry = latestArticles[index];
      if (!entry) {
        card.hidden = true;
        return;
      }

      const [id, article] = entry;
      const cover = card.querySelector("[data-home-article-cover]");
      const kicker = card.querySelector("[data-home-article-kicker]");
      const title = card.querySelector("[data-home-article-title]");

      card.href = `article.html?post=${encodeURIComponent(id)}`;
      if (cover) {
        cover.src = article.cover || "assets/images/article-numbers.svg";
        cover.alt = `${article.title}文章封面`;
      }
      if (kicker) kicker.textContent = `${article.category} · ${article.date}`;
      if (title) title.textContent = article.title;
    });
  }

  const revealItems = document.querySelectorAll(".reveal");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  } else {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -30px" }
    );
    revealItems.forEach((item) => revealObserver.observe(item));
  }

  const filterButtons = document.querySelectorAll("[data-filter]");
  const articleRows = document.querySelectorAll(".article-row[data-category]");
  const emptyState = document.querySelector(".filter-empty");

  if (filterButtons.length && articleRows.length) {
    filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const filter = button.dataset.filter;
        let visibleCount = 0;

        filterButtons.forEach((item) => {
          const active = item === button;
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-pressed", String(active));
        });

        articleRows.forEach((row) => {
          const visible = filter === "all" || row.dataset.category === filter;
          row.hidden = !visible;
          if (visible) visibleCount += 1;
        });

        if (emptyState) emptyState.hidden = visibleCount > 0;
      });
    });
  }

  const articleRoot = document.querySelector("#article-root");

  if (articleRoot && window.siteArticles) {
    const postId = new URLSearchParams(window.location.search).get("post") || "budget";
    const post = window.siteArticles[postId];

    if (post) {
      document.title = `${post.title}｜王铄然`;
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) metaDescription.setAttribute("content", post.deck);
      const openGraphTitle = document.querySelector('meta[property="og:title"]');
      const openGraphDescription = document.querySelector('meta[property="og:description"]');
      if (openGraphTitle) openGraphTitle.setAttribute("content", post.title);
      if (openGraphDescription) openGraphDescription.setAttribute("content", post.deck);

      articleRoot.innerHTML = `
        <header class="article-hero">
          <div class="article-meta">
            <span>${escapeHtml(post.category)}</span>
            <time datetime="${escapeHtml(post.datetime)}">${escapeHtml(post.date)}</time>
            <span>${escapeHtml(post.readTime)}</span>
          </div>
          <h1>${escapeHtml(post.title)}</h1>
          <p class="article-deck">${escapeHtml(post.deck)}</p>
        </header>
        <figure class="article-cover">
          <img src="${escapeHtml(post.cover)}" alt="${escapeHtml(post.title)}文章封面" width="1200" height="800">
        </figure>
        <div class="article-body">${post.body}</div>
      `;
      articleRoot.setAttribute("aria-busy", "false");
    } else {
      document.title = "文章未找到｜王铄然";
      articleRoot.innerHTML = `
        <div class="article-loading section-shell">
          <p class="eyebrow">404 / NOT FOUND</p>
          <h1>这篇文章还在路上。</h1>
          <p class="hero-intro">页面链接可能已经更新，请返回文章列表继续浏览。</p>
          <p style="margin-top: 30px"><a class="text-link" href="articles.html">返回文章列表 →</a></p>
        </div>
      `;
    }
  }

  const projectDialog = document.querySelector("#project-dialog");
  const projectButtons = document.querySelectorAll("[data-project]");
  const dialogTitle = document.querySelector("#dialog-title");
  const dialogKicker = document.querySelector("#dialog-kicker");
  const dialogBody = document.querySelector("#dialog-body");

  const projects = {
    market: {
      kicker: "01 / ENTREPRENEURSHIP",
      title: "农特产销售互换平台",
      sections: [
        ["项目问题", "校园创业项目希望连接本地农户与消费者，但平台模式是否成立，需要用成本和真实需求来验证。"],
        ["我的工作", "担任财务负责人，参与成本测算、定价策略、商业计划书财务分析、问卷设计与试运行数据分析。"],
        ["阶段结果", "回收并分析 150 份问卷，对接 3 家本地农户，记录 50+ 笔试运行交易，为产品功能收敛提供依据。"]
      ]
    },
    budget: {
      kicker: "02 / DATA VISUALIZATION",
      title: "校园活动预算分析",
      sections: [
        ["项目问题", "活动预算往往只被当作报销依据，缺少可用于比较、追踪与复盘的结构。"],
        ["我的工作", "按场地、物料、传播等类别拆分预算，整理计划与实际差异，并用可视化方式突出资源分配和风险缓冲。"],
        ["分析重点", "关注预算结构、支出偏差与机动资金，让不同方案之间具备更清晰的比较依据。"]
      ]
    },
    ai: {
      kicker: "03 / AI WORKFLOW",
      title: "个人研究与整理助手",
      sections: [
        ["项目问题", "资料分散、重复整理耗时，AI 的回答也容易出现事实偏差，需要一套可检查的协作流程。"],
        ["我的工作", "把任务拆成资料收集、信息提炼、交叉核验和表达优化，并通过提示词模板记录可复用的上下文。"],
        ["当前阶段", "仍处于个人学习和小范围试用阶段，公开页只展示方法，不虚构效率提升比例或商业成果。"]
      ]
    }
  };

  if (projectDialog && dialogTitle && dialogKicker && dialogBody) {
    projectButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const project = projects[button.dataset.project];
        if (!project) return;

        dialogKicker.textContent = project.kicker;
        dialogTitle.textContent = project.title;
        dialogBody.innerHTML = project.sections
          .map(([heading, text]) => `<h3>${heading}</h3><p>${text}</p>`)
          .join("");
        projectDialog.showModal();
      });
    });

    const closeButton = projectDialog.querySelector(".dialog-close");
    closeButton?.addEventListener("click", () => projectDialog.close());

    projectDialog.addEventListener("click", (event) => {
      if (event.target === projectDialog) projectDialog.close();
    });
  }

  const copyButtons = document.querySelectorAll("[data-copy-value]");

  copyButtons.forEach((copyButton) => {
    copyButton.addEventListener("click", async () => {
      const value = copyButton.dataset.copyValue;
      const originalText = copyButton.textContent;

      try {
        await navigator.clipboard.writeText(value);
        copyButton.textContent = "已复制";
        window.setTimeout(() => {
          copyButton.textContent = originalText;
        }, 1800);
      } catch {
        window.prompt("请手动复制以下内容：", value);
      }
    });
  });
})();
