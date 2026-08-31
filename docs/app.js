(function () {
  "use strict";

  const DATA_URL = "data/creatures.json";

  const ELEMENT_CATEGORIES = [
    { key: "strong", label: "Stark mot" },
    { key: "weakness", label: "Svag mot" },
    { key: "immune", label: "Immun mot" },
    { key: "healed", label: "Läks av" },
  ];

  const BEHAVIOUR_FIELDS = [
    { key: "be_paralysed", label: "Kan paralyseras" },
    { key: "be_convinced", label: "Kan convinceas" },
    { key: "be_summoned", label: "Kan summonas" },
    { key: "see_invisible", label: "Ser invisible" },
  ];

  const ELEMENT_COLOR_MAP = {
    fire: "var(--el-fire)",
    ice: "var(--el-ice)",
    energy: "var(--el-energy)",
    earth: "var(--el-earth)",
    death: "var(--el-death)",
    holy: "var(--el-holy)",
    physical: "var(--el-physical)",
    drown: "var(--el-drown)",
    lifedrain: "var(--el-lifedrain)",
    agony: "var(--el-lifedrain)",
  };

  const NEUTRAL_COLOR = "var(--text-muted)";
  const DAMAGE_CATEGORY_KEYS = ["strong", "weakness", "immune"]; // healed är en egen axel, inte del av neutral-beräkningen

  function colorForElement(el) {
    const key = (el || "").toLowerCase();
    return ELEMENT_COLOR_MAP[key] || "var(--el-default)";
  }

  function damageElementsOf(creature) {
    const set = new Set();
    for (const key of DAMAGE_CATEGORY_KEYS) {
      for (const el of creature[key] || []) set.add(el);
    }
    return set;
  }

  function isNeutralTo(creature, element) {
    return !damageElementsOf(creature).has(element);
  }

  // state: selected elements per category (Set of strings), behaviour state per field ("any"|"yes"|"no")
  const state = {
    search: "",
    hpMin: null,
    hpMax: null,
    expMin: null,
    expMax: null,
    speedMin: null,
    speedMax: null,
    armorMin: null,
    armorMax: null,
    elements: { strong: new Set(), weakness: new Set(), immune: new Set(), healed: new Set(), neutral: new Set() },
    behaviour: { be_paralysed: "any", be_convinced: "any", be_summoned: "any", see_invisible: "any" },
  };

  let allCreatures = [];

  function uniqueElementsFor(category, creatures) {
    const set = new Set();
    for (const c of creatures) {
      for (const el of c[category] || []) set.add(el);
    }
    return Array.from(set).sort();
  }

  function uniqueDamageElements(creatures) {
    const set = new Set();
    for (const c of creatures) {
      for (const el of damageElementsOf(c)) set.add(el);
    }
    return Array.from(set).sort();
  }

  function buildChipRow(elements, colorFn, onToggle) {
    const row = document.createElement("div");
    row.className = "chip-row";

    for (const el of elements) {
      const chip = document.createElement("label");
      chip.className = "chip";
      chip.style.setProperty("--chip-color", colorFn(el));

      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = el;
      input.addEventListener("change", () => {
        onToggle(el, input.checked);
        applyFilters();
      });

      const span = document.createElement("span");
      span.textContent = el;

      chip.appendChild(input);
      chip.appendChild(span);
      row.appendChild(chip);
    }

    return row;
  }

  function buildElementFilters(creatures) {
    const container = document.getElementById("element-groups");
    container.innerHTML = "";

    for (const cat of ELEMENT_CATEGORIES) {
      const elements = uniqueElementsFor(cat.key, creatures);
      if (elements.length === 0) continue;

      const group = document.createElement("div");
      group.className = "element-group";

      const title = document.createElement("div");
      title.className = "element-group-title";
      title.textContent = cat.label;
      group.appendChild(title);

      group.appendChild(
        buildChipRow(elements, colorForElement, (el, checked) => {
          if (checked) state.elements[cat.key].add(el);
          else state.elements[cat.key].delete(el);
        })
      );

      container.appendChild(group);
    }

    // Neutral är inget eget fält i datan — det är "inte strong/weakness/immune"
    // för ett givet element, så listan av valbara element beräknas här.
    const neutralElements = uniqueDamageElements(creatures);
    if (neutralElements.length > 0) {
      const group = document.createElement("div");
      group.className = "element-group";

      const title = document.createElement("div");
      title.className = "element-group-title";
      title.textContent = "Neutral mot";
      group.appendChild(title);

      group.appendChild(
        buildChipRow(neutralElements, () => NEUTRAL_COLOR, (el, checked) => {
          if (checked) state.elements.neutral.add(el);
          else state.elements.neutral.delete(el);
        })
      );

      container.appendChild(group);
    }
  }

  function buildBehaviourFilters() {
    const container = document.getElementById("behaviour-group");
    container.innerHTML = "";

    for (const field of BEHAVIOUR_FIELDS) {
      const row = document.createElement("div");
      row.className = "tristate-row";

      const label = document.createElement("span");
      label.textContent = field.label;

      const seg = document.createElement("div");
      seg.className = "seg";

      const options = [
        { value: "any", label: "Alla" },
        { value: "yes", label: "Ja" },
        { value: "no", label: "Nej" },
      ];

      for (const opt of options) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = opt.label;
        btn.className = opt.value === "any" ? "active" : "";
        btn.addEventListener("click", () => {
          state.behaviour[field.key] = opt.value;
          for (const sib of seg.children) sib.classList.remove("active");
          btn.classList.add("active");
          applyFilters();
        });
        seg.appendChild(btn);
      }

      row.appendChild(label);
      row.appendChild(seg);
      container.appendChild(row);
    }
  }

  function matchesElementFilters(creature) {
    for (const cat of ELEMENT_CATEGORIES) {
      const selected = state.elements[cat.key];
      if (selected.size === 0) continue;
      const creatureEls = new Set((creature[cat.key] || []).map((e) => e));
      let matchesAny = false;
      for (const sel of selected) {
        if (creatureEls.has(sel)) {
          matchesAny = true;
          break;
        }
      }
      if (!matchesAny) return false;
    }

    const selectedNeutral = state.elements.neutral;
    if (selectedNeutral.size > 0) {
      let matchesAny = false;
      for (const sel of selectedNeutral) {
        if (isNeutralTo(creature, sel)) {
          matchesAny = true;
          break;
        }
      }
      if (!matchesAny) return false;
    }

    return true;
  }

  function matchesBehaviourFilters(creature) {
    for (const field of BEHAVIOUR_FIELDS) {
      const wanted = state.behaviour[field.key];
      if (wanted === "any") continue;
      const actual = !!creature[field.key];
      if (wanted === "yes" && !actual) return false;
      if (wanted === "no" && actual) return false;
    }
    return true;
  }

  function inRange(value, min, max) {
    if (min != null && (value == null || value < min)) return false;
    if (max != null && (value == null || value > max)) return false;
    return true;
  }

  function matchesRanges(creature) {
    return (
      inRange(creature.hitpoints, state.hpMin, state.hpMax) &&
      inRange(creature.experience_points, state.expMin, state.expMax) &&
      inRange(creature.speed, state.speedMin, state.speedMax) &&
      inRange(creature.armor, state.armorMin, state.armorMax)
    );
  }

  function matchesSearch(creature) {
    if (!state.search) return true;
    return (creature.name || "").toLowerCase().includes(state.search);
  }

  function renderCard(c) {
    const card = document.createElement("article");
    card.className = "card";

    const head = document.createElement("div");
    head.className = "card-head";

    const img = document.createElement("img");
    img.src = c.image_url || "";
    img.alt = "";
    img.loading = "lazy";
    head.appendChild(img);

    const h3 = document.createElement("h3");
    h3.textContent = c.name || c.race;
    head.appendChild(h3);

    card.appendChild(head);

    const stats = document.createElement("div");
    stats.className = "card-stats";
    stats.innerHTML =
      `<span>HP <b>${c.hitpoints ?? "?"}</b></span>` +
      `<span>EXP <b>${c.experience_points ?? "?"}</b></span>` +
      `<span>SPD <b>${c.speed ?? "?"}</b></span>` +
      `<span>ARM <b>${c.armor ?? "?"}</b></span>`;
    card.appendChild(stats);

    const badges = document.createElement("div");
    badges.className = "card-badges";

    const badgePrefix = { strong: "+", weakness: "−", immune: "IMM", healed: "HEALS" };
    for (const cat of ELEMENT_CATEGORIES) {
      for (const el of c[cat.key] || []) {
        const b = document.createElement("span");
        b.className = "badge";
        b.style.setProperty("--badge-color", colorForElement(el));
        b.textContent = `${badgePrefix[cat.key]} ${el}`;
        badges.appendChild(b);
      }
    }

    for (const field of BEHAVIOUR_FIELDS) {
      if (c[field.key]) {
        const b = document.createElement("span");
        b.className = "badge behaviour";
        b.textContent = field.label;
        badges.appendChild(b);
      }
    }

    card.appendChild(badges);
    return card;
  }

  function applyFilters() {
    const filtered = allCreatures.filter(
      (c) => matchesSearch(c) && matchesRanges(c) && matchesElementFilters(c) && matchesBehaviourFilters(c)
    );

    const grid = document.getElementById("grid");
    const emptyState = document.getElementById("empty-state");
    grid.innerHTML = "";

    if (filtered.length === 0) {
      emptyState.hidden = false;
    } else {
      emptyState.hidden = true;
      const frag = document.createDocumentFragment();
      for (const c of filtered) frag.appendChild(renderCard(c));
      grid.appendChild(frag);
    }

    document.getElementById("result-count").textContent = `${filtered.length} / ${allCreatures.length} monster`;
  }

  function wireStaticControls() {
    document.getElementById("search").addEventListener("input", (e) => {
      state.search = e.target.value.trim().toLowerCase();
      applyFilters();
    });

    const numField = (id, key) => {
      document.getElementById(id).addEventListener("input", (e) => {
        const v = e.target.value;
        state[key] = v === "" ? null : Number(v);
        applyFilters();
      });
    };
    numField("hp-min", "hpMin");
    numField("hp-max", "hpMax");
    numField("exp-min", "expMin");
    numField("exp-max", "expMax");
    numField("speed-min", "speedMin");
    numField("speed-max", "speedMax");
    numField("armor-min", "armorMin");
    numField("armor-max", "armorMax");

    document.getElementById("reset-filters").addEventListener("click", () => {
      state.search = "";
      state.hpMin = state.hpMax = state.expMin = state.expMax = null;
      state.speedMin = state.speedMax = state.armorMin = state.armorMax = null;
      for (const cat of ELEMENT_CATEGORIES) state.elements[cat.key].clear();
      state.elements.neutral.clear();
      for (const field of BEHAVIOUR_FIELDS) state.behaviour[field.key] = "any";

      document.getElementById("search").value = "";
      document.getElementById("hp-min").value = "";
      document.getElementById("hp-max").value = "";
      document.getElementById("exp-min").value = "";
      document.getElementById("exp-max").value = "";
      document.getElementById("speed-min").value = "";
      document.getElementById("speed-max").value = "";
      document.getElementById("armor-min").value = "";
      document.getElementById("armor-max").value = "";
      document.querySelectorAll(".chip input").forEach((el) => (el.checked = false));
      document.querySelectorAll(".tristate-row .seg").forEach((seg) => {
        for (const btn of seg.children) btn.classList.remove("active");
        seg.children[0].classList.add("active");
      });

      applyFilters();
    });
  }

  async function init() {
    wireStaticControls();
    buildBehaviourFilters();

    try {
      const res = await fetch(DATA_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      allCreatures = payload.creatures || [];

      buildElementFilters(allCreatures);
      applyFilters();

      const updatedAt = document.getElementById("updated-at");
      if (payload.updated_at) {
        const d = new Date(payload.updated_at);
        updatedAt.textContent = `Data uppdaterad ${d.toLocaleDateString("sv-SE")}`;
      }
    } catch (err) {
      document.getElementById("result-count").textContent = "Kunde inte ladda creature-data.";
      console.error(err);
    }
  }

  init();
})();
