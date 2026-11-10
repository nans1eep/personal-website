(() => {
  "use strict";

  const dropZone = document.querySelector("#drop-zone");

  if (!dropZone) return;

  const fileInput = document.querySelector("#csv-file");
  const mappingPanel = document.querySelector("#mapping-panel");
  const resultsPanel = document.querySelector("#tool-results");
  const statusElement = document.querySelector("#tool-status");
  const tableBody = document.querySelector("#finance-table-body");
  const exportCleanButton = document.querySelector("#export-clean");
  const exportSummaryButton = document.querySelector("#export-summary");
  const excludeDuplicates = document.querySelector("#exclude-duplicates");
  const onlyErrors = document.querySelector("#only-errors");
  const filterStart = document.querySelector("#filter-start");
  const filterEnd = document.querySelector("#filter-end");
  const filterSearch = document.querySelector("#filter-search");
  const monthNames = Array.from({ length: 12 }, (_, index) => `${index + 1}月`);
  const currencyFormatter = new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  let source = { name: "", headers: [], rows: [] };
  let normalizedRows = [];
  let visibleRows = [];

  const sampleCsv = `日期,摘要,分类,账户,收支类型,金额
2026-01-05,客户回款,销售收入,基本户,收入,"18,000.00"
2026-01-08,包装材料采购,采购成本,基本户,支出,"2,600.00"
2026-01-18,物流配送费,物流费用,基本户,支出,"1,200.00"
2026-02-03,项目服务收入,销售收入,基本户,收入,"22,000.00"
2026-02-07,原料采购,采购成本,基本户,支出,"3,100.00"
2026-02-15,临时仓储费,仓储费用,基本户,支出,800
2026-03-02,客户回款,销售收入,基本户,收入,"16,000.00"
2026-03-05,原料采购,采购成本,基本户,支出,"4,200.00"
2026-03-08,包装材料采购,采购成本,基本户,支出,"2,600.00"
2026-03-12,办公用品,管理费用,基本户,支出,950
2026-03-28,临时配送,物流费用,基本户,支出,600
2026-03-08,包装材料采购,采购成本,基本户,支出,"2,600.00"
待确认,异常日期记录,其他支出,基本户,支出,300
2026-03-31,零金额测试,其他支出,基本户,支出,0`;

  const mappingSynonyms = {
    date: ["记账日期", "交易日期", "发生日期", "日期", "date", "时间"],
    description: ["交易摘要", "摘要", "说明", "用途", "备注", "对方户名", "description", "memo"],
    category: ["费用类型", "交易分类", "分类", "类别", "会计科目", "科目", "category"],
    account: ["银行账户", "资金账户", "账户", "account"],
    amount: ["交易金额", "发生金额", "金额（元）", "金额(元)", "金额", "amount"],
    direction: ["收支类型", "借贷标志", "交易类型", "收支方向", "direction", "type"],
    income: ["贷方金额", "收入金额", "收入", "贷方", "入账金额", "credit", "income"],
    expense: ["借方金额", "支出金额", "支出", "借方", "出账金额", "debit", "expense"]
  };

  const fieldLabels = {
    date: "日期",
    description: "摘要",
    category: "分类",
    account: "账户",
    amount: "金额",
    direction: "收支类型",
    income: "收入 / 贷方",
    expense: "支出 / 借方"
  };

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setStatus(message, type = "") {
    statusElement.textContent = message;
    statusElement.dataset.type = type;
  }

  function normalizeHeader(value) {
    return String(value)
      .trim()
      .toLowerCase()
      .replace(/[\s_./\\：:（）()【】\[\]-]/g, "");
  }

  function detectDelimiter(text) {
    const candidates = [",", "\t", ";"];
    const counts = Object.fromEntries(candidates.map((candidate) => [candidate, 0]));
    let inQuotes = false;

    for (let index = 0; index < text.length && index < 5000; index += 1) {
      const character = text[index];
      if (character === '"') {
        if (inQuotes && text[index + 1] === '"') {
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (!inQuotes && (character === "\n" || character === "\r")) break;
      if (!inQuotes && candidates.includes(character)) counts[character] += 1;
    }

    return candidates.reduce((best, candidate) => {
      return counts[candidate] > counts[best] ? candidate : best;
    }, ",");
  }

  function parseDelimited(text) {
    const delimiter = detectDelimiter(text);
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];

      if (character === '"') {
        if (inQuotes && text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (!inQuotes && character === delimiter) {
        row.push(cell);
        cell = "";
        continue;
      }

      if (!inQuotes && (character === "\n" || character === "\r")) {
        if (character === "\r" && text[index + 1] === "\n") index += 1;
        row.push(cell);
        if (row.some((value) => value.trim())) rows.push(row);
        row = [];
        cell = "";
        continue;
      }

      cell += character;
    }

    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);

    if (rows.length < 2) throw new Error("文件中没有可分析的数据行。");

    const usedHeaders = new Map();
    const headers = rows[0].map((header, index) => {
      const base = header.trim() || `列${index + 1}`;
      const count = usedHeaders.get(base) || 0;
      usedHeaders.set(base, count + 1);
      return count === 0 ? base : `${base}_${count + 1}`;
    });

    const records = rows.slice(1).map((values) => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = (values[index] || "").trim();
      });
      return record;
    });

    return { headers, records };
  }

  function autoMap(headers) {
    const mapping = {};
    Object.entries(mappingSynonyms).forEach(([field, synonyms]) => {
      const match = headers.find((header) => {
        const normalized = normalizeHeader(header);
        return synonyms.some((synonym) => {
          const candidate = normalizeHeader(synonym);
          return normalized === candidate || normalized.includes(candidate);
        });
      });
      mapping[field] = match || "";
    });
    return mapping;
  }

  function renderMapping(headers, suggested) {
    mappingPanel.querySelectorAll("[data-map]").forEach((select) => {
      const field = select.dataset.map;
      select.innerHTML = [
        '<option value="">未使用</option>',
        ...headers.map((header) => `<option value="${escapeHtml(header)}">${escapeHtml(header)}</option>`)
      ].join("");
      select.value = suggested[field] || "";
    });
    mappingPanel.hidden = false;
  }

  function currentMapping() {
    return Object.fromEntries(
      [...mappingPanel.querySelectorAll("[data-map]")].map((select) => [select.dataset.map, select.value])
    );
  }

  function parseAmount(value) {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    let text = String(value)
      .trim()
      .replace(/[¥￥$,\s]/g, "")
      .replace(/元$/, "");
    let negative = false;

    if (/^\(.*\)$/.test(text)) {
      negative = true;
      text = text.slice(1, -1);
    }

    const amount = Number.parseFloat(text);
    if (!Number.isFinite(amount)) return null;
    return negative ? -Math.abs(amount) : amount;
  }

  function parseDate(value) {
    const text = String(value || "").trim();
    if (!text) return null;

    if (/^\d{5}(\.\d+)?$/.test(text)) {
      const serial = Number.parseFloat(text);
      if (serial > 20000 && serial < 80000) {
        const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
        return date.toISOString().slice(0, 10);
      }
    }

    let match = text.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!match) {
      match = text.match(/^(\d{4})[年./-](\d{1,2})[月./-](\d{1,2})/);
    }
    if (!match) {
      const western = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
      if (western) match = [null, western[3], western[1], western[2]];
    }
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return date.toISOString().slice(0, 10);
  }

  function normalizeDirection(value) {
    const text = String(value || "").trim().toLowerCase();
    if (!text) return "";
    if (/收入|收款|入账|贷方|credit|income|^in$/.test(text)) return "income";
    if (/支出|付款|出账|借方|debit|expense|^out$/.test(text)) return "expense";
    return "";
  }

  function createRecord(row, mapping, index, duplicateKeys) {
    const rawDate = mapping.date ? row[mapping.date] : "";
    const date = parseDate(rawDate);
    const description = mapping.description ? row[mapping.description].trim() : "";
    const category = (mapping.category ? row[mapping.category].trim() : "") || "未分类";
    const account = (mapping.account ? row[mapping.account].trim() : "") || "未指定";
    const errors = [];
    const warnings = [];
    let income = 0;
    let expense = 0;

    if (!date) errors.push("日期无法识别");
    if (!description) warnings.push("缺少摘要");
    if (!mapping.category || !row[mapping.category]?.trim()) warnings.push("缺少分类");

    const hasSplitAmount = Boolean(mapping.income || mapping.expense);
    if (hasSplitAmount) {
      const incomeValue = mapping.income ? row[mapping.income] : "";
      const expenseValue = mapping.expense ? row[mapping.expense] : "";
      const parsedIncome = incomeValue?.trim() ? parseAmount(incomeValue) : 0;
      const parsedExpense = expenseValue?.trim() ? parseAmount(expenseValue) : 0;

      if (parsedIncome === null) errors.push("收入金额无效");
      if (parsedExpense === null) errors.push("支出金额无效");
      income = Math.abs(parsedIncome || 0);
      expense = Math.abs(parsedExpense || 0);
    } else if (mapping.amount) {
      const amount = parseAmount(row[mapping.amount]);
      const direction = normalizeDirection(mapping.direction ? row[mapping.direction] : "");

      if (amount === null) {
        errors.push("金额无效");
      } else if (direction === "income") {
        income = Math.abs(amount);
      } else if (direction === "expense") {
        expense = Math.abs(amount);
      } else if (amount < 0) {
        expense = Math.abs(amount);
      } else {
        income = amount;
      }
    } else {
      errors.push("尚未指定金额字段");
    }

    const net = income - expense;
    if (!errors.length && Math.abs(net) < 0.005) {
      errors.push("金额为零");
    }

    const duplicateKey = date
      ? [date, description, category, account, net.toFixed(2)].join("|")
      : "";
    let isDuplicate = false;
    if (duplicateKey && !errors.length) {
      if (duplicateKeys.has(duplicateKey)) {
        isDuplicate = true;
        warnings.push("疑似重复记录");
      } else {
        duplicateKeys.add(duplicateKey);
      }
    }

    return {
      index: index + 1,
      date: date || String(rawDate || ""),
      validDate: Boolean(date),
      description: description || "未填写摘要",
      category,
      account,
      income,
      expense,
      net,
      direction: net >= 0 ? "收入" : "支出",
      errors,
      warnings,
      isDuplicate,
      valid: errors.length === 0
    };
  }

  function analyze() {
    const mapping = currentMapping();

    if (!mapping.date) {
      setStatus("请选择日期字段后再分析。", "error");
      resultsPanel.hidden = true;
      return;
    }
    if (!mapping.amount && !mapping.income && !mapping.expense) {
      setStatus("请选择金额字段，或收入/支出字段后再分析。", "error");
      resultsPanel.hidden = true;
      return;
    }

    const duplicateKeys = new Set();
    normalizedRows = source.rows.map((row, index) => createRecord(row, mapping, index, duplicateKeys));
    resultsPanel.hidden = false;

    const validDates = normalizedRows.filter((row) => row.validDate).map((row) => row.date).sort();
    filterStart.min = validDates[0] || "";
    filterStart.max = validDates.at(-1) || "";
    filterEnd.min = validDates[0] || "";
    filterEnd.max = validDates.at(-1) || "";

    updateView();
    setStatus(`已分析 ${normalizedRows.length} 条记录。`, "success");
  }

  function getFilteredRows(forAnalysis = false) {
    const start = filterStart.value;
    const end = filterEnd.value;
    const keyword = filterSearch.value.trim().toLowerCase();

    return normalizedRows.filter((row) => {
      if (forAnalysis && (!row.valid || (excludeDuplicates.checked && row.isDuplicate))) return false;
      if (onlyErrors.checked && row.valid && !row.isDuplicate) return false;
      if (row.validDate && start && row.date < start) return false;
      if (row.validDate && end && row.date > end) return false;
      if (excludeDuplicates.checked && row.isDuplicate) return false;
      if (keyword) {
        const haystack = `${row.description} ${row.category} ${row.account}`.toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    });
  }

  function formatCurrency(value) {
    return currencyFormatter.format(value);
  }

  function updateView() {
    const validRows = normalizedRows.filter((row) => row.valid);
    const duplicateCount = normalizedRows.filter((row) => row.isDuplicate).length;
    const errorCount = normalizedRows.filter((row) => !row.valid).length;
    document.querySelector("#stat-total").textContent = String(normalizedRows.length);
    document.querySelector("#stat-valid").textContent = String(validRows.length - duplicateCount);
    document.querySelector("#stat-duplicate").textContent = String(duplicateCount);
    document.querySelector("#stat-error").textContent = String(errorCount);

    const analysisRows = getFilteredRows(true);
    const incomeRows = analysisRows.filter((row) => row.income > 0);
    const expenseRows = analysisRows.filter((row) => row.expense > 0);
    const totalIncome = incomeRows.reduce((sum, row) => sum + row.income, 0);
    const totalExpense = expenseRows.reduce((sum, row) => sum + row.expense, 0);
    const net = totalIncome - totalExpense;
    const turnover = totalIncome + totalExpense;

    document.querySelector("#kpi-income").textContent = formatCurrency(totalIncome);
    document.querySelector("#kpi-expense").textContent = formatCurrency(totalExpense);
    document.querySelector("#kpi-net").textContent = formatCurrency(net);
    document.querySelector("#kpi-average").textContent = formatCurrency(
      analysisRows.length ? turnover / analysisRows.length : 0
    );
    document.querySelector("#kpi-income-count").textContent = `${incomeRows.length} 笔收入`;
    document.querySelector("#kpi-expense-count").textContent = `${expenseRows.length} 笔支出`;
    document.querySelector("#kpi-margin").textContent = totalIncome
      ? `净现金流率 ${((net / totalIncome) * 100).toFixed(1)}%`
      : "暂无可计算收入";

    const analysisDates = analysisRows.map((row) => row.date).filter(Boolean).sort();
    document.querySelector("#kpi-date-range").textContent = analysisDates.length
      ? `${analysisDates[0]} 至 ${analysisDates.at(-1)}`
      : "暂无日期范围";

    renderMonthlyChart(analysisRows);
    renderCategoryChart(analysisRows);

    visibleRows = getFilteredRows(false);
    renderTable(visibleRows);
  }

  function renderMonthlyChart(rows) {
    const container = document.querySelector("#monthly-chart");
    const grouped = new Map();

    rows.forEach((row) => {
      if (!row.validDate) return;
      const month = row.date.slice(0, 7);
      const current = grouped.get(month) || { income: 0, expense: 0 };
      current.income += row.income;
      current.expense += row.expense;
      grouped.set(month, current);
    });

    const entries = [...grouped.entries()].sort(([first], [second]) => first.localeCompare(second));
    if (!entries.length) {
      container.innerHTML = '<p class="chart-empty">当前筛选范围内没有可绘制的数据。</p>';
      return;
    }

    const width = 720;
    const height = 260;
    const padding = { top: 20, right: 18, bottom: 40, left: 55 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const maximum = Math.max(...entries.flatMap(([, value]) => [value.income, value.expense]), 1);
    const groupWidth = plotWidth / entries.length;
    const barWidth = Math.min(24, groupWidth * 0.27);
    const y = (value) => padding.top + plotHeight - (value / maximum) * plotHeight;
    const compact = (value) => {
      if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
      if (value >= 1000) return `${(value / 1000).toFixed(1)}千`;
      return String(Math.round(value));
    };

    const grid = [0, 0.25, 0.5, 0.75, 1]
      .map((ratio) => {
        const yPosition = padding.top + plotHeight * ratio;
        return `<line x1="${padding.left}" y1="${yPosition}" x2="${width - padding.right}" y2="${yPosition}" stroke="rgba(24,33,29,.12)"/>
          <text x="${padding.left - 8}" y="${yPosition + 3}" text-anchor="end" fill="#65706a" font-size="9">${compact(maximum * (1 - ratio))}</text>`;
      })
      .join("");

    const bars = entries.map(([month, value], index) => {
      const center = padding.left + groupWidth * (index + 0.5);
      const incomeX = center - barWidth - 2;
      const expenseX = center + 2;
      const incomeY = y(value.income);
      const expenseY = y(value.expense);
      return `
        <rect x="${incomeX}" y="${incomeY}" width="${barWidth}" height="${Math.max(plotHeight + padding.top - incomeY, 0)}" fill="#18352d"/>
        <rect x="${expenseX}" y="${expenseY}" width="${barWidth}" height="${Math.max(plotHeight + padding.top - expenseY, 0)}" fill="#df6740"/>
        <text x="${center}" y="${height - 16}" text-anchor="middle" fill="#4d5650" font-size="9">${escapeHtml(month)}</text>
      `;
    }).join("");

    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="月度收入和支出柱状图">
        ${grid}
        ${bars}
      </svg>
    `;
  }

  function renderCategoryChart(rows) {
    const container = document.querySelector("#category-chart");
    const grouped = new Map();
    rows.forEach((row) => {
      if (row.expense <= 0) return;
      grouped.set(row.category, (grouped.get(row.category) || 0) + row.expense);
    });

    const entries = [...grouped.entries()].sort(([, first], [, second]) => second - first).slice(0, 6);
    if (!entries.length) {
      container.innerHTML = '<p class="chart-empty">当前筛选范围内没有支出数据。</p>';
      return;
    }

    const maximum = Math.max(...entries.map(([, value]) => value), 1);
    container.innerHTML = entries.map(([category, value]) => `
      <div class="category-row">
        <span title="${escapeHtml(category)}">${escapeHtml(category)}</span>
        <div class="category-bar"><i style="--bar-width:${(value / maximum) * 100}%"></i></div>
        <strong>${escapeHtml(formatCurrency(value))}</strong>
      </div>
    `).join("");
  }

  function renderTable(rows) {
    const limitedRows = rows.slice(0, 300);
    tableBody.innerHTML = limitedRows.map((row) => {
      const status = !row.valid ? "异常" : row.isDuplicate ? "疑似重复" : row.warnings.length ? "需确认" : "正常";
      const statusClass = !row.valid ? "is-error" : row.isDuplicate || row.warnings.length ? "is-warning" : "";
      return `
        <tr>
          <td><span class="row-status ${statusClass}" title="${escapeHtml([...row.errors, ...row.warnings].join("；"))}">${status}</span></td>
          <td>${escapeHtml(row.date || "无效日期")}</td>
          <td>${escapeHtml(row.description)}</td>
          <td>${escapeHtml(row.category)}</td>
          <td>${escapeHtml(row.account)}</td>
          <td class="number-cell amount-income">${row.income ? escapeHtml(formatCurrency(row.income)) : "—"}</td>
          <td class="number-cell amount-expense">${row.expense ? escapeHtml(formatCurrency(row.expense)) : "—"}</td>
          <td class="number-cell">${escapeHtml(formatCurrency(row.net))}</td>
        </tr>
      `;
    }).join("");

    document.querySelector("#table-note").textContent = rows.length
      ? `当前显示 ${limitedRows.length} 条，共 ${rows.length} 条符合条件的记录。异常和重复状态保留在导出文件中。`
      : "当前筛选条件下没有记录。";
  }

  function csvCell(value) {
    const text = String(value ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function downloadCsv(filename, rows) {
    const content = "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function processText(text, name) {
    const cleanText = text.replace(/^\uFEFF/, "");
    const parsed = parseDelimited(cleanText);
    source = { name, headers: parsed.headers, rows: parsed.records };
    renderMapping(source.headers, autoMap(source.headers));
    setStatus(`已读取 ${source.rows.length} 条记录，正在分析。`, "success");
    analyze();
  }

  async function readFile(file) {
    if (file.size > 15 * 1024 * 1024) {
      throw new Error("文件超过 15MB，建议先拆分成较小的 CSV。");
    }

    const buffer = await file.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(buffer);
    if (text.includes("\uFFFD")) {
      text = new TextDecoder("gb18030").decode(buffer);
    }
    processText(text, file.name);
  }

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      await readFile(file);
    } catch (error) {
      setStatus(`导入失败：${error.message}`, "error");
    }
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("is-dragging");
    });
  });

  dropZone.addEventListener("drop", async (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    try {
      await readFile(file);
    } catch (error) {
      setStatus(`导入失败：${error.message}`, "error");
    }
  });

  document.querySelector("#load-demo").addEventListener("click", () => {
    try {
      processText(sampleCsv, "体验数据.csv");
      setStatus(`已载入体验数据，共 ${normalizedRows.length} 条记录。`, "success");
    } catch (error) {
      setStatus(`体验数据加载失败：${error.message}`, "error");
    }
  });

  document.querySelector("#download-template").addEventListener("click", () => {
    downloadCsv("财务流水导入模板.csv", [
      ["日期", "摘要", "分类", "账户", "收支类型", "金额"],
      ["2026-01-05", "客户回款", "销售收入", "基本户", "收入", "12000.00"],
      ["2026-01-08", "办公用品", "管理费用", "基本户", "支出", "350.00"]
    ]);
    setStatus("CSV 模板已下载。", "success");
  });

  document.querySelector("#apply-mapping").addEventListener("click", analyze);

  [filterStart, filterEnd, filterSearch, excludeDuplicates, onlyErrors].forEach((control) => {
    control.addEventListener("input", updateView);
    control.addEventListener("change", updateView);
  });

  document.querySelector("#reset-filters").addEventListener("click", () => {
    filterStart.value = "";
    filterEnd.value = "";
    filterSearch.value = "";
    excludeDuplicates.checked = true;
    onlyErrors.checked = false;
    updateView();
  });

  exportCleanButton.addEventListener("click", () => {
    if (!visibleRows.length) {
      setStatus("当前没有可导出的记录。", "error");
      return;
    }
    downloadCsv("财务流水-清洗结果.csv", [
      ["原始序号", "日期", "摘要", "分类", "账户", "收入", "支出", "净额", "状态", "问题说明"],
      ...visibleRows.map((row) => [
        row.index,
        row.date,
        row.description,
        row.category,
        row.account,
        row.income.toFixed(2),
        row.expense.toFixed(2),
        row.net.toFixed(2),
        !row.valid ? "异常" : row.isDuplicate ? "疑似重复" : row.warnings.length ? "需确认" : "正常",
        [...row.errors, ...row.warnings].join("；")
      ])
    ]);
    setStatus("清洗后的流水已导出。", "success");
  });

  exportSummaryButton.addEventListener("click", () => {
    const analysisRows = getFilteredRows(true);
    const income = analysisRows.reduce((sum, row) => sum + row.income, 0);
    const expense = analysisRows.reduce((sum, row) => sum + row.expense, 0);
    const monthly = new Map();
    const categories = new Map();

    analysisRows.forEach((row) => {
      if (row.validDate) {
        const month = row.date.slice(0, 7);
        const current = monthly.get(month) || { income: 0, expense: 0 };
        current.income += row.income;
        current.expense += row.expense;
        monthly.set(month, current);
      }
      if (row.expense > 0) {
        categories.set(row.category, (categories.get(row.category) || 0) + row.expense);
      }
    });

    const rows = [
      ["财务数据分析汇总", ""],
      ["文件", source.name],
      ["分析记录数", analysisRows.length],
      ["总收入", income.toFixed(2)],
      ["总支出", expense.toFixed(2)],
      ["净现金流", (income - expense).toFixed(2)],
      ["", ""],
      ["月份", "收入", "支出", "净现金流"],
      ...[...monthly.entries()].sort(([first], [second]) => first.localeCompare(second)).map(([month, value]) => [
        month,
        value.income.toFixed(2),
        value.expense.toFixed(2),
        (value.income - value.expense).toFixed(2)
      ]),
      ["", ""],
      ["支出分类", "金额"],
      ...[...categories.entries()].sort(([, first], [, second]) => second - first).map(([category, value]) => [
        category,
        value.toFixed(2)
      ])
    ];

    downloadCsv("财务流水-分析汇总.csv", rows);
    setStatus("分析汇总已导出。", "success");
  });

})();
