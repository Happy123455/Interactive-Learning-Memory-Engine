import { getTauC, getTauCMax } from './SteelTableDatabase';

// Standard constant factors for limit state design (IS 456)
export const CONCRETE_SAFETY_FACTOR = 1.5;
export const STEEL_SAFETY_FACTOR = 1.15;

export interface SinglyLimitingResult {
  xuMaxFactor: number;
  xuMax: number;
  zLim: number;
  CuLim: number;
  AstLim: number;
  MuLim: number;
  concreteDesignStress: number;
  steelDesignStress: number;
}

export function solveSinglyLimiting(
  b: number,
  d: number,
  fck: number,
  fy: number
): SinglyLimitingResult {
  const concreteDesignStress = 0.446 * fck;
  const steelDesignStress = 0.87 * fy;

  let xuMaxFactor = 0.53;
  if (fy === 415) xuMaxFactor = 0.48;
  else if (fy >= 500) xuMaxFactor = 0.46;

  const xuMax = xuMaxFactor * d;
  const zLim = d - 0.42 * xuMax;
  const CuLim = 0.36 * fck * b * xuMax;
  const AstLim = CuLim / steelDesignStress;
  const MuLim = CuLim * zLim * 1e-6;

  return {
    xuMaxFactor,
    xuMax,
    zLim,
    CuLim,
    AstLim,
    MuLim,
    concreteDesignStress,
    steelDesignStress
  };
}

export interface SinglyAnalysisResult {
  Ast: number;
  xu: number;
  xuMax: number;
  isUnderReinforced: boolean;
  sectionClass: string;
  Mu: number;
  safeWorkingUdl: number;
  selfWeight: number;
  safeSuperimposedUdl: number;
}

export function solveSinglyAnalysis(
  b: number,
  d: number,
  numBars: number,
  barDia: number,
  fck: number,
  fy: number,
  span: number
): SinglyAnalysisResult {
  const Ast = numBars * (Math.PI / 4) * Math.pow(barDia, 2);
  const xu = (0.87 * fy * Ast) / (0.36 * fck * b);

  let xuMaxFactor = 0.53;
  if (fy === 415) xuMaxFactor = 0.48;
  else if (fy >= 500) xuMaxFactor = 0.46;
  const xuMax = xuMaxFactor * d;

  const isUnderReinforced = xu < xuMax;
  const sectionClass = xu < xuMax - 1 ? "Under-Reinforced" : xu > xuMax + 1 ? "Over-Reinforced" : "Balanced (Limiting)";

  let Mu = 0;
  if (xu <= xuMax) {
    Mu = 0.87 * fy * Ast * (d - 0.42 * xu) * 1e-6;
  } else {
    Mu = 0.36 * fck * b * xuMax * (d - 0.42 * xuMax) * 1e-6;
  }

  const wu = (8 * Mu) / Math.pow(span, 2);
  const safeWorkingUdl = wu / 1.5;
  const overallD = d + 50;
  const selfWeight = (b / 1000) * (overallD / 1000) * 25.0;
  const safeSuperimposedUdl = Math.max(0, safeWorkingUdl - selfWeight);

  return {
    Ast,
    xu,
    xuMax,
    isUnderReinforced,
    sectionClass,
    Mu,
    safeWorkingUdl,
    selfWeight,
    safeSuperimposedUdl
  };
}

export interface SinglyDesignResult {
  D_trial: number;
  d_trial: number;
  selfWeight: number;
  wu: number;
  L_eff: number;
  Mu: number;
  d_required: number;
  D_final: number;
  d_final: number;
  Ast_required: number;
}

export function solveSinglyDesign(
  span: number,
  supportWidth: number,
  DL_user: number,
  LL: number,
  fck: number,
  fy: number
): SinglyDesignResult {
  const b = 230;
  let D_trial = 550;
  let d_trial = D_trial - 50;

  const selfWeight = (b / 1000) * (D_trial / 1000) * 25.0;
  const DL_total = DL_user + selfWeight;
  const wu = 1.5 * (DL_total + LL);

  const Leff_1 = span + d_trial / 1000;
  const Leff_2 = span + supportWidth / 1000;
  const L_eff = Math.min(Leff_1, Leff_2);

  const Mu = (wu * Math.pow(L_eff, 2)) / 8;

  let xuMaxFactor = 0.48;
  let Q = 0.138;
  if (fy === 250) {
    xuMaxFactor = 0.53;
    Q = 0.148 * fck;
  } else if (fy === 415) {
    xuMaxFactor = 0.48;
    Q = 0.138 * fck;
  } else {
    xuMaxFactor = 0.46;
    Q = 0.133 * fck;
  }

  const d_required = Math.sqrt((Mu * 1e6) / (Q * b));

  let D_final = D_trial;
  let d_final = d_trial;
  if (d_trial < d_required) {
    d_final = Math.ceil(d_required / 50) * 50;
    D_final = d_final + 50;
  }

  const selfWeightFinal = (b / 1000) * (D_final / 1000) * 25.0;
  const DL_total_final = DL_user + selfWeightFinal;
  const wu_final = 1.5 * (DL_total_final + LL);
  const Leff_final = Math.min(span + d_final / 1000, span + supportWidth / 1000);
  const Mu_final = (wu_final * Math.pow(Leff_final, 2)) / 8;

  const term = 1 - (4.6 * Mu_final * 1e6) / (fck * b * Math.pow(d_final, 2));
  let Ast_required = 0;
  if (term >= 0) {
    Ast_required = ((0.5 * fck) / fy) * (1 - Math.sqrt(term)) * b * d_final;
  } else {
    const CuLim = 0.36 * fck * b * (xuMaxFactor * d_final);
    Ast_required = CuLim / (0.87 * fy);
  }

  return {
    D_trial: D_final,
    d_trial: d_final,
    selfWeight: selfWeightFinal,
    wu: wu_final,
    L_eff: Leff_final,
    Mu: Mu_final,
    d_required,
    D_final: D_final,
    d_final: d_final,
    Ast_required
  };
}

export interface DoublyAnalysisResult {
  Ast: number;
  Asc: number;
  xu: number;
  xuMax: number;
  fsc: number;
  isUnderReinforced: boolean;
  Mu: number;
}

export function solveDoublyAnalysis(
  b: number,
  d: number,
  D: number,
  numBarsTension: number,
  barDiaTension: number,
  numBarsComp: number,
  barDiaComp: number,
  dc: number,
  fck: number,
  fy: number
): DoublyAnalysisResult {
  const Ast = numBarsTension * (Math.PI / 4) * Math.pow(barDiaTension, 2);
  const Asc = numBarsComp * (Math.PI / 4) * Math.pow(barDiaComp, 2);

  let xuMaxFactor = 0.53;
  if (fy === 415) xuMaxFactor = 0.48;
  else if (fy >= 500) xuMaxFactor = 0.46;
  const xuMax = xuMaxFactor * d;

  const getFscValue = (dPrimeOverD: number): number => {
    if (fy === 250) return 0.87 * 250;
    
    const ratios = [0.05, 0.10, 0.15, 0.20];
    const fsc415 = [355.1, 351.9, 342.4, 329.2];
    const fsc500 = [412.3, 412.3, 397.0, 370.2];

    const targetList = fy === 415 ? fsc415 : fsc500;

    if (dPrimeOverD <= ratios[0]) return targetList[0];
    if (dPrimeOverD >= ratios[ratios.length - 1]) return targetList[targetList.length - 1];

    let i = 0;
    for (let r = 0; r < ratios.length - 1; r++) {
      if (dPrimeOverD >= ratios[r] && dPrimeOverD <= ratios[r + 1]) {
        i = r;
        break;
      }
    }

    const r0 = ratios[i];
    const r1 = ratios[i + 1];
    const f0 = targetList[i];
    const f1 = targetList[i + 1];

    return f0 + ((f1 - f0) / (r1 - r0)) * (dPrimeOverD - r0);
  };

  let xu = xuMax;
  let iterations = 10;
  for (let it = 0; it < iterations; it++) {
    const dPrimeOverD = dc / xu;
    const fsc = getFscValue(dPrimeOverD);
    xu = (0.87 * fy * Ast - (fsc - 0.45 * fck) * Asc) / (0.36 * fck * b);
  }

  let isUnderReinforced = true;
  let xuFinal = xu;
  if (xu > xuMax) {
    xuFinal = xuMax;
    isUnderReinforced = false;
  }

  const dPrimeOverDFinal = dc / xuFinal;
  const fscFinal = getFscValue(dPrimeOverDFinal);

  const Mu1 = 0.36 * fck * b * xuFinal * (d - 0.42 * xuFinal) * 1e-6;
  const Mu2 = (fscFinal - 0.45 * fck) * Asc * (d - dc) * 1e-6;
  const Mu = Mu1 + Mu2;

  return {
    Ast,
    Asc,
    xu: xuFinal,
    xuMax,
    fsc: fscFinal,
    isUnderReinforced,
    Mu
  };
}

