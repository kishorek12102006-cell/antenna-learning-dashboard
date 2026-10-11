"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { calculatePatch, format, type DesignInputs } from "@/lib/antenna";
import { getSupabase } from "@/lib/supabase";

const AntennaViewer = dynamic(() => import("@/components/AntennaViewer"), { ssr: false });
const initial: DesignInputs = { frequencyGHz: 2.4, epsilonR: 2.4, lossTangent: 0.017, substrateMm: 1.6, feedOffsetMm: 13.9 };

const lessons = {
  frequency: { title: "Operating frequency", symbol: "f", formula: "λ₀ = c / f", summary: "Frequency sets the antenna’s electrical size. A higher frequency has a shorter wavelength, so the patch gets smaller.", effect: "Changing frequency updates the free-space wavelength and the first-pass patch width and length.", note: "Use the actual radio channel or band center. A patch designed for one frequency may not work well across a wide band." },
  permittivity: { title: "Relative permittivity", symbol: "εr", formula: "εeff ≈ (εr + 1) / 2 + …", summary: "Permittivity describes how strongly the substrate stores electric-field energy. Some patch fields travel in air, so the effective value falls between 1 and εr.", effect: "Higher εr usually makes a patch smaller, while often narrowing its bandwidth and increasing sensitivity to material variation.", note: "Use a value measured near your operating frequency on a sample printed with the same filament, infill, and print settings." },
  loss: { title: "Loss tangent", symbol: "tan δ", formula: "tan δ = ε″ / ε′", summary: "Loss tangent describes dielectric energy converted to heat in each RF cycle. It is separate from conductor and feed losses.", effect: "Higher loss can reduce radiation efficiency and alter bandwidth. The simple patch sizing equations do not calculate efficiency.", note: "The example value is from one published wood-filled PLA sample. Other PLA, ABS, or print density can have a different value." },
  thickness: { title: "Substrate thickness", symbol: "h", formula: "ΔL ∝ h · F(εeff, W/h)", summary: "The dielectric thickness separates the radiating metal from the ground plane and influences fringing fields and feed impedance.", effect: "Changing h modifies effective permittivity, edge fringing, and estimated board margin. Thicker substrates can increase bandwidth but may also increase surface waves.", note: "The current 1.6 mm value is only a starting assumption. Measure the printed panel after fabrication." },
  wavelength: { title: "Free-space wavelength", symbol: "λ₀", formula: "λ₀ = c / f", summary: "This is the distance a wave travels in one cycle through empty space. A resonant patch is roughly a half guided wavelength long.", effect: "The guided wavelength is shorter than λ₀ because part of the electric field is inside the dielectric.", note: "At 2.4 GHz, λ₀ is about 125 mm; the patch is shorter because of the effective dielectric constant and edge fringing." },
  effective: { title: "Effective permittivity", symbol: "εeff", formula: "1 < εeff < εr", summary: "The patch fields are shared between the printed substrate and surrounding air. εeff approximates that mixed field environment.", effect: "It determines the guided wavelength used to estimate resonant patch length.", note: "It is calculated from εr, substrate thickness, and patch width; it is not a separate filament datasheet value." },
  width: { title: "Patch width", symbol: "W", formula: "W = c / (2f) · √(2 / (εr + 1))", summary: "The width sets the radiating-edge size and affects input impedance and bandwidth. It is usually selected before the resonant length.", effect: "The displayed value is a closed-form starting estimate for the dominant TM₁₀ mode.", note: "Nearby spacecraft structure, finite ground plane, conductor thickness, and feed details can shift the final tuned width." },
  length: { title: "Patch length & fringing", symbol: "L", formula: "L = Leff − 2ΔL", summary: "The electric field extends beyond each open end of the metal patch. Those fringe fields make the antenna act electrically longer than its physical length.", effect: "Patch length is the main first-pass control for resonance: lengthening it generally lowers resonant frequency.", note: "The design subtracts two edge extensions from the effective half-wavelength length." },
  feed: { title: "Feed position & matching", symbol: "Zin", formula: "Γ = (Zin − 50) / (Zin + 50)", summary: "A feed at the patch edge often sees a higher resistance; moving toward the center changes the input impedance. A radio feed is commonly designed around 50 Ω.", effect: "Feed location or a matching network is tuned to reduce reflected power. This estimator does not solve Zin, so it cannot promise a match.", note: "Use an EM solver to tune the feed, then confirm S₁₁ with a calibrated VNA. |S₁₁| below −10 dB is a common initial target." },
  material: { title: "Printed material", symbol: "εr · tan δ", formula: "ε* = ε′ − jε″", summary: "A filament is not automatically an RF substrate with known properties. Polymer recipe, moisture, infill, voids, and print orientation all matter.", effect: "The dashboard lets you explore assumed values, but predictions are only as representative as the material numbers you enter.", note: "For a serious build, characterize a printed coupon at the operating frequency or find measurements matching your print process." },
} as const;
type LessonKey = keyof typeof lessons;

