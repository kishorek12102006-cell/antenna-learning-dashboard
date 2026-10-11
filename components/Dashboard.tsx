"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, type ReactNode } from "react";
import { calculatePatch, format, type DesignInputs } from "@/lib/antenna";
import { getSupabase } from "@/lib/supabase";
import { INFILL_PATTERNS, MATERIAL_TYPES, MEASURED_PRINT_SAMPLES, materialLabel as getMaterialLabel, type InfillPattern, type MaterialType } from "@/lib/print";

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
  material: { title: "Printed material", symbol: "εr · tan δ", formula: "ε* = ε′ − jε″", summary: "A filament is not automatically an RF substrate with known properties. Polymer recipe, moisture, infill, voids, and print orientation all matter.", effect: "The selected sample or manual dielectric values feed the first-pass patch-size calculator.", note: "A published sample is a reference point, not a universal PLA or wood-filled PLA specification. Characterize a coupon made with your own filament and printer." },
  infill: { title: "Infill & air voids", symbol: "εr,print ≠ εr,filament", formula: "Printed εr depends on polymer, air, skins, and direction", summary: "Infill changes how much polymer and air the RF field encounters. Layer direction and the outer skins can make a printed substrate behave differently in different directions.", effect: "The cutaway preview changes immediately. The calculator uses a matching measured sample when one is selected; otherwise it keeps the editable εr and loss tangent as explicit assumptions.", note: "The 3D lattice is an illustration, not a field solver. A coupon printed with the final pattern and skin settings gives more useful dielectric values." },
} as const;
type LessonKey = keyof typeof lessons;

