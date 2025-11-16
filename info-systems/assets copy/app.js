/* ============================================================
 * Event Bus - lightweight pub/sub
 * ============================================================ */

const EventBus = (() => {
  const map = new Map();
  return {
    on(event, handler) {
      if (!map.has(event)) map.set(event, new Set());
      map.get(event).add(handler);
      return () => map.get(event)?.delete(handler);
    },
    emit(event, payload) {
      map.get(event)?.forEach((handler) => handler(payload));
    },
  };
})();

/* ============================================================
 * Utility Helpers
 * ============================================================ */

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

const formatClock = (value) => value.toString().padStart(4, "0");
const formatInstruction = (value) => value.toString().padStart(2, "0");

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/* ============================================================
 * Static Data
 * ============================================================ */

const COMPONENT_DATA = {
  cpu: {
    title: "Merkezi İşlem Birimi (CPU)",
    category: "Bileşen",
    body: [
      "Talimatları adım adım işler: fetch, decode, execute, write-back.",
      "İçerdiği kayıtlar (PC, MAR, IR, MBR) veri ve adresleri geçici olarak tutar.",
    ],
    metrics: { bus: "Sistem Veri Yolu", source: "PC / Kontrol", target: "ALU / Bellek" },
  },
  pc: {
    title: "Program Counter (PC)",
    category: "Kayıt",
    body: [
      "Bir sonraki talimatın adresini tutar.",
      "Fetch adımı sonunda güncellenerek talimat akışını yönetir.",
    ],
    metrics: { bus: "Adres Yolu", source: "PC", target: "MAR" },
  },
  mar: {
    title: "Memory Address Register (MAR)",
    category: "Kayıt",
    body: [
      "PC'den gelen adresi bellek birimine gönderir.",
      "Okuma ve yazma operasyonlarında adres referansı olarak kullanılır.",
    ],
    metrics: { bus: "Adres Yolu", source: "MAR", target: "Bellek" },
  },
  ir: {
    title: "Instruction Register (IR)",
    category: "Kayıt",
    body: [
      "Fetch işlemiyle gelen talimat burada tutulur.",
      "Kontrol birimi talimatı çözümler ve gerekli sinyalleri üretir.",
    ],
    metrics: { bus: "Kontrol Sinyali", source: "IR", target: "Kontrol Ünitesi" },
  },
  mbr: {
    title: "Memory Buffer/Data Register (MBR/MDR)",
    category: "Kayıt",
    body: [
      "Bellekten gelen ya da belleğe giden veriyi geçici olarak saklar.",
      "ALU sonuçlarını write-back sırasında belleğe buradan aktarır.",
    ],
    metrics: { bus: "Veri Yolu", source: "MBR", target: "Bellek" },
  },
  "control-unit": {
    title: "Kontrol Ünitesi",
    category: "Alt Birim",
    body: [
      "IR'daki talimatı çözümler, mikro operasyonları sıralar.",
      "ALU, kayıtlar ve veri yolları için gerekli kontrol sinyallerini üretir.",
    ],
    metrics: { bus: "Kontrol Yolu", source: "Kontrol Ünitesi", target: "ALU / Bus" },
  },
  alu: {
    title: "Arithmetic Logic Unit (ALU)",
    category: "Alt Birim",
    body: [
      "Toplama, çıkarma, mantıksal karşılaştırma gibi işlemleri yürütür.",
      "Flag/PSW değerleri üzerinden koşullu dallanmalara temel oluşturur.",
    ],
    metrics: { bus: "Veri Yolu", source: "MBR + Kayıtlar", target: "MBR / Flagler" },
  },
  memory: {
    title: "Ana Bellek",
    category: "Bileşen",
    body: [
      "Talimat ve veri bloklarını tek bir adres alanında saklar.",
      "Von Neumann mimarisinde talimat ve veri aynı veri yolunu paylaşır.",
    ],
    metrics: { bus: "Veri + Adres", source: "Bellek", target: "CPU / I/O" },
  },
  "instruction-bank": {
    title: "Talimat Bankası",
    category: "Bellek",
    body: [
      "Program kodunun tutulduğu ardışık bellek adresleri.",
      "Fetch adımında IR'a aktarılır.",
    ],
    metrics: { bus: "Veri Yolu", source: "Bellek", target: "IR" },
  },
  "data-bank": {
    title: "Veri Bankası",
    category: "Bellek",
    body: [
      "Programın ihtiyaç duyduğu verileri saklar.",
      "ALU işlemlerinde MBR üzerinden veri alır ve yazar.",
    ],
    metrics: { bus: "Veri Yolu", source: "Bellek", target: "MBR" },
  },
  "io-module": {
    title: "Girdi/Çıktı Modülü",
    category: "Bileşen",
    body: [
      "Çevre birimlerinin CPU ve bellekle senkron çalışmasını sağlar.",
      "Bufferlar gecikmeleri gizleyerek veri akışını dengeler.",
    ],
    metrics: { bus: "I/O Bus", source: "I/O Modülü", target: "CPU / Bellek" },
  },
  "io-buffer": {
    title: "I/O Bufferları",
    category: "Alt Birim",
    body: [
      "G/Ç cihazlarından gelen veriyi geçici olarak depolar.",
      "DMA veya kesmelerle CPU'ya veri taşır.",
    ],
    metrics: { bus: "I/O Bus", source: "G/Ç Cihazı", target: "MBR" },
  },
};

