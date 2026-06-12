/* html-view runtime: TOC + scrollspy, copy affordances, sortable tables. */
(function () {
  "use strict";

  /* ---------- Toast ---------- */

  var toast = document.createElement("div");
  toast.className = "toast";
  document.body.appendChild(toast);
  var toastTimer = null;

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove("show");
    }, 1400);
  }

  function copyText(text, label) {
    navigator.clipboard.writeText(text).then(
      function () { showToast("Copied " + (label || "")); },
      function () { showToast("Copy failed"); }
    );
  }

  /* ---------- TOC build + scrollspy ---------- */

  var tocNav = document.getElementById("toc");
  var headings = Array.prototype.slice.call(
    document.querySelectorAll(".doc h2, .doc h3")
  );

  function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  if (tocNav && headings.length) {
    var label = document.createElement("div");
    label.className = "toc-label";
    label.textContent = "Contents";
    tocNav.appendChild(label);

    var list = document.createElement("ul");
    var used = {};

    headings.forEach(function (h) {
      if (!h.id) {
        var base = slugify(h.textContent.replace(/Copy section$/i, ""));
        var id = base, n = 2;
        while (used[id] || document.getElementById(id)) { id = base + "-" + n++; }
        used[id] = true;
        h.id = id;
      }
      var li = document.createElement("li");
      if (h.tagName === "H3") li.className = "toc-h3";
      var a = document.createElement("a");
      a.href = "#" + h.id;
      a.textContent = h.childNodes[0] ? h.childNodes[0].textContent.trim() : h.textContent.trim();
      var badge = h.getAttribute("data-toc-badge");
      if (badge) {
        var dot = document.createElement("span");
        dot.className = "toc-dot " + badge;
        a.prepend(dot);
      }
      li.appendChild(a);
      list.appendChild(li);
    });

    tocNav.appendChild(list);

    var links = tocNav.querySelectorAll("a");
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });

    var current = null;
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            if (current) current.classList.remove("active");
            current = byId[entry.target.id];
            if (current) current.classList.add("active");
          }
        });
      },
      { rootMargin: "0px 0px -75% 0px", threshold: 0 }
    );
    headings.forEach(function (h) { observer.observe(h); });
  }

  /* ---------- Code block copy buttons ---------- */

  document.querySelectorAll("pre").forEach(function (pre) {
    var code = pre.querySelector("code");
    if (!code || pre.classList.contains("mermaid")) return;
    var btn = document.createElement("button");
    btn.className = "copy-btn";
    btn.type = "button";
    btn.textContent = "Copy";
    btn.addEventListener("click", function () {
      copyText(code.textContent.replace(/\n$/, ""), "code");
    });
    pre.appendChild(btn);
  });

  /* ---------- Inline code click-to-copy ---------- */

  document.querySelectorAll("code").forEach(function (code) {
    if (code.parentElement.tagName === "PRE") return;
    code.title = "Click to copy";
    code.addEventListener("click", function () {
      copyText(code.textContent, "“" + truncate(code.textContent, 24) + "”");
    });
  });

  /* ---------- Copy chips ---------- */

  document.querySelectorAll(".chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      var value = chip.getAttribute("data-copy") || chip.textContent;
      copyText(value, "“" + truncate(value, 24) + "”");
    });
  });

  /* ---------- Section copy-as-markdown ---------- */

  document.querySelectorAll("h2[data-md], h3[data-md]").forEach(function (h) {
    var btn = document.createElement("button");
    btn.className = "section-copy";
    btn.type = "button";
    btn.textContent = "Copy md";
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      copyText(decodeURIComponent(h.getAttribute("data-md")), "section markdown");
    });
    h.appendChild(btn);
  });

  /* ---------- Sortable tables ---------- */

  document.querySelectorAll("table").forEach(function (table) {
    var ths = table.querySelectorAll("thead th");
    ths.forEach(function (th, idx) {
      var arrow = document.createElement("span");
      arrow.className = "sort-arrow";
      arrow.textContent = "↕";
      th.appendChild(arrow);
      th.addEventListener("click", function () {
        sortTable(table, idx, th);
      });
    });
  });

  function sortTable(table, colIdx, th) {
    var tbody = table.querySelector("tbody");
    if (!tbody) return;
    var rows = Array.prototype.slice.call(tbody.querySelectorAll("tr"));
    var dir = th.getAttribute("data-dir") === "asc" ? "desc" : "asc";
    table.querySelectorAll("th").forEach(function (other) {
      other.removeAttribute("data-dir");
      var a = other.querySelector(".sort-arrow");
      if (a) a.textContent = "↕";
    });
    th.setAttribute("data-dir", dir);
    var arrow = th.querySelector(".sort-arrow");
    if (arrow) arrow.textContent = dir === "asc" ? "↑" : "↓";

    rows.sort(function (a, b) {
      var av = cellValue(a, colIdx), bv = cellValue(b, colIdx);
      var an = parseFloat(av.replace(/[^0-9.\-]/g, ""));
      var bn = parseFloat(bv.replace(/[^0-9.\-]/g, ""));
      var cmp;
      if (!isNaN(an) && !isNaN(bn) && av.match(/\d/) && bv.match(/\d/)) {
        cmp = an - bn;
      } else {
        cmp = av.localeCompare(bv);
      }
      return dir === "asc" ? cmp : -cmp;
    });

    rows.forEach(function (r) { tbody.appendChild(r); });
  }

  function cellValue(row, idx) {
    var cell = row.children[idx];
    return cell ? cell.textContent.trim() : "";
  }

  /* ---------- Provenance copy ---------- */

  document.querySelectorAll(".provenance code").forEach(function (code) {
    code.title = "Click to copy";
  });

  function truncate(s, n) {
    return s.length > n ? s.slice(0, n) + "…" : s;
  }
})();
