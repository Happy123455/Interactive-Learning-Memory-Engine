export interface SteelSection {
  designation: string; // e.g., "ISMB 300"
  weight: number;      // kg/m
  h: number;           // depth of section in mm
  bf: number;          // width of flange in mm
  tw: number;          // thickness of web in mm
  tf: number;          // thickness of flange in mm
  Ixx: number;         // x 10^4 mm^4 (or cm^4)
  Iyy: number;         // x 10^4 mm^4 (or cm^4)
  Zxx: number;         // elastic section modulus cm^3
  Zpx: number;         // plastic section modulus cm^3
}

export const INDIAN_STEEL_TABLE: SteelSection[] = [
  {
    designation: "ISMB 200",
    weight: 25.4,
    h: 200,
    bf: 100,
    tw: 5.7,
    tf: 10.8,
    Ixx: 2235,
    Iyy: 150,
    Zxx: 223.6,
    Zpx: 254.2
  },
  {
    designation: "ISMB 250",
    weight: 37.3,
    h: 250,
    bf: 125,
    tw: 6.9,
    tf: 12.5,
    Ixx: 5757.6,
    Iyy: 298.6,
    Zxx: 461.0,
    Zpx: 527.1
  },
  {
    designation: "ISMB 300",
    weight: 44.2,
    h: 300,
    bf: 140,
    tw: 7.5,
    tf: 12.4,
    Ixx: 8603.6,
    Iyy: 453.9,
    Zxx: 573.6,
    Zpx: 654.3
  },
  {
    designation: "ISMB 350",
    weight: 52.4,
    h: 350,
    bf: 140,
    tw: 8.1,
    tf: 14.2,
    Ixx: 13630.3,
    Iyy: 537.7,
    Zxx: 778.9,
    Zpx: 889.2
  },
  {
    designation: "ISMB 400",
    weight: 61.6,
    h: 400,
    bf: 140,
    tw: 8.9,
    tf: 16.0,
    Ixx: 20458.4,
    Iyy: 622.1,
    Zxx: 1022.9,
    Zpx: 1176.2
  }
];

// IS 456:2000 Table 19: Design Shear Strength of Concrete, \tau_c (N/mm^2)
export function getTauC(fck: number, pt: number): number {
  // pt is percentage of steel (100 * Ast / bd)
  const grades = [15, 20, 25, 30, 35, 40];
  const pts = [0.15, 0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00];
  
  // Table 19 values
  const table19: Record<number, number[]> = {
    15: [0.28, 0.35, 0.46, 0.54, 0.60, 0.64, 0.68, 0.71, 0.71, 0.71, 0.71, 0.71, 0.71],
    20: [0.28, 0.36, 0.48, 0.56, 0.62, 0.67, 0.72, 0.75, 0.79, 0.81, 0.82, 0.82, 0.82],
    25: [0.29, 0.36, 0.49, 0.57, 0.64, 0.70, 0.74, 0.78, 0.82, 0.85, 0.88, 0.90, 0.92],
    30: [0.29, 0.37, 0.50, 0.59, 0.66, 0.71, 0.76, 0.80, 0.84, 0.88, 0.91, 0.94, 0.96],
    35: [0.29, 0.37, 0.50, 0.59, 0.67, 0.73, 0.78, 0.82, 0.86, 0.90, 0.93, 0.96, 0.99],
    40: [0.30, 0.38, 0.51, 0.60, 0.68, 0.74, 0.79, 0.84, 0.88, 0.92, 0.95, 0.98, 1.01]
  };

  // Find nearest fck grade
  let fckRef = 20;
  for (let g of grades) {
    if (fck >= g) fckRef = g;
  }
  
  const values = table19[fckRef];
  
  // Interpolation for pt
  if (pt <= pts[0]) return values[0];
  if (pt >= pts[pts.length - 1]) return values[values.length - 1];
  
  // Find bounds
  let idx = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    if (pt >= pts[i] && pt <= pts[i+1]) {
      idx = i;
      break;
    }
  }
  
  const pt0 = pts[idx];
  const pt1 = pts[idx + 1];
  const t0 = values[idx];
  const t1 = values[idx + 1];
  
  // Linear interpolation
  return t0 + ((t1 - t0) / (pt1 - pt0)) * (pt - pt0);
}

// IS 456:2000 Table 20: Maximum Shear Stress \tau_c_max (N/mm^2)
export function getTauCMax(fck: number): number {
  if (fck <= 15) return 2.5;
  if (fck <= 20) return 2.8;
  if (fck <= 25) return 3.1;
  if (fck <= 30) return 3.5;
  if (fck <= 35) return 3.7;
  return 4.0; // M40 and above
}