const SCENARIOS = {
  load: [
    {
      label: "Fetch",
      description: "PC adresi MAR'a gönderilir, bellekten talimat çekilir ve IR'a yüklenir.",
      buses: ["address-bus", "data-bus"],
      nodes: ["pc", "mar", "memory", "instruction-bank", "ir"],
      source: "PC",
      target: "IR",
    },
    {
      label: "Decode",
      description:
        "IR talimatı çözümler, kontrol birimi LOAD komutunu tanır ve veri konumunu belirler.",
      buses: ["control-bus"],
      nodes: ["control-unit", "ir"],
      source: "IR",
      target: "Kontrol Ünitesi",
    },
    {
      label: "Execute",
      description:
        "MAR veri adresini alır, bellekten veri MBR'ye aktarılır. ALU gerekirse veri üzerinde işlem yapar.",
      buses: ["address-bus", "data-bus"],
      nodes: ["mar", "memory", "data-bank", "mbr"],
      source: "Bellek",
      target: "MBR",
    },
    {
      label: "Write-back",
      description:
        "MBR'deki veri hedef kayda yazılır (örneğin genel amaçlı kayıt). PC bir sonraki talimatı gösterecek şekilde artar.",
      buses: ["control-bus"],
      nodes: ["mbr", "control-unit", "pc"],
      source: "MBR",
      target: "Register Dosyası",
    },
  ],
  add: [
    {
      label: "Fetch",
      description:
        "Toplama talimatı getirildi. Operant adresleri talimat içinde yer alıyor.",
      buses: ["address-bus", "data-bus"],
      nodes: ["pc", "mar", "memory", "instruction-bank", "ir"],
      source: "PC",
      target: "IR",
    },
    {
      label: "Decode",
      description:
        "Kontrol birimi kaynak ve hedef adresleri çözümler, ALU için hazırlık yapılır.",
      buses: ["control-bus"],
      nodes: ["control-unit", "ir"],
      source: "IR",
      target: "Kontrol Ünitesi",
    },
    {
      label: "Execute",
      description:
        "İki operand bellekten/registrelerden MBR aracılığıyla ALU'ya taşınır, ALU toplama işlemini yapar.",
      buses: ["data-bus"],
      nodes: ["memory", "data-bank", "mbr", "alu"],
      source: "Bellek / MBR",
      target: "ALU",
    },
    {
      label: "Write-back",
      description:
        "ALU sonucu MBR üzerinden hedef kayda ve gerekirse belleğe yazılır. Carry/Zero flagleri güncellenir.",
      buses: ["data-bus", "control-bus"],
      nodes: ["alu", "mbr", "memory", "control-unit"],
      source: "ALU",
      target: "MBR / Bellek",
    },
  ],
  store: [
    {
      label: "Fetch",
      description:
        "STORE talimatı alınır; hangi registrenin ve adresin kullanılacağı belirlenir.",
      buses: ["address-bus", "data-bus"],
      nodes: ["pc", "mar", "memory", "instruction-bank", "ir"],
      source: "PC",
      target: "IR",
    },
    {
      label: "Decode",
      description:
        "Kontrol birimi kaynak registra ulaşır, hedef bellek adresini hazırlar.",
      buses: ["control-bus", "address-bus"],
      nodes: ["control-unit", "ir", "mar"],
      source: "Kontrol Ünitesi",
      target: "MAR",
    },
    {
      label: "Execute",
      description:
        "Kaynak registrenin içeriği MBR'ye kopyalanır; MAR hedef adresi tutar.",
      buses: ["data-bus"],
      nodes: ["mbr", "control-unit"],
      source: "CPU Kayıtları",
      target: "MBR",
    },
    {
      label: "Write-back",
      description:
        "MBR içeriği veri yoluyla belleğe yazılır; PC bir sonraki talimata geçer.",
      buses: ["data-bus", "address-bus"],
      nodes: ["mbr", "memory", "data-bank", "pc"],
      source: "MBR",
      target: "Bellek",
    },
  ],
};