export default function Dashboard() {
  const [inputs, setInputs] = useState(initial);
  const [materialLabel, setMaterialLabel] = useState("Wood-filled PLA · published example");
  const [modelUrl, setModelUrl] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [activeLesson, setActiveLesson] = useState<LessonKey | null>(null);
  const [liveChange, setLiveChange] = useState<{ key: LessonKey; message: string } | null>(null);
  const result = useMemo(() => calculatePatch(inputs), [inputs]);
  const supabase = getSupabase();
  const update = (key: keyof DesignInputs, value: number) => {
    const lessonKey: LessonKey = key === "frequencyGHz" ? "frequency" : key === "epsilonR" ? "permittivity" : key === "lossTangent" ? "loss" : key === "substrateMm" ? "thickness" : "feed";
    const next = { ...inputs, [key]: value };
    const before = calculatePatch(inputs);
    const after = calculatePatch(next);
    const message = key === "frequencyGHz"
      ? `Frequency ${inputs.frequencyGHz.toFixed(3)} → ${value.toFixed(3)} GHz. Estimated patch: ${before.widthMm.toFixed(1)} × ${before.lengthMm.toFixed(1)} → ${after.widthMm.toFixed(1)} × ${after.lengthMm.toFixed(1)} mm.`
      : key === "epsilonR"
        ? `εr ${inputs.epsilonR.toFixed(2)} → ${value.toFixed(2)}. Estimated patch length: ${before.lengthMm.toFixed(1)} → ${after.lengthMm.toFixed(1)} mm.`
        : key === "substrateMm"
          ? `Substrate ${inputs.substrateMm.toFixed(1)} → ${value.toFixed(1)} mm. Estimated patch length: ${before.lengthMm.toFixed(1)} → ${after.lengthMm.toFixed(1)} mm.`
          : key === "lossTangent"
            ? `tan δ ${inputs.lossTangent.toFixed(3)} → ${value.toFixed(3)}. Patch geometry stays the same in this sizing formula; dielectric loss performance is not being simulated.`
            : `Feed position is not solved by the current sizing formula.`;
    setInputs(next);
    setActiveLesson(lessonKey);
    setLiveChange({ key: lessonKey, message });
  };

  async function signIn() {
    if (!supabase) return setMessage("Add your Supabase URL and anon key to .env.local first.");
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    setMessage(error ? error.message : "Sign-in link sent. Open it in this browser, then save a design.");
  }

  async function saveDesign() {
    if (!supabase) return setMessage("Add your Supabase URL and anon key to .env.local first.");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setMessage("Sign in by email before saving a design.");
    const { error } = await supabase.from("antenna_designs").insert({
      user_id: user.id, frequency_ghz: inputs.frequencyGHz, epsilon_r: inputs.epsilonR,
      loss_tangent: inputs.lossTangent, substrate_mm: inputs.substrateMm,
      patch_width_mm: result.widthMm, patch_length_mm: result.lengthMm,
      material_label: materialLabel,
    });
    setMessage(error ? error.message : "Design saved to your Supabase history.");
  }

  function loadModel(file?: File) {
    if (!file) return;
    if (modelUrl) URL.revokeObjectURL(modelUrl);
    setModelUrl(URL.createObjectURL(file));
    setActiveLesson("material");
  }

  return <main className="shell">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark">◎</span><span>ORBITAL<span className="brand-light"> / ANTENNA LAB</span></span></a>
      <div className="top-status"><span className="live-dot" /> DESIGN EXPLORER <span className="status-divider">/</span> 2.4 GHz PATCH</div>
      <button className="top-link learn-top-link" onClick={() => setActiveLesson("frequency")}>LEARN RF <span>↗</span></button>
    </header>

    <section className="intro">
      <div className="eyebrow">SMALLSAT RF WORKBENCH <span>01 / 03</span></div>
      <h1>Design a patch.<br/><em>Understand why it works.</em></h1>
      <p>Explore how frequency and printed dielectric properties shape a rectangular microstrip antenna. This is a first-pass learning model; full-wave analysis is needed before fabrication.</p>
    </section>

    <section className="workspace">
      <aside className="panel controls-panel">
        <div className="panel-heading"><div><span className="section-index">01</span><h2>Design inputs</h2></div><span className="edit-mark">EDIT</span></div>
        <div className="field-group">
          <div className="field-title"><div className="label-with-help"><label htmlFor="freq">Operating frequency</label><LearnButton onClick={() => setActiveLesson("frequency")} /></div><b>{inputs.frequencyGHz.toFixed(3)} <small>GHz</small></b></div>
          <input id="freq" type="range" min="1" max="6" step="0.01" value={inputs.frequencyGHz} onFocus={() => setActiveLesson("frequency")} onChange={(e) => update("frequencyGHz", +e.target.value)} />
          <div className="range-labels"><span>1 GHz</span><span>6 GHz</span></div>
        </div>
        <div className="divider" />
        <div className="field-group">
          <div className="field-title"><div className="label-with-help"><label htmlFor="er">Relative permittivity <i>εr</i></label><LearnButton onClick={() => setActiveLesson("permittivity")} /></div><b>{inputs.epsilonR.toFixed(2)}</b></div>
          <input id="er" type="range" min="1.2" max="10" step="0.01" value={inputs.epsilonR} onFocus={() => setActiveLesson("permittivity")} onChange={(e) => update("epsilonR", +e.target.value)} />
          <div className="range-labels"><span>Low εr · larger patch</span><span>High εr · smaller patch</span></div>
        </div>
        <div className="field-group compact-field">
          <div className="label-with-help field-label-line"><label htmlFor="material">Material note</label><LearnButton onClick={() => setActiveLesson("material")} /></div>
          <input id="material" className="text-input" value={materialLabel} onFocus={() => setActiveLesson("material")} onChange={(e) => { setMaterialLabel(e.target.value); setActiveLesson("material"); }} />
        </div>
        <div className="field-row">
          <div className="field-group"><div className="label-with-help field-label-line"><label htmlFor="loss">Loss tangent <i>tan δ</i></label><LearnButton onClick={() => setActiveLesson("loss")} /></div><div className="number-wrap"><input id="loss" type="number" min="0" max="0.5" step="0.001" value={inputs.lossTangent} onFocus={() => setActiveLesson("loss")} onChange={(e) => update("lossTangent", Math.max(0, +e.target.value))}/><span>—</span></div></div>
          <div className="field-group"><div className="label-with-help field-label-line"><label htmlFor="thickness">Substrate <i>h</i></label><LearnButton onClick={() => setActiveLesson("thickness")} /></div><div className="number-wrap"><input id="thickness" type="number" min="0.2" max="10" step="0.1" value={inputs.substrateMm} onFocus={() => setActiveLesson("thickness")} onChange={(e) => update("substrateMm", Math.max(0.2, +e.target.value))}/><span>mm</span></div></div>
        </div>
        <div className="material-callout"><span className="callout-icon">i</span><p>εr and loss vary with filament, infill, print pattern, and frequency. Replace these example values with measurements for your exact printed sample.</p></div>
        <div className="divider" />
        <div className="panel-heading subheading"><div><span className="section-index">02</span><h2>Model file</h2></div></div>
        <label className="upload-box"><span className="upload-symbol">＋</span><span><b>{modelUrl ? "Model loaded" : "Load a Fusion export"}</b><small>GLB or glTF · browser preview</small></span><input type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" onChange={(e) => loadModel(e.target.files?.[0])}/></label>
        <div className="upload-footnote">No file? The live parametric patch remains visible in the viewer.</div>
      </aside>

      <div className="visual-column">
        <div className="panel visual-panel">
          <div className="panel-heading visual-heading"><div><span className="section-index">LIVE VIEW</span><h2>Rectangular patch · TM₁₀</h2></div><div className="label-with-help"><span className="units">DIMENSIONS IN MM</span><LearnButton onClick={() => setActiveLesson("length")} /></div></div>
          <AntennaViewer width={result.widthMm} length={result.lengthMm} thickness={inputs.substrateMm} modelUrl={modelUrl}/>
          <div className="dimension-strip"><div><span>PATCH WIDTH</span><b>{format(result.widthMm)} <small>mm</small></b></div><div><span>PATCH LENGTH</span><b>{format(result.lengthMm)} <small>mm</small></b></div><div><span>BOARD ESTIMATE</span><b>{format(result.boardWidthMm)} × {format(result.boardLengthMm)} <small>mm</small></b></div></div>
        </div>
        <div className="metrics-grid">
          <Metric label="FREE-SPACE λ₀" value={format(result.wavelengthMm)} unit="mm" detail="c ÷ f" onLearn={() => setActiveLesson("wavelength")}/>
          <Metric label="EFFECTIVE ε" value={format(result.effectivePermittivity, 3)} unit="εeff" detail="substrate + fringing air" onLearn={() => setActiveLesson("effective")}/>
          <Metric label="FRINGE EXTENSION" value={format(result.fringeMm, 2)} unit="mm / edge" detail="electrical length correction" onLearn={() => setActiveLesson("length")}/>
          <Metric label="EST. RESONANCE" value={format(result.estimatedResonanceGHz, 3)} unit="GHz" detail="idealized TM₁₀ model" onLearn={() => setActiveLesson("frequency")}/>
        </div>
      </div>
    </section>

    <section id="theory" className="theory-section">
      <div className="theory-title"><div className="eyebrow">THE MODEL <span>WHY THE NUMBERS MOVE</span></div><h2>From wavelength<br/>to printed geometry.</h2></div>
      <div className="theory-cards">
        <article className="theory-card"><span className="card-num">01</span><h3>Resonance & wavelength</h3><div className="equation">λ₀ = c / f</div><p>At 2.4 GHz, free-space wavelength is about 125 mm. Fields partly travel through the dielectric, shortening the guided wavelength.</p></article>
        <article className="theory-card"><span className="card-num">02</span><h3>Patch sizing</h3><div className="equation">L ≈ c / (2f√εeff) − 2ΔL</div><p>Fringing fields make the patch electrically longer than its metal. εr and substrate height set εeff and the edge correction.</p></article>
        <article className="theory-card"><span className="card-num">03</span><h3>Loss & matching</h3><div className="equation">Γ = (Zin − 50) / (Zin + 50)</div><p>Loss tangent affects dielectric loss. Feed position changes input impedance; tune the inset or matching network in an EM solver, then verify with a VNA.</p></article>
      </div>
      <div className="model-caveat"><span>ENGINEERING NOTE</span><p>These closed-form equations estimate the starting geometry of an ideal rectangular patch. They do not solve Maxwell’s equations for your exact print, feed, connector, spacecraft body, or nearby materials. The board estimate uses a 3h margin around the patch.</p></div>
    </section>

    <section className="history-section">
      <div><div className="eyebrow">SAVE YOUR WORK</div><h2>Design history</h2><p>Sign in with email to save input snapshots to your private Supabase account.</p></div>
      <div className="history-actions"><input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)}/><button className="secondary-button" onClick={signIn}>EMAIL SIGN-IN LINK</button><button className="primary-button" onClick={saveDesign}>SAVE DESIGN ↗</button>{message && <div className="notice">{message}</div>}</div>
    </section>
    <footer><span>ORBITAL / ANTENNA LAB</span><span>LEARNING TOOL · NOT A FLIGHT-QUALIFIED DESIGN</span><span>BUILD 0.1</span></footer>
    {activeLesson && <TheoryPanel active={activeLesson} inputs={inputs} currentValue={lessonValue(activeLesson, inputs, result, materialLabel)} liveChange={liveChange?.key === activeLesson ? liveChange.message : null} onSelect={setActiveLesson} onClose={() => setActiveLesson(null)} />}
  </main>;
}

function LearnButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className="learn-button" aria-label="Explain this parameter" title="Explain this parameter" onClick={onClick}>i</button>;
}

function Metric({ label, value, unit, detail, onLearn }: { label: string; value: string; unit: string; detail: string; onLearn: () => void }) {
  return <button type="button" className="metric panel" onClick={onLearn} title={`Learn about ${label}`}><span className="metric-label">{label}<span className="metric-info">i</span></span><div><b>{value}</b> <small>{unit}</small></div><span className="metric-detail">{detail}</span></button>;
}

function lessonValue(key: LessonKey, inputs: DesignInputs, result: ReturnType<typeof calculatePatch>, materialLabel: string) {
  const values: Record<LessonKey, string> = {
    frequency: `${format(inputs.frequencyGHz, 3)} GHz`, permittivity: `εr ${format(inputs.epsilonR, 2)}`,
    loss: `tan δ ${format(inputs.lossTangent, 3)}`, thickness: `${format(inputs.substrateMm, 1)} mm`,
    wavelength: `${format(result.wavelengthMm, 2)} mm`, effective: `εeff ${format(result.effectivePermittivity, 3)}`,
    width: `${format(result.widthMm, 2)} mm`, length: `${format(result.lengthMm, 2)} mm`,
    feed: "Requires EM tuning", material: materialLabel || "No material label entered",
  };
  return values[key];
}

