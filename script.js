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
        ["问题背景", "校园创业项目希望连接本地农户与消费者。在继续开发功能之前，团队需要先判断农户和消费者是否有真实需求，以及成本与定价能否支撑平台持续运行。"],
        ["我的职责", "担任财务负责人，负责项目成本测算与定价策略，撰写商业计划书中的财务分析部分，并参与用户调研和试运行数据整理。"],
        ["分析与推进", "设计并发放 150 份问卷，使用 Excel 回收、清洗和统计调研结果；对接 3 家本地农户，记录 50+ 笔交易，用成本、价格和交易数据检查项目假设。"],
        ["阶段结果", "形成可用于项目讨论的需求梳理、成本测算和定价依据，支撑平台功能收敛与试运行验证。财务分析结果同时用于商业计划书和项目决策。"]
      ],
      tags: ["用户调研", "Excel", "数据清洗", "成本测算", "定价分析"]
    },
    budget: {
      kicker: "02 / DATA VISUALIZATION",
      title: "校园活动预算分析",
      sections: [
        ["问题背景", "校级活动经费规模有限，采购、执行和报销又涉及多个环节。如果只记录最终支出，就难以及时发现超支风险，也不方便复盘资源是否真正支持了活动目标。"],
        ["我的职责", "负责部门 2000 元活动经费的预算编制和支出管理，参与报销审核，并与活动执行环节同步采购和费用信息。"],
        ["执行方法", "按用途拆分预算，在采购前进行多方比价并记录价格依据；支出过程中跟踪实际金额，保留机动空间，确保预算既能够执行，也能够接受复核。"],
        ["工作结果", "在保障活动正常开展的前提下节省约 15% 采购支出，并形成预算、采购与报销之间的对应关系，提高经费使用的可追踪性。"]
      ],
      tags: ["预算编制", "报销审核", "比价采购", "成本控制", "Excel"]
    },
    business: {
      kicker: "03 / BUSINESS PRACTICE",
      title: "校园摆摊调酒经营",
      sections: [
        ["经营背景", "校园摆摊需要同时兼顾采购成本、出摊安排、现场沟通和客户反馈。项目规模不大，但采购判断、定价和复购会直接影响最终利润。"],
        ["我的职责", "负责材料采购和成本规划，参与销售路线与出摊安排，与客户沟通并开展购买后回访，根据反馈调整后续经营。"],
        ["执行方法", "在采购阶段控制材料成本，在销售阶段根据现场需求安排产品与销售节奏；通过回访了解客户反馈，关注复购机会而不是只完成单次交易。"],
        ["经营结果", "项目实现盈利 3000 余元，并积累复购客户。这段经历集中锻炼了成本意识、客户沟通和持续跟进能力，也与销售运营岗位的工作方式直接相关。"]
      ],
      tags: ["客户沟通", "采购管理", "成本规划", "销售安排", "复购维护"]
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
          .join("") + (project.tags?.length
            ? `<div class="dialog-tags">${project.tags.map((tag) => `<span>${tag}</span>`).join("")}</div>`
            : "");
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
