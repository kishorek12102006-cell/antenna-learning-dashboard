export type MaterialType = "pla" | "wood-pla" | "abs" | "petg" | "asa" | "nylon" | "rf" | "custom";
export type InfillPattern = "solid" | "grid" | "lines" | "honeycomb" | "gyroid" | "concentric" | "waffle" | "empty";

export const MATERIAL_TYPES: { key: MaterialType; label: string; description: string }[] = [
  { key: "pla", label: "PLA", description: "Common thermoplastic. The preset is one measured print sample, not a universal PLA value." },
  { key: "wood-pla", label: "Wood-filled PLA", description: "A PLA composite; wood fraction and print settings change its RF properties." },
  { key: "abs", label: "ABS", description: "Common thermoplastic. Enter values measured for your filament and print." },
  { key: "petg", label: "PETG", description: "Common thermoplastic. Brand, moisture, and print structure matter." },
  { key: "asa", label: "ASA", description: "UV-resistant thermoplastic. Use measured or manufacturer RF data." },
  { key: "nylon", label: "Nylon / PA", description: "Moisture uptake can strongly change dielectric properties." },
  { key: "rf", label: "RF / low-loss filament", description: "Use the manufacturer’s frequency-specific datasheet or a printed-coupon measurement." },
  { key: "custom", label: "Other / custom filament", description: "Name the material and enter measured substrate properties below." },
];

export const INFILL_PATTERNS: { key: InfillPattern; label: string; description: string }[] = [
  { key: "solid", label: "Solid", description: "Nearly continuous polymer. Simple to explain; usually heavier and uses more filament." },
  { key: "grid", label: "Grid", description: "Crossing straight ribs. The repeated directions can make the printed dielectric electrically anisotropic." },
  { key: "lines", label: "Lines", description: "Parallel ribs leave air channels. The field can see different properties along and across the lines." },
  { key: "honeycomb", label: "Honeycomb", description: "Hexagonal cells trade material for a cellular structure. The cell walls and outer skins affect the RF result." },
  { key: "gyroid", label: "Gyroid-like", description: "A continuous, wavy lattice. The preview is schematic; it is not an exact slicer gyroid or electromagnetic model." },
  { key: "concentric", label: "Concentric", description: "Nested loops follow the part boundary. Air gaps and loop orientation affect the substrate’s effective properties." },
  { key: "waffle", label: "Waffle", description: "Cross-hatched cells. A published PLA sample is available as a reference preset." },
  { key: "empty", label: "Hollow core", description: "Outer skins and walls enclose air. The skins still contain polymer and carry mechanical loads." },
];

export type MeasuredPrintSample = {
  id: string;
  material: MaterialType;
  label: string;
  pattern: InfillPattern;
  polymerFraction: number;
  epsilonR: number;
  lossTangent: number;
  sourceLabel: string;
  sourceUrl: string;
  note: string;
};

// These are individual published specimens measured at 2.4 GHz. They are not
// universal properties for every spool, printer, or slicer profile.
export const MEASURED_PRINT_SAMPLES: MeasuredPrintSample[] = [
  {
    id: "pla-solid",
    material: "pla",
    label: "Solid PLA · 100% polymer volume",
    pattern: "solid",
    polymerFraction: 100,
    epsilonR: 2.72,
    lossTangent: 0.008,
    sourceLabel: "Zhang et al., 2015",
    sourceUrl: "https://onlinelibrary.wiley.com/doi/full/10.1002/mop.29324",
    note: "One printed PLA specimen with 100% polymer volume fraction.",
  },
  {
    id: "pla-waffle-73",
    material: "pla",
    label: "PLA · waffle · 73% polymer volume",
    pattern: "waffle",
    polymerFraction: 73,
    epsilonR: 2.53,
    lossTangent: 0.008,
    sourceLabel: "Zhang et al., 2015",
    sourceUrl: "https://onlinelibrary.wiley.com/doi/full/10.1002/mop.29324",
    note: "Measured specimen; reported volume fraction includes its outer skins.",
  },
  {
    id: "pla-waffle-70",
    material: "pla",
    label: "PLA · waffle · 70% polymer volume",
    pattern: "waffle",
    polymerFraction: 70,
    epsilonR: 2.27,
    lossTangent: 0.006,
    sourceLabel: "Zhang et al., 2015",
    sourceUrl: "https://onlinelibrary.wiley.com/doi/full/10.1002/mop.29324",
    note: "A different waffle geometry from the 73% specimen; same pattern name does not mean the same RF value.",
  },
  {
    id: "pla-honeycomb-70",
    material: "pla",
    label: "PLA · honeycomb · 70% polymer volume",
    pattern: "honeycomb",
    polymerFraction: 70,
    epsilonR: 2.25,
    lossTangent: 0.006,
    sourceLabel: "Zhang et al., 2015",
    sourceUrl: "https://onlinelibrary.wiley.com/doi/full/10.1002/mop.29324",
    note: "Measured specimen; reported volume fraction includes its outer skins.",
  },
  {
    id: "pla-hollow-33",
    material: "pla",
    label: "PLA · hollow core with skins · 33% polymer volume",
    pattern: "empty",
    polymerFraction: 33,
    epsilonR: 1.6,
    lossTangent: 0.004,
    sourceLabel: "Zhang et al., 2015",
    sourceUrl: "https://onlinelibrary.wiley.com/doi/full/10.1002/mop.29324",
    note: "This specimen had no inner fill but did have polymer top and bottom skins.",
  },
  {
    id: "wood-pla-solid",
    material: "wood-pla",
    label: "Wood-filled PLA · solid · 100% fill",
    pattern: "solid",
    polymerFraction: 100,
    epsilonR: 2.4,
    lossTangent: 0.017,
    sourceLabel: "Mirzaee & Noghanian, 2016",
    sourceUrl: "https://ietresearch.onlinelibrary.wiley.com/doi/10.1049/el.2016.2505",
    note: "The paper’s solid specimen was 70% PLA and 30% recycled wood fiber.",
  },
];

export function materialLabel(key: MaterialType, customName = "") {
  if (key === "custom" && customName.trim()) return customName.trim();
  return MATERIAL_TYPES.find((material) => material.key === key)?.label ?? "Custom filament";
}