export interface DoublyDesignResult {
  MuLim: number;
  isDoublyRequired: boolean;
  deltaM: number;
  Asc: number;
  Ast1: number;
  Ast2: number;
  Ast: number;
  fsc: number;
}

export function solveDoublyDesign(
  b: number,
  d: number,
  Mu: number,
  fck: number,
  fy: number,
  dc: number
): DoublyDesignResult {
  let xuMaxFactor = 0.53;
  if (fy === 415) xuMaxFactor = 0.48;
  else if (fy >= 500) xuMaxFactor = 0.46;
  const xuMax = xuMaxFactor * d;

  const MuLim = 0.36 * fck * b * xuMax * (d - 0.42 * xuMax) * 1e-6;
  
  const isDoublyRequired = Mu > MuLim;
  const deltaM = Math.max(0, Mu - MuLim);

  if (!isDoublyRequired) {
    const term = 1 - (4.6 * Mu * 1e6) / (fck * b * Math.pow(d, 2));
    const Ast = term >= 0 
      ? ((0.5 * fck) / fy) * (1 - Math.sqrt(term)) * b * d
      : 0;
    return {
      MuLim,
      isDoublyRequired: false,
      deltaM: 0,
      Asc: 0,
      Ast1: Ast,
      Ast2: 0,
      Ast,
      fsc: 0
    };
  }

  const dPrimeOverD = dc / xuMax;
  
  let fsc = 0.87 * fy;
  if (fy === 415) {
    const ratios = [0.05, 0.10, 0.15, 0.20];
    const stresses = [355.1, 351.9, 342.4, 329.2];
    if (dPrimeOverD <= 0.05) fsc = stresses[0];
    else if (dPrimeOverD >= 0.20) fsc = stresses[3];
    else {
      let idx = 0;
      for (let i = 0; i < 3; i++) {
        if (dPrimeOverD >= ratios[i] && dPrimeOverD <= ratios[i+1]) {
          idx = i; break;
        }
      }
      fsc = stresses[idx] + ((stresses[idx+1] - stresses[idx]) / (ratios[idx+1] - ratios[idx])) * (dPrimeOverD - ratios[idx]);
    }
  } else if (fy >= 500) {
    const ratios = [0.05, 0.10, 0.15, 0.20];
    const stresses = [412.3, 412.3, 397.0, 370.2];
    if (dPrimeOverD <= 0.05) fsc = stresses[0];
    else if (dPrimeOverD >= 0.20) fsc = stresses[3];
    else {
      let idx = 0;
      for (let i = 0; i < 3; i++) {
        if (dPrimeOverD >= ratios[i] && dPrimeOverD <= ratios[i+1]) {
          idx = i; break;
        }
      }
      fsc = stresses[idx] + ((stresses[idx+1] - stresses[idx]) / (ratios[idx+1] - ratios[idx])) * (dPrimeOverD - ratios[idx]);
    }
  }

  const Asc = (deltaM * 1e6) / ((fsc - 0.45 * fck) * (d - dc));
  const Ast1 = (0.36 * fck * b * xuMax) / (0.87 * fy);
  const Ast2 = ((fsc - 0.45 * fck) * Asc) / (0.87 * fy);
  const Ast = Ast1 + Ast2;

  return {
    MuLim,
    isDoublyRequired: true,
    deltaM,
    Asc,
    Ast1,
    Ast2,
    Ast,
    fsc
  };
}

export interface FlangedAnalysisResult {
  Ast: number;
  xu: number;
  xuMax: number;
  yf: number;
  isNaInFlange: boolean;
  Mu: number;
  concreteDesignStress: number;
  steelDesignStress: number;
}

export function solveFlangedAnalysis(
  bf: number,
  Df: number,
  bw: number,
  d: number,
  numBars: number,
  barDia: number,
  fck: number,
  fy: number
): FlangedAnalysisResult {
  const Ast = numBars * (Math.PI / 4) * Math.pow(barDia, 2);

  let xuMaxFactor = 0.53;
  if (fy === 415) xuMaxFactor = 0.48;
  else if (fy >= 500) xuMaxFactor = 0.46;
  const xuMax = xuMaxFactor * d;

  let xu = (0.87 * fy * Ast) / (0.36 * fck * bf);
  let isNaInFlange = xu <= Df;
  let yf = Df;
  let Mu = 0;

  if (isNaInFlange) {
    if (xu > xuMax) xu = xuMax;
    Mu = 0.87 * fy * Ast * (d - 0.42 * xu) * 1e-6;
  } else {
    const term1 = 0.36 * fck * bw + 0.0675 * fck * (bf - bw);
    const term2 = 0.87 * fy * Ast - 0.2925 * fck * (bf - bw) * Df;
    
    xu = term2 / term1;
    if (xu > xuMax) xu = xuMax;
    
    if (Df <= 0.43 * xu) {
      yf = Df;
    } else {
      yf = Math.min(Df, 0.15 * xu + 0.65 * Df);
    }

    const Mu1 = 0.36 * fck * bw * xu * (d - 0.42 * xu) * 1e-6;
    const Mu2 = 0.45 * fck * (bf - bw) * yf * (d - 0.5 * yf) * 1e-6;
    Mu = Mu1 + Mu2;
  }

  return {
    Ast,
    xu,
    xuMax,
    yf,
    isNaInFlange,
    Mu,
    concreteDesignStress: 0.36 * fck,
    steelDesignStress: 0.87 * fy
  };
}

export interface ShearDesignResult {
  Ast: number;
  pt: number;
  tauV: number;
  tauC: number;
  tauCMax: number;
  isUnsafe: boolean;
  isStirrupRequired: boolean;
  Asv: number;
  Vus: number;
  sv_calculated: number;
  sv_min: number;
  sv_final: number;
}

export function solveShearDesign(
  b: number,
  d: number,
  overallD: number,
  numBarsLongitudinal: number,
  barDiaLongitudinal: number,
  Vu: number,
  fck: number,
  fy_longitudinal: number,
  fy_stirrups: number,
  dia_stirrups: number
): ShearDesignResult {
  const Ast = numBarsLongitudinal * (Math.PI / 4) * Math.pow(barDiaLongitudinal, 2);
  const tauV = (Vu * 1000) / (b * d);
  const pt = (100 * Ast) / (b * d);

  const tauC = getTauC(fck, pt);
  const tauCMax = getTauCMax(fck);

  const isUnsafe = tauV > tauCMax;
  const isStirrupRequired = tauV > tauC;

  const Asv = 2 * (Math.PI / 4) * Math.pow(dia_stirrups, 2);
  const sv_min = (Asv * fy_stirrups) / (0.4 * b);

  let Vus = 0;
  let sv_calculated = Infinity;
  let sv_final = sv_min;

  if (isStirrupRequired && !isUnsafe) {
    Vus = Math.max(0, Vu * 1000 - tauC * b * d);
    if (Vus > 0) {
      sv_calculated = (0.87 * fy_stirrups * Asv * d) / Vus;
    }
  }

  const maxLimit = Math.min(0.75 * d, 300, sv_min);
  
  if (isStirrupRequired) {
    sv_final = Math.min(sv_calculated, maxLimit);
  } else {
    sv_final = maxLimit;
  }

  sv_final = Math.floor(sv_final / 10) * 10;
  sv_final = Math.max(50, sv_final);

  return {
    Ast,
    pt,
    tauV,
    tauC,
    tauCMax,
    isUnsafe,
    isStirrupRequired,
    Asv,
    Vus: Vus * 1e-3,
    sv_calculated,
    sv_min,
    sv_final
  };
}