const COMPONENT_CARDS = [
  {
    title: "Program Counter",
    body: "Talimat adreslerini sırayla tutarak kontrol akışını belirler.",
    tags: ["Adresleme", "Sıralı Akış"],
  },
  {
    title: "Kontrol Ünitesi",
    body: "Mikro talimatları tetikleyerek CPU'daki tüm sinyalleri senkronize eder.",
    tags: ["Mikro Kod", "Zamanlama"],
  },
  {
    title: "ALU",
    body: "Aritmetik+mantık işlemlerini pipeline halinde işleyebilir.",
    tags: ["Pipeline", "Flagler"],
  },
  {
    title: "Ana Bellek",
    body: "Adreslenebilir tekdüze alan; veri ve talimat aynı veri yolunu kullanır.",
    tags: ["DRAM", "Von Neumann Darboğazı"],
  },
  {
    title: "Veri Yolları",
    body: "Adres, veri ve kontrol çizgileri senkron şekilde çalışır.",
    tags: ["Tri-State", "Sistem Bus"],
  },
  {
    title: "G/Ç Modülü",
    body: "DMA ve kesme mekanizmalarıyla CPU yükünü azaltır.",
    tags: ["DMA", "Kesme"],
  },
];

const TIMELINE_DATA = [
  {
    era: "1. Nesil",
    title: "Vakum Tüpleri Çağı (1946-1956)",
    description:
      "ENIAC ve UNIVAC gibi makineler; devasa boyutlarda, yüksek güç tüketimi ve düşük güvenilirlik.",
    highlights: [
      "Vakum tüpleri ana aktif bileşen",
      "Saniyede binlerce işlem",
      "Manuel kablolama ile programlama",
    ],
    visual: "Vakum tüpleri ve panelli kontrol odaları",
  },
  {
    era: "2. Nesil",
    title: "Transistör Devrimi (1957-1963)",
    description:
      "Transistörler daha küçük, daha hızlı ve daha dayanıklı bilgisayarların önünü açtı.",
    highlights: [
      "Isı ve enerji tüketiminde büyük düşüş",
      "İş, bilim ve mühendislikte yaygınlaşma",
      "Assembly ve yüksek seviyeli dillerin ortaya çıkışı",
    ],
    visual: "Transistör kartları ve erken mainframe kasaları",
  },
  {
    era: "3. Nesil",
    title: "Entegre Devreler (1964-1979)",
    description:
      "IC'ler sayesinde minicomputer'lar doğdu; kullanıcı dostu işletim sistemleri gelişti.",
    highlights: ["IC tabanlı modüller", "Zaman paylaşımlı işletim sistemleri", "Büyüyen yazılım ekosistemi"],
    visual: "Tek kartlık IC dizileri, minicomputer panelleri",
  },
  {
    era: "4. Nesil",
    title: "VLSI/Bilgisayar Devrimi (1980-2000+)",
    description:
      "Mikroişlemciler ve kişisel bilgisayarlar; milyonlarca transistör tek çipte.",
    highlights: [
      "VLSI/ULSI teknikleri",
      "Kişisel bilgisayarların yaygınlaşması",
      "İnternet ve ağ mimarilerinin temeli",
    ],
    visual: "PCB üzerinde mikroişlemci soketleri, PC kasaları",
  },
  {
    era: "5. Nesil",
    title: "Paralelizm & Heterojenlik (2000+)",
    description:
      "Süper bilgisayarlar, GPU hızlandırma ve devasa paralel mimariler exaFLOP seviyesine ulaşıyor.",
    highlights: [
      "GPU/CPU hibritleri",
      "Massively parallel cluster mimarileri",
      "Yapay zeka ve büyük veri iş yükleri",
    ],
    visual: "Süperbilgisayar rafları ve yüksek yoğunluklu küme topolojileri",
  },
];

const MICROFACTS = [
  {
    title: "Von Neumann Darboğazı",
    text: "Talimat ve verinin aynı veri yolunu paylaşması, yüksek bant gerektiren uygulamalarda darboğaz oluşmasına yol açar.",
  },
  {
    title: "Clock Cycle",
    text: "Modern CPU'lar tek bir çevrimde birden fazla mikro işlemi tamamlayabilir; pipeline sayesinde fetch ve execute eşzamanlı yürür.",
  },
  {
    title: "Ön Bellek Katmanları",
    text: "L1/L2/L3 cache hiyerarşisi, bellek erişim gecikmesini saklayarak Von Neumann dar boğazını hafifletir.",
  },
  {
    title: "Control Store",
    text: "Mikroprogramlı kontrol ünitelerinde, mikro talimatlar ROM-benzeri kontrol belleğinde saklanır.",
  },
  {
    title: "DMA Avantajı",
    text: "Direct Memory Access, G/Ç modülünün belleğe doğrudan erişerek CPU'yu meşgul etmemesini sağlar.",
  },
];

