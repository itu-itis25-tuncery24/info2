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
    title: "Kontrol Ünitesi (Control Unit)",
    category: "Alt Birim",
    body: [
      "Von Neumann Mimarisinin kalbi: Program Counter'ı (PC) kullanarak bir sonraki komutun nerede olduğunu belirler.",
      "IR'daki talimatı çözümler, mikro operasyonları sıralar ve Fetch-Decode-Execute döngüsünü yönetir.",
      "ALU, kayıtlar ve veri yolları için gerekli kontrol sinyallerini üretir.",
      "Tüm bileşenlerin senkronize çalışmasını koordine eder.",
    ],
    metrics: { bus: "Kontrol Yolu", source: "Kontrol Ünitesi", target: "PC / ALU / Registers / Bus" },
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

const SCENARIO_INFO = {
  load: {
    name: "LOAD",
    description: "Bellekten veri okuma işlemi. Bir bellek adresindeki veri, CPU register'ına yüklenir."
  },
  add: {
    name: "ADD",
    description: "Toplama işlemi. İki sayı ALU'da toplanır, sonuç register'a veya belleğe yazılır."
  },
  store: {
    name: "STORE",
    description: "Belleğe veri yazma işlemi. Register'daki veri, belirtilen bellek adresine kaydedilir."
  }
};