function TheoryPanel({ active, inputs, currentValue, liveChange, onSelect, onClose }: { active: LessonKey; inputs: DesignInputs; currentValue: string; liveChange: string | null; onSelect: (key: LessonKey) => void; onClose: () => void }) {
  const lesson = lessons[active];
  const warning = active === "loss"
    ? "Loss tangent is shown as an input, but this calculator does not predict efficiency or bandwidth from it."
    : active === "feed"
      ? "No input impedance or S₁₁ is solved here. Feed matching needs an EM solver and measurement."
      : active === "material" || active === "permittivity"
        ? "An inaccurate εr can shift the real resonant frequency. Printed-sample measurements matter more than a generic filament label."
        : active === "thickness"
          ? "The analytical estimate omits the connector, finite conductor thickness, enclosure, and spacecraft structure."
          : "Treat the dimensions as a starting estimate. Final resonance depends on the complete feed and spacecraft installation.";
  return <div className="theory-overlay">
    <aside className="theory-drawer" role="complementary" aria-label="Live RF theory guide">
      <div className="drawer-top"><div><span className="eyebrow">QUICK RF GUIDE</span><h2 id="drawer-title">Understand a parameter</h2></div><button className="drawer-close" onClick={onClose} aria-label="Close theory panel">×</button></div>
      <div className="lesson-picker" aria-label="Choose an RF concept">{(Object.keys(lessons) as LessonKey[]).map((key) => <button key={key} className={active === key ? "lesson-chip selected" : "lesson-chip"} onClick={() => onSelect(key)}>{lessons[key].title}</button>)}</div>
      <article className="lesson-content" key={active}>
        <span className="lesson-symbol">{lesson.symbol}</span><h3>{lesson.title}</h3><div className="lesson-formula">{lesson.formula}</div>
        <div className="lesson-current"><span>CURRENT IN THIS DESIGN</span><b>{currentValue}</b></div>
        {liveChange && <div className="live-calculation"><span>LIVE CALCULATION CHANGE</span><p>{liveChange}</p></div>}
        {!liveChange && <p className="adjust-hint">Adjust this control to see the calculation update here.</p>}
        <ResponseGraph active={active} inputs={inputs} />
        <p>{lesson.summary}</p>
        <div className="lesson-effect"><span>WHAT CHANGES IN THE DESIGN</span><p>{lesson.effect}</p></div>
        <div className="lesson-note"><span>KEEP IN MIND</span><p>{lesson.note}</p></div>
        <div className="live-warning"><span>MODEL CHECK</span><p>{warning}</p></div>
      </article>
      <div className="drawer-footer"><span>FIRST-PASS MODEL · TM₁₀ PATCH</span><button onClick={onClose}>BACK TO DESIGN <span>↗</span></button></div>
    </aside>
  </div>;
}