const BUS_USAGE = {
  load: [
    [5, 0, 0, 0, 0, 0],
    [3, 0, 0, 0, 0, 0],
    [0, 4, 0, 0, 0, 0],
    [0, 0, 6, 0, 0, 0],
  ],
  add: [
    [5, 0, 0, 0, 0, 0],
    [3, 0, 0, 0, 0, 0],
    [0, 5, 0, 0, 0, 0],
    [0, 2, 4, 0, 0, 0],
  ],
  store: [
    [5, 0, 0, 0, 0, 0],
    [3, 0, 0, 0, 0, 0],
    [0, 4, 0, 0, 0, 0],
    [0, 6, 0, 0, 0, 0],
  ],
};

const BUS_LABELS = ["Data", "Address", "Control", "I/O", "Internal", "DMA"];

/* ============================================================
 * Theme Module
 * ============================================================ */

const ThemeModule = (() => {
  const STORAGE_KEY = "vn-theme";
  const toggle = $("#theme-toggle");

  const setTheme = (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
    toggle.textContent = theme === "dark" ? "☀️" : "🌙";
  };

  const init = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = stored || (prefersDark ? "dark" : "light");
    setTheme(theme);
    toggle?.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      setTheme(next);
    });
  };

  return { init, setTheme };
})();

/* ============================================================
 * Scroll Module (hero buttons)
 * ============================================================ */

const ScrollModule = (() => {
  const buttons = $$("[data-scroll-target]");
  const init = () => {
    buttons.forEach((btn) =>
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-scroll-target");
        if (!target) return;
        const el = document.querySelector(target);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      })
    );
  };
  return { init };
})();

/* ============================================================
 * Panel Module
 * ============================================================ */

const PanelModule = (() => {
  const title = $("#info-title");
  const subtitle = $("#info-subtitle");
  const body = $("#info-body");
  const badge = $("#info-category");
  const activeBus = $("#info-active-bus");
  const infoSource = $("#info-source");
  const infoTarget = $("#info-target");

  const defaultState = () => {
    badge.textContent = "Bileşen";
    title.textContent = "Bir bileşen seç";
    subtitle.textContent =
      "Diyagramda bir noktayı vurgula veya sağdaki simülasyon adımlarından birini başlat.";
    body.innerHTML =
      "<p>Simülasyon sırasında veri yolları yanıp sönecek ve ilgili bileşen burada detaylı olarak açıklanacak.</p>";
    activeBus.textContent = "—";
    infoSource.textContent = "—";
    infoTarget.textContent = "—";
  };

  const update = ({ title: ttl, category, body: paragraphs, metrics }) => {
    badge.textContent = category ?? "Bileşen";
    title.textContent = ttl;
    subtitle.textContent = "Seçilen bileşen için detaylar";
    body.innerHTML = paragraphs.map((p) => `<p>${p}</p>`).join("");
    activeBus.textContent = metrics?.bus ?? "—";
    infoSource.textContent = metrics?.source ?? "—";
    infoTarget.textContent = metrics?.target ?? "—";
  };

  EventBus.on("panel:update", update);
  EventBus.on("panel:reset", defaultState);

  const init = () => defaultState();
  return { init, update };
})();

/* ============================================================
 * Diagram Module
 * ============================================================ */