const SCENARIOS = {
  load: [
    {
      label: "Fetch",
      description: "Kontrol birimi PC'yi kullanarak bir sonraki komutu belirler, bellekten talimat çekilir ve IR'a yüklenir.",
      buses: ["address-bus", "data-bus", "control-bus", "control-to-reg"],
      busDirection: "reverse", // Memory → CPU (talimat okuma)
      nodes: ["control-unit", "pc", "mar", "memory", "instruction-bank", "ir", "mbr"],
      source: "Kontrol Ünitesi (PC'den adres alır) → MAR → Bellek",
      target: "Bellek → MBR → IR (talimat yüklenir), PC (artar)",
      flowSteps: [
        "<strong>Kontrol Ünitesi (Control Unit)</strong>, <strong>Program Counter (PC)</strong>'ı kullanarak <code>bir sonraki komutun adresini</code> belirler.",
        "<strong>PC</strong>'deki adres <strong>MAR'a (Memory Address Register)</strong> kopyalanır.",
        "<strong>MAR</strong>, <em>Adres Yolu (Address Bus)</em> üzerinden belleğe <code>hangi adresten</code> okuma yapılacağını bildirir.",
        "<strong>Bellek</strong>, MAR'daki adresten talimatı okur ve <em>Veri Yolu (Data Bus)</em> üzerinden <strong>MBR'ye (Memory Buffer Register)</strong> gönderir.",
        "<strong>Bellek</strong>, aynı zamanda <em>Kontrol Yolu</em> üzerinden <strong>Kontrol Ünitesi'ne</strong> <code>okuma tamamlandı</code> sinyali (ready signal) gönderir.",
        "<strong>MBR'deki</strong> talimat <strong>IR'a (Instruction Register)</strong> transfer edilir. Artık talimat CPU'da işlenmeye hazır!",
        "<strong>Kontrol Ünitesi</strong>, <strong>PC</strong>'yi <code>1 artırır</code>, böylece bir sonraki talimatın adresini gösterir."
      ],
    },
    {
      label: "Decode",
      description:
        "IR talimatı çözümler, kontrol birimi LOAD komutunu tanır ve veri konumunu belirler.",
      buses: ["control-bus", "control-to-reg"],
      nodes: ["control-unit", "ir", "mar"],
      source: "IR → Kontrol Ünitesi (talimat çözümü)",
      target: "Kontrol Ünitesi → MAR/Register'lar (kontrol sinyalleri)",
      flowSteps: [
        "<strong>IR (Instruction Register)</strong>, içindeki <code>LOAD talimatını</code> <strong>Kontrol Ünitesi'ne</strong> sunar.",
        "<strong>Kontrol Ünitesi</strong>, talimatı çözümleyerek bu bir <code>bellek okuma</code> işlemi olduğunu anlar.",
        "Talimat içindeki <code>veri adresi</code> belirlenir (LOAD komutunda hangi bellekten veri alınacak?).",
        "<strong>Kontrol Ünitesi</strong>, <em>Kontrol Yolu</em> üzerinden <strong>MAR ve Register'lara</strong> gerekli kontrol sinyallerini gönderir.",
        "Bu sinyaller, bir sonraki adımda (Execute) hangi işlemlerin yapılacağını bildirir."
      ],
    },
    {
      label: "Execute",
      description:
        "MAR veri adresini alır, bellekten veri MBR'ye aktarılır. ALU gerekirse veri üzerinde işlem yapar.",
      buses: ["address-bus", "data-bus", "control-bus", "reg-to-alu-1"],
      busDirection: "reverse", // Memory → CPU (veri okuma)
      nodes: ["control-unit", "mar", "memory", "data-bank", "mbr", "alu"],
      source: "MAR → Bellek (adres yoluyla)",
      target: "Bellek → MBR (veri yoluyla), MBR → ALU (gerekirse)",
      flowSteps: [
        "<strong>MAR</strong>, decode adımında aldığı <code>veri adresini</code> tutar.",
        "<strong>MAR</strong>, <em>Adres Yolu</em> üzerinden belleğe <code>hangi adresten veri</code> okunacağını bildirir.",
        "<strong>Bellek</strong>, bu adresten <code>gerçek veriyi</code> (sayı, metin, vs.) okur.",
        "Okunan veri <em>Veri Yolu</em> üzerinden <strong>MBR'ye</strong> aktarılır.",
        "<strong>Bellek</strong> → <em>Kontrol Yolu</em> → <strong>Kontrol Ünitesi</strong>: <code>Veri hazır</code> (data ready) sinyali gönderilir.",
        "Eğer veri üzerinde işlem yapılacaksa, <strong>MBR'den ALU'ya</strong> gönderilir. Yoksa direkt register'a yazılır."
      ],
    },
    {
      label: "Write-back",
      description:
        "MBR'deki veri hedef kayda yazılır (örneğin genel amaçlı kayıt). PC bir sonraki talimatı gösterecek şekilde artar.",
      buses: ["control-bus", "control-to-reg"],
      nodes: ["mbr", "control-unit", "pc", "mar"],
      source: "MBR → Hedef Register (veri yazımı)",
      target: "Register Dosyası (güncellenir), PC (sonraki adrese)",
      flowSteps: [
        "<strong>MBR</strong> içindeki veri, <strong>hedef register'a</strong> (örneğin genel amaçlı bir kayıt) yazılmaya hazır.",
        "<strong>Kontrol Ünitesi</strong>, <em>Kontrol Sinyalleri</em> ile hangi register'a yazılacağını belirler.",
        "Veri <strong>MBR'den → Hedef Register'a</strong> kopyalanır. LOAD işlemi tamamlandı!",
        "<strong>PC (Program Counter)</strong> zaten bir önceki adımda artmıştı, şimdi sistem bir sonraki talimata geçmeye hazır.",
        "Tüm <code>Fetch → Decode → Execute → Write-back</code> döngüsü tamamlandı ve yeniden başlayabilir."
      ],
    },
  ],
  add: [
    {
      label: "Fetch",
      description:
        "Kontrol birimi PC'yi kullanarak ADD talimatını belirler ve getirir. Operant adresleri talimat içinde yer alıyor.",
      buses: ["address-bus", "data-bus", "control-bus", "control-to-reg"],
      busDirection: "reverse", // Memory → CPU
      nodes: ["control-unit", "pc", "mar", "memory", "instruction-bank", "ir", "mbr"],
      source: "Kontrol Ünitesi (PC'den adres) → MAR → Bellek (ADD talimatı)",
      target: "Bellek → MBR → IR (talimat), PC (artar)",
      flowSteps: [
        "<strong>Kontrol Ünitesi</strong>, <strong>PC</strong>'yi kullanarak <code>ADD talimatının adresini</code> belirler.",
        "<strong>PC</strong> → <strong>MAR</strong> → <em>Adres Yolu</em> → <strong>Bellek</strong>: ADD talimatının adresi gönderilir.",
        "<strong>Bellek</strong> → <em>Veri Yolu</em> → <strong>MBR</strong> → <strong>IR</strong>: ADD talimatı ve operand adresleri yüklenir.",
        "<strong>Bellek</strong> → <em>Kontrol Yolu</em> → <strong>Kontrol Ünitesi</strong>: <code>Okuma tamamlandı</code> (ready) sinyali gönderilir.",
        "<strong>Kontrol Ünitesi</strong>, <strong>PC</strong> değerini artırır, sonraki talimata hazır hale gelir."
      ],
    },
    {
      label: "Decode",
      description:
        "Kontrol birimi kaynak ve hedef adresleri çözümler, ALU için hazırlık yapılır.",
      buses: ["control-bus", "control-to-reg"],
      nodes: ["control-unit", "ir", "mar", "pc"],
      source: "IR → Kontrol Ünitesi (ADD çözümü, operand adresleri)",
      target: "Kontrol Ünitesi → Register'lar/ALU (hazırlık sinyalleri)",
      flowSteps: [
        "<strong>IR</strong> → <strong>Kontrol Ünitesi</strong>: <code>ADD</code> talimatı çözümlenir.",
        "<strong>Kontrol Ünitesi</strong>, iki operandın <code>hangi register'larda</code> olduğunu belirler.",
        "<strong>ALU</strong>'ya <code>toplama işlemi</code> yapacağı sinyali gönderir.",
        "Register'lar, operandları ALU'ya göndermeye hazırlanır."
      ],
    },
    {
      label: "Execute",
      description:
        "İki operand bellekten/registrelerden MBR aracılığıyla ALU'ya taşınır, ALU toplama işlemini yapar.",
      buses: ["data-bus", "control-bus", "reg-to-alu-1", "reg-to-alu-2", "alu-to-control"],
      nodes: ["memory", "data-bank", "mbr", "mar", "alu", "control-unit"],
      source: "Register'lar → ALU (operand #1, #2)",
      target: "ALU (toplama), ALU → Kontrol Ünitesi (flag'ler: Zero, Carry)",
      flowSteps: [
        "<strong>Birinci operand</strong>, bellekten okunarak <em>Veri Yolu</em> üzerinden <strong>MBR</strong>'ye, oradan <strong>ALU</strong>'ya gönderilir.",
        "<strong>Bellek</strong> → <em>Kontrol Yolu</em> → <strong>Kontrol Ünitesi</strong>: <code>Veri hazır</code> sinyali gönderilir.",
        "<strong>İkinci operand</strong>, bellekten okunarak aynı şekilde <strong>ALU</strong>'ya gönderilir.",
        "<strong>ALU</strong>, iki sayıyı <code>toplar</code> ve sonucu üretir.",
        "<strong>ALU → Kontrol Ünitesi</strong>: Sonuç ile ilgili <code>flag'ler</code> (Zero, Carry, Overflow) güncellenir."
      ],
    },
    {
      label: "Write-back",
      description:
        "ALU sonucu MBR üzerinden hedef kayda ve gerekirse belleğe yazılır. Carry/Zero flagleri güncellenir.",
      buses: ["data-bus", "control-bus", "control-to-reg"],
      nodes: ["alu", "mbr", "memory", "control-unit", "pc", "mar"],
      source: "ALU → MBR/Register (sonuç)",
      target: "Hedef Register/Bellek (yazım), Flag Register (güncelleme), PC (sonraki)",
      flowSteps: [
        "<strong>ALU</strong>'nun ürettiği <code>toplam sonucu</code>, hedef register'a yazılır.",
        "Eğer sonuç belleğe de kaydedilecekse, <strong>MBR → Veri Yolu → Bellek</strong> akışı gerçekleşir.",
        "<strong>Flag Register</strong> güncellenir (Zero: sonuç sıfır mı?, Carry: taşma oldu mu?).",
        "<strong>PC</strong> zaten artmış durumda, sistem bir sonraki talimata geçer."
      ],
    },
  ],
  store: [
    {
      label: "Fetch",
      description:
        "Kontrol birimi PC'yi kullanarak STORE talimatını belirler ve getirir. Hangi registrenin ve adresin kullanılacağı belirlenir.",
      buses: ["address-bus", "data-bus", "control-bus", "control-to-reg"],
      busDirection: "reverse", // Memory → CPU
      nodes: ["control-unit", "pc", "mar", "memory", "instruction-bank", "ir", "mbr"],
      source: "Kontrol Ünitesi (PC'den adres) → MAR → Bellek (STORE talimatı)",
      target: "Bellek → MBR → IR (talimat + hedef adres), PC (artar)",
      flowSteps: [
        "<strong>Kontrol Ünitesi</strong>, <strong>PC</strong>'yi kullanarak <code>STORE talimatının adresini</code> belirler.",
        "<strong>PC</strong> → <strong>MAR</strong> → <em>Adres Yolu</em> → <strong>Bellek</strong>: STORE talimatının adresi gönderilir.",
        "<strong>Bellek</strong> → <em>Veri Yolu</em> → <strong>MBR</strong> → <strong>IR</strong>: STORE talimatı, kaynak register ve hedef bellek adresi yüklenir.",
        "<strong>Bellek</strong> → <em>Kontrol Yolu</em> → <strong>Kontrol Ünitesi</strong>: <code>Okuma tamamlandı</code> (ready) sinyali gönderilir.",
        "<strong>Kontrol Ünitesi</strong>, <strong>PC</strong>'yi artırır, sonraki talimata hazır."
      ],
    },
    {
      label: "Decode",
      description:
        "Kontrol birimi kaynak registra ulaşır, hedef bellek adresini hazırlar.",
      buses: ["control-bus", "control-to-reg"],
      nodes: ["control-unit", "ir", "mar", "pc"],
      source: "IR → Kontrol Ünitesi (STORE çözümü, kaynak reg + hedef adres)",
      target: "Kontrol Ünitesi → MAR (hedef adres) + Register'lar (okuma hazırlığı)",
      flowSteps: [
        "<strong>IR</strong> → <strong>Kontrol Ünitesi</strong>: <code>STORE</code> talimatı çözümlenir.",
        "<strong>Kontrol Ünitesi</strong>, <code>hangi register'dan</code> veri alınacağını ve <code>hangi bellek adresine</code> yazılacağını belirler.",
        "<strong>Hedef adres</strong>, <strong>MAR</strong>'a yüklenir.",
        "Kaynak register, veriyi <strong>MBR</strong>'ye göndermeye hazırlanır."
      ],
    },
    {
      label: "Execute",
      description:
        "Kaynak registrenin içeriği MBR'ye kopyalanır; MAR hedef adresi tutar.",
      buses: ["reg-to-alu-2", "control-to-reg"],
      nodes: ["mbr", "control-unit", "mar", "pc"],
      source: "Kaynak Register → MBR (veri kopyalama)",
      target: "MBR (veri hazır), MAR (hedef adres hazır)",
      flowSteps: [
        "<strong>Kaynak Register</strong>'daki <code>veri</code>, <em>içsel bus</em> üzerinden <strong>MBR</strong>'ye kopyalanır.",
        "<strong>MAR</strong>, <code>hedef bellek adresini</code> tutar ve hazırdır.",
        "Artık hem <strong>adres (MAR)</strong> hem de <strong>veri (MBR)</strong> belleğe yazmaya hazır!"
      ],
    },
    {
      label: "Write-back",
      description:
        "MBR içeriği veri yoluyla belleğe yazılır; PC bir sonraki talimata geçer.",
      buses: ["data-bus", "address-bus", "control-bus"],
      busDirection: "forward", // CPU → Memory (veri yazma)
      nodes: ["mbr", "memory", "data-bank", "pc", "mar", "control-unit"],
      source: "MAR (adres) + MBR (veri) → Bellek",
      target: "Bellek[MAR] (veri yazıldı), PC (sonraki adres)",
      flowSteps: [
        "<strong>MAR</strong>, <em>Adres Yolu</em> üzerinden belleğe <code>nereye</code> yazılacağını bildirir.",
        "<strong>MBR</strong>, <em>Veri Yolu</em> üzerinden belleğe <code>ne yazılacağını</code> gönderir.",
        "<strong>Kontrol Ünitesi</strong>, <em>Kontrol Yolu</em> üzerinden <code>yazma sinyali</code> (WRITE) gönderir.",
        "<strong>Bellek[MAR]</strong>, MBR'deki veriyle güncellenir. STORE işlemi tamamlandı!",
        "<strong>Bellek</strong> → <em>Kontrol Yolu</em> → <strong>Kontrol Ünitesi</strong>: <code>Yazma tamamlandı</code> (write complete) sinyali gönderilir.",
        "<strong>PC</strong> zaten artmış durumda, sistem bir sonraki talimata geçer."
      ],
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

const BUS_DETAILS = {
  "data-bus": {
    name: "Veri Yolu (Data Bus)",
    from: "CPU ↔ Bellek",
    carries: "Talimatlar, operandlar, sonuçlar",
  },
  "address-bus": {
    name: "Adres Yolu (Address Bus)",
    from: "CPU → Bellek",
    carries: "Bellek adresleri (MAR'dan)",
  },
  "control-bus": {
    name: "Kontrol Yolu (Control Bus)",
    from: "CPU ↔ Bellek/G/Ç",
    carries: "Okuma/Yazma sinyalleri, saat darbeleri",
  },
  "io-link": {
    name: "G/Ç Bağlantısı",
    from: "CPU ↔ G/Ç",
    carries: "G/Ç komutları ve durum bilgisi",
  },
  "io-bus": {
    name: "G/Ç Yolu",
    from: "G/Ç ↔ Sistem Yolu",
    carries: "G/Ç veri transferi",
  },
  "reg-to-alu-1": {
    name: "Register → ALU #1",
    from: "PC/IR → ALU",
    carries: "Birinci operand (sol register'lardan)",
  },
  "reg-to-alu-2": {
    name: "Register → ALU #2",
    from: "MAR/MBR → ALU",
    carries: "İkinci operand (sağ register'lardan)",
  },
  "alu-to-control": {
    name: "ALU → Kontrol",
    from: "ALU → Control Unit",
    carries: "Sonuç flag'leri (Zero, Carry, Overflow)",
  },
  "control-to-reg": {
    name: "Kontrol → Register",
    from: "Control Unit → Register'lar",
    carries: "Yükleme/okuma kontrol sinyalleri",
  },
};

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
  const flowStepsList = $("#flow-steps");
  let currentNodeId = null;

  const defaultState = () => {
    badge.textContent = "Bileşen";
    title.textContent = "Bir bileşen seç";
    subtitle.textContent =
      "Diyagramda bir noktayı vurgula veya sağdaki simülasyon adımlarından birini başlat.";
    body.innerHTML =
      "<p>Simülasyon sırasında veri yolları yanıp sönecek ve ilgili bileşen burada detaylı olarak açıklanacak.</p>";
    activeBus.innerHTML = "—";
    infoSource.textContent = "—";
    infoTarget.textContent = "—";
    if (flowStepsList) {
      flowStepsList.innerHTML = "<li>Simülasyon başladığında bu bölümde detaylı akış görünecek.</li>";
    }
    currentNodeId = null;
  };

  const update = ({ title: ttl, category, body: paragraphs, metrics, nodeId, flowSteps }) => {
    badge.textContent = category ?? "Bileşen";
    title.textContent = ttl;
    subtitle.textContent = "Seçilen bileşen için detaylar";
    body.innerHTML = paragraphs.map((p) => `<p>${p}</p>`).join("");
    currentNodeId = nodeId || null;
    activeBus.innerHTML = metrics?.bus ?? "—";
    infoSource.textContent = metrics?.source ?? "—";
    infoTarget.textContent = metrics?.target ?? "—";
    
    // Update flow steps
    if (flowStepsList && flowSteps && flowSteps.length > 0) {
      flowStepsList.innerHTML = flowSteps.map((step) => `<li>${step}</li>`).join("");
    } else if (flowStepsList) {
      flowStepsList.innerHTML = "<li>Bu adım için detaylı akış bilgisi mevcut değil.</li>";
    }
  };

  EventBus.on("panel:update", update);
  EventBus.on("panel:reset", defaultState);

  const init = () => defaultState();
  const getCurrentNodeId = () => currentNodeId;
  return { init, update, getCurrentNodeId };
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

  const highlightBuses = (buses, direction = "forward") => {
    $$(".bus-line", svg).forEach((line) => {
      const linkId = line.getAttribute("data-link");
      const isActive = buses?.includes(linkId);
      line.classList.toggle("is-active", isActive);
      
      if (isActive) {
        // Adres yolu her zaman forward, veri yolu direction parametresine göre
        const busDirection = linkId === "address-bus" ? "forward" : direction;
        line.setAttribute("data-direction", busDirection);
      } else {
        line.removeAttribute("data-direction");
      }
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

  const handleNodeClick = (node, event) => {
    event?.stopPropagation(); // Prevent event bubbling to parent nodes
    const id = node.getAttribute("data-node");
    const data = COMPONENT_DATA[id];
    if (data) {
      EventBus.emit("panel:update", { ...data, nodeId: id });
      // Don't auto-jump to simulation step on node click
      // Only show info panel
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
      node.addEventListener("click", (e) => handleNodeClick(node, e));
      node.setAttribute("role", "button");
      node.setAttribute("aria-label", COMPONENT_DATA[node.getAttribute("data-node")]?.title ?? "Bileşen");
    });
  };

  const registerBusEvents = () => {
    const busNames = {
      "data-bus": "Veri Yolu (Data Bus)",
      "address-bus": "Adres Yolu (Address Bus)",
      "control-bus": "Kontrol Yolu (Control Bus)",
      "io-link": "G/Ç Bağlantısı",
      "io-bus": "G/Ç Yolu",
      "reg-to-alu-1": "Register → ALU #1",
      "reg-to-alu-2": "Register → ALU #2",
      "alu-to-control": "ALU → Kontrol",
      "control-to-reg": "Register → Kontrol Ünitesi"
    };

    $$(".bus-line", svg).forEach((bus) => {
      bus.addEventListener("mouseenter", (ev) => {
        const linkId = bus.getAttribute("data-link");
        const name = busNames[linkId] || linkId;
        showTooltip(ev, name);
      });
      bus.addEventListener("mouseleave", hideTooltip);
      bus.style.cursor = "help";
    });
  };

  const clearFlowParticles = () => {
    while (flowLayer?.firstChild) flowLayer.removeChild(flowLayer.firstChild);
  };

  const animateParticles = (pathId, duration = 2000, color = "var(--color-accent)", reverse = false) => {
    if (prefersReducedMotion) return;
    const path = $(`.bus-line[data-link="${pathId}"]`, svg);
    if (!path) return;
    const length = path.getTotalLength();
    const particleCount = 6;
    clearFlowParticles();
    
    console.log("🚀 animateParticles called:", { pathId, reverse, length });

    for (let i = 0; i < particleCount; i += 1) {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("r", 6);
      circle.setAttribute("class", "flow-particle");
      circle.style.fill = color;
      const offset = (i / particleCount) * length;
      let startTime = null;
      const animate = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = (elapsed % duration) / duration;
        
        // Calculate distance based on direction
        let distance;
        if (reverse) {
          // Go backwards: start from end (length), move to start (0)
          // Each particle starts at different positions going backwards
          distance = length - offset - (progress * length);
        } else {
          // Go forwards: start from beginning (0), move to end (length)
          distance = offset + (progress * length);
        }
        
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
  EventBus.on("diagram:highlight-buses", ({ buses, direction = "forward" }) => {
    highlightBuses(buses, direction);
  });
  EventBus.on("diagram:clear-flow", clearFlowParticles);

  const init = () => {
    registerNodeEvents();
    registerBusEvents();
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
    
    // Build detailed bus information
    const activeBuses = step?.buses ?? [];
    const busDetails = activeBuses.map((busId) => {
      const detail = BUS_DETAILS[busId];
      if (detail) {
        return `<strong>${detail.name}</strong><br><em>${detail.from}</em><br>Taşınan: ${detail.carries}`;
      }
      return busId;
    }).join("<br><br>");
    
    EventBus.emit("panel:update", {
      title: `${step?.label ?? "Adım"} (${scenarioKey.toUpperCase()})`,
      category: "Simülasyon",
      body: [step?.description ?? "Beklemede"],
      metrics: {
        bus: busDetails || "—",
        source: step?.source ?? "—",
        target: step?.target ?? "—",
      },
      flowSteps: step?.flowSteps ?? [],
    });
    const direction = step.busDirection === "reverse" ? "reverse" : "forward";
    EventBus.emit("diagram:highlight-nodes", step?.nodes ?? []);
    EventBus.emit("diagram:highlight-buses", { buses: step?.buses ?? [], direction });
    
    // Partiküller devre dışı - sadece bus animasyonu kullan
    // if (step?.buses?.length) {
    //   EventBus.emit("diagram:animate-bus", { ... });
    // }
    
    // 🔥 Execution Trace güncelle
    EventBus.emit("trace:update", { scenario: scenarioKey, stepIndex });
    
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

  const updateScenarioInfo = () => {
    const info = SCENARIO_INFO[scenarioKey];
    if (!info) return;
    
    const scenarioName = $("#scenario-name");
    const scenarioDescription = $("#scenario-description");
    
    if (scenarioName) scenarioName.textContent = info.name;
    if (scenarioDescription) scenarioDescription.textContent = info.description;
  };

  const handleScenarioChange = () => {
    scenarioKey = scenarioSelect.value;
    updateScenarioInfo();
    renderStepList();
    reset();
    drawHeatmap();
    // 🔥 Trace tablosunu yeni senaryoya göre güncelle
    EventBus.emit("trace:scenario-change", scenarioKey);
  };

  const handleSpeedChange = () => {
    speed = parseFloat(speedInput.value) || 1;
  };

  const handleFocusPlay = () => {
    const nodeId = PanelModule.getCurrentNodeId();
    if (!nodeId) return;
    
    const scenario = getScenario();
    const targetStepIndex = scenario.findIndex((step) => step.nodes?.includes(nodeId));
    
    if (targetStepIndex >= 0) {
      stopPlaying();
      stepIndex = targetStepIndex;
      updateUI();
    }
  };

  const handleKeyboard = (event) => {
    const activeTag = document.activeElement.tagName;
    if (event.key === " " && activeTag !== "INPUT" && activeTag !== "TEXTAREA") {
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

  const init = () => {
    initControls();
    handleSpeedChange();
    updateScenarioInfo();
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
 * Reference Diagram Switcher Module
 * ============================================================ */

const ReferenceModule = (() => {
  const referenceImage = $("#reference-image");
  const referenceCaption = $("#reference-caption");
  const referenceOpen = $("#reference-open");
  const tabs = $$(".reference-tab");

  const REFERENCE_DATA = {
    classic: {
      src: "assets/images/I2IS_01-Hardware-41.png",
      alt: "CPU, bellek ve I/O etkileşimini gösteren basitleştirilmiş blok diyagramı",
      caption: "Program sayacı, kayıtlar, ALU ve kontrol biriminden oluşan CPU; bellek ve I/O sistemiyle etkileşiyor.",
    },
    course: {
      src: "assets/images/I2IS_01-Hardware-42.png",
      alt: "Von Neumann mimarisi: CPU (PC, IR, MAR, MBR, ALU, Kontrol), Ana Bellek ve I/O Modülü arasında Sistem Yolu bağlantısı",
      caption: "CPU içinde kayıtlar, execution unit (ALU) ve kontrol birimi; sistem yoluyla bellek ve I/O modülüne bağlanır.",
    },
  };

  const switchDiagram = (key) => {
    const data = REFERENCE_DATA[key];
    if (!data || !referenceImage) return;

    referenceImage.src = data.src;
    referenceImage.alt = data.alt;
    if (referenceCaption) referenceCaption.textContent = data.caption;
    if (referenceOpen) referenceOpen.href = data.src;

    tabs.forEach((tab) => {
      const isActive = tab.dataset.reference === key;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", isActive);
    });
  };

  const init = () => {
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        switchDiagram(tab.dataset.reference);
      });
    });
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

/* ============================================================
 * Execution Trace Module
 * ============================================================ */

const ExecutionTraceModule = (() => {
  const traceContainer = $(".trace-container");
  let currentScenario = "add";
  let currentStepIndex = 0;
  
  // Gerçek simülasyon verisi - ADD senaryosu (940 + 941 = 941)
  const EXECUTION_TRACES = {
    add: [
      {
        step: 0,
        label: "Fetch (LOAD)",
        memory: { "300": "1 9 4 0", "301": "5 9 4 1", "302": "2 9 4 1", "940": "0 0 0 3", "941": "0 0 0 2" },
        registers: { "PC": "3 0 0", "AC": "0 0 0 0", "IR": "1 9 4 0" },
        changed: { memory: [], registers: ["IR"] }
      },
      {
        step: 1,
        label: "Decode (LOAD)",
        memory: { "300": "1 9 4 0", "301": "5 9 4 1", "302": "2 9 4 1", "940": "0 0 0 3", "941": "0 0 0 2" },
        registers: { "PC": "3 0 0", "AC": "0 0 0 0", "IR": "1 9 4 0", "MAR": "9 4 0" },
        changed: { memory: [], registers: ["MAR"] }
      },
      {
        step: 2,
        label: "Execute (LOAD)",
        memory: { "300": "1 9 4 0", "301": "5 9 4 1", "302": "2 9 4 1", "940": "0 0 0 3", "941": "0 0 0 2" },
        registers: { "PC": "3 0 1", "AC": "0 0 0 3", "IR": "1 9 4 0", "MAR": "9 4 0", "MBR": "0 0 0 3" },
        changed: { memory: [], registers: ["PC", "AC", "MBR"] },
        note: "940 → AC"
      },
      {
        step: 3,
        label: "Fetch (ADD)",
        memory: { "300": "1 9 4 0", "301": "5 9 4 1", "302": "2 9 4 1", "940": "0 0 0 3", "941": "0 0 0 2" },
        registers: { "PC": "3 0 1", "AC": "0 0 0 3", "IR": "5 9 4 1", "MAR": "3 0 1" },
        changed: { memory: [], registers: ["IR", "MAR"] }
      },
      {
        step: 4,
        label: "Decode (ADD)",
        memory: { "300": "1 9 4 0", "301": "5 9 4 1", "302": "2 9 4 1", "940": "0 0 0 3", "941": "0 0 0 2" },
        registers: { "PC": "3 0 1", "AC": "0 0 0 3", "IR": "5 9 4 1", "MAR": "9 4 1" },
        changed: { memory: [], registers: ["MAR"] }
      },
      {
        step: 5,
        label: "Execute (ADD)",
        memory: { "300": "1 9 4 0", "301": "5 9 4 1", "302": "2 9 4 1", "940": "0 0 0 3", "941": "0 0 0 2" },
        registers: { "PC": "3 0 2", "AC": "0 0 0 5", "IR": "5 9 4 1", "MAR": "9 4 1", "MBR": "0 0 0 2" },
        changed: { memory: [], registers: ["PC", "AC", "MBR"] },
        note: "3 + 2 = 5"
      },
      {
        step: 6,
        label: "Fetch (STORE)",
        memory: { "300": "1 9 4 0", "301": "5 9 4 1", "302": "2 9 4 1", "940": "0 0 0 3", "941": "0 0 0 2" },
        registers: { "PC": "3 0 2", "AC": "0 0 0 5", "IR": "2 9 4 1", "MAR": "3 0 2" },
        changed: { memory: [], registers: ["IR", "MAR"] }
      },
      {
        step: 7,
        label: "Decode (STORE)",
        memory: { "300": "1 9 4 0", "301": "5 9 4 1", "302": "2 9 4 1", "940": "0 0 0 3", "941": "0 0 0 2" },
        registers: { "PC": "3 0 2", "AC": "0 0 0 5", "IR": "2 9 4 1", "MAR": "9 4 1", "MBR": "0 0 0 5" },
        changed: { memory: [], registers: ["MAR", "MBR"] }
      },
      {
        step: 8,
        label: "Write-back (STORE)",
        memory: { "300": "1 9 4 0", "301": "5 9 4 1", "302": "2 9 4 1", "940": "0 0 0 3", "941": "0 0 0 5" },
        registers: { "PC": "3 0 3", "AC": "0 0 0 5", "IR": "2 9 4 1", "MAR": "9 4 1", "MBR": "0 0 0 5" },
        changed: { memory: ["941"], registers: ["PC"] },
        note: "AC → 941"
      }
    ],
    load: [
      {
        step: 0,
        label: "Initial",
        memory: { "300": "1 9 4 0", "301": "5 9 4 1", "940": "0 0 0 3" },
        registers: { "PC": "3 0 0", "AC": "0 0 0 0", "IR": "0 0 0 0" },
        changed: { memory: [], registers: [] }
      }
    ],
    store: [
      {
        step: 0,
        label: "Initial",
        memory: { "300": "2 9 4 1", "941": "0 0 0 0" },
        registers: { "PC": "3 0 0", "AC": "0 0 0 5", "IR": "0 0 0 0" },
        changed: { memory: [], registers: [] }
      }
    ]
  };
  
  const highlightCurrentStep = () => {
    if (!traceContainer) return;
    
    // Tüm step'lerden active sınıfını kaldır
    $$(".trace-step", traceContainer).forEach(step => step.classList.remove("is-active"));
    
    // Şu anki step'i highlight et
    const steps = $$(".trace-step", traceContainer);
    if (steps[currentStepIndex]) {
      steps[currentStepIndex].classList.add("is-active");
      
      // Auto-scroll to active step
      steps[currentStepIndex].scrollIntoView({ 
        behavior: "smooth", 
        block: "nearest", 
        inline: "center" 
      });
    }
  };
  
  const renderSteps = (scenarioKey) => {
    if (!traceContainer) return;
    
    currentScenario = scenarioKey;
    const steps = EXECUTION_TRACES[scenarioKey] || EXECUTION_TRACES.add;
    traceContainer.innerHTML = "";
    
    steps.forEach((stepData, index) => {
      const stepDiv = document.createElement("div");
      stepDiv.className = "trace-step";
      stepDiv.dataset.stepIndex = index;
      
      // Header
      const label = document.createElement("div");
      label.className = "trace-step-label";
      label.textContent = `Step ${index + 1}: ${stepData.label}`;
      if (stepData.note) label.textContent += ` → ${stepData.note}`;
      
      // Content
      const content = document.createElement("div");
      content.className = "trace-content";
      
      // Memory column
      const memoryCol = document.createElement("div");
      memoryCol.className = "trace-column trace-memory";
      const memoryRows = Object.entries(stepData.memory).map(([addr, val]) => {
        const isChanged = stepData.changed.memory.includes(addr);
        return `<tr ${isChanged ? 'class="changed"' : ''}><td>${addr}:</td><td>${val}</td></tr>`;
      }).join("");
      memoryCol.innerHTML = `
        <div class="trace-column-header">Memory</div>
        <table class="trace-table"><tbody>${memoryRows}</tbody></table>
      `;
      
      // Registers column
      const registersCol = document.createElement("div");
      registersCol.className = "trace-column trace-registers";
      const registerRows = Object.entries(stepData.registers).map(([name, val]) => {
        const isChanged = stepData.changed.registers.includes(name);
        return `<tr ${isChanged ? 'class="changed"' : ''}><td>${name}:</td><td>${val}</td></tr>`;
      }).join("");
      registersCol.innerHTML = `
        <div class="trace-column-header">CPU Registers</div>
        <table class="trace-table"><tbody>${registerRows}</tbody></table>
      `;
      
      content.appendChild(memoryCol);
      content.appendChild(registersCol);
      stepDiv.appendChild(label);
      stepDiv.appendChild(content);
      traceContainer.appendChild(stepDiv);
    });
    
    highlightCurrentStep();
  };
  
  const updateStep = (stepIndex) => {
    currentStepIndex = stepIndex;
    highlightCurrentStep();
  };
  
  const init = () => {
    // Default: ADD scenario
    renderSteps("add");
    
    // EventBus dinle
    EventBus.on("trace:update", ({ scenario, stepIndex }) => {
      if (scenario !== currentScenario) {
        renderSteps(scenario);
      }
      updateStep(stepIndex);
    });
    
    EventBus.on("trace:scenario-change", (scenario) => {
      renderSteps(scenario);
      currentStepIndex = 0;
      highlightCurrentStep();
    });
  };
  
  return { init, renderSteps };
})();

/* ============================================================
 * VVM Simulator Module
 * ============================================================ */

const VVMSimulatorModule = (() => {
  // DOM Elements
  const codeEditor = $("#vvm-code-editor");
  const lineNumbers = $("#vvm-line-numbers");
  const exampleSelect = $("#vvm-example-select");
  const runBtn = $("#vvm-run-btn");
  const stepBtn = $("#vvm-step-btn");
  const resetBtn = $("#vvm-reset-btn");
  const clearBtn = $("#vvm-clear-btn");
  const speedSlider = $("#vvm-speed-slider");
  const speedLabel = $("#vvm-speed-label");
  const statusLabel = $("#vvm-status-label");
  const statusDot = $(".status-dot");
  const cycleCount = $("#vvm-cycle-count");
  const lineCount = $("#vvm-line-count");
  const statusText = $("#vvm-status-text");
  const outputConsole = $("#vvm-output-console");
  const clearOutputBtn = $("#vvm-clear-output-btn");
  const memoryGrid = $("#vvm-memory-grid");

  // Opcodes (VVM Standard - Little Man Computer based)
  const OPCODES = {
    HALT: 0,
    HLT: 0,
    COB: 0,
    ADD: 1,
    SUB: 2,
    STORE: 3,
    STO: 3,
    STA: 3,
    NOP: 4,
    NUL: 4,
    LOAD: 5,
    LDA: 5,
    BRANCH: 6,
    BR: 6,
    BRU: 6,
    JMP: 6,
    BRZ: 7,
    BRP: 8,
    IN: 901,
    INP: 901,
    OUT: 902,
    PRN: 902,
  };

  const OPCODE_NAMES = {
    0: "HALT/HLT/COB",
    1: "ADD",
    2: "SUB",
    3: "STORE/STO/STA",
    4: "NOP/NUL",
    5: "LOAD/LDA",
    6: "BRANCH/BR/BRU/JMP",
    7: "BRZ",
    8: "BRP",
    901: "IN/INP",
    902: "OUT/PRN",
  };

  // Example Programs (VVM Standard)
  const EXAMPLES = {
    sum: `// A sample VVM Assembly program
// to add a number to the value -1.

IN        Input number to be added
ADD 99    Add value stored at address 99 to input
OUT       Output result
HLT       Halt (program ends here)
*99       Next value loaded at address 99
DAT -001  Data value`,

    fibonacci: `// Fibonacci Example
// Calculate first few Fibonacci numbers

LDA 10     Load F(0) = 0
STO 20     Store result
LDA 11     Load F(1) = 1
STO 21     Store result
LDA 10     Load F(0)
ADD 11     Add F(1)
STO 22     Store F(2)
OUT        Output result
HLT        End
*10
DAT 000    F(0) = 0
DAT 001    F(1) = 1`,

    max: `// Maximum of Two Numbers
// Compare two values and output larger

IN         Input first number
STO 10     Store at address 10
IN         Input second number
STO 11     Store at address 11
LDA 10     Load first number
SUB 11     Subtract second
BRP 10     If positive/zero, first is max
LDA 11     Otherwise load second
BR 11      Skip to output
*10
LDA 10     Load first number
*11
OUT        Output maximum
HLT        End`,

    loop: `// Loop Counter Example
// Count from 1 to 5

LDA 20     Load counter
ADD 21     Increment by 1
STO 20     Store counter
OUT        Output current value
SUB 22     Check if reached 5
BRZ 08     If 5, halt
BR 00      Otherwise, loop back
*08
HLT        End program
*20
DAT 000    Counter starts at 0
DAT 001    Increment value
DAT 005    Limit value`
  };

  // CPU State
  let cpu = {
    PC: 0,      // Program Counter
    AC: 0,      // Accumulator
    IR: 0,      // Instruction Register
    MAR: 0,     // Memory Address Register
    MBR: 0,     // Memory Buffer Register
    Z: false,   // Zero flag
    N: false,   // Negative flag
  };

  // Memory (256 words)
  let memory = new Array(256).fill(0);

  // Simulator State
  let state = {
    running: false,
    halted: false,
    error: false,
    cycle: 0,
    speed: 1,
    program: [],
    currentLine: -1,
  };

  let animationId = null;
  let lastStepTime = 0;

  /* ============================================================
   * Assembler - Parse Assembly to Bytecode
   * ============================================================ */
  
  const assembleProgram = (code) => {
    const lines = code.split("\n");
    const program = [];
    const errors = [];
    let address = 0;

    // Pass 1: Parse instructions
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and comments
      if (!line || line.startsWith("//") || line.startsWith(";")) continue;

      // Remove inline comments
      let codeOnly = line.split("//")[0].trim();
      if (!codeOnly) continue;
      codeOnly = codeOnly.split(";")[0].trim();
      if (!codeOnly) continue;

      // Check for load directive (*nn)
      if (codeOnly.startsWith("*")) {
        const newAddr = parseInt(codeOnly.substring(1), 10);
        if (!isNaN(newAddr) && newAddr >= 0 && newAddr <= 99) {
          address = newAddr;
        }
        continue;
      }

      // Check for DAT directive or raw data
      if (codeOnly.toUpperCase().startsWith("DAT")) {
        const dataStr = codeOnly.substring(3).trim();
        const dataValue = parseInt(dataStr, 10);
        if (!isNaN(dataValue)) {
          program.push({
            address,
            bytecode: dataValue,
            line: i,
            instruction: "DAT",
            operand: dataValue,
          });
          address++;
        }
        continue;
      }

      // Check if line starts with a number (data or machine code)
      if (/^-?\d+$/.test(codeOnly)) {
        const value = parseInt(codeOnly, 10);
        program.push({
          address,
          bytecode: value,
          line: i,
          instruction: "DATA",
          operand: value,
        });
        address++;
        continue;
      }

      // Parse instruction
      const parts = codeOnly.split(/\s+/);
      const instruction = parts[0].toUpperCase();
      let operand = parts[1] ? parseInt(parts[1], 10) : 0;

      // Validate instruction
      if (!OPCODES.hasOwnProperty(instruction)) {
        errors.push(`Line ${i + 1}: Unknown instruction '${instruction}'`);
        continue;
      }

      // Get opcode
      const opcode = OPCODES[instruction];
      
      // Encode instruction (VVM format: 3-digit integer)
      let bytecode;
      if (opcode === 901 || opcode === 902) {
        // IN and OUT use full 3-digit codes
        bytecode = opcode;
      } else {
        // Standard format: opcode (1 digit) + operand (2 digits)
        bytecode = opcode * 100 + (operand % 100);
      }

      program.push({
        address,
        bytecode,
        line: i,
        instruction,
        operand,
      });

      address++;
    }

    return { program, errors };
  };

  /* ============================================================
   * CPU - Fetch-Decode-Execute Cycle
   * ============================================================ */

  const fetch = () => {
    // PC → MAR
    cpu.MAR = cpu.PC;
    EventBus.emit("vvm:register-change", { register: "MAR", value: cpu.MAR });
    
    // Memory[MAR] → MBR
    cpu.MBR = memory[cpu.MAR];
    EventBus.emit("vvm:register-change", { register: "MBR", value: cpu.MBR });
    EventBus.emit("vvm:memory-read", { address: cpu.MAR });
    
    // MBR → IR
    cpu.IR = cpu.MBR;
    EventBus.emit("vvm:register-change", { register: "IR", value: cpu.IR });
    
    // PC++
    cpu.PC++;
    EventBus.emit("vvm:register-change", { register: "PC", value: cpu.PC });
    
    return cpu.IR;
  };

  const decode = (instruction) => {
    // VVM uses 3-digit decimal instructions
    // Special cases: 901 (IN), 902 (OUT)
    if (instruction === 901 || instruction === 902) {
      return { opcode: instruction, operand: 0 };
    }
    
    // Standard format: first digit is opcode, last 2 digits are operand
    const opcode = Math.floor(Math.abs(instruction) / 100) % 10;
    const operand = Math.abs(instruction) % 100;
    
    return { opcode, operand };
  };

  const execute = (opcode, operand) => {
    let output = null;

    switch (opcode) {
      case 0: // HALT/HLT/COB
        state.halted = true;
        output = { type: "success", message: "Program terminated (HALT)" };
        break;

      case 1: // ADD
        cpu.MAR = operand;
        EventBus.emit("vvm:register-change", { register: "MAR", value: cpu.MAR });
        
        cpu.MBR = memory[cpu.MAR];
        EventBus.emit("vvm:memory-read", { address: cpu.MAR });
        EventBus.emit("vvm:register-change", { register: "MBR", value: cpu.MBR });
        
        cpu.AC = cpu.AC + cpu.MBR;
        // VVM uses -999 to +999 range
        if (cpu.AC < -999 || cpu.AC > 999) {
          state.error = true;
          output = { type: "error", message: `Data overflow: AC = ${cpu.AC} (range: -999 to +999)` };
        } else {
          cpu.Z = cpu.AC === 0;
          cpu.N = cpu.AC < 0;
          EventBus.emit("vvm:register-change", { register: "AC", value: cpu.AC });
          EventBus.emit("vvm:flags-change", { Z: cpu.Z, N: cpu.N });
          output = { type: "info", message: `ADD: AC ← AC + Memory[${operand}] (${cpu.AC})` };
        }
        break;

      case 2: // SUB
        cpu.MAR = operand;
        EventBus.emit("vvm:register-change", { register: "MAR", value: cpu.MAR });
        
        cpu.MBR = memory[cpu.MAR];
        EventBus.emit("vvm:memory-read", { address: cpu.MAR });
        EventBus.emit("vvm:register-change", { register: "MBR", value: cpu.MBR });
        
        cpu.AC = cpu.AC - cpu.MBR;
        // VVM uses -999 to +999 range
        if (cpu.AC < -999 || cpu.AC > 999) {
          state.error = true;
          output = { type: "error", message: `Data overflow: AC = ${cpu.AC} (range: -999 to +999)` };
        } else {
          cpu.Z = cpu.AC === 0;
          cpu.N = cpu.AC < 0;
          EventBus.emit("vvm:register-change", { register: "AC", value: cpu.AC });
          EventBus.emit("vvm:flags-change", { Z: cpu.Z, N: cpu.N });
          output = { type: "info", message: `SUB: AC ← AC - Memory[${operand}] (${cpu.AC})` };
        }
        break;

      case 3: // STORE/STO/STA
        cpu.MAR = operand;
        EventBus.emit("vvm:register-change", { register: "MAR", value: cpu.MAR });
        
        cpu.MBR = cpu.AC;
        EventBus.emit("vvm:register-change", { register: "MBR", value: cpu.MBR });
        
        memory[cpu.MAR] = cpu.MBR;
        EventBus.emit("vvm:memory-write", { address: cpu.MAR, value: cpu.MBR });
        
        output = { type: "info", message: `STORE: Memory[${operand}] ← AC (${cpu.AC})` };
        break;

      case 4: // NOP/NUL
        output = { type: "info", message: "NOP: No operation" };
        break;

      case 5: // LOAD/LDA
        cpu.MAR = operand;
        EventBus.emit("vvm:register-change", { register: "MAR", value: cpu.MAR });
        
        cpu.MBR = memory[cpu.MAR];
        EventBus.emit("vvm:memory-read", { address: cpu.MAR });
        EventBus.emit("vvm:register-change", { register: "MBR", value: cpu.MBR });
        
        cpu.AC = cpu.MBR;
        cpu.Z = cpu.AC === 0;
        cpu.N = cpu.AC < 0;
        EventBus.emit("vvm:register-change", { register: "AC", value: cpu.AC });
        EventBus.emit("vvm:flags-change", { Z: cpu.Z, N: cpu.N });
        
        output = { type: "info", message: `LOAD: AC ← Memory[${operand}] (${cpu.AC})` };
        break;

      case 6: // BRANCH/BR/BRU/JMP
        cpu.PC = operand;
        EventBus.emit("vvm:register-change", { register: "PC", value: cpu.PC });
        output = { type: "warning", message: `BRANCH: Jump to address ${operand}` };
        break;

      case 7: // BRZ (Branch if Zero)
        if (cpu.Z || cpu.AC === 0) {
          cpu.PC = operand;
          EventBus.emit("vvm:register-change", { register: "PC", value: cpu.PC });
          output = { type: "warning", message: `BRZ: Jump to address ${operand} (AC = 0)` };
        } else {
          output = { type: "info", message: `BRZ: No jump (AC ≠ 0)` };
        }
        break;

      case 8: // BRP (Branch if Positive or Zero)
        if (cpu.AC >= 0) {
          cpu.PC = operand;
          EventBus.emit("vvm:register-change", { register: "PC", value: cpu.PC });
          output = { type: "warning", message: `BRP: Jump to address ${operand} (AC >= 0)` };
        } else {
          output = { type: "info", message: `BRP: No jump (AC < 0)` };
        }
        break;

      case 901: // IN/INP
        // IN: Get user input (simplified - prompt for value)
        const inputValue = prompt("Enter a value (-999 to 999):", "0");
        if (inputValue !== null) {
          const val = parseInt(inputValue, 10);
          if (!isNaN(val) && val >= -999 && val <= 999) {
            cpu.AC = val;
            cpu.Z = cpu.AC === 0;
            cpu.N = cpu.AC < 0;
            EventBus.emit("vvm:register-change", { register: "AC", value: cpu.AC });
            EventBus.emit("vvm:flags-change", { Z: cpu.Z, N: cpu.N });
            output = { type: "info", message: `IN: User input → AC (${cpu.AC})` };
          } else {
            state.error = true;
            output = { type: "error", message: `Invalid input: ${inputValue} (range: -999 to +999)` };
          }
        } else {
          state.error = true;
          output = { type: "error", message: "User canceled input" };
        }
        break;

      case 902: // OUT/PRN
        // OUT: Output AC value
        output = { type: "success", message: `OUT: Output = ${cpu.AC}` };
        break;

      default:
        state.error = true;
        output = { type: "error", message: `Unknown opcode: ${opcode}` };
    }

    return output;
  };

  const step = () => {
    if (state.halted || state.error) return;

    state.cycle++;
    updateCycleCount();

    // Fetch
    const instruction = fetch();
    
    // Decode
    const { opcode, operand } = decode(instruction);
    
    // Execute
    const output = execute(opcode, operand);
    
    if (output) {
      log(output.message, output.type);
    }

    // Update current line highlight
    const programEntry = state.program.find(p => p.address === cpu.PC - 1);
    if (programEntry) {
      state.currentLine = programEntry.line;
    }

    // Check if we've run past the program
    if (cpu.PC >= state.program.length && !state.halted) {
      state.halted = true;
      log("Program ended (reached end of code)", "warning");
    }

    return !state.halted && !state.error;
  };

  /* ============================================================
   * UI Controllers
   * ============================================================ */

  const initializeMemoryCells = () => {
    if (!memoryGrid) return;
    
    memoryGrid.innerHTML = "";
    // VVM has 100 memory locations (0-99), displayed as 10x10 grid
    for (let i = 0; i < 100; i++) {
      const cell = document.createElement("div");
      cell.className = "vvm-memory-cell";
      cell.dataset.address = i;
      // Format memory value: signed 3-digit or 4-digit for larger values
      const value = memory[i];
      let displayValue;
      if (value === 0) {
        displayValue = "0";
      } else if (value < 0) {
        displayValue = value.toString(); // Negative with sign
      } else if (value <= 999) {
        displayValue = value.toString(); // Positive 1-3 digits
      } else {
        displayValue = value.toString(); // Larger values as-is
      }
      
      cell.innerHTML = `
        <div class="vvm-memory-cell-addr">${i.toString().padStart(2, "0")}</div>
        <div class="vvm-memory-cell-value">${displayValue}</div>
      `;
      memoryGrid.appendChild(cell);
    }
  };

  const updateRegister = (register, value) => {
    const elem = $(`#vvm-reg-${register.toLowerCase()}`);
    if (!elem) return;

    // VVM uses decimal values (not hex)
    if (register === "PC" || register === "MAR") {
      // 2-digit addresses (00-99)
      elem.textContent = value.toString().padStart(2, "0");
    } else if (register === "IR") {
      // 3-digit instruction (000-999)
      elem.textContent = value.toString().padStart(3, "0");
    } else {
      // AC, MBR: 3-digit signed values (-999 to +999)
      const sign = value < 0 ? "-" : "+";
      elem.textContent = sign + Math.abs(value).toString().padStart(3, "0");
    }
    
    // Animate change
    const parent = elem.closest(".vvm-register");
    if (parent) {
      parent.classList.add("changed");
      setTimeout(() => parent.classList.remove("changed"), 600);
    }
  };

  const updateFlags = (flags) => {
    const zFlag = $("[data-flag='z']");
    const nFlag = $("[data-flag='n']");
    
    if (zFlag) {
      if (flags.Z) zFlag.classList.add("active");
      else zFlag.classList.remove("active");
    }
    
    if (nFlag) {
      if (flags.N) nFlag.classList.add("active");
      else nFlag.classList.remove("active");
    }
  };

  const updateMemoryCell = (address) => {
    const cell = $(`.vvm-memory-cell[data-address="${address}"]`);
    if (!cell) return;

    const valueElem = cell.querySelector(".vvm-memory-cell-value");
    if (valueElem) {
      // Format memory value: signed 3-digit or 4-digit for larger values
      const value = memory[address];
      let displayValue;
      if (value === 0) {
        displayValue = "0";
      } else if (value < 0) {
        displayValue = value.toString(); // Negative with sign
      } else if (value <= 999) {
        displayValue = value.toString(); // Positive 1-3 digits
      } else {
        displayValue = value.toString(); // Larger values as-is
      }
      valueElem.textContent = displayValue;
    }

    cell.classList.add("changed");
    setTimeout(() => cell.classList.remove("changed"), 600);
  };

  const updateLineNumbers = () => {
    if (!codeEditor || !lineNumbers) return;
    
    const lines = codeEditor.value.split("\n").length;
    lineNumbers.textContent = Array.from({ length: lines }, (_, i) => i + 1).join("\n");
    
    if (lineCount) {
      lineCount.textContent = `${lines} satır`;
    }
  };

  const updateStatus = (status, label) => {
    if (statusDot) {
      statusDot.className = `status-dot status-${status}`;
    }
    if (statusLabel) {
      statusLabel.textContent = label;
    }
    if (statusText) {
      statusText.textContent = label;
    }
  };

  const updateCycleCount = () => {
    if (cycleCount) {
      cycleCount.textContent = `Çevrim: ${state.cycle}`;
    }
  };

  const log = (message, type = "info") => {
    if (!outputConsole) return;
    
    const line = document.createElement("div");
    line.className = `vvm-output-line vvm-output-${type}`;
    line.textContent = `[${state.cycle}] ${message}`;
    outputConsole.appendChild(line);
    
    // Auto-scroll to bottom
    outputConsole.scrollTop = outputConsole.scrollHeight;
  };

  const clearOutput = () => {
    if (outputConsole) {
      outputConsole.innerHTML = '<div class="vvm-output-line vvm-output-info">Output cleared.</div>';
    }
  };

  /* ============================================================
   * Control Functions
   * ============================================================ */

  const loadProgram = () => {
    const code = codeEditor.value;
    const { program, errors } = assembleProgram(code);

    if (errors.length > 0) {
      errors.forEach(err => log(err, "error"));
      state.error = true;
      updateStatus("error", "Assembly Error");
      return false;
    }

    // Load program into memory
    program.forEach(({ address, bytecode }) => {
      memory[address] = bytecode;
    });

    state.program = program;
    log(`Program loaded: ${program.length} instructions`, "success");
    
    // Debug: Show loaded addresses and check memory state
    console.log("📦 Loaded program:");
    program.forEach(({ address, bytecode, instruction }) => {
      console.log(`  [${address.toString().padStart(2, '0')}] ${bytecode.toString().padStart(4, ' ')} (${instruction})`);
    });
    
    console.log("\n🔍 Memory state after load:");
    console.log("  Memory[17]:", memory[17]);
    console.log("  Memory[89]:", memory[89]);
    console.log("  Memory[97]:", memory[97]);
    console.log("  Memory[98]:", memory[98]);
    console.log("  Memory[99]:", memory[99]);
    
    // Refresh memory display for all affected addresses
    program.forEach(({ address }) => {
      updateMemoryCell(address);
    });

    return true;
  };

  const loadExampleData = (exampleKey) => {
    // Load example-specific data into memory
    memory.fill(0);

    switch (exampleKey) {
      case "sum":
        memory[10] = 5;
        memory[11] = 3;
        break;
      case "fibonacci":
        memory[10] = 0;
        memory[11] = 1;
        break;
      case "max":
        memory[10] = 7;
        memory[11] = 5;
        break;
      case "loop":
        memory[13] = 5;
        memory[14] = 0;
        memory[15] = 1;
        break;
    }

    // Refresh all visible memory cells
    for (let i = 0; i < 100; i++) {
      updateMemoryCell(i);
    }
  };

  const reset = () => {
    // Stop running
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }

    // Reset CPU
    cpu = {
      PC: 0,
      AC: 0,
      IR: 0,
      MAR: 0,
      MBR: 0,
      Z: false,
      N: false,
    };

    // Reset memory
    memory.fill(0);

    // Reset state
    state = {
      running: false,
      halted: false,
      error: false,
      cycle: 0,
      speed: parseFloat(speedSlider.value) || 1,
      program: [],
      currentLine: -1,
    };

    // Update UI
    updateRegister("PC", cpu.PC);
    updateRegister("AC", cpu.AC);
    updateRegister("IR", cpu.IR);
    updateRegister("MAR", cpu.MAR);
    updateRegister("MBR", cpu.MBR);
    updateFlags({ Z: cpu.Z, N: cpu.N });
    updateCycleCount();
    updateStatus("ready", "Hazır");
    initializeMemoryCells();

    log("Simulator reset", "info");
  };

  const run = () => {
    if (state.running) return;

    // Load program if not already loaded
    if (state.program.length === 0) {
      if (!loadProgram()) return;
    }

    state.running = true;
    updateStatus("running", "Çalışıyor");
    
    runBtn.disabled = true;
    stepBtn.disabled = true;

    const animate = (timestamp) => {
      if (!state.running) return;

      if (!lastStepTime) lastStepTime = timestamp;
      const elapsed = timestamp - lastStepTime;

      if (elapsed >= 1000 / state.speed) {
        const canContinue = step();
        
        if (!canContinue) {
          state.running = false;
          updateStatus("halted", "Durdu");
          runBtn.disabled = false;
          stepBtn.disabled = false;
          return;
        }

        lastStepTime = timestamp;
      }

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
  };

  const singleStep = () => {
    if (state.running) return;

    // Load program if not already loaded
    if (state.program.length === 0) {
      if (!loadProgram()) return;
    }

    step();
    
    if (state.halted || state.error) {
      updateStatus("halted", "Durdu");
    }
  };

  const handleRun = () => {
    if (state.running) {
      // Pause
      state.running = false;
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      lastStepTime = 0;
      runBtn.textContent = "▶ Çalıştır";
      runBtn.disabled = false;
      stepBtn.disabled = false;
      updateStatus("ready", "Duraklatıldı");
    } else {
      // Run
      runBtn.textContent = "⏸ Duraklat";
      run();
    }
  };

  const handleExample = (e) => {
    const exampleKey = e.target.value;
    if (!exampleKey || !EXAMPLES[exampleKey]) return;

    codeEditor.value = EXAMPLES[exampleKey];
    updateLineNumbers();
    reset();
    loadExampleData(exampleKey);
    log(`Example loaded: ${exampleKey}`, "info");
  };

  const handleClear = () => {
    codeEditor.value = "";
    updateLineNumbers();
    reset();
  };

  const handleSpeedChange = () => {
    state.speed = parseFloat(speedSlider.value) || 1;
    if (speedLabel) {
      speedLabel.textContent = `${state.speed}x`;
    }
  };

  /* ============================================================
   * Event Bus Listeners
   * ============================================================ */

  EventBus.on("vvm:register-change", ({ register, value }) => {
    updateRegister(register, value);
  });

  EventBus.on("vvm:flags-change", (flags) => {
    updateFlags(flags);
  });

  EventBus.on("vvm:memory-read", ({ address }) => {
    if (address < 100) {  // Update all VVM memory cells (0-99)
      updateMemoryCell(address);
    }
  });

  EventBus.on("vvm:memory-write", ({ address, value }) => {
    if (address < 100) {  // Update all VVM memory cells (0-99)
      updateMemoryCell(address);
    }
  });

  /* ============================================================
   * Initialization
   * ============================================================ */

  const init = () => {
    if (!codeEditor) return;

    // Initialize memory cells
    initializeMemoryCells();

    // Update line numbers on input
    codeEditor.addEventListener("input", updateLineNumbers);
    codeEditor.addEventListener("scroll", () => {
      if (lineNumbers) {
        lineNumbers.scrollTop = codeEditor.scrollTop;
      }
    });

    // Button handlers
    if (runBtn) runBtn.addEventListener("click", handleRun);
    if (stepBtn) stepBtn.addEventListener("click", singleStep);
    if (resetBtn) resetBtn.addEventListener("click", reset);
    if (clearBtn) clearBtn.addEventListener("click", handleClear);
    if (clearOutputBtn) clearOutputBtn.addEventListener("click", clearOutput);
    if (exampleSelect) exampleSelect.addEventListener("change", handleExample);
    if (speedSlider) speedSlider.addEventListener("input", handleSpeedChange);

    // Initialize UI
    updateLineNumbers();
    updateStatus("ready", "Hazır");
    log("VVM Simulator ready. Load a program or select an example.", "info");
  };

  return { init };
})();

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
  ReferenceModule.init();
  OnboardingModule.init();
  ReducedMotionFallback.init();
  ExecutionTraceModule.init();
  VVMSimulatorModule.init();
});

