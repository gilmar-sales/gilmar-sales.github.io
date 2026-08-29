(function () {
    "use strict";

    const STORAGE_KEY = "gs-benchmark-runs-v1";

    const COLORS = [
        "var(--accent)",
        "var(--marker-green)",
        "var(--code-number)",
        "var(--code-keyword)",
        "var(--marker-red)",
        "var(--code-name)",
        "var(--code-string)",
        "var(--ink-4)",
    ];

    let runs = [];
    let baselineId = null;
    let dragDepth = 0;

    const $ = (id) => document.getElementById(id);

    function uid() {
        return (
            crypto.randomUUID?.() ??
            `run-${Date.now()}-${Math.random().toString(16).slice(2)}`
        );
    }

    function parseBenchmarkName(name) {
        const parts = name.split("/");
        return { family: parts[0], args: parts.slice(1).join("/") || "—" };
    }

    function formatTime(value, unit) {
        if (value == null) return "—";
        const scales = { ns: 1e-9, us: 1e-6, ms: 1e-3, s: 1 };
        const seconds = value * (scales[unit] ?? 1);
        if (seconds < 1e-6) return `${(seconds * 1e9).toFixed(1)} ns`;
        if (seconds < 1e-3) return `${(seconds * 1e6).toFixed(1)} µs`;
        if (seconds < 1) return `${(seconds * 1e3).toFixed(2)} ms`;
        return `${seconds.toFixed(3)} s`;
    }

    function formatMetric(bench, metric) {
        if (metric === "items_per_second") {
            const v = bench.items_per_second;
            if (v == null) return "—";
            if (v >= 1e9) return `${(v / 1e9).toFixed(2)} G/s`;
            if (v >= 1e6) return `${(v / 1e6).toFixed(2)} M/s`;
            if (v >= 1e3) return `${(v / 1e3).toFixed(2)} k/s`;
            return `${v.toFixed(1)}/s`;
        }
        return formatTime(bench[metric], bench.time_unit);
    }

    function metricValue(bench, metric) {
        if (metric === "items_per_second") return bench.items_per_second ?? null;
        return bench[metric] ?? null;
    }

    function lowerIsBetter(metric) {
        return metric !== "items_per_second";
    }

    function deltaPct(base, current, metric) {
        if (base == null || current == null || base === 0) return null;
        if (lowerIsBetter(metric)) return ((current - base) / base) * 100;
        return ((base - current) / base) * 100;
    }

    function deltaClass(pct) {
        if (pct == null || Math.abs(pct) < 0.5) return "delta-neutral";
        return pct > 0 ? "delta-good" : "delta-bad";
    }

    function runLabel(run) {
        const date = run.context?.date ?? run.label ?? "sem data";
        const host = run.context?.host_name ?? "";
        return `${date}${host ? ` · ${host}` : ""}`;
    }

    function indexBenchmarks(run) {
        const map = new Map();
        for (const b of run.benchmarks ?? []) map.set(b.name, b);
        return map;
    }

    function allFamilies() {
        const set = new Set();
        for (const run of runs) {
            for (const b of run.benchmarks ?? [])
                set.add(parseBenchmarkName(b.name).family);
        }
        return [...set].sort();
    }

    function allBenchmarkNames() {
        const set = new Set();
        for (const run of runs)
            for (const b of run.benchmarks ?? []) set.add(b.name);
        return [...set].sort();
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function metricLabel(metric) {
        return {
            real_time: "Tempo real",
            cpu_time: "Tempo CPU",
            items_per_second: "Items/s",
        }[metric];
    }

    function shortLabel(run) {
        const d = run.context?.date ?? "";
        const m = d.match(/(\d{4}-\d{2}-\d{2})/);
        return m ? m[1] : run.label.slice(0, 16);
    }

    function persist() {
        const payload = runs.map((r) => ({
            id: r.id,
            label: r.label,
            context: r.context,
            benchmarks: r.benchmarks,
            savedAt: r.savedAt,
        }));
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ runs: payload, baselineId }),
        );
    }

    function loadPersisted() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            runs = (data.runs ?? []).map((r) => ({
                ...r,
                index: indexBenchmarks(r),
            }));
            baselineId = data.baselineId ?? runs[0]?.id ?? null;
        } catch {
            runs = [];
            baselineId = null;
        }
    }

    function setUploadStatus(message, isError) {
        const el = $("uploadStatus");
        if (!el) return;
        el.textContent = message;
        el.classList.toggle("is-error", !!isError);
        if (message) {
            clearTimeout(setUploadStatus._timer);
            setUploadStatus._timer = setTimeout(() => {
                el.textContent = "";
                el.classList.remove("is-error");
            }, 4000);
        }
    }

    function updateDropzoneState() {
        const dz = $("dropzone");
        if (!dz) return;
        dz.classList.toggle("has-runs", runs.length > 0);
    }

    function addRunFromJson(text, fileName) {
        const data = JSON.parse(text);
        if (!Array.isArray(data.benchmarks))
            throw new Error("JSON inválido: falta benchmarks[]");
        const id = uid();
        const run = {
            id,
            label: fileName || runLabel(data),
            context: data.context ?? {},
            benchmarks: data.benchmarks,
            savedAt: new Date().toISOString(),
            index: indexBenchmarks({ benchmarks: data.benchmarks }),
        };
        const existing = runs.findIndex(
            (r) =>
                r.label === run.label &&
                r.context?.date === run.context?.date,
        );
        if (existing >= 0) runs[existing] = { ...run, id: runs[existing].id };
        else runs.push(run);
        if (!baselineId) baselineId = runs[0].id;
        persist();
        render();
    }

    function removeRun(id) {
        runs = runs.filter((r) => r.id !== id);
        if (baselineId === id) baselineId = runs[0]?.id ?? null;
        persist();
        render();
    }

    function isJsonFile(file) {
        return (
            file.name.toLowerCase().endsWith(".json") ||
            file.type === "application/json"
        );
    }

    async function processFiles(fileList) {
        const files = [...fileList].filter(isJsonFile);
        const skipped = fileList.length - files.length;

        if (!files.length) {
            setUploadStatus(
                skipped
                    ? "Nenhum arquivo .json encontrado."
                    : "Selecione arquivos .json de benchmark.",
                true,
            );
            return;
        }

        let loaded = 0;
        const errors = [];

        for (const file of files) {
            try {
                addRunFromJson(await file.text(), file.name);
                loaded++;
            } catch (err) {
                errors.push(`${file.name}: ${err.message}`);
            }
        }

        if (errors.length) {
            setUploadStatus(errors.join(" · "), true);
        } else {
            const skipMsg =
                skipped > 0 ? ` (${skipped} ignorado(s))` : "";
            setUploadStatus(
                `${loaded} run(s) carregado(s)${skipMsg}.`,
                false,
            );
        }
    }

    function renderRuns() {
        const el = $("runs");
        if (!runs.length) {
            el.innerHTML =
                '<div class="bench-empty bench-empty-inline">Nenhum run carregado. Arraste arquivos .json ou clique na área acima.</div>';
            return;
        }
        el.innerHTML = runs
            .map(
                (r) => `
        <div class="run-chip ${r.id === baselineId ? "baseline" : ""}">
          <input type="radio" name="baseline" value="${r.id}" ${r.id === baselineId ? "checked" : ""} title="Baseline" aria-label="Definir ${escapeHtml(r.label)} como baseline" />
          <span class="run-chip-label">${escapeHtml(r.label)}</span>
          <span class="run-chip-meta">${r.benchmarks?.length ?? 0} bms</span>
          <button type="button" data-remove="${r.id}" class="run-chip-remove" aria-label="Remover ${escapeHtml(r.label)}">×</button>
        </div>`,
            )
            .join("");

        el.querySelectorAll('input[name="baseline"]').forEach((input) => {
            input.addEventListener("change", () => {
                baselineId = input.value;
                persist();
                render();
            });
        });
        el.querySelectorAll("[data-remove]").forEach((btn) => {
            btn.addEventListener("click", () => removeRun(btn.dataset.remove));
        });
    }

    function renderStats() {
        const el = $("stats");
        if (!runs.length) {
            el.innerHTML = "";
            return;
        }
        const names = allBenchmarkNames();
        const baseline = runs.find((r) => r.id === baselineId);
        el.innerHTML = `
        <div class="bench-stat"><div class="bench-stat-label">Runs</div><div class="bench-stat-value">${runs.length}</div></div>
        <div class="bench-stat"><div class="bench-stat-label">Benchmarks</div><div class="bench-stat-value">${names.length}</div></div>
        <div class="bench-stat"><div class="bench-stat-label">Baseline</div><div class="bench-stat-value bench-stat-value-sm">${escapeHtml(baseline ? baseline.label : "—")}</div></div>
        <div class="bench-stat"><div class="bench-stat-label">Famílias</div><div class="bench-stat-value">${allFamilies().length}</div></div>`;
    }

    function renderFamilySelect() {
        const select = $("familySelect");
        const families = allFamilies();
        const current = select.value;
        select.innerHTML =
            '<option value="">Todas as famílias</option>' +
            families
                .map(
                    (f) =>
                        `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`,
                )
                .join("");
        if (families.includes(current)) select.value = current;
        else if (families.length) select.value = families[0];
    }

    function filteredNames() {
        const family = $("familySelect").value;
        const q = $("searchInput").value.trim().toLowerCase();
        return allBenchmarkNames().filter((name) => {
            if (family && !name.startsWith(family + "/") && name !== family)
                return false;
            if (q && !name.toLowerCase().includes(q)) return false;
            return true;
        });
    }

    function renderTable() {
        const el = $("tableArea");
        const metric = $("metricSelect").value;
        const names = filteredNames();
        const baseline = runs.find((r) => r.id === baselineId);

        if (!runs.length || !names.length) {
            el.innerHTML = '<div class="bench-empty">Sem dados para exibir.</div>';
            return;
        }

        const head = `<tr><th>Benchmark</th>${runs.map((r) => `<th>${escapeHtml(shortLabel(r))}</th>`).join("")}${runs.length > 1 ? "<th>Δ vs baseline</th>" : ""}</tr>`;

        const rows = names
            .map((name) => {
                const cells = runs.map((r) => {
                    const b = r.index.get(name);
                    return `<td>${b ? formatMetric(b, metric) : "—"}</td>`;
                });
                let deltaCell = "";
                if (runs.length > 1 && baseline) {
                    const b0 = baseline.index.get(name);
                    const baseVal = b0 ? metricValue(b0, metric) : null;
                    const others = runs.filter((r) => r.id !== baselineId);
                    const deltas = others
                        .map((r) => {
                            const b = r.index.get(name);
                            return deltaPct(
                                baseVal,
                                b ? metricValue(b, metric) : null,
                                metric,
                            );
                        })
                        .filter((d) => d != null);
                    if (!deltas.length || baseVal == null)
                        deltaCell = '<td class="delta-neutral">—</td>';
                    else {
                        const avg =
                            deltas.reduce((a, b) => a + b, 0) / deltas.length;
                        const cls = deltaClass(avg);
                        const sign = avg > 0 ? "+" : "";
                        deltaCell = `<td class="${cls}">${sign}${avg.toFixed(1)}%</td>`;
                    }
                }
                return `<tr><td>${escapeHtml(name)}</td>${cells.join("")}${deltaCell}</tr>`;
            })
            .join("");

        el.innerHTML = `<table><thead>${head}</thead><tbody>${rows}</tbody></table>`;
    }

    function renderChart() {
        const area = $("chartArea");
        const legend = $("legend");
        const metric = $("metricSelect").value;
        const family = $("familySelect").value;

        if (!runs.length || !family) {
            area.innerHTML =
                '<div class="bench-empty">Selecione uma família de benchmark.</div>';
            legend.innerHTML = "";
            return;
        }

        const names = filteredNames().filter(
            (n) => parseBenchmarkName(n).family === family,
        );
        if (!names.length) {
            area.innerHTML =
                '<div class="bench-empty">Nenhum benchmark nesta família.</div>';
            legend.innerHTML = "";
            return;
        }

        const categories = [
            ...new Set(names.map((n) => parseBenchmarkName(n).args)),
        ];
        const series = runs.map((run, i) => ({
            name: run.label,
            color: COLORS[i % COLORS.length],
            data: categories.map((args) => {
                const full = `${family}/${args}`;
                const b = run.index.get(full);
                return b ? metricValue(b, metric) : null;
            }),
        }));

        $("chartTitle").textContent = `${family} — ${metricLabel(metric)} por argumentos`;

        const validValues = series
            .flatMap((s) => s.data)
            .filter((v) => v != null && v > 0);
        if (!validValues.length) {
            area.innerHTML =
                '<div class="bench-empty">Sem valores numéricos.</div>';
            legend.innerHTML = "";
            return;
        }

        const log =
            metric === "items_per_second" ||
            Math.max(...validValues) / Math.min(...validValues) > 50;
        const height = Math.max(220, categories.length * 28 + 60);
        const width = Math.max(480, area.clientWidth || 720);
        const pad = { top: 16, right: 16, bottom: 36, left: 120 };
        const innerW = width - pad.left - pad.right;
        const innerH = height - pad.top - pad.bottom;
        const groupH = innerH / categories.length;
        const barH = Math.min(14, groupH / (series.length + 1));

        function scale(v) {
            if (v == null || v <= 0) return 0;
            if (!log) {
                const max = Math.max(...validValues);
                return (v / max) * innerW;
            }
            const min = Math.min(...validValues);
            const max = Math.max(...validValues);
            const lo = Math.log10(min);
            const hi = Math.log10(max);
            return ((Math.log10(v) - lo) / (hi - lo || 1)) * innerW;
        }

        let svg = `<svg class="bench-chart" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfico de ${escapeHtml(family)}">`;
        categories.forEach((cat, ci) => {
            const y0 = pad.top + ci * groupH + groupH / 2;
            svg += `<text class="bench-chart-label" x="${pad.left - 8}" y="${y0 + 4}" text-anchor="end">${escapeHtml(cat)}</text>`;
            series.forEach((s, si) => {
                const v = s.data[ci];
                const w = scale(v);
                const y =
                    y0 -
                    barH / 2 +
                    (si - (series.length - 1) / 2) * (barH + 2);
                svg += `<rect x="${pad.left}" y="${y}" width="${Math.max(w, 1)}" height="${barH}" fill="${s.color}" />`;
                if (v != null) {
                    const bench = runs[si].index.get(`${family}/${cat}`);
                    svg += `<text class="bench-chart-value" x="${pad.left + w + 4}" y="${y + barH - 2}">${escapeHtml(formatMetric(bench, metric))}</text>`;
                }
            });
        });
        svg += `<text class="bench-chart-axis" x="${pad.left + innerW / 2}" y="${height - 8}" text-anchor="middle">${escapeHtml(metricLabel(metric))}${log ? " (escala log)" : ""}</text>`;
        svg += "</svg>";
        area.innerHTML = svg;
        legend.innerHTML = series
            .map(
                (s) =>
                    `<span><i class="bench-swatch" style="background:${s.color}"></i>${escapeHtml(s.name)}</span>`,
            )
            .join("");
    }

    function render() {
        updateDropzoneState();
        renderRuns();
        renderStats();
        renderFamilySelect();
        renderChart();
        renderTable();
    }

    function exportCsv() {
        const metric = $("metricSelect").value;
        const names = filteredNames();
        const header = ["benchmark", ...runs.map((r) => shortLabel(r))];
        const lines = [header.join(",")];
        for (const name of names) {
            const row = [
                name,
                ...runs.map((r) => {
                    const b = r.index.get(name);
                    const v = b ? metricValue(b, metric) : "";
                    return v == null ? "" : v;
                }),
            ];
            lines.push(row.join(","));
        }
        const blob = new Blob([lines.join("\n")], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `benchmark-compare-${metric}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    function initDropzone() {
        const dropzone = $("dropzone");
        const fileInput = $("fileInput");
        if (!dropzone || !fileInput) return;

        dropzone.addEventListener("click", () => fileInput.click());

        dropzone.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInput.click();
            }
        });

        fileInput.addEventListener("change", async (e) => {
            await processFiles(e.target.files);
            e.target.value = "";
        });

        dropzone.addEventListener("dragenter", (e) => {
            e.preventDefault();
            dragDepth++;
            dropzone.classList.add("is-dragover");
        });

        dropzone.addEventListener("dragover", (e) => {
            e.preventDefault();
        });

        dropzone.addEventListener("dragleave", () => {
            dragDepth--;
            if (dragDepth <= 0) {
                dragDepth = 0;
                dropzone.classList.remove("is-dragover");
            }
        });

        dropzone.addEventListener("drop", async (e) => {
            e.preventDefault();
            dragDepth = 0;
            dropzone.classList.remove("is-dragover");
            await processFiles(e.dataTransfer.files);
        });
    }

    $("saveBtn").addEventListener("click", () => {
        persist();
        setUploadStatus(`${runs.length} run(s) salvos no navegador.`);
    });

    $("exportBtn").addEventListener("click", exportCsv);

    $("clearBtn").addEventListener("click", () => {
        if (!confirm("Remover todos os runs salvos no navegador?")) return;
        runs = [];
        baselineId = null;
        localStorage.removeItem(STORAGE_KEY);
        render();
        setUploadStatus("Runs removidos.");
    });

    ["familySelect", "metricSelect", "searchInput"].forEach((id) => {
        $(id).addEventListener("input", render);
        $(id).addEventListener("change", render);
    });

    window.addEventListener("resize", () => {
        if (runs.length) renderChart();
    });

    initDropzone();
    loadPersisted();
    render();
})();