const DiagramModule = (() => {
  const svg = $("#architecture-diagram");
  const tooltip = $("#diagram-tooltip");
  const flowLayer = $("#flow-layer");

  const highlightNodes = (nodes) => {
    $$(".node, .sub-node, .memory-bank", svg).forEach((node) => {
      const id = node.getAttribute("data-node");
      node.classList.toggle("is-active", nodes?.includes(id));
      if (nodes?.includes(id)) {
        node.querySelectorAll("rect,path").forEach((shape) => {
          shape.style.fill = "rgba(46,106,219,0.32)";
          shape.style.stroke = "rgba(46,106,219,0.9)";
        });
      } else {
        node.querySelectorAll("rect,path").forEach((shape) => {
          shape.style.fill = "";
          shape.style.stroke = "";
        });
      }
    });
  };

  const highlightBuses = (buses) => {
    $$(".bus-line", svg).forEach((line) => {
      line.classList.toggle("is-active", buses?.includes(line.getAttribute("data-link")));
    });
  };

  const showTooltip = (event, content) => {
    if (!tooltip || !content) return;
    tooltip.hidden = false;
    tooltip.textContent = content;
    const rect = tooltip.parentElement.getBoundingClientRect();
    const offset = 16;
    tooltip.style.left = `${Math.min(event.offsetX + offset, rect.width - tooltip.offsetWidth - offset)}px`;
    tooltip.style.top = `${Math.max(event.offsetY + offset, offset)}px`;
  };

  const hideTooltip = () => {
    if (tooltip) tooltip.hidden = true;
  };

  const handleNodeFocus = (node) => {
    const id = node.getAttribute("data-node");
    const data = COMPONENT_DATA[id];
    if (data) EventBus.emit("panel:update", data);
  };

  const handleNodeBlur = () => {
    EventBus.emit("panel:reset");
  };

  const handleNodeClick = (node) => {
    const id = node.getAttribute("data-node");
    const data = COMPONENT_DATA[id];
    if (data) {
      EventBus.emit("panel:update", data);
      EventBus.emit("simulation:focus-node", { id });
    }
  };

  const registerNodeEvents = () => {
    $$(".node, .sub-node, .memory-bank", svg).forEach((node) => {
      node.addEventListener("mouseenter", (ev) => {
        const id = node.getAttribute("data-node");
        const data = COMPONENT_DATA[id];
        showTooltip(ev, data?.title ?? id);
      });
      node.addEventListener("mouseleave", hideTooltip);
      node.addEventListener("focus", () => handleNodeFocus(node));
      node.addEventListener("blur", handleNodeBlur);
      node.addEventListener("click", () => handleNodeClick(node));
      node.setAttribute("role", "button");
      node.setAttribute("aria-label", COMPONENT_DATA[node.getAttribute("data-node")]?.title ?? "Bileşen");
    });
  };

  const clearFlowParticles = () => {
    while (flowLayer?.firstChild) flowLayer.removeChild(flowLayer.firstChild);
  };

  const animateParticles = (pathId, duration = 2000, color = "var(--color-accent)") => {
    if (prefersReducedMotion) return;
    const path = $(`.bus-line[data-link="${pathId}"]`, svg);
    if (!path) return;
    const length = path.getTotalLength();
    const particleCount = 6;
    clearFlowParticles();

    for (let i = 0; i < particleCount; i += 1) {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("r", 6);
      circle.setAttribute("class", "flow-particle");
      circle.style.fill = color;
      const start = (i / particleCount) * length;
      let startTime = null;
      const animate = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = (elapsed % duration) / duration;
        const distance = start + progress * length;
        const point = path.getPointAtLength(distance % length);
        circle.setAttribute("cx", point.x);
        circle.setAttribute("cy", point.y);
        if (!circle.dataset.stopped) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
      flowLayer?.appendChild(circle);
    }
  };

  EventBus.on("diagram:highlight-nodes", highlightNodes);
  EventBus.on("diagram:highlight-buses", highlightBuses);
  EventBus.on("diagram:animate-bus", (bus) => animateParticles(bus));
  EventBus.on("diagram:clear-flow", clearFlowParticles);

  const init = () => {
    registerNodeEvents();
  };
  return { init, highlightNodes, highlightBuses, animateParticles, clearFlowParticles };
})();

/* ============================================================
 * Simulation Module
 * ============================================================ */

