export type DesignInputs = {
  frequencyGHz: number;
  epsilonR: number;
  lossTangent: number;
  substrateMm: number;
  feedOffsetMm: number;
};

export type PatchResult = {
  wavelengthMm: number;
  effectivePermittivity: number;
  widthMm: number;
  effectiveLengthMm: number;
  fringeMm: number;
  lengthMm: number;
  boardWidthMm: number;
  boardLengthMm: number;
  estimatedResonanceGHz: number;
};

const c = 299_792_458;

export function calculatePatch(input: DesignInputs): PatchResult {
  const f = input.frequencyGHz * 1e9;
  const h = input.substrateMm;
  const wavelengthMm = (c / f) * 1e3;
  const widthMm = (c / (2 * f)) * Math.sqrt(2 / (input.epsilonR + 1)) * 1e3;
  const effectivePermittivity = (input.epsilonR + 1) / 2
    + ((input.epsilonR - 1) / 2) * (1 + (12 * h) / widthMm) ** -0.5;
  const effectiveLengthMm = (c / (2 * f * Math.sqrt(effectivePermittivity))) * 1e3;
  const ratio = widthMm / h;
  const fringeMm = 0.412 * h
    * ((effectivePermittivity + 0.3) * (ratio + 0.264))
    / ((effectivePermittivity - 0.258) * (ratio + 0.8));
  const lengthMm = effectiveLengthMm - 2 * fringeMm;
  // Conventional first-pass ground plane margin of 3h on each side.
  const boardWidthMm = widthMm + 6 * h;
  const boardLengthMm = lengthMm + 6 * h;
  const estimatedResonanceGHz = (c / (2 * (lengthMm + 2 * fringeMm) / 1e3 * Math.sqrt(effectivePermittivity))) / 1e9;
  return { wavelengthMm, effectivePermittivity, widthMm, effectiveLengthMm, fringeMm,
    lengthMm, boardWidthMm, boardLengthMm, estimatedResonanceGHz };
}

export function format(value: number, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