export interface CombinedDesignResult {
  Mt: number;
  Me1: number;
  Me2: number;
  Ve: number;
  tauVe: number;
  tauC: number;
  tauCMax: number;
  isUnsafe: boolean;
  Asv_stirrups: number;
  sv_calculated: number;
  sv_final: number;
  b1: number;
  d1: number;
}

export function solveCombinedDesign(
  b: number,
  d: number,
  overallD: number,
  Mu: number,
  Vu: number,
  Tu: number,
  fck: number,
  fy: number,
  dc: number
): CombinedDesignResult {
  const Mt = Tu * (1 + overallD / b) / 1.7;
  const Me1 = Mu + Mt;
  const Me2 = Mt - Mu;

  const Ve = Vu + 1.6 * (Tu / (b / 1000));
  const tauVe = (Ve * 1000) / (b * d);
  
  const pt = 1.0;
  const fillTauC = getTauC(fck, pt);
  const tauCMax = getTauCMax(fck);
  const isUnsafe = tauVe > tauCMax;

  const stirrupDia = 8;
  const Asv = 2 * (Math.PI / 4) * Math.pow(stirrupDia, 2);

  const b1 = b - 2 * dc;
  const d1 = overallD - 2 * dc;

  const termTorsion = (Tu * 1e6) / (b1 * d1);
  const termShear = (Vu * 1e3) / (2.5 * d);
  const sv_calculated = (0.87 * fy * Asv) / (termTorsion + termShear);

  const x1 = b1 + 16;
  const y1 = d1 + 16;
  const limit1 = x1;
  const limit2 = (x1 + y1) / 4;
  
  let sv_final = Math.min(sv_calculated, limit1, limit2, 300);
  sv_final = Math.floor(sv_final / 10) * 10;
  sv_final = Math.max(50, sv_final);

  return {
    Mt,
    Me1,
    Me2,
    Ve,
    tauVe,
    tauC: fillTauC,
    tauCMax,
    isUnsafe,
    Asv_stirrups: Asv,
    sv_calculated,
    sv_final,
    b1,
    d1
  };
}

// -------------------------------------------------------------
// PROBLEMS DATABASE CONFIGURATION
// -------------------------------------------------------------

interface ProblemDef {
  id: string;
  tutorial: string;
  qNumber: number;
  title: string;
  description: string;
  tags: string[];
  defaultInputs: Record<string, number>;
  steps: {
    title: string;
    description: string;
    clause: string;
    getFormula: (inputs: any, outputs: any) => string;
    getSubstitution: (inputs: any, outputs: any) => string;
    getCheck: (inputs: any, outputs: any) => { success: boolean; text: string } | null;
  }[];
  runSolver: (inputs: any) => any;
}