const SimulationModule = (() => {
  const playBtn = $("#sim-play");
  const pauseBtn = $("#sim-pause");
  const stepForwardBtn = $("#sim-step-forward");
  const stepBackBtn = $("#sim-step-back");
  const resetBtn = $("#sim-reset");
  const speedInput = $("#sim-speed");
  const scenarioSelect = $("#scenario-select");
  const cycleDisplay = $("#clock-cycle");
  const instructionDisplay = $("#instruction-counter");
  const stateIndicator = $("#state-indicator");
  const playFocus = $("#play-focus");
  const heatmapCanvas = $("#bus-heatmap");
  const stepList = $("#step-list");
  const stepNarration = $("#step-narration");
  const stepProgressBar = $("#step-progress-bar");
  const stepProgressLabel = $("#step-progress-label");

  let stepButtons = [];

  let scenarioKey = "load";
  let stepIndex = 0;
  let isPlaying = false;
  let rafId;
  let lastTimestamp;
  let speed = 1;
  let accumulated = 0;
  const stepDuration = 2200;

  const getScenario = () => SCENARIOS[scenarioKey] ?? SCENARIOS.load;

  const renderStepList = () => {
    if (!stepList) return;
    const steps = getScenario();
    stepList.innerHTML = steps
      .map(
        (step, i) => `
        <li>
          <button
            type="button"
            class="step-pill"
            data-step="${i}"
            id="step-pill-${scenarioKey}-${i}"
            role="option"
            aria-selected="${i === stepIndex}"
          >
            ${i + 1}. ${step.label}
          </button>
        </li>`
      )
      .join("");
    stepButtons = $$(".step-pill", stepList);
    stepButtons.forEach((btn) =>
      btn.addEventListener("click", () => {
        const targetStep = Number(btn.dataset.step);
        if (Number.isNaN(targetStep)) return;
        stopPlaying();
        stepIndex = targetStep;
        updateUI();
      })
    );
    stepList.setAttribute("aria-activedescendant", stepButtons[stepIndex]?.id ?? "");
  };

  const updateStepMetadata = (steps, step) => {
    if (!stepList) return;
    if (stepButtons.length !== steps.length) {
      renderStepList();
    }
    stepButtons.forEach((btn, idx) => {
      const isActive = idx === stepIndex;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
    });
    stepList.setAttribute("aria-activedescendant", stepButtons[stepIndex]?.id ?? "");
    if (stepNarration) {
      stepNarration.textContent = step?.description ?? "Adım açıklaması bulunamadı.";
    }
    if (stepProgressBar) {
      const progress = steps.length ? ((stepIndex + 1) / steps.length) * 100 : 0;
      stepProgressBar.style.width = `${progress}%`;
    }
    if (stepProgressLabel) {
      const total = steps.length || 1;
      stepProgressLabel.textContent = `Adım ${stepIndex + 1} / ${total}`;
    }
  };

  const updateUI = () => {
    const steps = getScenario();
    const step = steps[stepIndex];
    cycleDisplay.textContent = formatClock(stepIndex + 1);
    instructionDisplay.textContent = formatInstruction(stepIndex + 1);
    stateIndicator.textContent = step?.label ?? "Idle";
    EventBus.emit("panel:update", {
      title: `${step?.label ?? "Adım"} (${scenarioKey.toUpperCase()})`,
      category: "Simülasyon",
      body: [step?.description ?? "Beklemede"],
      metrics: {
        bus: step?.buses?.map((b) => b.replace("-", " ")).join(", ") ?? "—",
        source: step?.source ?? "—",
        target: step?.target ?? "—",
      },
    });
    EventBus.emit("diagram:highlight-nodes", step?.nodes ?? []);
    EventBus.emit("diagram:highlight-buses", step?.buses ?? []);
    if (step?.buses?.length) EventBus.emit("diagram:animate-bus", step.buses[0]);
    updateStepMetadata(steps, step);
  };

  const stopPlaying = () => {
    isPlaying = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    accumulated = 0;
    lastTimestamp = undefined;
  };

  const reset = () => {
    stopPlaying();
    stepIndex = 0;
    EventBus.emit("diagram:clear-flow");
    updateUI();
  };

  const next = () => {
    const steps = getScenario();
    stepIndex = (stepIndex + 1) % steps.length;
    updateUI();
  };

  const prev = () => {
    const steps = getScenario();
    stepIndex = (stepIndex - 1 + steps.length) % steps.length;
    updateUI();
  };

  const play = () => {
    if (isPlaying) return;
    isPlaying = true;
    const loop = (timestamp) => {
      if (!isPlaying) return;
      if (lastTimestamp === undefined) lastTimestamp = timestamp;
      const delta = timestamp - lastTimestamp;
      lastTimestamp = timestamp;
      accumulated += delta * speed;
      if (accumulated >= stepDuration) {
        accumulated = 0;
        next();
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  };

  const handleScenarioChange = () => {
    scenarioKey = scenarioSelect.value;
    renderStepList();
    reset();
    drawHeatmap();
  };

  const handleSpeedChange = () => {
    speed = parseFloat(speedInput.value) || 1;
  };

  const handleFocusPlay = () => {
    const step = getScenario()[stepIndex];
    if (step?.nodes?.length) EventBus.emit("diagram:highlight-nodes", step.nodes);
  };

  const handleKeyboard = (event) => {
    if (event.key === " " && document.activeElement.tagName !== "INPUT") {
      event.preventDefault();
      isPlaying ? stopPlaying() : play();
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      stopPlaying();
      next();
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      stopPlaying();
      prev();
    }
  };

  const drawHeatmap = () => {
    const ctx = heatmapCanvas?.getContext("2d");
    if (!ctx) return;
    const data = BUS_USAGE[scenarioKey] ?? BUS_USAGE.load;
    const rows = BUS_LABELS.length;
    const cols = data[0]?.length ?? 6;
    const cellWidth = heatmapCanvas.width / cols;
    const cellHeight = heatmapCanvas.height / rows;
    ctx.clearRect(0, 0, heatmapCanvas.width, heatmapCanvas.height);

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const value = data[r]?.[c] ?? 0;
        const intensity = clamp(value / 6, 0, 1);
        ctx.fillStyle = `rgba(46, 106, 219, ${0.08 + intensity * 0.55})`;
        ctx.fillRect(c * cellWidth, r * cellHeight, cellWidth - 2, cellHeight - 2);
      }
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.font = "12px var(--font-mono)";
      ctx.fillText(BUS_LABELS[r], 4, (r + 0.7) * cellHeight);
    }
  };

  const initControls = () => {
    playBtn?.addEventListener("click", play);
    pauseBtn?.addEventListener("click", stopPlaying);
    stepForwardBtn?.addEventListener("click", () => {
      stopPlaying();
      next();
    });
    stepBackBtn?.addEventListener("click", () => {
      stopPlaying();
      prev();
    });
    resetBtn?.addEventListener("click", reset);
    speedInput?.addEventListener("input", handleSpeedChange);
    scenarioSelect?.addEventListener("change", handleScenarioChange);
    playFocus?.addEventListener("click", handleFocusPlay);
    document.addEventListener("keydown", handleKeyboard);
  };

  EventBus.on("simulation:focus-node", ({ id }) => {
    const scenario = getScenario();
    const nextFocusIndex = scenario.findIndex((step) => step.nodes?.includes(id));
    if (nextFocusIndex >= 0) {
      stepIndex = nextFocusIndex;
      updateUI();
    }
  });

  const init = () => {
    initControls();
    handleSpeedChange();
    renderStepList();
    reset();
    drawHeatmap();
  };

  return {
    init,
    play,
    pause: stopPlaying,
    next,
    prev,
    reset,
  };
})();