export default function Dashboard() {
  const [inputs, setInputs] = useState(initial);
  const [materialType, setMaterialType] = useState<MaterialType>("wood-pla");
  const [infillPattern, setInfillPattern] = useState<InfillPattern>("solid");
  const [infillDensity, setInfillDensity] = useState(100);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>("wood-pla-solid");
  const [customMaterialName, setCustomMaterialName] = useState("");
  const [propertyStatus, setPropertyStatus] = useState("Using a published wood-filled PLA solid sample measured at 2.4 GHz.");
  const [modelUrl, setModelUrl] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [activeLesson, setActiveLesson] = useState<LessonKey | null>(null);
  const [liveChange, setLiveChange] = useState<{ key: LessonKey; message: string } | null>(null);
  const result = useMemo(() => calculatePatch(inputs), [inputs]);
  const supabase = getSupabase();
  const materialLabel = getMaterialLabel(materialType, customMaterialName);
  const sampleOptions = MEASURED_PRINT_SAMPLES.filter((sample) => sample.material === materialType);
  const selectedSample = MEASURED_PRINT_SAMPLES.find((sample) => sample.id === selectedSampleId) ?? null;
  const selectedPattern = INFILL_PATTERNS.find((pattern) => pattern.key === infillPattern)!;
  const designMaterialLabel = `${materialLabel} · ${selectedPattern.label} · ${infillDensity}%`;
  const sampleFrequencyMatches = !!selectedSample && Math.abs(inputs.frequencyGHz - 2.4) < 0.005;
  const printStatusMessage = selectedSample && !sampleFrequencyMatches
    ? `${propertyStatus} The reference is measured at 2.4 GHz; its dielectric values may not apply at ${inputs.frequencyGHz.toFixed(3)} GHz.`
    : propertyStatus;

  function applySample(sampleId: string) {
    const sample = MEASURED_PRINT_SAMPLES.find((item) => item.id === sampleId);
    if (!sample) return;
    setMaterialType(sample.material);
    setSelectedSampleId(sample.id);
    setInfillPattern(sample.pattern);
    setInfillDensity(sample.polymerFraction);
    setInputs((current) => ({ ...current, epsilonR: sample.epsilonR, lossTangent: sample.lossTangent }));
    setPropertyStatus(`Using one published ${sample.label} specimen measured at 2.4 GHz. It is not a universal filament specification.`);
    setActiveLesson("material");
    setLiveChange({ key: "material", message: `Loaded ${sample.label}: εr ${sample.epsilonR.toFixed(2)}, tan δ ${sample.lossTangent.toFixed(3)} at 2.4 GHz. The same sample's pattern and polymer fraction are shown in the cutaway.` });
  }

  function chooseMaterial(nextMaterial: MaterialType) {
    setMaterialType(nextMaterial);
    const defaultSample = MEASURED_PRINT_SAMPLES.find((sample) => sample.material === nextMaterial && sample.pattern === "solid" && sample.polymerFraction === 100);
    if (defaultSample) {
      applySample(defaultSample.id);
      return;
    }
    setSelectedSampleId(null);
    const nextLabel = getMaterialLabel(nextMaterial, customMaterialName);
    setPropertyStatus(`No measured 2.4 GHz preset is loaded for ${nextLabel}. The εr and tan δ values currently shown are carried-over assumptions, not measured values for this material.`);
    setActiveLesson("material");
    setLiveChange({ key: "material", message: `Selected ${nextLabel}. No 2.4 GHz reference preset is available here, so the current εr and loss tangent stay unchanged and must be replaced with measured or datasheet values.` });
  }

  function changeInfillPattern(nextPattern: InfillPattern) {
    const previousSource = selectedSample?.label ?? "the current manual values";
    setInfillPattern(nextPattern);
    setSelectedSampleId(null);
    setPropertyStatus(`Print pattern changed. The εr and tan δ numbers remain from ${previousSource}; they are not recalculated for this new pattern.`);
    setActiveLesson("infill");
    setLiveChange({ key: "infill", message: `Changed infill to ${INFILL_PATTERNS.find((item) => item.key === nextPattern)?.label}. The cutaway changes; εr and tan δ remain ${inputs.epsilonR.toFixed(2)} and ${inputs.lossTangent.toFixed(3)} until you load a matching sample or enter measured values.` });
  }

  function changeInfillDensity(nextDensity: number) {
    const previousSource = selectedSample?.label ?? "your manual assumptions";
    setInfillDensity(nextDensity);
    setSelectedSampleId(null);
    setPropertyStatus(`Polymer volume changed. The εr and tan δ numbers remain from ${previousSource}; they are not recalculated for this density.`);
    setActiveLesson("infill");
    setLiveChange({ key: "infill", message: `Polymer volume fraction set to ${nextDensity}%. The 3D cutaway updates; this estimator does not infer RF properties from a slicer percentage.` });
  }

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
    if (key === "epsilonR" || key === "lossTangent") {
      setSelectedSampleId(null);
      setPropertyStatus("Manual dielectric input. Use values measured for this exact filament and printed structure where possible.");
    }
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
      material_label: designMaterialLabel,
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
          <div className="field-title"><div className="label-with-help"><label htmlFor="er">Printed substrate <i>εr</i></label><LearnButton onClick={() => setActiveLesson("permittivity")} /></div><b>{inputs.epsilonR.toFixed(2)}</b></div>
          <input id="er" type="range" min="1.2" max="10" step="0.01" value={inputs.epsilonR} onFocus={() => setActiveLesson("permittivity")} onChange={(e) => update("epsilonR", +e.target.value)} />
          <div className="range-labels"><span>Low εr · larger patch</span><span>High εr · smaller patch</span></div>
        </div>
        <div className="divider" />
        <div className="panel-heading subheading"><div><span className="section-index">PRINT</span><h2>Material & infill</h2></div><LearnButton onClick={() => setActiveLesson("infill")} /></div>
        <div className="field-group compact-field">
          <div className="label-with-help field-label-line"><label htmlFor="material-type">Filament material</label><LearnButton onClick={() => setActiveLesson("material")} /></div>
          <select id="material-type" className="select-input" value={materialType} onFocus={() => setActiveLesson("material")} onChange={(e) => chooseMaterial(e.target.value as MaterialType)}>
            {MATERIAL_TYPES.map((material) => <option key={material.key} value={material.key}>{material.label}</option>)}
          </select>
          <p className="field-explainer">{MATERIAL_TYPES.find((material) => material.key === materialType)?.description}</p>
          {materialType === "custom" && <input className="text-input custom-material-input" aria-label="Custom material name" placeholder="Enter filament name" value={customMaterialName} onFocus={() => setActiveLesson("material")} onChange={(e) => { setCustomMaterialName(e.target.value); setSelectedSampleId(null); setPropertyStatus("Custom filament selected. Enter measured or datasheet εr and loss tangent; current numbers are assumptions."); }} />}
        </div>
        <div className="field-group compact-field">
          <div className="label-with-help field-label-line"><label htmlFor="rf-sample">Published RF sample</label><LearnButton onClick={() => setActiveLesson("material")} /></div>
          {sampleOptions.length > 0 ? <select id="rf-sample" className="select-input" value={selectedSampleId ?? ""} onFocus={() => setActiveLesson("material")} onChange={(e) => applySample(e.target.value)}>
            <option value="" disabled>Choose a measured reference sample</option>
            {sampleOptions.map((sample) => <option key={sample.id} value={sample.id}>{sample.label}</option>)}
          </select> : <div className="no-preset">No 2.4 GHz sample preset for this filament. Enter its printed-coupon values below.</div>}
        </div>
        <div className="field-group compact-field">
          <div className="label-with-help field-label-line"><label htmlFor="infill-pattern">Infill type</label><LearnButton onClick={() => setActiveLesson("infill")} /></div>
          <select id="infill-pattern" className="select-input" value={infillPattern} onFocus={() => setActiveLesson("infill")} onChange={(e) => changeInfillPattern(e.target.value as InfillPattern)}>
            {INFILL_PATTERNS.map((pattern) => <option key={pattern.key} value={pattern.key}>{pattern.label}</option>)}
          </select>
          <p className="field-explainer">{selectedPattern.description}</p>
        </div>
        <div className="field-group density-field">
          <div className="field-title"><div className="label-with-help"><label htmlFor="infill-density">Polymer volume fraction</label><LearnButton onClick={() => setActiveLesson("infill")} /></div><b>{infillDensity}<small>%</small></b></div>
          <input id="infill-density" type="range" min="10" max="100" step="1" value={infillDensity} onFocus={() => setActiveLesson("infill")} onChange={(e) => changeInfillDensity(+e.target.value)} />
          <div className="range-labels"><span>More air</span><span>More polymer</span></div>
        </div>
        <div className={sampleFrequencyMatches ? "print-status measured" : "print-status"}>
          <b>{sampleFrequencyMatches ? "REFERENCE DATA · 2.4 GHz" : "UNMATCHED PRINT SETTINGS"}</b>
          <p>{printStatusMessage}</p>
          {selectedSample && <a href={selectedSample.sourceUrl} target="_blank" rel="noreferrer">Source: {selectedSample.sourceLabel} ↗</a>}
        </div>
        <div className="field-row">
          <div className="field-group"><div className="label-with-help field-label-line"><label htmlFor="loss">Loss tangent <i>tan δ</i></label><LearnButton onClick={() => setActiveLesson("loss")} /></div><div className="number-wrap"><input id="loss" type="number" min="0" max="0.5" step="0.001" value={inputs.lossTangent} onFocus={() => setActiveLesson("loss")} onChange={(e) => update("lossTangent", Math.max(0, +e.target.value))}/><span>—</span></div></div>
          <div className="field-group"><div className="label-with-help field-label-line"><label htmlFor="thickness">Substrate <i>h</i></label><LearnButton onClick={() => setActiveLesson("thickness")} /></div><div className="number-wrap"><input id="thickness" type="number" min="0.2" max="10" step="0.1" value={inputs.substrateMm} onFocus={() => setActiveLesson("thickness")} onChange={(e) => update("substrateMm", Math.max(0.2, +e.target.value))}/><span>mm</span></div></div>
        </div>
        <div className="material-callout"><span className="callout-icon">i</span><p>The filled-number presets are individual 2.4 GHz research samples. Changing the material or infill does not invent dielectric data: the warning above tells you when εr and tan δ no longer match the selected print.</p></div>
        <div className="divider" />
        <div className="panel-heading subheading"><div><span className="section-index">02</span><h2>Model file</h2></div></div>
        <label className="upload-box"><span className="upload-symbol">＋</span><span><b>{modelUrl ? "Model loaded" : "Load a Fusion export"}</b><small>GLB or glTF · browser preview</small></span><input type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" onChange={(e) => loadModel(e.target.files?.[0])}/></label>
        <div className="upload-footnote">No file? The live parametric patch remains visible in the viewer.</div>
      </aside>

      <div className="visual-column">
        <div className="panel visual-panel">
          <div className="panel-heading visual-heading"><div><span className="section-index">LIVE VIEW</span><h2>Rectangular patch · TM₁₀</h2></div><div className="label-with-help"><span className="units">DIMENSIONS IN MM</span><LearnButton onClick={() => setActiveLesson("length")} /></div></div>
          <AntennaViewer width={result.widthMm} length={result.lengthMm} boardWidth={result.boardWidthMm} boardLength={result.boardLengthMm} thickness={inputs.substrateMm} modelUrl={modelUrl} pattern={infillPattern} density={infillDensity} materialType={materialType}/>
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
    {activeLesson && <TheoryPanel active={activeLesson} inputs={inputs} currentValue={lessonValue(activeLesson, inputs, result, designMaterialLabel, infillPattern, infillDensity)} liveChange={liveChange?.key === activeLesson ? liveChange.message : null} propertyStatus={printStatusMessage} infillPattern={infillPattern} infillDensity={infillDensity} onSelect={setActiveLesson} onClose={() => setActiveLesson(null)} />}
  </main>;
}

function LearnButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className="learn-button" aria-label="Explain this parameter" title="Explain this parameter" onClick={onClick}>i</button>;
}

function Metric({ label, value, unit, detail, onLearn }: { label: string; value: string; unit: string; detail: string; onLearn: () => void }) {
  return <button type="button" className="metric panel" onClick={onLearn} title={`Learn about ${label}`}><span className="metric-label">{label}<span className="metric-info">i</span></span><div><b>{value}</b> <small>{unit}</small></div><span className="metric-detail">{detail}</span></button>;
}

function lessonValue(key: LessonKey, inputs: DesignInputs, result: ReturnType<typeof calculatePatch>, materialLabel: string, infillPattern: InfillPattern, infillDensity: number) {
  const values: Record<LessonKey, string> = {
    frequency: `${format(inputs.frequencyGHz, 3)} GHz`, permittivity: `εr ${format(inputs.epsilonR, 2)}`,
    loss: `tan δ ${format(inputs.lossTangent, 3)}`, thickness: `${format(inputs.substrateMm, 1)} mm`,
    wavelength: `${format(result.wavelengthMm, 2)} mm`, effective: `εeff ${format(result.effectivePermittivity, 3)}`,
    width: `${format(result.widthMm, 2)} mm`, length: `${format(result.lengthMm, 2)} mm`,
    feed: "Requires EM tuning", material: materialLabel || "No material label entered",
    infill: `${INFILL_PATTERNS.find((pattern) => pattern.key === infillPattern)?.label} · ${infillDensity}% polymer`,
  };
  return values[key];
}