function ResponseGraph({ active, inputs }: { active: LessonKey; inputs: DesignInputs }) {
  const xKey: keyof DesignInputs = active === "frequency" || active === "wavelength" || active === "width" || active === "length"
    ? "frequencyGHz"
    : active === "permittivity" || active === "effective" || active === "material"
      ? "epsilonR"
      : active === "loss" ? "lossTangent" : active === "thickness" ? "substrateMm" : "feedOffsetMm";
  const labels: Record<keyof DesignInputs, string> = { frequencyGHz: "Frequency (GHz)", epsilonR: "Assumed εr", lossTangent: "Loss tangent", substrateMm: "Thickness (mm)", feedOffsetMm: "Feed inset (mm)" };
  const xValue = inputs[xKey];
  let min = xKey === "frequencyGHz" ? Math.max(1, xValue * 0.65) : xKey === "epsilonR" ? 1.2 : xKey === "substrateMm" ? 0.2 : xKey === "feedOffsetMm" ? 0 : 0;
  let max = xKey === "frequencyGHz" ? Math.min(6, xValue * 1.35) : xKey === "epsilonR" ? 10 : xKey === "substrateMm" ? 10 : xKey === "feedOffsetMm" ? 30 : Math.max(0.1, xValue * 2, 0.05);
  if (max - min < 1e-6) max = min + 0.1;
  const points = Array.from({ length: 33 }, (_, index) => {
    const x = min + (max - min) * index / 32;
    const design = calculatePatch({ ...inputs, [xKey]: x });
    return { x, width: design.widthMm, length: design.lengthMm };
  });
  const values = points.flatMap((point) => [point.width, point.length]);
  const yMin = Math.min(...values) - 1;
  const yMax = Math.max(...values) + 1;
  const plot = { left: 39, right: 306, top: 16, bottom: 111 };
  const xAt = (x: number) => plot.left + (x - min) / (max - min) * (plot.right - plot.left);
  const yAt = (y: number) => plot.bottom - (y - yMin) / (yMax - yMin || 1) * (plot.bottom - plot.top);
  const pathFor = (key: "width" | "length") => points.map((point, index) => `${index === 0 ? "M" : "L"}${xAt(point.x).toFixed(1)},${yAt(point[key]).toFixed(1)}`).join(" ");
  const current = calculatePatch(inputs);
  const markerX = xAt(xValue);
  return <div className="response-graph">
    <div className="graph-heading"><span>PATCH SIZE RESPONSE</span><small>estimator output · not full-wave simulation</small></div>
    <svg viewBox="0 0 320 145" role="img" aria-label={`Estimated patch width and length as ${labels[xKey]} changes`}>
      {[0, 1, 2, 3].map((index) => { const y = plot.top + index * (plot.bottom - plot.top) / 3; return <g key={index}><line x1={plot.left} x2={plot.right} y1={y} y2={y} stroke="#293740" strokeWidth="1"/><text x="3" y={y + 3} fill="#71808b" fontSize="8">{(yMax - (yMax - yMin) * index / 3).toFixed(0)}</text></g>; })}
      <line x1={markerX} x2={markerX} y1={plot.top} y2={plot.bottom} stroke="#e9a94c" strokeDasharray="3 4" opacity=".8"/>
      <path d={pathFor("length")} fill="none" stroke="#e8b467" strokeWidth="2"/>
      <path d={pathFor("width")} fill="none" stroke="#91b9a0" strokeWidth="2"/>
      <circle cx={markerX} cy={yAt(current.lengthMm)} r="3.2" fill="#e8b467" stroke="#111820" strokeWidth="1.4"/>
      <circle cx={markerX} cy={yAt(current.widthMm)} r="3.2" fill="#91b9a0" stroke="#111820" strokeWidth="1.4"/>
      <text x={plot.left} y="128" fill="#82909a" fontSize="8">{min.toFixed(2)}</text><text x={plot.right} y="128" fill="#82909a" fontSize="8" textAnchor="end">{max.toFixed(2)}</text>
      <text x="172" y="141" fill="#82909a" fontSize="8" textAnchor="middle">{labels[xKey]}</text>
    </svg>
    <div className="graph-legend"><span><i className="legend-length"/>Patch length</span><span><i className="legend-width"/>Patch width</span><b>{xValue.toFixed(xKey === "frequencyGHz" ? 3 : 2)}</b></div>
  </div>;
}

