/* =============================================================================
   Former Defenders — main.js
   - Loads ./site-branding.json   (firm name, copy, nav, footer contacts)
   - Loads ./site-attorneysbystate.txt  (recommended attorneys)
   - Renders the continental U.S. map (D3 + vendored us-atlas topojson)
   - Click a STATE  -> pop-out lists every attorney in that state
   - Click a STAR   -> pop-out lists the attorneys at that office (city)
   No external network calls. Everything is served from this repo.
   ============================================================================= */

(function () {
  "use strict";

  // FIPS ids we do NOT draw (keeps the map to the continental U.S.)
  // 02 Alaska, 15 Hawaii, 60 Am. Samoa, 66 Guam, 69 N. Mariana, 72 PR, 78 USVI
  var NON_CONTINENTAL = { "02": 1, "15": 1, "60": 1, "66": 1, "69": 1, "72": 1, "78": 1 };

  var STORE = {
    branding: null,
    byState: {},   // normalizedStateName -> [attorney, ...]
    stars: []      // { state, city, lat, lng, attorneys: [...] }
  };

  /* ---------------------------------------------------------------- helpers */
  function norm(s) { return (s || "").trim().toLowerCase(); }
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ------------------------------------------------------ load + apply branding */
  function applyBranding(b) {
    STORE.branding = b;
    var name = b.SITENAME || "Former Defenders";

    document.title = name;
    el("brandName").textContent = b.SITENAME_SHORT || name;
    if (b.TAGLINE) el("brandTagline").textContent = b.TAGLINE;
    el("brandLogo").alt = name + " logo";

    if (b.HERO_EYEBROW) el("heroEyebrow").textContent = b.HERO_EYEBROW;
    if (b.HERO_HEADING) el("heroHeading").textContent = b.HERO_HEADING;
    if (b.HERO_SUBTEXT) el("heroSubtext").textContent = b.HERO_SUBTEXT;

    if (b.ABOUT_HEADING) el("aboutHeading").textContent = b.ABOUT_HEADING;
    if (b.ABOUT_BODY) el("aboutBody").textContent = b.ABOUT_BODY;

    // nav
    var nav = el("navLinks");
    nav.innerHTML = "";
    (b.NAV_LINKS || []).forEach(function (link) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = link.href || "#";
      a.textContent = link.label || "";
      li.appendChild(a);
      nav.appendChild(li);
    });

    // footer
    el("footerName").textContent = name;
    if (b.FOOTER_DISCLAIMER) el("footerDisclaimer").textContent = b.FOOTER_DISCLAIMER;

    var c = b.CONTACT || {};
    var rows = [];
    if (c.ADDRESS) rows.push("<dd>" + esc(c.ADDRESS) + "</dd>");
    if (c.PHONE) rows.push('<dd><a href="tel:' + esc(c.PHONE.replace(/[^+\d]/g, "")) + '">' + esc(c.PHONE) + "</a></dd>");
    if (c.EMAIL) rows.push('<dd><a href="mailto:' + esc(c.EMAIL) + '">' + esc(c.EMAIL) + "</a></dd>");
    if (c.HOURS) rows.push("<dd>" + esc(c.HOURS) + "</dd>");
    el("footerContact").innerHTML =
      '<span class="fc-label">Contact</span><dl>' + rows.join("") + "</dl>";

    var year = new Date().getFullYear();
    el("footerCopyright").textContent = "\u00A9 " + year + " " + name + ". All rights reserved.";

    var fl = el("footerLinks");
    fl.innerHTML = "";
    (b.FOOTER_LINKS || []).forEach(function (link) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = link.href || "#";
      a.textContent = link.label || "";
      li.appendChild(a);
      fl.appendChild(li);
    });
  }

  /* --------------------------------------------- parse attorneys text file */
  function parseAttorneys(text) {
    var blocks = text.split(/^\s*---\s*$/m);
    var byState = {};
    var cityMap = {}; // key state|city -> star object

    blocks.forEach(function (block) {
      var rec = {};
      block.split(/\r?\n/).forEach(function (line) {
        var t = line.trim();
        if (!t || t.charAt(0) === "#") return;
        var i = t.indexOf(":");
        if (i === -1) return;
        var key = t.slice(0, i).trim().toUpperCase();
        var val = t.slice(i + 1).trim();
        if (val) rec[key] = val;
      });

      if (!rec.STATE || !rec.NAME) return; // skip incomplete blocks

      var attorney = {
        state: rec.STATE,
        city: rec.CITY || "",
        name: rec.NAME,
        firm: rec.FIRM || "",
        phone: rec.PHONE || "",
        email: rec.EMAIL || "",
        website: rec.WEBSITE || "",
        address: rec.ADDRESS || "",
        note: rec.NOTE || ""
      };

      var sKey = norm(rec.STATE);
      (byState[sKey] = byState[sKey] || []).push(attorney);

      var lat = parseFloat(rec.LAT), lng = parseFloat(rec.LNG);
      if (!isNaN(lat) && !isNaN(lng)) {
        attorney.lat = lat; attorney.lng = lng;
        var cKey = sKey + "|" + norm(rec.CITY);
        if (!cityMap[cKey]) {
          cityMap[cKey] = { state: rec.STATE, city: rec.CITY || rec.STATE, lat: lat, lng: lng, attorneys: [] };
        }
        cityMap[cKey].attorneys.push(attorney);
      }
    });

    STORE.byState = byState;
    STORE.stars = Object.keys(cityMap).map(function (k) { return cityMap[k]; });
  }

  /* ------------------------------------------------------------- icons (svg) */
  var ICON = {
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L19 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 5 6 2 2 0 0 1 5 4z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3.5 6.5 12 13l8.5-6.5"/></svg>',
    web: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"/></svg>'
  };

  function attorneyCard(a) {
    var rows = "";
    if (a.address) rows += '<div class="row">' + ICON.pin + "<span>" + esc(a.address) + "</span></div>";
    if (a.phone) rows += '<div class="row">' + ICON.phone + '<a href="tel:' + esc(a.phone.replace(/[^+\d]/g, "")) + '">' + esc(a.phone) + "</a></div>";
    if (a.email) rows += '<div class="row">' + ICON.mail + '<a href="mailto:' + esc(a.email) + '">' + esc(a.email) + "</a></div>";
    if (a.website) {
      var disp = a.website.replace(/^https?:\/\//, "").replace(/\/$/, "");
      rows += '<div class="row">' + ICON.web + '<a href="' + esc(a.website) + '" target="_blank" rel="noopener noreferrer">' + esc(disp) + "</a></div>";
    }
    var cityLine = a.city ? '<p class="attorney-city">&#9733; ' + esc(a.city) + "</p>" : "";
    var firmLine = a.firm ? '<p class="attorney-firm">' + esc(a.firm) + "</p>" : "";
    var noteLine = a.note ? '<p class="note">' + esc(a.note) + "</p>" : "";
    return (
      '<article class="attorney">' +
        cityLine +
        '<h3 class="attorney-name">' + esc(a.name) + "</h3>" +
        firmLine +
        '<div class="rows">' + rows + "</div>" +
        noteLine +
      "</article>"
    );
  }

  /* ------------------------------------------------------------------ drawer */
  var drawer = el("drawer");
  var overlay = el("drawerOverlay");
  var lastFocus = null;

  function openDrawer(title, kicker, attorneys) {
    el("drawerKicker").textContent = kicker;
    el("drawerTitle").textContent = title;

    var body = el("drawerBody");
    if (attorneys && attorneys.length) {
      body.innerHTML = attorneys.map(attorneyCard).join("");
    } else {
      var contact = (STORE.branding && STORE.branding.CONTACT) || {};
      var mail = contact.EMAIL ? '<p><a href="mailto:' + esc(contact.EMAIL) + '">Contact us</a> and we\'ll help you find counsel.</p>' : "";
      body.innerHTML =
        '<div class="drawer-empty"><div class="de-star">&#9733;</div>' +
        "<h3>No listings yet</h3>" +
        "<p>We don\u2019t currently have a recommended attorney in " + esc(title) + ".</p>" +
        mail + "</div>";
    }

    lastFocus = document.activeElement;
    overlay.hidden = false;
    requestAnimationFrame(function () {
      overlay.classList.add("is-open");
      drawer.classList.add("is-open");
    });
    drawer.setAttribute("aria-hidden", "false");
    el("drawerClose").focus();
    document.addEventListener("keydown", onKeydown);
  }

  function closeDrawer() {
    overlay.classList.remove("is-open");
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    document.removeEventListener("keydown", onKeydown);
    setTimeout(function () { overlay.hidden = true; }, 320);
    clearActiveState();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function onKeydown(e) { if (e.key === "Escape") closeDrawer(); }

  el("drawerClose").addEventListener("click", closeDrawer);
  overlay.addEventListener("click", closeDrawer);

  /* ----------------------------------------------------------- nav (mobile) */
  var navToggle = el("navToggle");
  if (navToggle) {
    navToggle.addEventListener("click", function () {
      var open = el("navLinks").classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    el("navLinks").addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        el("navLinks").classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* -------------------------------------------------------------- the map */
  var activeNode = null;
  function clearActiveState() {
    if (activeNode) { activeNode.classList.remove("is-active"); activeNode = null; }
  }

  function renderMap(topo) {
    var svg = d3.select("#usMap");
    var tooltip = el("mapTooltip");
    var stage = el("mapWrap");

    var states = topojson.feature(topo, topo.objects.states).features
      .filter(function (f) { return !NON_CONTINENTAL[f.id]; });

    var W = 960, H = 600; // viewBox units
    svg.attr("viewBox", "0 0 " + W + " " + H)
       .attr("preserveAspectRatio", "xMidYMid meet");

    var projection = d3.geoAlbers()
      .scale(1)
      .translate([0, 0]);
    var path = d3.geoPath(projection);

    // fit projection to the continental features within our viewBox
    var fc = { type: "FeatureCollection", features: states };
    projection.fitExtent([[18, 18], [W - 18, H - 18]], fc);

    var gStates = svg.append("g").attr("class", "states");
    var gStars = svg.append("g").attr("class", "stars");

    function stateAttorneys(name) { return STORE.byState[norm(name)] || []; }

    gStates.selectAll("path")
      .data(states)
      .enter()
      .append("path")
      .attr("d", path)
      .attr("class", function (d) {
        return "state" + (stateAttorneys(d.properties.name).length ? " is-covered" : "");
      })
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", function (d) {
        var n = stateAttorneys(d.properties.name).length;
        return d.properties.name + (n ? ", " + n + " attorney" + (n === 1 ? "" : "s") : ", no listings yet");
      })
      .on("mouseenter", function (event, d) { showTip(event, d, this); })
      .on("mousemove", function (event, d) { moveTip(event); })
      .on("mouseleave", hideTip)
      .on("click", function (event, d) { selectState(d, this); })
      .on("focus", function (event, d) { showTip(event, d, this, true); })
      .on("blur", hideTip)
      .on("keydown", function (event, d) {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectState(d, this); }
      });

    // stars
    var starPath = "M0,-9 L2.1,-2.8 L8.9,-2.8 L3.4,1.1 L5.5,7.6 L0,3.7 L-5.5,7.6 L-3.4,1.1 L-8.9,-2.8 L-2.1,-2.8 Z";
    gStars.selectAll("path")
      .data(STORE.stars.filter(function (s) { return projection([s.lng, s.lat]); }))
      .enter()
      .append("path")
      .attr("class", "office-star")
      .attr("d", starPath)
      .attr("transform", function (s) {
        var p = projection([s.lng, s.lat]);
        return p ? "translate(" + p[0] + "," + p[1] + ")" : "translate(-999,-999)";
      })
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", function (s) { return s.city + " office, " + s.attorneys.length + " attorney" + (s.attorneys.length === 1 ? "" : "s"); })
      .on("mouseenter", function (event, s) { showStarTip(event, s); })
      .on("mousemove", moveTip)
      .on("mouseleave", hideTip)
      .on("click", function (event, s) {
        event.stopPropagation();
        clearActiveState();
        openDrawer(s.city + ", " + s.state, "Office location", s.attorneys);
      })
      .on("focus", function (event, s) { showStarTip(event, s); })
      .on("blur", hideTip)
      .on("keydown", function (event, s) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDrawer(s.city + ", " + s.state, "Office location", s.attorneys);
        }
      });

    function selectState(d, node) {
      clearActiveState();
      activeNode = node; node.classList.add("is-active");
      hideTip();
      openDrawer(d.properties.name, "Recommended attorneys", stateAttorneys(d.properties.name));
    }

    /* tooltip positioning (relative to the map stage) */
    function tipXY(event) {
      var r = stage.getBoundingClientRect();
      return { x: event.clientX - r.left, y: event.clientY - r.top };
    }
    function showTip(event, d, node, fromFocus) {
      var n = stateAttorneys(d.properties.name).length;
      tooltip.innerHTML = esc(d.properties.name) +
        (n ? ' <span class="tt-count">&middot; ' + n + " attorney" + (n === 1 ? "" : "s") + "</span>"
           : ' <span class="tt-count">&middot; no listings yet</span>');
      if (fromFocus && node) {
        var bb = node.getBoundingClientRect(), r = stage.getBoundingClientRect();
        tooltip.style.left = (bb.left + bb.width / 2 - r.left) + "px";
        tooltip.style.top = (bb.top - r.top) + "px";
      } else { moveTip(event); }
      tooltip.classList.add("is-visible");
    }
    function showStarTip(event, s) {
      tooltip.innerHTML = esc(s.city) + ' <span class="tt-count">&middot; ' + s.attorneys.length + " attorney" + (s.attorneys.length === 1 ? "" : "s") + "</span>";
      moveTip(event);
      tooltip.classList.add("is-visible");
    }
    function moveTip(event) {
      if (!event || event.clientX == null) return;
      var p = tipXY(event);
      tooltip.style.left = p.x + "px";
      tooltip.style.top = p.y + "px";
    }
    function hideTip() { tooltip.classList.remove("is-visible"); }

    el("mapLoading").style.display = "none";
  }

  /* ------------------------------------------------------------------- boot */
  function fail(msg) {
    var loading = el("mapLoading");
    if (loading) { loading.textContent = msg; loading.style.display = "flex"; }
    console.error(msg);
  }

  Promise.all([
    fetch("./site-branding.json").then(function (r) { if (!r.ok) throw new Error("branding"); return r.json(); }),
    fetch("./site-attorneysbystate.txt").then(function (r) { if (!r.ok) throw new Error("attorneys"); return r.text(); }),
    fetch("./vendor/states-10m.json").then(function (r) { if (!r.ok) throw new Error("map"); return r.json(); })
  ]).then(function (res) {
    applyBranding(res[0]);
    parseAttorneys(res[1]);
    renderMap(res[2]);
  }).catch(function (err) {
    // branding/data may still partially apply; surface a friendly map message
    fail("We couldn\u2019t load the map. If you\u2019re viewing this from your computer, open it through a local web server (see README).");
    console.error(err);
  });
})();