function TheoryPanel({ active, inputs, currentValue, liveChange, propertyStatus, infillPattern, infillDensity, onSelect, onClose }: { active: LessonKey; inputs: DesignInputs; currentValue: string; liveChange: string | null; propertyStatus: string; infillPattern: InfillPattern; infillDensity: number; onSelect: (key: LessonKey) => void; onClose: () => void }) {
  const lesson = lessons[active];
  const warning = active === "loss"
    ? "Loss tangent is shown as an input, but this calculator does not predict efficiency or bandwidth from it."
    : active === "feed"
      ? "No input impedance or S₁₁ is solved here. Feed matching needs an EM solver and measurement."
      : active === "material" || active === "permittivity"
        ? "An inaccurate εr can shift the real resonant frequency. Printed-sample measurements matter more than a generic filament label."
    : active === "infill"
      ? "Pattern and polymer fraction change the cutaway illustration. The estimator does not calculate the new effective εr or loss tangent from the slicer setting."
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
        {active === "infill" ? <InfillDiagram pattern={infillPattern} density={infillDensity} /> : <ResponseGraph active={active} inputs={inputs} />}
        <p>{lesson.summary}</p>
        <div className="lesson-effect"><span>WHAT CHANGES IN THE DESIGN</span><p>{lesson.effect}</p></div>
        <div className="lesson-note"><span>KEEP IN MIND</span><p>{lesson.note}</p></div>
        <div className="live-warning"><span>MODEL CHECK</span><p>{warning}</p></div>
        {(active === "material" || active === "infill" || active === "permittivity" || active === "loss") && <div className="print-status drawer-status"><b>PRINT DATA STATUS</b><p>{propertyStatus}</p></div>}
      </article>
      <div className="drawer-footer"><span>FIRST-PASS MODEL · TM₁₀ PATCH</span><button onClick={onClose}>BACK TO DESIGN <span>↗</span></button></div>
    </aside>
  </div>;
}