/* ============================================================
 * Accordion Module
 * ============================================================ */

const AccordionModule = (() => {
  const items = $$(".accordion-item");

  const toggleItem = (item) => {
    const isOpen = item.classList.contains("is-open");
    items.forEach((el) => el.classList.remove("is-open"));
    if (!isOpen) item.classList.add("is-open");
  };

  const init = () => {
    items.forEach((item) => {
      const trigger = $(".accordion-trigger", item);
      trigger?.addEventListener("click", () => toggleItem(item));
    });
  };

  return { init };
})();

/* ============================================================
 * Component Cards Module
 * ============================================================ */

const ComponentModule = (() => {
  const grid = $("#component-grid");

  const renderCards = () => {
    if (!grid) return;
    grid.innerHTML = COMPONENT_CARDS.map(
      (card) => `
      <article class="component-card">
        <h3>${card.title}</h3>
        <p>${card.body}</p>
        <div class="component-meta">
          ${card.tags.map((tag) => `<span>${tag}</span>`).join("")}
        </div>
      </article>`
    ).join("");
  };

  const init = () => renderCards();
  return { init };
})();

/* ============================================================
 * Timeline Module
 * ============================================================ */

const TimelineModule = (() => {
  const slider = $("#generation-slider");
  const era = $("#generation-era");
  const title = $("#generation-title");
  const description = $("#generation-description");
  const highlights = $("#generation-highlights");
  const visual = $("#generation-visual");

  const update = (index) => {
    const data = TIMELINE_DATA[index] ?? TIMELINE_DATA[0];
    era.textContent = data.era;
    title.textContent = data.title;
    description.textContent = data.description;
    highlights.innerHTML = data.highlights.map((item) => `<li>${item}</li>`).join("");
    visual.textContent = data.visual;
    slider.setAttribute("aria-valuetext", data.era);
  };

  const init = () => {
    slider?.addEventListener("input", () => update(Number(slider.value)));
    update(Number(slider?.value ?? 0));
  };

  return { init, update };
})();

/* ============================================================
 * Microfacts Module
 * ============================================================ */

const MicrofactModule = (() => {
  const card = $("#microfact-card");
  const titleEl = $("#microfact-title");
  const textEl = $("#microfact-text");
  let index = 0;
  let interval;

  const update = () => {
    const fact = MICROFACTS[index % MICROFACTS.length];
    titleEl.textContent = fact.title;
    textEl.textContent = fact.text;
    index += 1;
  };

  const start = () => {
    update();
    if (prefersReducedMotion) return;
    interval = setInterval(update, 15000);
  };

  const init = () => {
    if (!card) return;
    start();
  };

  return { init };
})();

/* ============================================================
 * Slide Atlas Module
 * ============================================================ */