export const PROBLEMS_DB: ProblemDef[] = [
  {
    id: "t2-q1",
    tutorial: "Tutorial 2: Singly Reinforced Beam",
    qNumber: 1,
    title: "Balanced Section Parameter Analysis",
    description: "For Limiting Singly Reinforced section (Group C-3: 230 x 500 mm effective, M20 concrete, Fe415 steel), calculate stresses, lever arm, and limiting forces.",
    tags: ["Singly Reinforced", "Balanced Section", "M20", "Fe415", "IS 456"],
    defaultInputs: { b: 230, d: 500, fck: 20, fy: 415 },
    runSolver: (inputs) => solveSinglyLimiting(inputs.b, inputs.d, inputs.fck, inputs.fy),
    steps: [
      {
        title: "Calculate Stresses",
        description: "Determine the design strength of concrete in compression and steel in tension.",
        clause: "IS 456 Cl 38.1 & Cl 32.1",
        getFormula: () => `f_{cd} = 0.446 \\cdot f_{ck}, \\quad f_{yd} = 0.87 \\cdot f_y`,
        getSubstitution: (inps, outs) => `f_{cd} = 0.446 \\times ${inps.fck} = ${outs.concreteDesignStress.toFixed(1)} \\text{ MPa}\\\\f_{yd} = 0.87 \\times ${inps.fy} = ${outs.steelDesignStress.toFixed(1)} \\text{ MPa}`,
        getCheck: () => null
      },
      {
        title: "Determine Limiting Neutral Axis Depth",
        description: "Calculate maximum allowed depth of neutral axis for balanced section based on steel grade.",
        clause: "IS 456 Cl 38.1 Note",
        getFormula: () => `x_{u,max} = \\text{factor} \\cdot d`,
        getSubstitution: (inps, outs) => `x_{u,max} = ${outs.xuMaxFactor} \\times ${inps.d} = ${outs.xuMax.toFixed(1)} \\text{ mm}`,
        getCheck: (inps, outs) => ({
          success: true,
          text: `For steel grade Fe ${inps.fy}, the limiting depth factor is ${outs.xuMaxFactor}.`
        })
      },
      {
        title: "Lever Arm Calculation",
        description: "Compute the distance between compression and tension centroids.",
        clause: "IS 456 Annex G-1.1",
        getFormula: () => `z_{lim} = d - 0.42 \\cdot x_{u,max}`,
        getSubstitution: (inps, outs) => `z_{lim} = ${inps.d} - 0.42 \\times ${outs.xuMax.toFixed(1)} = ${outs.zLim.toFixed(1)} \\text{ mm}`,
        getCheck: () => null
      },
      {
        title: "Force Equilibrium & Steel Area",
        description: "Equate compressive force of concrete to tensile force of steel to find the limiting steel reinforcement.",
        clause: "IS 456 Annex G-1.1",
        getFormula: () => `C_u = 0.36 \\cdot f_{ck} \\cdot b \\cdot x_{u,max}, \\quad A_{st,lim} = \\frac{C_u}{0.87 \\cdot f_y}`,
        getSubstitution: (inps, outs) => `C_u = 0.36 \\times ${inps.fck} \\times ${inps.b} \\times ${outs.xuMax.toFixed(1)} = ${(outs.CuLim/1000).toFixed(1)} \\text{ kN}\\\\A_{st,lim} = \\frac{${outs.CuLim.toFixed(0)}}{0.87 \\times ${inps.fy}} = ${outs.AstLim.toFixed(1)} \\text{ mm}^2`,
        getCheck: () => null
      },
      {
        title: "Limiting Moment of Resistance",
        description: "Find the maximum ultimate bending moment capacity of the singly reinforced balanced section.",
        clause: "IS 456 Cl 38.1 & Annex G",
        getFormula: () => `M_{u,lim} = C_u \\cdot z_{lim}`,
        getSubstitution: (inps, outs) => `M_{u,lim} = ${(outs.CuLim/1000).toFixed(1)} \\text{ kN} \\times ${outs.zLim.toFixed(1)} \\text{ mm} \\times 10^{-3} = ${outs.MuLim.toFixed(1)} \\text{ kN-m}`,
        getCheck: (inps, outs) => ({
          success: true,
          text: `Limiting Moment is ${outs.MuLim.toFixed(1)} kN-m. If external moment exceeds this, double reinforcement is required.`
        })
      }
    ]
  },
  {
    id: "t2-q2",
    tutorial: "Tutorial 2: Singly Reinforced Beam",
    qNumber: 2,
    title: "Moment of Resistance & Safe Load Analysis",
    description: "Given a singly reinforced beam (Group C-3: 230 x 500 mm effective, 3 bars of 16mm dia, M20 concrete, Fe415 steel, span = 3m), calculate the Moment of Resistance and safe working UDL.",
    tags: ["Singly Reinforced", "Analysis", "Moment of Resistance", "M20", "Fe415", "IS 456"],
    defaultInputs: { b: 230, d: 500, numBars: 3, barDia: 16, fck: 20, fy: 415, span: 3 },
    runSolver: (inputs) => solveSinglyAnalysis(inputs.b, inputs.d, inputs.numBars, inputs.barDia, inputs.fck, inputs.fy, inputs.span),
    steps: [
      {
        title: "Calculate Steel Area (Ast)",
        description: "Determine the total area of tensile reinforcement.",
        clause: "General Geometry",
        getFormula: () => `A_{st} = n \\cdot \\frac{\\pi}{4} \\cdot \\phi^2`,
        getSubstitution: (inps, outs) => `A_{st} = ${inps.numBars} \\times \\frac{\\pi}{4} \\times ${inps.barDia}^2 = ${outs.Ast.toFixed(1)} \\text{ mm}^2`,
        getCheck: () => null
      },
      {
        title: "Find Actual Depth of Neutral Axis (xu)",
        description: "Equate compressive and tensile forces to locate the neutral axis.",
        clause: "IS 456 Cl 38.1 & Annex G",
        getFormula: () => `x_u = \\frac{0.87 \\cdot f_y \\cdot A_{st}}{0.36 \\cdot f_{ck} \\cdot b}`,
        getSubstitution: (inps, outs) => `x_u = \\frac{0.87 \\times ${inps.fy} \\times ${outs.Ast.toFixed(1)}}{0.36 \\times ${inps.fck} \\times ${inps.b}} = ${outs.xu.toFixed(1)} \\text{ mm}`,
        getCheck: () => null
      },
      {
        title: "Evaluate Section Classification",
        description: "Compare actual NA depth (xu) with limiting NA depth (xuMax) to identify if the section is under-reinforced or over-reinforced.",
        clause: "IS 456 Cl 38.1 Note",
        getFormula: () => `x_{u,max} = 0.48 \\cdot d \\quad (\\text{for Fe 415})`,
        getSubstitution: (inps, outs) => `x_u = ${outs.xu.toFixed(1)} \\text{ mm} \\quad \\text{vs} \\quad x_{u,max} = ${outs.xuMax.toFixed(1)} \\text{ mm}`,
        getCheck: (inps, outs) => ({
          success: outs.isUnderReinforced,
          text: `Section is ${outs.sectionClass} (x_u ${outs.xu <= outs.xuMax ? '<' : '>'} x_u,max).`
        })
      },
      {
        title: "Compute Moment of Resistance (Mu)",
        description: "Calculate capacity using tensile steel lever arm formula.",
        clause: "IS 456 Annex G-1.1",
        getFormula: () => `M_u = 0.87 \\cdot f_y \\cdot A_{st} \\cdot (d - 0.42 \\cdot x_u)`,
        getSubstitution: (inps, outs) => `M_u = 0.87 \\times ${inps.fy} \\times ${outs.Ast.toFixed(1)} \\times (${inps.d} - 0.42 \\times ${outs.xu.toFixed(1)}) \\times 10^{-6} = ${outs.Mu.toFixed(1)} \\text{ kN-m}`,
        getCheck: () => null
      },
      {
        title: "Determine Safe Working Load (UDL)",
        description: "Solve for the maximum safe working UDL service load including self-weight calculations.",
        clause: "IS 456 Loading Guidelines",
        getFormula: () => `w_u = \\frac{8 \\cdot M_u}{L^2}, \\quad w_{safe} = \\frac{w_u}{1.5}`,
        getSubstitution: (inps, outs) => `w_u = \\frac{8 \\times ${outs.Mu.toFixed(1)}}{${inps.span}^2} = ${(outs.safeWorkingUdl * 1.5).toFixed(1)} \\text{ kN/m}\\\\w_{working} = \\frac{${(outs.safeWorkingUdl * 1.5).toFixed(1)}}{1.5} = ${outs.safeWorkingUdl.toFixed(1)} \\text{ kN/m}`,
        getCheck: (inps, outs) => ({
          success: true,
          text: `Self-weight of beam is ~${outs.selfWeight.toFixed(1)} kN/m, leaving a safe superimposed working UDL of ${outs.safeSuperimposedUdl.toFixed(1)} kN/m.`
        })
      }
    ]
  },
  {
    id: "t2-q3",
    tutorial: "Tutorial 2: Singly Reinforced Beam",
    qNumber: 3,
    title: "Beam Sizing and Reinforcement Design",
    description: "Design a rectangular beam (Clear Span = 3.5 m, Support Width = 230 mm) subjected to DL = 20 kN/m and LL = 40 kN/m. Grades: M20, Fe415.",
    tags: ["Singly/Doubly Reinforced", "Design", "M20", "Fe415", "IS 456"],
    defaultInputs: { span: 3.5, supportWidth: 230, DL: 20, LL: 40, fck: 20, fy: 415 },
    runSolver: (inputs) => solveSinglyDesign(inputs.span, inputs.supportWidth / 1000, inputs.DL, inputs.LL, inputs.fck, inputs.fy),
    steps: [
      {
        title: "Trial Sizing & Load Analysis",
        description: "Choose a trial overall depth D = 550mm (d = 500mm), calculate concrete self-weight and factored load.",
        clause: "IS 456 Cl 22.2",
        getFormula: () => `w_{self} = b \\cdot D \\cdot 25 \\text{ kN/m}^3, \\quad w_u = 1.5 \\cdot (DL + w_{self} + LL)`,
        getSubstitution: (inps, outs) => `w_{self} = 0.23 \\times 0.55 \\times 25 = ${outs.selfWeight.toFixed(2)} \\text{ kN/m}\\\\w_u = 1.5 \\times (${inps.DL} + ${outs.selfWeight.toFixed(2)} + ${inps.LL}) = ${outs.wu.toFixed(2)} \\text{ kN/m}`,
        getCheck: () => null
      },
      {
        title: "Effective Span & Factored Moment",
        description: "Determine effective span (Leff) and calculate the maximum factored design moment (Mu).",
        clause: "IS 456 Cl 22.2",
        getFormula: () => `L_{eff} = \\min(L_c + d, L_c + w_{support}), \\quad M_u = \\frac{w_u \\cdot L_{eff}^2}{8}`,
        getSubstitution: (inps, outs) => `L_{eff} = \\min(3.5 + 0.5, 3.5 + ${(inps.supportWidth/1000).toFixed(2)}) = ${outs.L_eff.toFixed(2)} \\text{ m}\\\\M_u = \\frac{${outs.wu.toFixed(2)} \\times ${outs.L_eff.toFixed(2)}^2}{8} = ${outs.Mu.toFixed(1)} \\text{ kN-m}`,
        getCheck: () => null
      },
      {
        title: "Minimum Effective Depth Check",
        description: "Determine depth required for a limiting singly reinforced section to resist Mu.",
        clause: "IS 456 Annex G-1.1",
        getFormula: () => `d_{req} = \\sqrt{\\frac{M_u}{Q \\cdot b}} \\quad \\text{where } Q = 0.138 \\cdot f_{ck}`,
        getSubstitution: (inps, outs) => `d_{req} = \\sqrt{\\frac{${outs.Mu.toFixed(1)} \\times 10^6}{0.138 \\times ${inps.fck} \\times 230}} = ${outs.d_required.toFixed(1)} \\text{ mm}`,
        getCheck: (inps, outs) => ({
          success: outs.d_trial >= outs.d_required,
          text: `Provided effective depth d = ${outs.d_final} mm is ${outs.d_final >= outs.d_required ? 'SAFE' : 'UNSAFE (Need to increase section depth)'}.`
        })
      },
      {
        title: "Calculate Reinforcement Area (Ast)",
        description: "Compute the necessary tensile steel area for the selected depth.",
        clause: "IS 456 Annex G-1.1",
        getFormula: () => `A_{st} = \\frac{0.5 \\cdot f_{ck}}{f_y} \\left[ 1 - \\sqrt{1 - \\frac{4.6 \\cdot M_u}{f_{ck} \\cdot b \\cdot d^2}} \\right] b \\cdot d`,
        getSubstitution: (inps, outs) => `A_{st} = \\frac{0.5 \\times ${inps.fck}}{${inps.fy}} \\left[ 1 - \\sqrt{1 - \\frac{4.6 \\times ${outs.Mu.toFixed(1)} \\times 10^6}{${inps.fck} \\times 230 \\times ${outs.d_final}^2}} \\right] \\times 230 \\times ${outs.d_final} = ${outs.Ast_required.toFixed(1)} \\text{ mm}^2`,
        getCheck: (inps, outs) => ({
          success: true,
          text: `Provide steel area: ${outs.Ast_required.toFixed(0)} mm² (e.g. 3 bars of 20mm dia provides 942 mm²).`
        })
      }
    ]
  },
  {
    id: "t3-q1",
    tutorial: "Tutorial 3: Doubly Reinforced Beam",
    qNumber: 1,
    title: "Moment of Resistance of Doubly Reinforced Beam",
    description: "Given a doubly reinforced section (Group C-3: 230 x 500 mm overall, tension: 5-T25, compression: 3-T20, cover = 25mm, M20, Fe415), calculate the Moment of Resistance.",
    tags: ["Doubly Reinforced", "Analysis", "Moment of Resistance", "M20", "Fe415", "IS 456"],
    defaultInputs: { b: 230, D: 500, numBarsTension: 5, barDiaTension: 25, numBarsComp: 3, barDiaComp: 20, dc: 25, fck: 20, fy: 415 },
    runSolver: (inputs) => {
      const d = inputs.D - (inputs.dc + inputs.barDiaTension / 2);
      const dc_effective = inputs.dc + inputs.barDiaComp / 2;
      return solveDoublyAnalysis(inputs.b, d, inputs.D, inputs.numBarsTension, inputs.barDiaTension, inputs.numBarsComp, inputs.barDiaComp, dc_effective, inputs.fck, inputs.fy);
    },
    steps: [
      {
        title: "Determine Effective Dimensions",
        description: "Calculate effective depth (d) and effective compression steel depth (d').",
        clause: "General Detailing",
        getFormula: () => `d = D - d_{cover} - \\frac{\\phi_t}{2}, \\quad d' = d_{cover} + \\frac{\\phi_c}{2}`,
        getSubstitution: (inps, outs) => `d = ${inps.D} - ${inps.dc} - 12.5 = ${(inps.D - inps.dc - 12.5).toFixed(1)} \\text{ mm}\\\\d' = ${inps.dc} + 10 = ${(inps.dc + 10).toFixed(1)} \\text{ mm}`,
        getCheck: () => null
      },
      {
        title: "Locate Neutral Axis (xu)",
        description: "Equate total compression (concrete + steel) to tension forces. Solved iteratively because fsc depends on xu.",
        clause: "IS 456 Cl 38.1 & SP 16",
        getFormula: () => `0.36 f_{ck} b x_u + (f_{sc} - 0.45 f_{ck}) A_{sc} = 0.87 f_y A_{st}`,
        getSubstitution: (inps, outs) => `0.36 \\times ${inps.fck} \\times ${inps.b} \\cdot x_u + (f_{sc} - 9) \\times ${outs.Asc.toFixed(0)} = 0.87 \\times ${inps.fy} \\times ${outs.Ast.toFixed(0)}\\\\x_u = ${outs.xu.toFixed(1)} \\text{ mm}`,
        getCheck: (inps, outs) => ({
          success: true,
          text: `Compression steel stress resolved to f_sc = ${outs.fsc.toFixed(1)} N/mm² based on strain ε_sc.`
        })
      },
      {
        title: "Limiting Neutral Axis Check",
        description: "Check if the section behaves as under-reinforced or is restricted by xu,max.",
        clause: "IS 456 Cl 38.1 Note",
        getFormula: () => `x_{u,max} = 0.48 \\cdot d \\quad (\\text{for Fe 415})`,
        getSubstitution: (inps, outs) => `x_u = ${outs.xu.toFixed(1)} \\text{ mm} \\quad \\text{vs} \\quad x_{u,max} = ${outs.xuMax.toFixed(1)} \\text{ mm}`,
        getCheck: (inps, outs) => ({
          success: outs.isUnderReinforced,
          text: outs.isUnderReinforced 
            ? "Neutral axis is within limiting bounds. Proceed." 
            : "Neutral axis exceeds limit! Restricted to xu,max for moment calculation."
        })
      },
      {
        title: "Calculate Moment of Resistance (Mu)",
        description: "Calculate total moment capacity: concrete compressive block moment + steel couple moment.",
        clause: "IS 456 Annex G-1.2",
        getFormula: () => `M_u = 0.36 f_{ck} b x_u (d - 0.42 x_u) + (f_{sc} - 0.45 f_{ck}) A_{sc} (d - d')`,
        getSubstitution: (inps, outs) => {
          const d_eff = inps.D - (inps.dc + inps.barDiaTension / 2);
          const dc_eff = inps.dc + inps.barDiaComp / 2;
          return `M_u = 0.36 \\times ${inps.fck} \\times ${inps.b} \\times ${outs.xu.toFixed(1)} \\times (${d_eff.toFixed(1)} - 0.42 \\times ${outs.xu.toFixed(1)}) \\times 10^{-6}\\\\+ (${outs.fsc.toFixed(1)} - 0.45 \\times ${inps.fck}) \\times ${outs.Asc.toFixed(0)} \\times (${d_eff.toFixed(1)} - ${dc_eff.toFixed(1)}) \\times 10^{-6}\\\\= ${outs.Mu.toFixed(1)} \\text{ kN-m}`;
        },
        getCheck: () => null
      }
    ]
  },
  {
    id: "t3-q2",
    tutorial: "Tutorial 3: Doubly Reinforced Beam",
    qNumber: 2,
    title: "Design of Reinforcement for Bending Moment",
    description: "Design reinforcement for a doubly reinforced beam of size 250 x 600 mm overall to resist a moment of Mu = 400 kN·m. Grades: M25 concrete, Fe415 steel, effective cover = 50mm.",
    tags: ["Doubly Reinforced", "Design", "Reinforcement Design", "M25", "Fe415", "IS 456"],
    defaultInputs: { b: 250, D: 600, dc: 50, Mu: 400, fck: 25, fy: 415 },
    runSolver: (inputs) => {
      const d = inputs.D - 50;
      return solveDoublyDesign(inputs.b, d, inputs.Mu, inputs.fck, inputs.fy, inputs.dc);
    },
    steps: [
      {
        title: "Determine Sizing & Single Limiting Moment",
        description: "Calculate limiting moment capacity as a singly reinforced beam (Mu,lim) to verify if compression steel is required.",
        clause: "IS 456 Annex G-1.1",
        getFormula: () => `x_{u,max} = 0.48 \\cdot d, \\quad M_{u,lim} = 0.36 \\cdot f_{ck} \\cdot b \\cdot x_{u,max} (d - 0.42 \\cdot x_{u,max})`,
        getSubstitution: (inps, outs) => `d = ${inps.D} - 50 = 550 \\text{ mm}\\\\x_{u,max} = 0.48 \\times 550 = 264 \\text{ mm}\\\\M_{u,lim} = 0.36 \\times ${inps.fck} \\times ${inps.b} \\times 264 \\times (550 - 0.42 \\times 264) \\times 10^{-6} = ${outs.MuLim.toFixed(1)} \\text{ kN-m}`,
        getCheck: (inps, outs) => ({
          success: outs.isDoublyRequired,
          text: `Factored Moment Mu = ${inps.Mu} kN-m > Mu,lim = ${outs.MuLim.toFixed(1)} kN-m. Doubly reinforcement is REQUIRED.`
        })
      },
      {
        title: "Calculate Excess Moment & Compression Steel (Asc)",
        description: "Find the bending moment difference (ΔM) and calculate compression reinforcement.",
        clause: "IS 456 Annex G-1.2",
        getFormula: () => `\\Delta M = M_u - M_{u,lim}, \\quad A_{sc} = \\frac{\\Delta M}{(f_{sc} - 0.45 \\cdot f_{ck}) (d - d')}`,
        getSubstitution: (inps, outs) => `\\Delta M = ${inps.Mu} - ${outs.MuLim.toFixed(1)} = ${outs.deltaM.toFixed(1)} \\text{ kN-m}\\\\A_{sc} = \\frac{${outs.deltaM.toFixed(1)} \\times 10^6}{(${outs.fsc.toFixed(1)} - 0.45 \\times ${inps.fck}) \\times (550 - ${inps.dc})} = ${outs.Asc.toFixed(1)} \\text{ mm}^2`,
        getCheck: (inps, outs) => ({
          success: true,
          text: `Compression Steel Area required is ${outs.Asc.toFixed(0)} mm² (e.g. 3 bars of 20mm dia).`
        })
      },
      {
        title: "Calculate Tensile Steel Area (Ast)",
        description: "Determine the total tensile reinforcement needed: Ast1 for limiting concrete, and Ast2 to balance the compression steel.",
        clause: "IS 456 Annex G-1.2",
        getFormula: () => `A_{st1} = \\frac{0.36 \\cdot f_{ck} \\cdot b \\cdot x_{u,max}}{0.87 \\cdot f_y}, \\quad A_{st2} = \\frac{(f_{sc} - 0.45 \\cdot f_{ck}) \\cdot A_{sc}}{0.87 \\cdot f_y}, \\quad A_{st} = A_{st1} + A_{st2}`,
        getSubstitution: (inps, outs) => `A_{st1} = \\frac{0.36 \\times ${inps.fck} \\times ${inps.b} \\times 264}{0.87 \\times ${inps.fy}} = ${outs.Ast1.toFixed(1)} \\text{ mm}^2\\\\A_{st2} = \\frac{(${outs.fsc.toFixed(1)} - 11.25) \\times ${outs.Asc.toFixed(1)}}{0.87 \\times ${inps.fy}} = ${outs.Ast2.toFixed(1)} \\text{ mm}^2\\\\A_{st} = ${outs.Ast1.toFixed(1)} + ${outs.Ast2.toFixed(1)} = ${outs.Ast.toFixed(1)} \\text{ mm}^2`,
        getCheck: (inps, outs) => ({
          success: true,
          text: `Total Tensile Steel required is ${outs.Ast.toFixed(0)} mm² (e.g. 5 bars of 25mm dia).`
        })
      }
    ]
  },
  {
    id: "t4-q1",
    tutorial: "Tutorial 4: Flanged Beam",
    qNumber: 1,
    title: "Moment of Resistance of T-Beam",
    description: "Calculate ultimate Moment of Resistance of T-beam (Group C-3: bf = 1000 mm, Df = 125 mm, bw = 230 mm, effective depth d = 550 mm, reinforced with 4 bars of 25mm dia, M20, Fe415).",
    tags: ["Flanged Beam", "T-Beam", "Analysis", "Moment of Resistance", "M20", "Fe415", "IS 456"],
    defaultInputs: { bf: 1000, Df: 125, bw: 230, d: 550, numBars: 4, barDia: 25, fck: 20, fy: 415 },
    runSolver: (inputs) => solveFlangedAnalysis(inputs.bf, inputs.Df, inputs.bw, inputs.d, inputs.numBars, inputs.barDia, inputs.fck, inputs.fy),
    steps: [
      {
        title: "Calculate Steel Area & Assume NA in Flange",
        description: "Determine Ast and check if neutral axis lies within the flange (xu <= Df) where it behaves as a rectangular beam.",
        clause: "IS 456 Cl 38.2.1",
        getFormula: () => `A_{st} = n \\cdot \\frac{\\pi}{4} \\cdot \\phi^2, \\quad x_u = \\frac{0.87 \\cdot f_y \\cdot A_{st}}{0.36 \\cdot f_{ck} \\cdot b_f}`,
        getSubstitution: (inps, outs) => `A_{st} = ${inps.numBars} \\times \\frac{\\pi}{4} \\times ${inps.barDia}^2 = ${outs.Ast.toFixed(1)} \\text{ mm}^2\\\\x_u = \\frac{0.87 \\times ${inps.fy} \\times ${outs.Ast.toFixed(1)}}{0.36 \\times ${inps.fck} \\times ${inps.bf}} = ${outs.xu.toFixed(1)} \\text{ mm}`,
        getCheck: (inps, outs) => ({
          success: outs.isNaInFlange,
          text: outs.isNaInFlange 
            ? `Neutral Axis (x_u = ${outs.xu.toFixed(1)} mm) is LESS than flange thickness D_f = ${inps.Df} mm. Section behaves as standard rectangular section of width bf.` 
            : `Neutral Axis (x_u = ${outs.xu.toFixed(1)} mm) is GREATER than flange thickness D_f = ${inps.Df} mm. Must use T-beam equations.`
        })
      },
      {
        title: "Determine Depth of Neutral Axis (xu) in Web",
        description: "If NA is in the web, recalculate xu accounting for web width and flange overhang stresses.",
        clause: "IS 456 Cl 38.2.2 & Cl 38.2.3",
        getFormula: () => `x_u = \\frac{0.87 f_y A_{st} - 0.2925 f_{ck} (b_f - b_w) D_f}{0.36 f_{ck} b_w + 0.0675 f_{ck} (b_f - b_w)}`,
        getSubstitution: (inps, outs) => outs.isNaInFlange 
          ? `N/A - Already solved in Step 1 (x_u = ${outs.xu.toFixed(1)} mm)`
          : `x_u = \\frac{0.87 \\times ${inps.fy} \\times ${outs.Ast.toFixed(0)} - 0.2925 \\times ${inps.fck} \\times (${inps.bf} - ${inps.bw}) \\times ${inps.Df}}{0.36 \\times ${inps.fck} \\times ${inps.bw} + 0.0675 \\times ${inps.fck} \\times (${inps.bf} - ${inps.bw})} = ${outs.xu.toFixed(1)} \\text{ mm}`,
        getCheck: (inps, outs) => ({
          success: outs.xu <= outs.xuMax,
          text: `Limiting depth xu,max = ${outs.xuMax.toFixed(1)} mm. Section is ${outs.xu <= outs.xuMax ? 'Under-reinforced' : 'Over-reinforced'}.`
        })
      },
      {
        title: "Calculate Moment of Resistance (Mu)",
        description: "Compute the total bending moment capacity of the flanged section.",
        clause: "IS 456 Cl 38.2 & Annex G-2.2",
        getFormula: (inps, outs) => outs.isNaInFlange 
          ? `M_u = 0.87 \\cdot f_y \\cdot A_{st} \\cdot (d - 0.42 \\cdot x_u)`
          : `M_u = 0.36 f_{ck} b_w x_u (d - 0.42 x_u) + 0.45 f_{ck} (b_f - b_w) y_f (d - 0.5 y_f)`,
        getSubstitution: (inps, outs) => outs.isNaInFlange
          ? `M_u = 0.87 \\times ${inps.fy} \\times ${outs.Ast.toFixed(0)} \\times (${inps.d} - 0.42 \\times ${outs.xu.toFixed(1)}) \\times 10^{-6} = ${outs.Mu.toFixed(1)} \\text{ kN-m}`
          : `M_u = 0.36 \\times ${inps.fck} \\times ${inps.bw} \\times ${outs.xu.toFixed(1)} \\times (${inps.d} - 0.42 \\times ${outs.xu.toFixed(1)}) \\times 10^{-6}\\\\+ 0.45 \\times ${inps.fck} \\times (${inps.bf} - ${inps.bw}) \\times ${outs.yf.toFixed(1)} \\times (${inps.d} - 0.5 \\times ${outs.yf.toFixed(1)}) \\times 10^{-6}\\\\= ${outs.Mu.toFixed(1)} \\text{ kN-m}`,
        getCheck: () => null
      }
    ]
  },
  {
    id: "t4-q2",
    tutorial: "Tutorial 4: Flanged Beam",
    qNumber: 2,
    title: "Flanged Beam Neutral Axis & MoR Analysis",
    description: "T-beam supporting 125 mm thick slab, spacing = 3m center-to-center. Web dimensions (Group C-3: 230 x 550 mm effective), 6 bars of 20mm dia, effective cover = 50mm, span = 4m. Find xu and Mu.",
    tags: ["Flanged Beam", "T-Beam", "Analysis", "Neutral Axis", "M20", "Fe415", "IS 456"],
    defaultInputs: { bf: 1000, Df: 125, bw: 230, d: 550, numBars: 6, barDia: 20, fck: 20, fy: 415 },
    runSolver: (inputs) => solveFlangedAnalysis(inputs.bf, inputs.Df, inputs.bw, inputs.d, inputs.numBars, inputs.barDia, inputs.fck, inputs.fy),
    steps: [
      {
        title: "Calculate Steel Area (Ast) & Flange Width",
        description: "Determine tension steel area and assume effective flange width bf = 1000mm as specified.",
        clause: "IS 456 Cl 23.1.2",
        getFormula: () => `A_{st} = n \\cdot \\frac{\\pi}{4} \\cdot \\phi^2`,
        getSubstitution: (inps, outs) => `A_{st} = ${inps.numBars} \\times \\frac{\\pi}{4} \\times ${inps.barDia}^2 = ${outs.Ast.toFixed(1)} \\text{ mm}^2\\\\b_f = ${inps.bf} \\text{ mm}`,
        getCheck: () => null
      },
      {
        title: "Locate Neutral Axis (xu)",
        description: "Equate forces to locate Neutral Axis depth in the web since xu exceeds flange thickness.",
        clause: "IS 456 Cl 38.2.2",
        getFormula: () => `0.36 f_{ck} b_w x_u + 0.45 f_{ck} (b_f - b_w) y_f = 0.87 f_y A_{st}`,
        getSubstitution: (inps, outs) => `0.36 \\times ${inps.fck} \\times ${inps.bw} \\cdot x_u + 0.45 \\times ${inps.fck} \\times (${inps.bf} - ${inps.bw}) \\cdot (0.15 x_u + 0.65 \\times ${inps.Df}) = 0.87 \\times ${inps.fy} \\times ${outs.Ast.toFixed(0)}\\\\x_u = ${outs.xu.toFixed(1)} \\text{ mm}`,
        getCheck: (inps, outs) => ({
          success: outs.xu > inps.Df,
          text: `Neutral Axis xu = ${outs.xu.toFixed(1)} mm > flange thickness Df = ${inps.Df} mm. Flange stress block factor yf = ${outs.yf.toFixed(1)} mm.`
        })
      },
      {
        title: "Calculate Moment Capacity (Mu)",
        description: "Compute final Moment of Resistance capacity using flange overhang calculations.",
        clause: "IS 456 Annex G-2.2",
        getFormula: (inps, outs) => outs.isNaInFlange 
          ? `M_u = 0.87 \\cdot f_y \\cdot A_{st} \\cdot (d - 0.42 \\cdot x_u)`
          : `M_u = 0.36 f_{ck} b_w x_u (d - 0.42 x_u) + 0.45 f_{ck} (b_f - b_w) y_f (d - 0.5 y_f)`,
        getSubstitution: (inps, outs) => `M_u = 0.36 \\times ${inps.fck} \\times ${inps.bw} \\times ${outs.xu.toFixed(1)} \\times (${inps.d} - 0.42 \\times ${outs.xu.toFixed(1)}) \\times 10^{-6}\\\\+ 0.45 \\times ${inps.fck} \\times (${inps.bf} - ${inps.bw}) \\times ${outs.yf.toFixed(1)} \\times (${inps.d} - 0.5 \\times ${outs.yf.toFixed(1)}) \\times 10^{-6}\\\\= ${outs.Mu.toFixed(1)} \\text{ kN-m}`,
        getCheck: () => null
      }
    ]
  },
  {
    id: "t5-q1",
    tutorial: "Tutorial 5: Shear Design",
    qNumber: 1,
    title: "Design of Shear Reinforcement for Beam",
    description: "Design shear reinforcement for a beam (Group C-3: size 300 x 500 mm overall, cover = 30mm, 4 bars of 20mm dia, M20 concrete, Fe415 longitudinal steel, subjected to Shear Force Vu = 125 kN). Stirrups: 8mm Fe250.",
    tags: ["Shear Design", "Design", "Stirrup Design", "M20", "Fe250", "Fe415", "IS 456"],
    defaultInputs: { b: 300, D: 500, dc: 30, numBars: 4, barDia: 20, Vu: 125, fck: 20, fy: 415, fy_stirrups: 250, dia_stirrups: 8 },
    runSolver: (inputs) => {
      const d = inputs.D - (inputs.dc + inputs.barDia / 2);
      return solveShearDesign(inputs.b, d, inputs.D, inputs.numBars, inputs.barDia, inputs.Vu, inputs.fck, inputs.fy, inputs.fy_stirrups, inputs.dia_stirrups);
    },
    steps: [
      {
        title: "Nominal Shear Stress (tauV)",
        description: "Calculate the average/nominal shear stress in the section.",
        clause: "IS 456 Cl 40.1",
        getFormula: () => `\\tau_v = \\frac{V_u}{b \\cdot d} \\quad \\text{where } d = D - \\text{cover} - \\frac{\\phi}{2}`,
        getSubstitution: (inps, outs) => {
          const d_eff = inps.D - (inps.dc + inps.barDia / 2);
          return `d = ${inps.D} - ${inps.dc} - 10 = ${d_eff.toFixed(1)} \\text{ mm}\\\\\\tau_v = \\frac{${inps.Vu} \\times 10^3}{${inps.b} \\times ${d_eff.toFixed(1)}} = ${outs.tauV.toFixed(2)} \\text{ N/mm}^2`;
        },
        getCheck: (inps, outs) => ({
          success: outs.tauV <= outs.tauCMax,
          text: `Maximum shear stress limit: \\tau_{c,max} = ${outs.tauCMax.toFixed(2)} N/mm². Section is ${outs.tauV <= outs.tauCMax ? 'SAFE' : 'UNSAFE (Increase dimensions!)'}.`
        })
      },
      {
        title: "Find Shear Strength of Concrete (tauC)",
        description: "Determine design shear capacity of concrete based on steel percentage pt.",
        clause: "IS 456 Table 19",
        getFormula: () => `p_t = \\frac{100 \\cdot A_{st}}{b \\cdot d}, \\quad \\tau_c = \\text{Table 19 Lookup}`,
        getSubstitution: (inps, outs) => `p_t = \\frac{100 \\times ${outs.Ast.toFixed(0)}}{${inps.b} \\times ${(inps.D - inps.dc - inps.barDia / 2).toFixed(1)}} = ${outs.pt.toFixed(2)} \\%\\\\\\tau_c = ${outs.tauC.toFixed(2)} \\text{ N/mm}^2`,
        getCheck: (inps, outs) => ({
          success: outs.isStirrupRequired,
          text: outs.isStirrupRequired 
            ? `Shear stress \\tau_v (${outs.tauV.toFixed(2)}) > \\tau_c (${outs.tauC.toFixed(2)}). Design shear reinforcement is REQUIRED.` 
            : `Shear stress \\tau_v (${outs.tauV.toFixed(2)}) <= \\tau_c (${outs.tauC.toFixed(2)}). Only nominal/minimum shear stirrups required.`
        })
      },
      {
        title: "Calculate Shear Spacing for Stirrups",
        description: "Compute the spacing required for 2-legged 8mm stirrups to resist the excess shear force.",
        clause: "IS 456 Cl 40.4",
        getFormula: () => `V_{us} = V_u - \\tau_c \\cdot b \\cdot d, \\quad s_v = \\frac{0.87 \\cdot f_{yw} \\cdot A_{sv} \\cdot d}{V_{us}}`,
        getSubstitution: (inps, outs) => {
          const d_eff = inps.D - (inps.dc + inps.barDia / 2);
          return `V_{us} = ${inps.Vu} \\times 1000 - ${outs.tauC.toFixed(2)} \\times ${inps.b} \\times ${d_eff.toFixed(1)} = ${(outs.Vus*1000).toFixed(0)} \\text{ N}\\\\A_{sv} = 2 \\times \\frac{\\pi}{4} \\times ${inps.dia_stirrups}^2 = ${outs.Asv.toFixed(1)} \\text{ mm}^2\\\\s_v = \\frac{0.87 \\times ${inps.fy_stirrups} \\times ${outs.Asv.toFixed(1)} \\times ${d_eff.toFixed(1)}}{${(outs.Vus*1000).toFixed(0)}} = ${outs.sv_calculated.toFixed(1)} \\text{ mm}`;
        },
        getCheck: () => null
      },
      {
        title: "Apply Maximum Spacing Limits",
        description: "Verify spacing doesn't exceed standard limits (0.75d or 300mm).",
        clause: "IS 456 Cl 26.5.1.5",
        getFormula: () => `s_{v,max} = \\min(0.75 \\cdot d, \\, 300 \\text{ mm}, \\, s_{v,min\\_nominal})`,
        getSubstitution: (inps, outs) => {
          const d_eff = inps.D - (inps.dc + inps.barDia / 2);
          return `0.75 \\times d = ${(0.75 * d_eff).toFixed(1)} \\text{ mm}\\\\s_{v,min\\_nominal} = ${outs.sv_min.toFixed(1)} \\text{ mm}\\\\s_{v,max} = \\min(${(0.75 * d_eff).toFixed(0)}, 300, ${outs.sv_min.toFixed(0)}) = ${Math.min(0.75 * d_eff, 300, outs.sv_min).toFixed(0)} \\text{ mm}`;
        },
        getCheck: (inps, outs) => ({
          success: true,
          text: `Provide 2-legged 8mm Fe250 stirrups @ ${outs.sv_final} mm c/c (rounded down from ${Math.min(outs.sv_calculated, outs.sv_min).toFixed(1)} mm).`
        })
      }
    ]
  },
  {
    id: "t6-q1",
    tutorial: "Tutorial 6: Combined Bending, Shear & Torsion",
    qNumber: 1,
    title: "Design for Bending, Shear, and Torsion",
    description: "Design longitudinal and transverse steel for rectangular beam (Group C-3: 300 x 500 mm effective) subjected to Mu = 40 kN·m, Vu = 25 kN, Tu = 15 kN·m. Grades M20, Fe415, cover = 50mm.",
    tags: ["Combined Design", "Torsion Design", "Design", "M20", "Fe415", "IS 456"],
    defaultInputs: { b: 300, d: 500, overallD: 550, Mu: 40, Vu: 25, Tu: 15, fck: 20, fy: 415, dc: 50 },
    runSolver: (inputs) => solveCombinedDesign(inputs.b, inputs.d, inputs.overallD, inputs.Mu, inputs.Vu, inputs.Tu, inputs.fck, inputs.fy, inputs.dc),
    steps: [
      {
        title: "Equivalent Bending Moment (Me1)",
        description: "Convert torsion into an equivalent moment (Mt) and calculate total equivalent design moment Me1.",
        clause: "IS 456 Cl 41.4.2",
        getFormula: () => `M_t = T_u \\cdot \\left[ \\frac{1 + D/b}{1.7} \\right], \\quad M_{e1} = M_u + M_t`,
        getSubstitution: (inps, outs) => `M_t = ${inps.Tu} \\times \\left[ \\frac{1 + ${inps.overallD}/${inps.b}}{1.7} \\right] = ${outs.Mt.toFixed(1)} \\text{ kN-m}\\\\M_{e1} = ${inps.Mu} + ${outs.Mt.toFixed(1)} = ${outs.Me1.toFixed(1)} \\text{ kN-m}`,
        getCheck: (inps, outs) => ({
          success: true,
          text: `Design longitudinal tensile reinforcement for Me1 = ${outs.Me1.toFixed(1)} kN-m. Since Mt (${outs.Mt.toFixed(1)}) > Mu (${inps.Mu}), also design for equivalent compression side moment Me2 = ${outs.Me2.toFixed(1)} kN-m.`
        })
      },
      {
        title: "Equivalent Shear Force (Ve)",
        description: "Calculate equivalent shear force Ve to account for shear and torsional stresses.",
        clause: "IS 456 Cl 41.3.1",
        getFormula: () => `V_e = V_u + 1.6 \\cdot \\frac{T_u}{b}`,
        getSubstitution: (inps, outs) => `V_e = ${inps.Vu} + 1.6 \\times \\frac{${inps.Tu}}{0.3} = ${outs.Ve.toFixed(1)} \\text{ kN}`,
        getCheck: (inps, outs) => ({
          success: outs.tauVe <= outs.tauCMax,
          text: `Equivalent shear stress \\tau_{ve} = ${outs.tauVe.toFixed(2)} N/mm² vs \\tau_{c,max} = ${outs.tauCMax.toFixed(2)} N/mm². ${outs.tauVe <= outs.tauCMax ? 'Safe' : 'Unsafe'}.`
        })
      },
      {
        title: "Transverse Shear and Torsion Reinforcement",
        description: "Calculate spacing for transverse stirrups (2-legged 8mm) to resist combined shear and torsion.",
        clause: "IS 456 Cl 41.4.3",
        getFormula: () => `s_v = \\frac{0.87 \\cdot f_y \\cdot A_{sv}}{\\frac{T_u}{b_1 \\cdot d_1} + \\frac{V_u}{2.5 \\cdot d}}`,
        getSubstitution: (inps, outs) => `b_1 = ${inps.b} - 100 = ${outs.b1} \\text{ mm}, \\quad d_1 = ${inps.overallD} - 100 = ${outs.d1} \\text{ mm}\\\\A_{sv} = 2 \\times \\frac{\\pi}{4} \\times 8^2 = ${outs.Asv_stirrups.toFixed(1)} \\text{ mm}^2\\\\s_v = \\frac{0.87 \\times ${inps.fy} \\times ${outs.Asv_stirrups.toFixed(1)}}{\\frac{${inps.Tu} \\times 10^6}{${outs.b1} \\times ${outs.d1}} + \\frac{${inps.Vu} \\times 10^3}{2.5 \\times ${inps.d}}} = ${outs.sv_calculated.toFixed(1)} \\text{ mm}`,
        getCheck: (inps, outs) => ({
          success: true,
          text: `Transverse reinforcement spacing is ${outs.sv_final} mm c/c (applying Cl 41.4.3 limits).`
        })
      }
    ]
  }
];