function InfillDiagram({ pattern, density }: { pattern: InfillPattern; density: number }) {
  const count = Math.max(2, Math.min(6, Math.round(2 + density / 25)));
  const lines: ReactNode[] = [];
  if (pattern === "solid") {
    lines.push(<rect key="solid" x="18" y="16" width="284" height="88" rx="2" fill="#7f9b94" opacity=".55" />);
  } else if (pattern === "empty") {
    lines.push(<rect key="empty" x="18" y="16" width="284" height="88" rx="2" fill="#0d151a" />);
  } else if (pattern === "grid" || pattern === "lines" || pattern === "waffle") {
    for (let i = 1; i <= count; i += 1) {
      const x = 18 + (284 * i) / (count + 1);
      const y = 16 + (88 * i) / (count + 1);
      lines.push(<line key={`v-${i}`} x1={pattern === "lines" ? 18 : x} x2={pattern === "lines" ? 302 : x} y1="16" y2="104" />);
      if (pattern !== "lines") lines.push(<line key={`h-${i}`} x1="18" x2="302" y1={y} y2={y} />);
    }
    if (pattern === "waffle") {
      for (let i = 0; i < count; i += 1) {
        const x = 18 + (284 * i) / count;
        const nextX = 18 + (284 * (i + 1)) / count;
        const y = 16 + (88 * i) / count;
        const nextY = 16 + (88 * (i + 1)) / count;
        lines.push(<line key={`d-${i}`} x1={x} y1={y} x2={nextX} y2={nextY} opacity=".55" />);
      }
    }
  } else if (pattern === "honeycomb") {
    const radius = Math.min(21, 86 / count);
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count + 1; col += 1) {
        const cx = 18 + col * radius * 1.5 + (row % 2) * radius * 0.75;
        const cy = 16 + radius + row * radius * 1.6;
        const points = Array.from({ length: 6 }, (_, index) => {
          const angle = Math.PI / 3 * index;
          return `${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`;
        }).join(" ");
        if (cx < 304 && cy < 104) lines.push(<polygon key={`hex-${row}-${col}`} points={points} />);
      }
    }
  } else if (pattern === "gyroid") {
    for (let lane = 0; lane < count + 1; lane += 1) {
      const baseY = 25 + lane * (70 / count);
      const points = Array.from({ length: 35 }, (_, index) => {
        const x = 19 + index * (282 / 34);
        const y = baseY + Math.sin((index / 34) * Math.PI * 4 + lane * Math.PI) * 8;
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ");
      lines.push(<path key={`wave-${lane}`} d={points} />);
    }
  } else if (pattern === "concentric") {
    for (let i = 0; i < count; i += 1) lines.push(<rect key={`ring-${i}`} x={18 + i * 10} y={16 + i * 6} width={284 - i * 20} height={88 - i * 12} rx="2" fill="none" />);
  }
  return <div className="infill-diagram">
    <div className="graph-heading"><span>INFILL CROSS-SECTION</span><small>schematic preview · {density}%</small></div>
    <svg viewBox="0 0 320 120" role="img" aria-label={`${pattern} infill schematic at ${density} percent polymer volume`}>
      <rect x="14" y="12" width="292" height="96" rx="3" fill="#0b1217" stroke="#647c78" strokeWidth="4" />
      <g fill="none" stroke="#9fc6a7" strokeWidth={Math.max(1.2, density / 35)} opacity=".9">{lines}</g>
      <rect x="14" y="12" width="292" height="7" fill="#7c9992" opacity=".5" />
      <rect x="14" y="101" width="292" height="7" fill="#7c9992" opacity=".5" />
    </svg>
    <p>Outer skins are shown. The pattern drawing explains the print layout; it does not solve the RF field inside the substrate.</p>
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