const SlideAtlasModule = (() => {
  const DATA_URL = "assets/data/slideAtlas.json";
  const listEl = $("#slide-atlas-list");
  const rangeEl = $("#slide-atlas-range");
  const titleEl = $("#slide-atlas-title");
  const summaryEl = $("#slide-atlas-summary");
  const highlightsEl = $("#slide-atlas-highlights");
  const openBtn = $("#slide-atlas-open");
  const previewImg = $("#slide-atlas-image");
  const placeholder = $("#slide-placeholder");

  let atlasData = [];
  let activeId;

  const buildListItem = (item) => `
    <li>
      <button
        type="button"
        class="slide-atlas-item ${item.id === activeId ? "is-active" : ""}"
        data-id="${item.id}"
        aria-selected="${item.id === activeId}"
        role="option"
      >
        <span>${item.title}</span>
        <small>${item.range}</small>
      </button>
    </li>
  `;

  const renderList = () => {
    if (!listEl) return;
    listEl.innerHTML = atlasData.map(buildListItem).join("");
    $$(".slide-atlas-item", listEl).forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        selectItem(id);
      });
    });
  };

  const renderHighlights = (highlights = []) => {
    if (!highlightsEl) return;
    highlightsEl.innerHTML = highlights.map((item) => `<li>${item}</li>`).join("");
  };

  const selectItem = (id) => {
    const item = atlasData.find((entry) => entry.id === id);
    if (!item) return;
    activeId = id;

    rangeEl.textContent = item.range;
    titleEl.textContent = item.title;
    summaryEl.textContent = item.summary;
    renderHighlights(item.highlights);

    if (item.images?.length) {
      const [firstImage] = item.images;
      if (previewImg) {
        previewImg.src = firstImage;
        previewImg.alt = `${item.title} önizleme görseli`;
        previewImg.hidden = false;
      }
      if (placeholder) placeholder.hidden = true;
      if (openBtn) {
        openBtn.href = firstImage;
        openBtn.hidden = false;
      }
    } else {
      if (previewImg) {
        previewImg.src = "";
        previewImg.hidden = true;
      }
      if (placeholder) {
        placeholder.hidden = false;
        placeholder.textContent = "Bu başlık için görsel bulunmuyor.";
      }
      if (openBtn) openBtn.hidden = true;
    }

    if (listEl) {
      $$(".slide-atlas-item", listEl).forEach((btn) => {
        const isActive = btn.getAttribute("data-id") === id;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-selected", String(isActive));
      });
    }
  };

  const handleError = () => {
    if (summaryEl) {
      summaryEl.textContent =
        "Görsel atlas verileri yüklenemedi. Lütfen sayfayı yeniledikten sonra yeniden deneyin.";
    }
  };

  const loadData = async () => {
    try {
      const response = await fetch(DATA_URL);
      if (!response.ok) throw new Error("Atlas verisi alınamadı");
      atlasData = await response.json();
      activeId = atlasData[0]?.id ?? null;
      renderList();
      if (activeId) selectItem(activeId);
    } catch (error) {
      console.error(error);
      handleError();
    }
  };

  const init = () => {
    if (!listEl) return;
    loadData();
  };

  return { init };
})();

/* ============================================================
 * Onboarding Module
 * ============================================================ */

const OnboardingModule = (() => {
  const modal = $("#onboarding");
  const closeBtn = $("#onboarding-close");
  const hideCheckbox = $("#onboarding-hide");
  const STORAGE_KEY = "vn-onboarding-dismissed";

  const close = () => {
    modal?.setAttribute("hidden", "");
    if (hideCheckbox?.checked) {
      localStorage.setItem(STORAGE_KEY, "true");
    }
  };

  const init = () => {
    if (!modal) return;
    const dismissed = localStorage.getItem(STORAGE_KEY) === "true";
    if (!dismissed) {
      modal.removeAttribute("hidden");
    }
    closeBtn?.addEventListener("click", close);
    modal?.addEventListener("click", (event) => {
      if (event.target === modal) close();
    });
  };

  return { init };
})();

/* ============================================================
 * Reduced Motion fallback (text narration)
 * ============================================================ */

const ReducedMotionFallback = (() => {
  const init = () => {
    if (!prefersReducedMotion) return;
    document.body.classList.add("reduced-motion");
    EventBus.on("diagram:animate-bus", () => {});
  };
  return { init };
})();

/* ============================================================
 * Initialization
 * ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  ThemeModule.init();
  ScrollModule.init();
  PanelModule.init();
  DiagramModule.init();
  SimulationModule.init();
  AccordionModule.init();
  ComponentModule.init();
  TimelineModule.init();
  MicrofactModule.init();
  SlideAtlasModule.init();
  OnboardingModule.init();
  ReducedMotionFallback.init();
});

