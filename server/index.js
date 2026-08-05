import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');
const officeParser = require('officeparser');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Local workspace directories
const DATA_DIR = path.join(__dirname, '../data');
const SIM_DIR = path.join(DATA_DIR, 'simulations');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const SETTINGS_PATH = path.join(DATA_DIR, 'settings.json');
const DOWNLOADS_DIR = process.env.DOWNLOADS_DIR || path.join(os.homedir(), '.gemini/antigravity/scratch/darshan-tracker/downloads');

// Persistent backup directory in user's Documents folder
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(os.homedir(), 'Documents/darshan-tracker-saves');
const BACKUP_SIM_DIR = path.join(BACKUP_DIR, 'simulations');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(SIM_DIR)) {
  fs.mkdirSync(SIM_DIR, { recursive: true });
}

// Default system prompts for customization
const DEFAULT_BLUEPRINT_PROMPT = `You are an expert prompt engineer and educational developer.
Your task is to write a highly detailed, step-by-step instruction prompt for a code generator model (Gemini) to build a dynamic, interactive HTML/JS simulation.

CRITICAL FOCUS GUIDELINES:
1. **NO NOTEBOOK / EXAM PAPER CLUTTER**: Do NOT instruct the model to write text boxes showing exam solution sheet layouts or large copy blocks of exam text. The focus is 100% on a rich, real-world interactive physical simulation space.
2. **REAL-WORLD GAMIFIED MECHANICS**: Encourage a highly creative, real-world simulation scenario (e.g. testing beam capacity by piling heavy blocks on it, dropping storm clouds to test rainfall runoff, dragging reinforcement steel rods into a concrete cross-section).
3. **INTERACTIVE FIGURES & VALUE-DROP**: Emphasize interactive engineering figures (force vectors, stress blocks, cross-sections) where you drag and drop answer cards, load blocks, or parameter numbers directly onto the figure itself to see live structural deformation, infiltration rates, or parameter responses inside the drawing.
4. **ADVANCED DRAG & DROP**: Drag & drop must not be limited to basic canvas shapes. Make it possible to drag numerical value cards, physical weights, soil packets, or engineering parameters and drop them directly into active formula slots, balancing scales, or canvas areas to trigger dynamic updates.
5. **Visual Simulation Strategy**: Dynamic 2D Canvas grids, structural diagrams, moving parts, force vectors, and real-time updating graphs.
6. **Sound & Narration**: Standard Web Audio synth sound triggers (beeps, clicks, warning tones) and window.speechSynthesis explaining concept actions.
7. **Aesthetics**: Premium cyber-engineering dark dashboard with translucent glass panels, glowing neon highlights (cyan, purple, green), and fluid CSS animations.
8. **RCC BEAM DESIGN & STRUCTURAL ENGINEERING STYLE GUIDE (CRITICAL)**:
   If the target step belongs to structural engineering/RCC design, the blueprint MUST instruct the code generator to build:
   - **Interactive Parameter Identification & Checklist**: Clickable problem statement text with highlightable variables (b, D, c, Ast, Asc, fck, fy) and a checklist transitioning from Pending to Identified.
   - **Real-Time Canvas Section Drafting Animations**: Growth animations of width (b), depth (D), clear cover margins (c), and sequential rebar placement (Ast/Asc) with staggered leaders and callouts to prevent overlay.
   - **Creative Pour & Glow Animations**: Liquid concrete pour textures (fck) and vibrant pulsing steel glows (fy) on the rebars when identified.
   - **Drag-and-Drop Formula Slots**: Drag numerical chips or structural constants from the canvas or problem cards into formula drop targets with snap effects, chime sounds, and green/red status rings.
   - **Dynamic Camera Zooms**: Zoom the HTML5 Canvas view (e.g., 150%) into target zones (like the tension or compression cover boundary) during relevant calculations, highlighting active lines in zoomed bold red.
    - **Gamified IS 456 Codebook Challenges**: Clickable Page/Clause reference books (e.g., Page 69, 70, or 96) that the student must select or drag from to unlock the active equation solver.
     - **Stress-Strain & Aligned Profile Diagrams**: Parallel renderings showing the concrete parabolic stress block with resultant compression/tension vectors alongside linear strain diagrams pivoting at the neutral axis depth.
     - **Superposition & Capacity Visualizer**: Stacked capacity bar charts showing capacity decomposition (e.g., Limiting flexural moment vs compression steel contribution).
9. **ROBUST VIEWPORT & RESOLUTION RULES**: Specify that the canvas and dashboard must use flex/grid layout with strict 100vh viewport height containment to prevent double scrollbars. Canvas must dynamically resize on window events, support high-DPI (Retina) scaling, and draw clean filled backdrop panels behind text annotations.
10. **STEP-BY-STEP DIALOGUES & CONDITIONAL LEARNING IF-ELSE BRANCHES**: Detail a complete sequence of step-by-step interactive guide dialogues, slot math puzzles, and visual guides. Program complex variable conditional checks using if-else logic to guide students through sequential learning milestones.`;

const DEFAULT_CODE_PROMPT = `You are a master frontend developer and UI/UX designer. Build a complete, single-file interactive educational simulation based on the instructions provided.

CRITICAL RULES FOR 100% RELIABLE VISUALS & PREMIUM UX:
1. **CONTAINER CONTAINMENT & NO OVERFLOWS**: Ensure the entire simulation dashboard is contained within a 100vh flexbox or grid layout wrapper. Do NOT allow outer page body scrollbars. The visual simulation panel and control inputs panel must be side-by-side or stacked cleanly, using "overflow: hidden" or scrollable control cards where appropriate.
2. **HIGH-DPI (RETINA) & RESPONSIVE CANVAS SCALING**: If using HTML5 Canvas, you MUST implement a high-DPI scaling handler.
   - Use a helper function that sets canvas width/height to CSS style size multiplied by window.devicePixelRatio, and scales the context:
     \`\`\`js
     function resizeCanvas() {
       const rect = canvas.getBoundingClientRect();
       const dpr = window.devicePixelRatio || 1;
       canvas.width = rect.width * dpr;
       canvas.height = rect.height * dpr;
       ctx.scale(dpr, dpr);
     }
     \`\`\`
   - Re-run resizeCanvas on window "resize" events. Use the canvas bounds (rect.width/rect.height) for coordinate math rather than fixed pixel dimensions.
3. **LEGIBLE CANVAS TEXT**: When drawing text on a canvas over grids or diagrams, always draw a solid or translucent background box or a high-contrast shadow/border behind the text. This prevents labels from overlapping lines and disappearing.
4. **SVG RESPONSIVE SCALE**: If using SVG, always specify a viewBox (e.g. viewBox="0 0 800 500") and set width="100%" height="100%". Never use fixed pixel width/height without viewBox.
5. **MODERN DIALOGS & POPUPS**: Make overlay panels and standard manual lookups use full modal overlays with blur backdrop-filter, explicit close buttons, and click-away dismissal so they never freeze the screen.
6. **NO BROKEN CSS LIBRARIES**: Use standard, vanilla CSS for layout (flexbox, grid). Do NOT rely on Tailwind CSS unless you explicitly write/include the complete Tailwind CSS CDN link in the head.
7. Focus 100% on the interactive visual simulator, physics loops, drag-and-drop value slots, and vector figures. Do NOT build paper-style textbook sheets or simple exam text templates.
8. Return ONLY the raw HTML code. Do NOT wrap the code in markdown code fences like \`\`\`html.
9. Place all styling in a <style> block and all interactive logic/canvas physics in a <script> block.
10. **STRICT AUTOPLAY BYPASS & BULLETPROOF SPEECH SYNTHESIS**:
    - Modern browsers block sound and speech unless triggered by a direct user click. You MUST render a highly visible, styled **🔊 Listen / Narrate** button (e.g. next to instructions or steps).
    - The speech engine must start only inside the click handler of this button.
    - Use a robust speech wrapper that resumes the engine, cancels previous speech, and queues speech with a 60ms timeout to bypass Chrome/macOS IPC cancel bugs:
      \`\`\`js
      function speakText(text) {
        if (!('speechSynthesis' in window)) return;
        try {
          window.speechSynthesis.resume();
          window.speechSynthesis.cancel();
          setTimeout(function() {
            try {
              var utterance = new SpeechSynthesisUtterance(text);
              utterance.rate = 1.0;
              utterance.pitch = 1.0;
              utterance.volume = 1.0;
              var voices = window.speechSynthesis.getVoices();
              if (voices && voices.length > 0) {
                var eng = voices.find(function(v) { return v.lang && v.lang.startsWith('en'); });
                if (eng) utterance.voice = eng;
              }
              window.speechSynthesis.speak(utterance);
            } catch (err) {
              console.error('TTS Speak Error:', err);
            }
          }, 60);
        } catch (e) {
          console.error('TTS Error:', e);
        }
      }
      \`\`\`
    - Add visual feedback (like a glowing speaker icon or active state) while the text is actively reading out.
11. Design must look extremely premium: dark cyber-themed dashboard, glowing indicators, translucent glass cards (glassmorphism), responsive layout.
12. Strictly implement the RCC structural animations, canvas drawings, and drag-and-drop formula/IS-code challenges described in the instructions blueprint.`;

// Style Profiles definitions
const STYLE_PROFILES = {
  universal_pedagogy: `🎯 Universal Engineering Pedagogy & Style Profile
🌟 Executive Summary: "Universal Gamified Blueprint Pedagogy"
Combines all calculation mechanics, slot puzzles, heatmaps, flow streams, voice controls, and X-ray inspection into a unified master studio.`,

  micro_inspector: `🔬 Micro-Inspector & X-Ray Mechanics Profile
🌟 Focus: Atomic & Material Level Inspection with Dynamic Vector Mechanics
1. **Translucent X-Ray Visual Canvas**: Render structural elements (beams, slabs, columns, soils) as translucent X-ray glass with interior rebar grids, grain boundaries, or moisture fronts visible inside.
2. **Dynamic Vector & Moment Overlays**: Draw glowing shear vectors, bending moment parabolic curves, and axial force vectors directly onto the geometry.
3. **Microscope Zoom Inspector**: Provide a draggable 2D microscope glass overlay ($200\%$ zoom) that reveals micro-cracking, strain tensors, and bond-stress slip zones.
4. **Live Strain & Stress Gauge Readouts**: Include digital meters calculating real-time $\\sigma = E \\cdot \\varepsilon$ and neutral axis movements as loads change.`,

  gamified_sandbox: `🎮 Gamified Failure-Boundary Sandbox Profile
🌟 Focus: Progressive Destruction Testing & Safety Factor Boundary Challenge
1. **Interactive Overload Control**: Allow the student to crank up live loads ($P$, $M$, $V$) to test structural capacity.
2. **Realistic Progressive Cracking & Plastic Hinges**: Animate concrete flexural cracking ($M_u > M_{cr}$), diagonal shear tension cracks, and plastic hinge yield zones.
3. **Safety Factor Dial Gauge**: Display a prominent glowing gauge ($\text{SF} = \text{Capacity} / \text{Demand}$).
4. **Catastrophic Collapse Animation & Audio Alert**: If $\text{SF} < 1.0$, trigger dynamic structural collapse animations on canvas with a warning alert sound!
5. **Gamified Exam Challenge**: Include target goal buttons (*"Achieve SF = 1.25 with minimum steel weight"*).`,

  intermediate_streams: `🌊 Intermediate Value Streams & Load Path Flow Profile
🌟 Focus: Continuous Load Transfer Streams & Real-Time Parameter Pipelines
1. **Animated Particle Vector Streams**: Render load pathways as glowing particle streams flowing down from load application points, through beam-column nodes, down to foundation soil layers.
2. **Intermediate Calculation Pipelines**: Animate intermediate math variables ($V_u, M_u, \\tau_c, x_u$) traveling as illuminated data nodes along connecting pipelines.
3. **Dynamic Energy & Capacity Bar Charts**: Render a live stacked bar graph showing capacity consumption (Flexure %, Shear %, Deflection %) in real-time.`,

  formula_puzzle: `🧩 Interactive Formula Slot Puzzle & Sensitivity Plotter Profile
🌟 Focus: Drag-and-Drop Equation Assembly & Real-Time Sensitivity Curves
1. **Drag-and-Drop Equation Slots**: Equations are displayed with empty target slots. Students drag numeric parameter chips ($A_{st}, f_{ck}, b, d$) into slots. Correct drops snap with a neon green glow.
2. **Live 2D Parameter Sensitivity Plotter**: Render an interactive $Y$ vs $X$ mathematical sensitivity curve (e.g. required $A_{st}$ vs depth $d$).
3. **Interactive Crosshair Indicator**: As user input sliders change, a glowing indicator dot slides dynamically along the mathematical sensitivity curve.`,

  voice_cockpit: `🎙️ Voice Control Cockpit & AI Lab Assistant Profile
🌟 Focus: Natural Speech Command Triggers & Interactive Dialogue Guidance
1. **Web Speech-to-Command Cockpit**: Users can click the microphone button or speak voice commands (*"increase width"*, *"reduce load"*, *"show moment diagram"*).
2. **Futuristic Glass Cockpit HUD**: Sci-fi translucent glass panel UI with animated speech waveform visualizer.
3. **Interactive Socratic "Lab Assistant" Chat Bubble**: Virtual assistant bubble asking probing questions (*"What happens to the neutral axis depth if $f_{ck}$ is doubled?"*) with step-by-step logic hints.`,

  fea_heatmap: `🔥 Dynamic FEA Heatmap & Multi-Physics Load Engine Profile
🌟 Focus: Finite Element Analysis Stress Fields & Thermal/Seismic Loading
1. **Color-Coded FEA Stress Heatmap**: Draw a smooth gradient stress field across the structural section (**Neon Blue** = Zero Tension / Safe $\rightarrow$ **Amber** = Moderate Stress $\rightarrow$ **Crimson Red** = Yielding / Maximum Compression).
2. **Multi-Physics Environmental Controls**: Sliders for thermal expansion ($\Delta T$), wind gusts, and earthquake ground acceleration ($a_g$).
3. **Modal Vibration Frequencies**: Animate structural resonance sway cycles based on natural period $T = 2\pi \sqrt{\frac{m}{k}}$.`,

  eli5_playful: `👶 Explain To Me Like I'm 5 (ELI5) Playful Sandbox Profile
🌟 Focus: Childlike Fun Analogies, Pitch-Shifting Sound Synthesizers & Hand Motion Gesture Control
1. **5-Year-Old Simplified Analogies**: Explain complex engineering/physics concepts using fun everyday analogies (e.g. beams bending like gummy bears, stress like overstretching a rubber band).
2. **Dynamic Pitch-Shifting Audio Synthesizer**: Connect sliders & parameters to Web Audio Oscillators; moving sliders dynamically alters audio pitch frequency in real-time (higher parameter levels = higher pitched squeak/tone).
3. **Native Web Speech Storytelling Voiceover**: Use Native Speech Synthesis (window.speechSynthesis) to narrate friendly, encouraging step-by-step childlike explanations out loud.
4. **Playful Bouncy Toy Visuals & Animated Diagrams**: Bright vibrant pastel colors, bouncy particle reactions, giant toy-like drag-and-drop handles, and rewarding cheer sound effects on successful steps!
5. **Hand/Mouse Motion Gesture Detection**: Interactive canvas pointer tracking allowing users to sweep their hand/mouse left-to-right across the canvas to bend beams, shift sliders, or trigger physics reactions!`
};

// Ensure backup directories exist
try {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  if (!fs.existsSync(BACKUP_SIM_DIR)) {
    fs.mkdirSync(BACKUP_SIM_DIR, { recursive: true });
  }
} catch (e) {
  console.error('Error creating backup directories in Documents:', e.message);
}

// Self-healing: Restore DB and simulations from persistent backups on boot
const restoreFromBackup = () => {
  try {
    const backupDbPath = path.join(BACKUP_DIR, 'db.json');
    const backupSettingsPath = path.join(BACKUP_DIR, 'settings.json');
    const backupUsagePath = path.join(BACKUP_DIR, 'token_usage.json');

    // 1. Restore database if local file is missing, empty, or has no subjects
    let shouldRestoreDB = false;
    if (fs.existsSync(backupDbPath)) {
      if (!fs.existsSync(DB_PATH)) {
        shouldRestoreDB = true;
      } else {
        const localContent = fs.readFileSync(DB_PATH, 'utf-8').trim();
        if (localContent === '') {
          shouldRestoreDB = true;
        } else {
          try {
            const parsed = JSON.parse(localContent);
            if (!parsed.subjects || parsed.subjects.length === 0) {
              shouldRestoreDB = true;
            }
          } catch (pe) {
            shouldRestoreDB = true;
          }
        }
      }
    }

    if (shouldRestoreDB) {
      fs.copyFileSync(backupDbPath, DB_PATH);
      console.log('[Backup System] Restored database (db.json) from persistent backup in Documents.');
    }

    // 2. Restore settings
    if (fs.existsSync(backupSettingsPath) && !fs.existsSync(SETTINGS_PATH)) {
      fs.copyFileSync(backupSettingsPath, SETTINGS_PATH);
      console.log('[Backup System] Restored system settings (settings.json) from persistent backup.');
    }

    // 3. Restore token usage
    const localUsagePath = path.join(DATA_DIR, 'token_usage.json');
    if (fs.existsSync(backupUsagePath) && !fs.existsSync(localUsagePath)) {
      fs.copyFileSync(backupUsagePath, localUsagePath);
    }

    // 4. Restore compiled HTML/TXT simulation assets
    if (fs.existsSync(BACKUP_SIM_DIR)) {
      const files = fs.readdirSync(BACKUP_SIM_DIR);
      let count = 0;
      for (const file of files) {
        const destPath = path.join(SIM_DIR, file);
        if (!fs.existsSync(destPath)) {
          fs.copyFileSync(path.join(BACKUP_SIM_DIR, file), destPath);
          count++;
        }
      }
      if (count > 0) {
        console.log(`[Backup System] Restored ${count} simulation assets to workspace directory.`);
      }
    }
  } catch (err) {
    console.error('Error during database self-healing check:', err.message);
  }
};

// Run boot recovery checks
restoreFromBackup();

// Background Auto-Run Queue State
let autoRunState = {
  isAutoRunning: false,
  activeAssignmentId: null,
  progressCurrent: 0,
  progressTotal: 0,
  estTimeRemaining: 0,
  currentQuestionId: null,
  error: null
};

// Background Topic Auto-Run Queue State
let topicAutoRunState = {
  isAutoRunning: false,
  activeUnitId: null,
  progressCurrent: 0,
  progressTotal: 0,
  estTimeRemaining: 0,
  currentTopicId: null,
  error: null
};

// Background queue runner for Unit Topics
const runTopicAutoRunBackground = async (subjectId, unitId, topics) => {
  topicAutoRunState.isAutoRunning = true;
  topicAutoRunState.activeUnitId = unitId;
  topicAutoRunState.progressTotal = topics.length;
  topicAutoRunState.progressCurrent = 0;
  topicAutoRunState.error = null;

  console.log(`Starting background topic auto-run loop for Unit ${unitId}. Topics count: ${topics.length}`);

  for (let i = 0; i < topics.length; i++) {
    if (topicAutoRunState.activeUnitId !== unitId) {
      console.log(`Background topic auto-run for unit ${unitId} was cancelled.`);
      break;
    }

    const topic = topics[i];
    topicAutoRunState.currentTopicId = topic.id;
    topicAutoRunState.estTimeRemaining = (topics.length - i) * 35;

    try {
      console.log(`[Topic Queue] Generating simulation ${i+1}/${topics.length}: ${topic.title}`);
      await generateTopicSimulationInternal(subjectId, unitId, topic.id, [
        "Drag and Drop Interaction",
        "Vector/Force/Velocity Diagram Overlays",
        "Real-time Equation Graphing/Plotting",
        "Speech Synthesis Concept Narration voiceovers",
        "Web Audio Synth Sound Effects",
        "Visual overlay instructions modal"
      ]);
      topicAutoRunState.progressCurrent = i + 1;
    } catch (err) {
      console.error(`[Topic Queue] Error generating simulation for topic ${topic.id}:`, err.message);
    }

    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  console.log(`Background topic auto-run loop completed for Unit: ${unitId}`);
  topicAutoRunState.isAutoRunning = false;
  topicAutoRunState.activeUnitId = null;
  topicAutoRunState.currentTopicId = null;
  topicAutoRunState.estTimeRemaining = 0;
};

// Helper to read DB
const readDB = () => {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify({ subjects: [], fsrsItems: [] }, null, 2));
    }
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    if (!parsed.fsrsItems) {
      parsed.fsrsItems = [];
    }
    return parsed;
  } catch (error) {
    console.error('Error reading DB:', error);
    return { subjects: [], fsrsItems: [] };
  }
};

// Helper to write DB (writes locally & mirrors to backup)
const writeDB = (data) => {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    
    // Mirror to backup
    try {
      const backupDbPath = path.join(BACKUP_DIR, 'db.json');
      fs.writeFileSync(backupDbPath, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error('Failed to write backup of DB:', e.message);
    }
    
    return true;
  } catch (error) {
    console.error('Error writing DB:', error);
    return false;
  }
};

// Robust wrapper for Gemini model calls with auto-retry and exponential backoff
const generateContentWithRetry = async (modelInstance, prompt, maxRetries = 8) => {
  let attempt = 0;
  let delay = 2000;
  while (attempt < maxRetries) {
    try {
      return await modelInstance.generateContent(prompt);
    } catch (error) {
      attempt++;
      const errMsg = error.message || '';
      console.warn(`[Gemini API] Attempt ${attempt}/${maxRetries} failed:`, errMsg);
      
      const isQuotaExceeded = errMsg.includes('Quota') || errMsg.includes('quota') || errMsg.includes('429');
      const isDemandIssue = errMsg.includes('503') || errMsg.includes('demand') || errMsg.includes('Service Unavailable') || errMsg.includes('temporary');

      if (isQuotaExceeded || isDemandIssue) {
        if (attempt >= maxRetries) {
          throw error;
        }
        console.log(`[Gemini API] Rate limit/load spike detected. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * 2, 30000); // backoff with a cap of 30 seconds
      } else {
        if (attempt >= 3) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
  }
};

// Helper to read Settings
const readSettings = () => {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) {
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify({ apiKey: '', optimizerModel: 'gemini-2.5-flash', generatorModel: 'gemini-2.5-flash', styleProfile: 'universal_pedagogy' }, null, 2));
    }
    const data = fs.readFileSync(SETTINGS_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    if (!parsed.styleProfile) {
      parsed.styleProfile = 'universal_pedagogy';
    }
    return parsed;
  } catch (error) {
    console.error('Error reading Settings:', error);
    return { apiKey: '', optimizerModel: 'gemini-2.5-flash', generatorModel: 'gemini-2.5-flash', styleProfile: 'universal_pedagogy' };
  }
};

// Helper to write Settings (writes locally & mirrors to backup)
const writeSettings = (settings) => {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
    
    // Mirror to backup
    try {
      fs.writeFileSync(path.join(BACKUP_DIR, 'settings.json'), JSON.stringify(settings, null, 2));
    } catch (e) {
      console.error('Failed to write backup of settings:', e.message);
    }
    
    return true;
  } catch (error) {
    console.error('Error writing Settings:', error);
    return false;
  }
};

// Initialize Gemini Client
const getGeminiClient = (apiKey) => {
  if (!apiKey) {
    const settings = readSettings();
    apiKey = settings.apiKey;
  }
  if (!apiKey) {
    throw new Error('Gemini API Key is not configured. Please add it in settings.');
  }
  const client = new GoogleGenerativeAI(apiKey);
  // Intercept getGenerativeModel to safely map fallback models to valid API models
  const originalGetModel = client.getGenerativeModel.bind(client);
  client.getGenerativeModel = (config) => {
    let modelName = config.model;
    if (modelName.includes('gemini-3.5') || modelName.includes('gemini-3.1') || modelName.includes('gemini-1.5')) {
      modelName = 'gemini-2.5-flash';
    }
    return originalGetModel({ ...config, model: modelName });
  };
  return client;
};

// Token usage logger
const logTokenUsage = (response) => {
  try {
    const usage = response.response?.usageMetadata || response.usageMetadata;
    if (usage) {
      const promptTokens = usage.promptTokenCount || 0;
      const responseTokens = usage.candidatesTokenCount || 0;
      const totalTokens = promptTokens + responseTokens;
      
      const usagePath = path.join(DATA_DIR, 'token_usage.json');
      const today = new Date().toISOString().split('T')[0];
      
      let log = { date: today, tokensToday: 0, requestsToday: 0 };
      if (fs.existsSync(usagePath)) {
        try {
          const raw = fs.readFileSync(usagePath, 'utf-8');
          const parsed = JSON.parse(raw);
          if (parsed.date === today) {
            log = parsed;
          }
        } catch (e) {
          // ignore
        }
      }
      
      log.tokensToday += totalTokens;
      log.requestsToday += 1;
      log.date = today;
      
      fs.writeFileSync(usagePath, JSON.stringify(log, null, 2));
      
      // Mirror to backup
      try {
        fs.writeFileSync(path.join(BACKUP_DIR, 'token_usage.json'), JSON.stringify(log, null, 2));
      } catch (e) {}

      console.log(`Token Usage Logged: Today's Requests = ${log.requestsToday}, Today's Tokens = ${log.tokensToday}`);
    }
  } catch (err) {
    console.error('Error logging token usage:', err);
  }
};

// Scan local downloads folder recursively for assignment PDFs
const scanLocalAssignments = () => {
  const list = [];
  if (!fs.existsSync(DOWNLOADS_DIR)) {
    return list;
  }
  try {
    const courseFolders = fs.readdirSync(DOWNLOADS_DIR);
    for (const courseFolder of courseFolders) {
      if (courseFolder.startsWith('.')) continue;
      const coursePath = path.join(DOWNLOADS_DIR, courseFolder);
      if (!fs.statSync(coursePath).isDirectory()) continue;
      
      const subDirs = [
        { name: 'Assignment', type: 'assignment' },
        { name: 'Presentation', type: 'ppt' },
        { name: 'E-Notes', type: 'enote' }
      ];

      for (const dir of subDirs) {
        const dirPath = path.join(coursePath, dir.name);
        if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
          const files = fs.readdirSync(dirPath);
          for (const file of files) {
            if (file.startsWith('.')) continue;
            const ext = path.extname(file).toLowerCase();
            if (['.pdf', '.docx', '.pptx', '.doc', '.ppt'].includes(ext)) {
              const filePath = path.join(dirPath, file);
              
              // Clean subject name
              let subjectName = courseFolder;
              const subMatch = courseFolder.match(/\d+[A-Z]+\d+\s*-\s*(.*?)\s*Semester/i);
              if (subMatch && subMatch[1]) {
                subjectName = subMatch[1].trim();
              } else {
                subjectName = courseFolder.replace(/\d+[A-Z]+\d+\s*-\s*/, '').replace(/\s*Semester.*/, '').trim();
              }

              // Extract unit number
              let unitNumber = 1;
              const unitMatch = file.match(/Unit\s*_\s*(\d+)/i) || file.match(/Unit\s*(\d+)/i) || file.match(/Assignment\s*(\d+)/i);
              if (unitMatch && unitMatch[1]) {
                unitNumber = parseInt(unitMatch[1]);
              }

              // Extract clean title
              let cleanTitle = file.replace(new RegExp(`\\${ext}$`, 'i'), '').trim();
              cleanTitle = cleanTitle.replace(/Unit\s*_\s*\d+/gi, '');
              cleanTitle = cleanTitle.replace(/Unit\s*\d+/gi, '');
              cleanTitle = cleanTitle.replace(/Assignment\s*\d+/gi, '');
              cleanTitle = cleanTitle.replace(/^\d+[A-Z]+\d+\s*[A-Z]+\s*/i, '');
              cleanTitle = cleanTitle.replace(/^[-_\s]+/, '').replace(/[-_\s]+$/, '').trim();
              
              const halfLength = Math.floor(cleanTitle.length / 2);
              if (cleanTitle.length > 10 && cleanTitle.slice(0, halfLength).trim() === cleanTitle.slice(halfLength).replace(/^[-_\s]+/, '').trim()) {
                cleanTitle = cleanTitle.slice(0, halfLength).trim();
              }
              if (!cleanTitle) {
                cleanTitle = `${dir.name} (Unit ${unitNumber})`;
              }

              list.push({
                subjectFolder: courseFolder,
                subjectName,
                fileName: file,
                filePath,
                detectedUnit: unitNumber,
                detectedTitle: cleanTitle,
                materialType: dir.type
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error reading course folder:', error);
  }
  return list;
};

// Reusable Core Simulation Generator logic
const generateSimulationInternal = async (questionId, addons) => {
  const db = readDB();
  let foundQuestion = null;
  let foundSubject = null;
  let foundUnit = null;
  let foundAssignment = null;

  for (const s of db.subjects) {
    for (const u of s.units) {
      for (const a of u.assignments) {
        for (const q of a.questions) {
          if (q.id === questionId) {
            foundQuestion = q;
            foundSubject = s;
            foundUnit = u;
            foundAssignment = a;
            break;
          }
        }
      }
    }
  }

  if (!foundQuestion) {
    throw new Error('Question not found');
  }

  const genStart = Date.now();

  try {
    foundQuestion.status = 'generating';
    writeDB(db);

    const settings = readSettings();
    const ai = getGeminiClient();
    
    const optimizerModel = settings.optimizerModel || 'gemini-3.1-flash-lite';
    const generatorModel = settings.generatorModel || 'gemini-3.5-flash';

    // Slide text scanning
    let slidesText = '';
    try {
      if (fs.existsSync(DOWNLOADS_DIR)) {
        const courseFolders = fs.readdirSync(DOWNLOADS_DIR);
        const matchedFolder = courseFolders.find(f => f.toLowerCase().includes(foundSubject.name.toLowerCase()));
        if (matchedFolder) {
          const presDir = path.join(DOWNLOADS_DIR, matchedFolder, 'Presentation');
          const labDir = path.join(DOWNLOADS_DIR, matchedFolder, 'Lab Manual');
          
          let matchedFile = null;
          let matchedPath = '';
          const unitNumStr = String(foundUnit.number);
          const unitRegex = new RegExp(`Unit\\s*_*\\s*0*${unitNumStr}\\b`, 'i');

          if (fs.existsSync(presDir)) {
            const files = fs.readdirSync(presDir);
            matchedFile = files.find(f => unitRegex.test(f) && (f.endsWith('.pptx') || f.endsWith('.pdf')));
            if (matchedFile) matchedPath = path.join(presDir, matchedFile);
          }

          if (!matchedFile && fs.existsSync(labDir)) {
            const files = fs.readdirSync(labDir);
            matchedFile = files.find(f => unitRegex.test(f) && (f.endsWith('.pdf') || f.endsWith('.pptx')));
            if (matchedFile) matchedPath = path.join(labDir, matchedFile);
          }

          if (matchedFile && matchedPath) {
            if (matchedFile.endsWith('.pptx')) {
              const ast = await officeParser.parseOffice(matchedPath);
              slidesText = ast.toText();
            } else if (matchedFile.endsWith('.pdf')) {
              const dataBuffer = fs.readFileSync(matchedPath);
              const parser = new PDFParse({ data: dataBuffer });
              const result = await parser.getText();
              slidesText = result.text;
            }

            if (slidesText) {
              if (slidesText.length > 6000) {
                slidesText = slidesText.slice(0, 6000) + '\n[Source context trimmed for token optimization]';
              }
            }
          }
        }
      }
    } catch (docErr) {
      console.warn('Could not parse unit presentation or note context:', docErr.message);
    }

    const slidesContextSection = slidesText 
      ? `\n--- REFERENCED UNIT SLIDES/NOTES SOURCE CONTEXT ---\n${slidesText}\n`
      : '';

    const activeProfileKey = settings.styleProfile || 'universal_pedagogy';
    const activeProfileText = STYLE_PROFILES[activeProfileKey] || STYLE_PROFILES['universal_pedagogy'];

    const blueprintPromptTemplate = settings.promptBlueprintSystem || DEFAULT_BLUEPRINT_PROMPT;
    const stage1Prompt = `${blueprintPromptTemplate}

Active Pedagogy Style Profile:
${activeProfileText}

Target Question Details:
Full Problem Text: "${foundQuestion.text}"
Subject: ${foundSubject.name}
Unit: Unit ${foundUnit.number} (${foundUnit.name})
Concept: ${foundQuestion.concept}
Difficulty: ${foundQuestion.difficulty}/10
${slidesContextSection}
Additional requested features:
${addons && addons.length > 0 ? addons.map(a => `- ${a}`).join('\n') : '- Simple interactive controls (Play/Pause, speed adjustment)\n- Speech synthesis voiceover narrative\n- Web Audio sound effects'}

Output a very comprehensive, detailed, and long simulation blueprint instructions for the code compiler (between 800 to 1200 words). Explicitly detail step-by-step logic, if-else conditional branches, parameter controls, sound formulas, and SVG/Canvas drawing coordinates.`;

    const optModelInstance = ai.getGenerativeModel({ model: optimizerModel });
    const stage1Response = await generateContentWithRetry(optModelInstance, stage1Prompt, 15);
    logTokenUsage(stage1Response);
    const optimizedPrompt = stage1Response.response.text();

    // Save prompt blueprint locally
    const promptFileName = `sim-${questionId}-prompt.txt`;
    const promptFilePath = path.join(SIM_DIR, promptFileName);
    fs.writeFileSync(promptFilePath, optimizedPrompt, 'utf-8');

    // Mirror prompt blueprint copy to user persistent Documents directory
    try {
      fs.writeFileSync(path.join(BACKUP_SIM_DIR, promptFileName), optimizedPrompt, 'utf-8');
    } catch (e) {
      console.error('Failed to write backup of prompt blueprint:', e.message);
    }

    const codeSystemPromptTemplate = settings.promptCodeSystem || DEFAULT_CODE_PROMPT;
    const stage2SystemPrompt = `${codeSystemPromptTemplate}

INSTRUCTIONS BLUEPRINT:
${optimizedPrompt}`;

    let stage2Response;
    try {
      const genModelInstance = ai.getGenerativeModel({ model: generatorModel });
      stage2Response = await generateContentWithRetry(genModelInstance, stage2SystemPrompt, 3);
    } catch (gErr) {
      console.warn(`[Gen Warning] ${generatorModel} rate-limited. Falling back to gemini-3.1-flash-lite for token savings...`);
      const fallbackInstance = ai.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
      stage2Response = await generateContentWithRetry(fallbackInstance, stage2SystemPrompt, 5);
    }
    logTokenUsage(stage2Response);

    let rawCode = stage2Response.response.text();
    let cleanCode = stripMarkdownFences(rawCode);

    const fileName = `sim-${questionId}.html`;
    const filePath = path.join(SIM_DIR, fileName);
    fs.writeFileSync(filePath, cleanCode, 'utf-8');

    // Mirror simulation HTML copy to persistent Documents directory
    try {
      fs.writeFileSync(path.join(BACKUP_SIM_DIR, fileName), cleanCode, 'utf-8');
    } catch (e) {
      console.error('Failed to write backup of simulation HTML:', e.message);
    }

    const freshDb = readDB();
    let qToUpdate = null;
    for (const s of freshDb.subjects) {
      for (const u of s.units) {
        for (const a of u.assignments) {
          for (const q of a.questions) {
            if (q.id === questionId) {
              qToUpdate = q;
              break;
            }
          }
        }
      }
    }

    const durationSeconds = Math.round((Date.now() - genStart) / 1000);

    if (qToUpdate) {
      qToUpdate.status = 'ready';
      qToUpdate.simulationFile = `/simulations/${fileName}`;
      qToUpdate.generationDuration = durationSeconds;
      writeDB(freshDb);
    }

    return `/simulations/${fileName}`;
  } catch (error) {
    const freshDb = readDB();
    let qToUpdate = null;
    for (const s of freshDb.subjects) {
      for (const u of s.units) {
        for (const a of u.assignments) {
          for (const q of a.questions) {
            if (q.id === questionId) {
              qToUpdate = q;
              break;
            }
          }
        }
      }
    }
    if (qToUpdate) {
      qToUpdate.status = 'failed';
      writeDB(freshDb);
    }
    throw error;
  }
};

// Reusable Step Simulation Generator logic
const generateStepSimulationInternal = async (questionId, stepId, addons) => {
  const db = readDB();
  let foundQuestion = null;
  let foundStep = null;
  let foundSubject = null;
  let foundUnit = null;

  for (const s of db.subjects) {
    for (const u of s.units) {
      // 1. Search assignment questions
      for (const a of u.assignments) {
        for (const q of a.questions) {
          if (q.id === questionId) {
            foundQuestion = q;
            foundSubject = s;
            foundUnit = u;
            if (q.steps) foundStep = q.steps.find(st => st.id === stepId);
            break;
          }
        }
      }
      // 2. Search unit topics
      if (!foundQuestion && u.topics) {
        for (const t of u.topics) {
          if (t.id === questionId) {
            foundQuestion = {
              id: t.id,
              text: `[Unit Topic] ${t.title}: ${t.description}`,
              concept: t.concept,
              difficulty: t.difficulty,
              hasSteps: t.hasSteps,
              steps: t.steps
            };
            foundSubject = s;
            foundUnit = u;
            if (t.steps) foundStep = t.steps.find(st => st.id === stepId);
            break;
          }
        }
      }
    }
  }

  if (!foundQuestion || !foundStep) {
    throw new Error('Question or step not found');
  }

  const genStart = Date.now();

  try {
    foundStep.status = 'generating';
    writeDB(db);

    const settings = readSettings();
    const ai = getGeminiClient();
    
    const optimizerModel = settings.optimizerModel || 'gemini-3.1-flash-lite';
    const generatorModel = settings.generatorModel || 'gemini-3.5-flash';

    // Slide text scanning
    let slidesText = '';
    try {
      if (fs.existsSync(DOWNLOADS_DIR)) {
        const courseFolders = fs.readdirSync(DOWNLOADS_DIR);
        const matchedFolder = courseFolders.find(f => f.toLowerCase().includes(foundSubject.name.toLowerCase()));
        if (matchedFolder) {
          const unitNumStr = String(foundUnit.number);
          const unitRegex = new RegExp(`Unit\\s*_*\\s*0*${unitNumStr}\\b`, 'i');

          // Search in Presentation and E-Notes directories
          const scanDirs = ['Presentation', 'E-Notes'];
          let matchedFile = null;
          let matchedPath = '';

          for (const dirName of scanDirs) {
            const dirPath = path.join(DOWNLOADS_DIR, matchedFolder, dirName);
            if (fs.existsSync(dirPath)) {
              const files = fs.readdirSync(dirPath);
              matchedFile = files.find(f => unitRegex.test(f) && (f.endsWith('.pptx') || f.endsWith('.pdf')));
              if (matchedFile) {
                matchedPath = path.join(dirPath, matchedFile);
                break;
              }
            }
          }

          if (matchedFile && matchedPath) {
            if (matchedFile.endsWith('.pptx')) {
              const ast = await officeParser.parseOffice(matchedPath);
              slidesText = ast.toText();
            } else if (matchedFile.endsWith('.pdf')) {
              const dataBuffer = fs.readFileSync(matchedPath);
              const parser = new PDFParse({ data: dataBuffer });
              const result = await parser.getText();
              slidesText = result.text;
            }

            if (slidesText && slidesText.length > 30000) {
              slidesText = slidesText.slice(0, 30000) + '\n[Source context truncated]';
            }
          }
        }
      }
    } catch (docErr) {
      console.warn('Could not parse unit presentation or note context:', docErr.message);
    }

    const slidesContextSection = slidesText 
      ? `\n--- REFERENCED UNIT SLIDES/NOTES SOURCE CONTEXT ---\n${slidesText}\n`
      : '';

    const activeProfileKey = settings.styleProfile || 'universal_pedagogy';
    const activeProfileText = STYLE_PROFILES[activeProfileKey] || STYLE_PROFILES['universal_pedagogy'];

    const blueprintPromptTemplate = settings.promptBlueprintSystem || DEFAULT_BLUEPRINT_PROMPT;
    const stage1Prompt = `${blueprintPromptTemplate}

Active Pedagogy Style Profile:
${activeProfileText}

Target Step Details:
Full Problem Text: "${foundQuestion.text}"
Subject: ${foundSubject.name}
Unit: Unit ${foundUnit.number} (${foundUnit.name})
Target Exam Step ${foundStep.stepNumber}: "${foundStep.title}"
Step Calculation & Value Transfer Details: "${foundStep.description}"
${slidesContextSection}
Additional requested features:
${addons && addons.length > 0 ? addons.map(a => `- ${a}`).join('\n') : '- Interactive calculation controls & inputs\n- Step-by-step exam writing format display\n- Speech synthesis voiceover narrative\n- Web Audio sound effects'}

The simulation must focus EXCLUSIVELY on making Step ${foundStep.stepNumber} ("${foundStep.title}") crystal clear for university exam writing.

Output a very comprehensive, detailed, and long simulation blueprint instructions for the code compiler (between 800 to 1200 words). Explicitly detail step-by-step logic, if-else conditional branches, parameter controls, sound formulas, and SVG/Canvas drawing coordinates.`;

    console.log(`[Layer 2 - Lite Prompt Model: ${optimizerModel}] Expanding creative interactive blueprint for Step ${foundStep.stepNumber}: "${foundStep.title}"...`);
    const optModelInstance = ai.getGenerativeModel({ model: optimizerModel });
    const stage1Response = await generateContentWithRetry(optModelInstance, stage1Prompt);
    logTokenUsage(stage1Response);
    const optimizedPrompt = stage1Response.response.text();

    // Save step prompt blueprint
    const promptFileName = `sim-${questionId}-step-${stepId}-prompt.txt`;
    const promptFilePath = path.join(SIM_DIR, promptFileName);
    fs.writeFileSync(promptFilePath, optimizedPrompt, 'utf-8');

    try {
      fs.writeFileSync(path.join(BACKUP_SIM_DIR, promptFileName), optimizedPrompt, 'utf-8');
    } catch (e) {}

    console.log(`[Layer 3 - Heavy Code Model: ${generatorModel}] Coding complete single-file HTML/JS simulation for Step ${foundStep.stepNumber}...`);

    const codeSystemPromptTemplate = settings.promptCodeSystem || DEFAULT_CODE_PROMPT;
    const stage2SystemPrompt = `${codeSystemPromptTemplate}

INSTRUCTIONS BLUEPRINT:
${optimizedPrompt}`;

    const genModelInstance = ai.getGenerativeModel({ model: generatorModel });
    const stage2Response = await generateContentWithRetry(genModelInstance, stage2SystemPrompt);
    logTokenUsage(stage2Response);

    let rawCode = stage2Response.response.text();
    let cleanCode = stripMarkdownFences(rawCode);

    const fileName = `sim-${questionId}-step-${stepId}.html`;
    const filePath = path.join(SIM_DIR, fileName);
    fs.writeFileSync(filePath, cleanCode, 'utf-8');

    try {
      fs.writeFileSync(path.join(BACKUP_SIM_DIR, fileName), cleanCode, 'utf-8');
    } catch (e) {}

    const freshDb = readDB();
    let qToUpdate = null;
    let stToUpdate = null;
    for (const s of freshDb.subjects) {
      for (const u of s.units) {
        for (const a of u.assignments) {
          for (const q of a.questions) {
            if (q.id === questionId) {
              qToUpdate = q;
              if (q.steps) stToUpdate = q.steps.find(st => st.id === stepId);
              break;
            }
          }
        }
        if (!qToUpdate && u.topics) {
          const t = u.topics.find(top => top.id === questionId);
          if (t) {
            qToUpdate = t;
            if (t.steps) stToUpdate = t.steps.find(st => st.id === stepId);
            break;
          }
        }
      }
    }

    const durationSeconds = Math.round((Date.now() - genStart) / 1000);

    if (stToUpdate) {
      stToUpdate.status = 'ready';
      stToUpdate.simulationFile = `/simulations/${fileName}`;
      stToUpdate.generationDuration = durationSeconds;
    }
    if (qToUpdate) {
      qToUpdate.activeStepId = stepId;
      writeDB(freshDb);
    }

    return `/simulations/${fileName}`;
  } catch (error) {
    const freshDb = readDB();
    for (const s of freshDb.subjects) {
      for (const u of s.units) {
        for (const a of u.assignments) {
          for (const q of a.questions) {
            if (q.id === questionId && q.steps) {
              const st = q.steps.find(sItem => sItem.id === stepId);
              if (st) st.status = 'failed';
              break;
            }
          }
        }
        if (u.topics) {
          const t = u.topics.find(top => top.id === questionId);
          if (t && t.steps) {
            const st = t.steps.find(sItem => sItem.id === stepId);
            if (st) st.status = 'failed';
          }
        }
      }
    }
    writeDB(freshDb);
    throw error;
  }
};

// Background queue runner
const runAutoRunBackground = async (assignmentId, questions) => {
  autoRunState.isAutoRunning = true;
  autoRunState.activeAssignmentId = assignmentId;
  autoRunState.progressTotal = questions.length;
  autoRunState.progressCurrent = 0;
  autoRunState.error = null;

  console.log(`Starting background auto-run loop for ${assignmentId}. Questions count: ${questions.length}`);

  for (let i = 0; i < questions.length; i++) {
    if (autoRunState.activeAssignmentId !== assignmentId) {
      console.log(`Background auto-run for assignment ${assignmentId} was cancelled.`);
      break;
    }

    const q = questions[i];
    autoRunState.currentQuestionId = q.id;
    autoRunState.estTimeRemaining = (questions.length - i) * 25;

    try {
      console.log(`[Background Queue] Generating simulation ${i+1}/${questions.length}: ${q.id}`);
      await generateSimulationInternal(q.id, [
        "Drag and Drop Interaction",
        "Vector/Force/Velocity Diagram Overlays",
        "Real-time Equation Graphing/Plotting",
        "Speech Synthesis Concept Narration voiceovers",
        "Web Audio Synth Sound Effects"
      ]);
      autoRunState.progressCurrent = i + 1;
    } catch (err) {
      console.error(`[Background Queue] Error generating simulation for ${q.id}:`, err.message);
    }

    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  console.log(`Background auto-run loop completed for assignment: ${assignmentId}`);
  autoRunState.isAutoRunning = false;
  autoRunState.activeAssignmentId = null;
  autoRunState.currentQuestionId = null;
  autoRunState.estTimeRemaining = 0;
};

// Serve static simulations
app.use('/simulations', express.static(SIM_DIR));

// DB endpoints
app.get('/api/db', (req, res) => {
  res.json(readDB());
});

app.post('/api/db', (req, res) => {
  const success = writeDB(req.body);
  if (success) {
    res.json({ success: true, db: req.body });
  } else {
    res.status(500).json({ error: 'Failed to write database.' });
  }
});

// Settings endpoints
app.get('/api/settings', (req, res) => {
  const settings = readSettings();
  const maskedKey = settings.apiKey 
    ? `${settings.apiKey.slice(0, 4)}...${settings.apiKey.slice(-4)}`
    : '';
  
  const usagePath = path.join(DATA_DIR, 'token_usage.json');
  const today = new Date().toISOString().split('T')[0];
  let usageLog = { date: today, tokensToday: 0, requestsToday: 0 };
  if (fs.existsSync(usagePath)) {
    try {
      const raw = fs.readFileSync(usagePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.date === today) {
        usageLog = parsed;
      }
    } catch (e) {}
  }

  res.json({
    apiKey: maskedKey,
    apiKeyConfigured: !!settings.apiKey,
    optimizerModel: settings.optimizerModel || 'gemini-3.1-flash-lite',
    generatorModel: settings.generatorModel || 'gemini-3.5-flash',
    promptBlueprintSystem: settings.promptBlueprintSystem || DEFAULT_BLUEPRINT_PROMPT,
    promptCodeSystem: settings.promptCodeSystem || DEFAULT_CODE_PROMPT,
    styleProfile: settings.styleProfile || 'universal_pedagogy',
    tokensToday: usageLog.tokensToday,
    requestsToday: usageLog.requestsToday,
    limitRequests: 1500
  });
});

app.post('/api/settings', (req, res) => {
  const currentSettings = readSettings();
  const { apiKey, optimizerModel, generatorModel, promptBlueprintSystem, promptCodeSystem, styleProfile } = req.body;
  
  const newSettings = {
    apiKey: apiKey && !apiKey.includes('...') ? apiKey : currentSettings.apiKey,
    optimizerModel: optimizerModel || currentSettings.optimizerModel,
    generatorModel: generatorModel || currentSettings.generatorModel,
    promptBlueprintSystem: promptBlueprintSystem !== undefined ? promptBlueprintSystem : currentSettings.promptBlueprintSystem,
    promptCodeSystem: promptCodeSystem !== undefined ? promptCodeSystem : currentSettings.promptCodeSystem,
    styleProfile: styleProfile !== undefined ? styleProfile : currentSettings.styleProfile
  };

  const success = writeSettings(newSettings);
  if (success) {
    res.json({
      success: true,
      apiKey: newSettings.apiKey ? `${newSettings.apiKey.slice(0, 4)}...${newSettings.apiKey.slice(-4)}` : '',
      apiKeyConfigured: !!newSettings.apiKey,
      optimizerModel: newSettings.optimizerModel,
      generatorModel: newSettings.generatorModel,
      promptBlueprintSystem: newSettings.promptBlueprintSystem || DEFAULT_BLUEPRINT_PROMPT,
      promptCodeSystem: newSettings.promptCodeSystem || DEFAULT_CODE_PROMPT,
      styleProfile: newSettings.styleProfile || 'universal_pedagogy'
    });
  } else {
    res.status(500).json({ error: 'Failed to save settings.' });
  }
});

// Scan local assignments
app.get('/api/local-assignments', (req, res) => {
  res.json(scanLocalAssignments());
});

// Import local assignment PDF
app.post('/api/import-local-assignment', async (req, res) => {
  const { filePath } = req.body;
  if (!filePath) {
    return res.status(400).json({ error: 'File path is required.' });
  }

  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk.' });
    }

    console.log(`Extracting text from PDF: ${filePath}`);
    const dataBuffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: dataBuffer });
    const result = await parser.getText();
    const text = result.text;

    if (!text || !text.trim()) {
      throw new Error('PDF has no extractable text content.');
    }

    const scanList = scanLocalAssignments();
    const match = scanList.find(item => item.filePath === filePath);
    
    const subjectName = match ? match.subjectName : 'Imported Subject';
    const unitNumber = match ? match.detectedUnit : 1;
    const assignmentTitle = match ? match.detectedTitle : path.basename(filePath, '.pdf');

    const settings = readSettings();
    const ai = getGeminiClient();
    
    const prompt = `You are an academic parser. Analyze the following assignment text and extract a list of individual questions. For each question, estimate its difficulty on a scale of 1.0 to 10.0 (1.0 is trivial, 10.0 is extremely advanced / PhD level). Also, identify the core concept/topic of the question (e.g. 'Thermodynamics: Heat engines', 'Calculus: Derivatives', 'Algorithms: Quicksort').

Assignment Text:
${text}

Return a JSON object in this exact format:
{
  "questions": [
    {
      "text": "The full question text...",
      "difficulty": 7.5,
      "concept": "Core Concept Topic"
    }
  ]
}
Do not include any other text, markdown wrapper, or explanation. Ensure the output is strictly valid JSON.`;

    const modelName = settings.optimizerModel || 'gemini-3.1-flash-lite';
    const model = ai.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: 'application/json' }
    });

    const response = await generateContentWithRetry(model, prompt);
    logTokenUsage(response);

    const resultText = response.response.text();
    const parsed = JSON.parse(resultText);

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error('Invalid parser response format');
    }

    const db = readDB();

    let subject = db.subjects.find(s => s.name.toLowerCase() === subjectName.toLowerCase());
    if (!subject) {
      subject = {
        id: `subject-${Date.now()}`,
        name: subjectName,
        units: []
      };
      db.subjects.push(subject);
    }

    let unit = subject.units.find(u => u.number === unitNumber);
    if (!unit) {
      unit = {
        id: `unit-${Date.now()}`,
        number: unitNumber,
        name: match ? match.detectedTitle : `Unit ${unitNumber}`,
        assignments: []
      };
      subject.units.push(unit);
    }

    const assignmentId = `assignment-${Date.now()}`;
    const newQuestions = parsed.questions.map((q, idx) => ({
      id: `q-${Date.now()}-${idx}`,
      text: q.text,
      difficulty: Number(q.difficulty) || 5.0,
      concept: q.concept || 'General Concept',
      status: 'pending',
      simulationFile: '',
      generationDuration: 0
    }));

    const newAssignment = {
      id: assignmentId,
      name: assignmentTitle,
      questions: newQuestions
    };

    unit.assignments.push(newAssignment);
    writeDB(db);

    res.json({ success: true, db, assignmentId });
  } catch (error) {
    console.error('Error importing local PDF assignment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Parse assignment text endpoint
app.post('/api/parse-assignment', async (req, res) => {
  const { text, subjectId, unitId, assignmentName } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Assignment text is required.' });
  }

  try {
    const settings = readSettings();
    const ai = getGeminiClient();
    
    const prompt = `You are an academic parser. Analyze the following assignment text and extract a list of individual questions. For each question, estimate its difficulty on a scale of 1.0 to 10.0 (1.0 is trivial, 10.0 is extremely advanced / PhD level). Also, identify the core concept/topic of the question (e.g. 'Thermodynamics: Heat engines', 'Calculus: Derivatives', 'Algorithms: Quicksort').

Assignment Text:
${text}

Return a JSON object in this exact format:
{
  "questions": [
    {
      "text": "The full question text...",
      "difficulty": 7.5,
      "concept": "Core Concept Topic"
    }
  ]
}
Do not include any other text, markdown wrapper, or explanation. Ensure the output is strictly valid JSON.`;

    const modelName = settings.optimizerModel || 'gemini-3.1-flash-lite';
    const model = ai.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: 'application/json' }
    });

    const response = await generateContentWithRetry(model, prompt);
    logTokenUsage(response);

    const resultText = response.response.text();
    console.log('Parse Assignment Result:', resultText);
    const parsed = JSON.parse(resultText);

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error('Invalid parser response format');
    }

    const db = readDB();
    let subject = db.subjects.find(s => s.id === subjectId);
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found.' });
    }

    let unit = subject.units.find(u => u.id === unitId);
    if (!unit) {
      return res.status(404).json({ error: 'Unit not found.' });
    }

    const assignmentId = `assignment-${Date.now()}`;
    const newQuestions = parsed.questions.map((q, idx) => ({
      id: `q-${Date.now()}-${idx}`,
      text: q.text,
      difficulty: Number(q.difficulty) || 5.0,
      concept: q.concept || 'General Concept',
      status: 'pending',
      simulationFile: '',
      generationDuration: 0
    }));

    const newAssignment = {
      id: assignmentId,
      name: assignmentName || `Assignment ${unit.assignments.length + 1}`,
      questions: newQuestions
    };

    unit.assignments.push(newAssignment);
    writeDB(db);

    res.json({ success: true, db, assignmentId });
  } catch (error) {
    console.error('Error parsing assignment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to strip markdown code fences and ensure clean self-contained HTML
const stripMarkdownFences = (code) => {
  if (!code) return '';
  let cleaned = code.trim();
  if (cleaned.startsWith('```html')) {
    cleaned = cleaned.replace(/^```html\s*/i, '');
  } else if (cleaned.startsWith('```jsx') || cleaned.startsWith('```tsx') || cleaned.startsWith('```javascript') || cleaned.startsWith('```js')) {
    cleaned = cleaned.replace(/^```(jsx|tsx|javascript|js)\s*/i, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/i, '');
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  cleaned = cleaned.trim();

  // If it's already full HTML document, return as is
  if (cleaned.toLowerCase().includes('<!doctype html>') || cleaned.toLowerCase().includes('<html')) {
    return cleaned;
  }

  // If code contains React component (import React, export default, useState, JSX)
  if (cleaned.includes('import React') || cleaned.includes('export default') || cleaned.includes('useState(') || cleaned.includes('function App')) {
    let babelCode = cleaned
      .replace(/import\s+React\s*,\s*\{([^}]+)\}\s+from\s+['"]react['"];?/g, 'const {$1} = React;')
      .replace(/import\s+React\s+from\s+['"]react['"];?/g, '')
      .replace(/import\s+.*?from\s+['"].*?['"];?/g, '')
      .replace(/export\s+default\s+function\s+([A-Za-z0-9_]+)/g, 'function $1')
      .replace(/export\s+default\s+([A-Za-z0-9_]+);?/g, '');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Interactive Engineering Simulation</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
</head>
<body class="bg-[#080a10] text-slate-100 min-h-screen overflow-x-hidden">
  <div id="root"></div>

  <script type="text/babel">
    ${babelCode}

    if (typeof App !== 'undefined') {
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(<App />);
    }
  </script>
</body>
</html>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
</head>
<body class="bg-[#080a10] text-slate-100 min-h-screen">
  ${cleaned}
</body>
</html>`;
};

// Generate simulation endpoint
app.post('/api/generate-simulation', async (req, res) => {
  const { questionId, addons } = req.body;
  if (!questionId) {
    return res.status(400).json({ error: 'Question ID is required.' });
  }

  try {
    const filePath = await generateSimulationInternal(questionId, addons);
    const updatedDb = readDB();
    res.json({ success: true, db: updatedDb, filePath });
  } catch (error) {
    console.error('Error generating simulation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Refine simulation endpoint (Canvas style refinement)
app.post('/api/refine-simulation', async (req, res) => {
  const { questionId, editPrompt } = req.body;
  if (!questionId || !editPrompt) {
    return res.status(400).json({ error: 'Question ID and edit prompt are required.' });
  }

  const db = readDB();
  let foundQuestion = null;
  for (const s of db.subjects) {
    for (const u of s.units) {
      for (const a of u.assignments) {
        for (const q of a.questions) {
          if (q.id === questionId) {
            foundQuestion = q;
            break;
          }
        }
      }
    }
  }

  if (!foundQuestion || !foundQuestion.simulationFile) {
    return res.status(404).json({ error: 'Simulation file not found for this question.' });
  }

  try {
    foundQuestion.status = 'generating';
    writeDB(db);

    const fileName = path.basename(foundQuestion.simulationFile);
    const filePath = path.join(SIM_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Simulation file ${fileName} does not exist on disk.`);
    }

    const currentHtml = fs.readFileSync(filePath, 'utf-8');

    const settings = readSettings();
    const ai = getGeminiClient();
    const generatorModel = settings.generatorModel || 'gemini-3.5-flash';

    console.log(`Refining simulation ${fileName} using ${generatorModel}...`);

    const refinePrompt = `You are a master frontend developer and UI/UX designer. You are editing an existing self-contained HTML simulation.
Here is the current HTML code of the simulation:

${currentHtml}

The user has requested the following edit/modification:
"${editPrompt}"

CRITICAL RULES:
1. Return the COMPLETE, updated HTML code. Do NOT truncate, omit, or leave placeholder comments like "// rest of the code remains the same". You must output every line of the final file.
2. Return ONLY the raw HTML. Do NOT wrap the code in markdown code fences like \`\`\`html or \`\`\$.
3. Keep all existing features (sounds, speech synthesis, sliders, play/pause, layout styles) intact unless explicitly asked to modify them.
4. Ensure the modified version has no syntax errors and runs perfectly inside an iframe.`;

    const modelInstance = ai.getGenerativeModel({ model: generatorModel });
    const response = await generateContentWithRetry(modelInstance, refinePrompt);
    logTokenUsage(response);

    let rawCode = response.response.text();
    let cleanCode = stripMarkdownFences(rawCode);

    fs.writeFileSync(filePath, cleanCode, 'utf-8');

    // Mirror updated HTML to persistent Documents backup directory
    try {
      fs.writeFileSync(path.join(BACKUP_SIM_DIR, fileName), cleanCode, 'utf-8');
    } catch (e) {
      console.error('Failed to write backup of refined simulation HTML:', e.message);
    }

    const freshDb = readDB();
    let qToUpdate = null;
    for (const s of freshDb.subjects) {
      for (const u of s.units) {
        for (const a of u.assignments) {
          for (const q of a.questions) {
            if (q.id === questionId) {
              qToUpdate = q;
              break;
            }
          }
        }
      }
    }
    if (qToUpdate) {
      qToUpdate.status = 'ready';
      writeDB(freshDb);
    }

    console.log(`Simulation ${fileName} refined successfully.`);
    res.json({ success: true, db: freshDb, filePath: foundQuestion.simulationFile });
  } catch (error) {
    console.error('Error refining simulation:', error);
    
    const freshDb = readDB();
    let qToUpdate = null;
    for (const s of freshDb.subjects) {
      for (const u of s.units) {
        for (const a of u.assignments) {
          for (const q of a.questions) {
            if (q.id === questionId) {
              qToUpdate = q;
              break;
            }
          }
        }
      }
    }
    if (qToUpdate) {
      qToUpdate.status = 'ready';
      writeDB(freshDb);
    }

    res.status(500).json({ error: error.message });
  }
});

// Add custom code simulation variant
app.post('/api/add-variant', (req, res) => {
  const { questionId, name, htmlCode } = req.body;
  if (!questionId || !name || !htmlCode) {
    return res.status(400).json({ error: 'Question ID, name, and HTML code are required.' });
  }

  try {
    const db = readDB();
    let foundQuestion = null;
    for (const s of db.subjects) {
      for (const u of s.units) {
        for (const a of u.assignments) {
          for (const q of a.questions) {
            if (q.id === questionId) {
              foundQuestion = q;
              break;
            }
          }
        }
      }
    }

    if (!foundQuestion) {
      return res.status(404).json({ error: 'Question not found.' });
    }

    const cleanCode = stripMarkdownFences(htmlCode);
    const variantId = `var-${Date.now()}`;
    const fileName = `sim-${questionId}-${variantId}.html`;
    const filePath = path.join(SIM_DIR, fileName);

    fs.writeFileSync(filePath, cleanCode, 'utf-8');

    // Save prompt text dummy file for custom copy paste so we don't crash
    const promptFileName = `sim-${questionId}-${variantId}-prompt.txt`;
    const promptFilePath = path.join(SIM_DIR, promptFileName);
    fs.writeFileSync(promptFilePath, 'Pasted custom HTML variant code (No generation prompt blueprint available).', 'utf-8');

    // Mirror copies to persistent Documents backup directory
    try {
      fs.writeFileSync(path.join(BACKUP_SIM_DIR, fileName), cleanCode, 'utf-8');
      fs.writeFileSync(path.join(BACKUP_SIM_DIR, promptFileName), 'Pasted custom HTML variant code.', 'utf-8');
    } catch (e) {
      console.error('Failed to write backups of variant assets:', e.message);
    }

    // If variants array does not exist, initialize it
    if (!foundQuestion.variants || !Array.isArray(foundQuestion.variants)) {
      foundQuestion.variants = [];
      if (foundQuestion.simulationFile) {
        foundQuestion.variants.push({
          id: 'original',
          name: 'Original',
          file: foundQuestion.simulationFile
        });
        foundQuestion.activeVariantId = 'original';
      }
    }

    const newVariant = {
      id: variantId,
      name: name.trim(),
      file: `/simulations/${fileName}`
    };

    foundQuestion.variants.push(newVariant);
    foundQuestion.activeVariantId = variantId;
    foundQuestion.simulationFile = newVariant.file;
    foundQuestion.status = 'ready';

    writeDB(db);
    res.json({ success: true, db });
  } catch (error) {
    console.error('Error adding variant:', error);
    res.status(500).json({ error: error.message });
  }
});

// Select active variant
app.post('/api/select-variant', (req, res) => {
  const { questionId, variantId } = req.body;
  if (!questionId || !variantId) {
    return res.status(400).json({ error: 'Question ID and variant ID are required.' });
  }

  try {
    const db = readDB();
    let foundQuestion = null;
    for (const s of db.subjects) {
      for (const u of s.units) {
        for (const a of u.assignments) {
          for (const q of a.questions) {
            if (q.id === questionId) {
              foundQuestion = q;
              break;
            }
          }
        }
      }
    }

    if (!foundQuestion) {
      return res.status(404).json({ error: 'Question not found.' });
    }

    if (!foundQuestion.variants || !Array.isArray(foundQuestion.variants)) {
      return res.status(400).json({ error: 'No variants configured for this question.' });
    }

    const variant = foundQuestion.variants.find(v => v.id === variantId);
    if (!variant) {
      return res.status(404).json({ error: 'Variant not found.' });
    }

    foundQuestion.activeVariantId = variantId;
    foundQuestion.simulationFile = variant.file;

    writeDB(db);
    res.json({ success: true, db });
  } catch (error) {
    console.error('Error selecting variant:', error);
    res.status(500).json({ error: error.message });
  }
});

// Breakdown a complex calculation question into N exam steps
app.post('/api/breakdown-steps', async (req, res) => {
  const { questionId } = req.body;
  if (!questionId) {
    return res.status(400).json({ error: 'Question ID is required.' });
  }

  const db = readDB();
  let foundQuestion = null;
  let foundSubject = null;
  let foundUnit = null;

  for (const s of db.subjects) {
    for (const u of s.units) {
      for (const a of u.assignments) {
        for (const q of a.questions) {
          if (q.id === questionId) {
            foundQuestion = q;
            foundSubject = s;
            foundUnit = u;
            break;
          }
        }
      }
    }
  }

  if (!foundQuestion) {
    return res.status(404).json({ error: 'Question not found.' });
  }

  try {
    const settings = readSettings();
    const ai = getGeminiClient();
    const modelName = settings.generatorModel || 'gemini-3.5-flash';

    let slidesText = '';
    try {
      if (fs.existsSync(DOWNLOADS_DIR)) {
        const courseFolders = fs.readdirSync(DOWNLOADS_DIR);
        const matchedFolder = courseFolders.find(f => f.toLowerCase().includes(foundSubject.name.toLowerCase()));
        if (matchedFolder) {
          const presDir = path.join(DOWNLOADS_DIR, matchedFolder, 'Presentation');
          const labDir = path.join(DOWNLOADS_DIR, matchedFolder, 'Lab Manual');
          
          let matchedFile = null;
          let matchedPath = '';
          const unitNumStr = String(foundUnit.number);
          const unitRegex = new RegExp(`Unit\\s*_*\\s*0*${unitNumStr}\\b`, 'i');

          if (fs.existsSync(presDir)) {
            const files = fs.readdirSync(presDir);
            matchedFile = files.find(f => unitRegex.test(f) && (f.endsWith('.pptx') || f.endsWith('.pdf')));
            if (matchedFile) matchedPath = path.join(presDir, matchedFile);
          }

          if (!matchedFile && fs.existsSync(labDir)) {
            const files = fs.readdirSync(labDir);
            matchedFile = files.find(f => unitRegex.test(f) && (f.endsWith('.pdf') || f.endsWith('.pptx')));
            if (matchedFile) matchedPath = path.join(labDir, matchedPath);
          }

          if (matchedFile && matchedPath) {
            if (matchedFile.endsWith('.pptx')) {
              const ast = await officeParser.parseOffice(matchedPath);
              slidesText = ast.toText();
            } else if (matchedFile.endsWith('.pdf')) {
              const dataBuffer = fs.readFileSync(matchedPath);
              const parser = new PDFParse({ data: dataBuffer });
              const result = await parser.getText();
              slidesText = result.text;
            }

            if (slidesText && slidesText.length > 30000) {
              slidesText = slidesText.slice(0, 30000) + '\n[Source context truncated]';
            }
          }
        }
      }
    } catch (docErr) {
      console.warn('Could not parse unit presentation or note context:', docErr.message);
    }

    const slidesContextSection = slidesText 
      ? `\n--- REFERENCED UNIT SLIDES/NOTES SOURCE CONTEXT ---\n${slidesText}\n`
      : '';

    const breakdownPrompt = `You are a master engineering professor, structural engineer, and senior academic examiner.
Your task is to analyze the following university assignment calculation / design problem:
"${foundQuestion.text}"

Subject: ${foundSubject.name}
Unit: Unit ${foundUnit.number} (${foundUnit.name})
Concept: ${foundQuestion.concept}
Assessed Difficulty: ${foundQuestion.difficulty}/10
${slidesContextSection}

CRITICAL DYNAMIC BREAKDOWN INSTRUCTIONS:
1. Carefully evaluate the complexity, depth, and mathematical steps required to solve this problem for a university exam.
2. Dynamically determine the EXACT number of steps needed based on problem complexity (do not use a default fixed count; choose 3, 4, 5, 6, 7, 8 or more steps depending on how complex the calculation is).
3. Ensure each step represents a distinct, rigorous exam calculation stage.
4. For each step, clearly state:
   - What input values/variables are needed from the previous step (or initial given data).
   - The exact equations, formulas, and calculations executed in this step.
   - The specific output values produced in this step that will transfer directly into the next step.

Return a JSON object in this exact format:
{
  "steps": [
    {
      "stepNumber": 1,
      "title": "Clear, precise step title",
      "description": "Detailed explanation of formulas, equations, inputs required from previous step, and outputs calculated for the next step.",
      "concept": "Specific sub-concept for this step"
    }
  ]
}
Do not include any markdown fences outside the JSON. Return ONLY valid JSON.`;

    console.log(`[Layer 1 - Heavy Model: ${modelName}] Decomposing problem into dynamic steps (based on difficulty ${foundQuestion.difficulty}/10 & mathematical complexity)...`);
    const model = ai.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: 'application/json' }
    });

    const response = await generateContentWithRetry(model, breakdownPrompt);
    logTokenUsage(response);

    const resultText = response.response.text();
    const parsed = JSON.parse(resultText);

    if (!parsed.steps || !Array.isArray(parsed.steps)) {
      throw new Error('Invalid breakdown response format');
    }

    const freshDb = readDB();
    let qToUpdate = null;
    for (const s of freshDb.subjects) {
      for (const u of s.units) {
        for (const a of u.assignments) {
          for (const q of a.questions) {
            if (q.id === questionId) {
              qToUpdate = q;
              break;
            }
          }
        }
      }
    }

    if (qToUpdate) {
      qToUpdate.hasSteps = true;
      qToUpdate.steps = parsed.steps.map((st, idx) => ({
        id: `step-${Date.now()}-${idx}`,
        stepNumber: st.stepNumber || (idx + 1),
        title: st.title,
        description: st.description,
        concept: st.concept || qToUpdate.concept,
        status: 'pending',
        simulationFile: ''
      }));
      qToUpdate.activeStepId = 'overview';
      writeDB(freshDb);
    }

    res.json({ success: true, db: freshDb, steps: qToUpdate ? qToUpdate.steps : [] });
  } catch (error) {
    console.error('Error breaking down question steps:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate single step simulation
app.post('/api/generate-step-simulation', async (req, res) => {
  const { questionId, stepId, addons } = req.body;
  if (!questionId || !stepId) {
    return res.status(400).json({ error: 'Question ID and Step ID are required.' });
  }

  try {
    const filePath = await generateStepSimulationInternal(questionId, stepId, addons);
    const updatedDb = readDB();
    res.json({ success: true, db: updatedDb, filePath });
  } catch (error) {
    console.error('Error generating step simulation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Auto-run all steps of a question sequentially
app.post('/api/auto-run-steps', async (req, res) => {
  const { questionId } = req.body;
  if (!questionId) {
    return res.status(400).json({ error: 'Question ID is required.' });
  }

  try {
    const db = readDB();
    let foundQuestion = null;
    for (const s of db.subjects) {
      for (const u of s.units) {
        for (const a of u.assignments) {
          for (const q of a.questions) {
            if (q.id === questionId) {
              foundQuestion = q;
              break;
            }
          }
        }
        if (!foundQuestion && u.topics) {
          const t = u.topics.find(top => top.id === questionId);
          if (t) {
            foundQuestion = t;
            break;
          }
        }
      }
    }

    if (!foundQuestion || !foundQuestion.steps) {
      return res.status(404).json({ error: 'Question or steps not found.' });
    }

    const pendingSteps = foundQuestion.steps.filter(st => st.status === 'pending' || st.status === 'failed');

    // Run sequentially in background
    (async () => {
      for (const st of pendingSteps) {
        try {
          console.log(`[Steps Queue] Generating step ${st.stepNumber} (${st.title}) for question ${questionId}`);
          await generateStepSimulationInternal(questionId, st.id, [
            "Interactive calculation controls & inputs",
            "Step-by-step exam writing format display",
            "Speech Synthesis Concept Narration voiceovers",
            "Web Audio Synth Sound Effects"
          ]);
        } catch (err) {
          console.error(`[Steps Queue] Error generating step ${st.id}:`, err.message);
        }
        await new Promise(r => setTimeout(r, 2000));
      }
    })();

    res.json({ success: true, message: 'Step auto-run started in background.', pendingCount: pendingSteps.length });
  } catch (error) {
    console.error('Error starting step auto-run:', error);
    res.status(500).json({ error: error.message });
  }
});

// Select active step of a question
app.post('/api/select-step', (req, res) => {
  const { questionId, stepId } = req.body;
  if (!questionId || !stepId) {
    return res.status(400).json({ error: 'Question ID and Step ID are required.' });
  }

  try {
    const db = readDB();
    let foundQuestion = null;
    for (const s of db.subjects) {
      for (const u of s.units) {
        for (const a of u.assignments) {
          for (const q of a.questions) {
            if (q.id === questionId) {
              foundQuestion = q;
              break;
            }
          }
        }
        if (!foundQuestion && u.topics) {
          const t = u.topics.find(top => top.id === questionId);
          if (t) {
            foundQuestion = t;
            break;
          }
        }
      }
    }

    if (!foundQuestion) {
      return res.status(404).json({ error: 'Question not found.' });
    }

    foundQuestion.activeStepId = stepId;
    writeDB(db);
    res.json({ success: true, db });
  } catch (error) {
    console.error('Error selecting step:', error);
    res.status(500).json({ error: error.message });
  }
});

// Fetch simulation prompt blueprint
app.get('/api/simulation-prompt', (req, res) => {
  const { questionId, variantId, stepId } = req.query;
  if (!questionId) {
    return res.status(400).json({ error: 'Question ID is required.' });
  }

  try {
    let promptFileName = `sim-${questionId}-prompt.txt`;
    if (stepId && stepId !== 'overview') {
      promptFileName = `sim-${questionId}-step-${stepId}-prompt.txt`;
    } else if (variantId && variantId !== 'original') {
      promptFileName = `sim-${questionId}-${variantId}-prompt.txt`;
    }
    const promptFilePath = path.join(SIM_DIR, promptFileName);

    if (fs.existsSync(promptFilePath)) {
      const prompt = fs.readFileSync(promptFilePath, 'utf-8');
      res.json({ prompt });
    } else {
      res.json({ prompt: 'No prompt blueprint available for this simulation.' });
    }
  } catch (error) {
    console.error('Error reading simulation prompt:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start background Auto-Run queue
app.post('/api/auto-run', (req, res) => {
  const { assignmentId } = req.body;
  if (!assignmentId) {
    return res.status(400).json({ error: 'Assignment ID is required.' });
  }

  if (autoRunState.isAutoRunning) {
    return res.status(400).json({ error: `Another auto-run is already in progress for assignment: ${autoRunState.activeAssignmentId}` });
  }

  try {
    const db = readDB();
    let foundAssignment = null;
    for (const s of db.subjects) {
      for (const u of s.units) {
        for (const a of u.assignments) {
          if (a.id === assignmentId) {
            foundAssignment = a;
            break;
          }
        }
      }
    }

    if (!foundAssignment) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const pendingQuestions = foundAssignment.questions.filter(
      q => q.status === 'pending' || q.status === 'failed'
    );

    if (pendingQuestions.length === 0) {
      return res.status(400).json({ error: 'All simulations in this assignment are already ready.' });
    }

    // Trigger background process (non-blocking)
    runAutoRunBackground(assignmentId, pendingQuestions);
    res.json({ success: true, message: 'Auto-run successfully started in the background.', autoRunState });
  } catch (error) {
    console.error('Error starting auto-run:', error);
    res.status(500).json({ error: error.message });
  }
});

// Fetch current auto-run status
app.get('/api/auto-run-status', (req, res) => {
  res.json(autoRunState);
});

// Cancel active auto-run queue
app.post('/api/auto-run-cancel', (req, res) => {
  if (autoRunState.isAutoRunning) {
    autoRunState.activeAssignmentId = null;
    autoRunState.isAutoRunning = false;
    autoRunState.currentQuestionId = null;
    autoRunState.estTimeRemaining = 0;
    res.json({ success: true, message: 'Auto-run canceled.' });
  } else {
    res.status(400).json({ error: 'No active auto-run to cancel.' });
  }
});

// ==========================================
// UNIT PPT & E-NOTES TOPICS SCANNER & SIMULATION ENGINE
// ==========================================

// Scan Presentation & E-Notes for Unit Topics (Ignoring Lab Manuals, Deduplicating content)
app.post('/api/scan-unit-topics', async (req, res) => {
  const { subjectId, unitId } = req.body;
  if (!subjectId || !unitId) {
    return res.status(400).json({ error: 'Subject ID and Unit ID are required.' });
  }

  const db = readDB();
  let foundSubject = db.subjects.find(s => s.id === subjectId);
  if (!foundSubject) return res.status(404).json({ error: 'Subject not found.' });

  let foundUnit = foundSubject.units.find(u => u.id === unitId);
  if (!foundUnit) return res.status(404).json({ error: 'Unit not found.' });

  try {
    const settings = readSettings();
    const ai = getGeminiClient();
    const generatorModel = settings.generatorModel || 'gemini-3.5-flash';

    let slidesText = '';
    let foundSourceFiles = [];
    if (fs.existsSync(DOWNLOADS_DIR)) {
      const courseFolders = fs.readdirSync(DOWNLOADS_DIR);
      const matchedFolder = courseFolders.find(f => f.toLowerCase().includes(foundSubject.name.toLowerCase()));
      if (matchedFolder) {
        const unitNumStr = String(foundUnit.number);
        const unitRegex = new RegExp(`Unit\\s*_*\\s*0*${unitNumStr}\\b`, 'i');

        // Search in both Presentation and E-Notes directories (ignoring Lab Manuals)
        const scanDirs = ['Presentation', 'E-Notes'];
        for (const dirName of scanDirs) {
          const dirPath = path.join(DOWNLOADS_DIR, matchedFolder, dirName);
          if (fs.existsSync(dirPath)) {
            const files = fs.readdirSync(dirPath).filter(f => unitRegex.test(f) && (f.endsWith('.pptx') || f.endsWith('.pdf')));
            for (const file of files) {
              foundSourceFiles.push(file);
              const filePath = path.join(dirPath, file);
              try {
                if (file.endsWith('.pptx')) {
                  const ast = await officeParser.parseOffice(filePath);
                  slidesText += `\n--- SOURCE FILE: ${file} ---\n` + ast.toText();
                } else if (file.endsWith('.pdf')) {
                  const dataBuffer = fs.readFileSync(filePath);
                  const parser = new PDFParse({ data: dataBuffer });
                  const result = await parser.getText();
                  slidesText += `\n--- SOURCE FILE: ${file} ---\n` + result.text;
                }
              } catch (fileErr) {
                console.warn(`Error parsing file ${file}:`, fileErr.message);
              }
            }
          }
        }
      }
    }

    if (!slidesText || slidesText.trim().length === 0) {
      return res.status(400).json({ error: `No PPT or E-Notes files found for Unit ${foundUnit.number} in Presentation or E-Notes directories.` });
    }

    // Calculate word count
    const totalWords = slidesText.trim().split(/\s+/).length;
    foundUnit.wordCount = totalWords;
    foundUnit.sourceFiles = foundSourceFiles;

    if (slidesText.length > 50000) {
      slidesText = slidesText.slice(0, 50000) + '\n[Content truncated]';
    }

    console.log(`[Unit Topics Scanner] Parsing PPT & E-Notes for Unit ${foundUnit.number} (${foundUnit.name}) - Total Words: ${totalWords}...`);

    const scanPrompt = `You are an expert engineering professor and textbook curriculum planner.
Analyze the following presentation slides and E-Notes content for Unit ${foundUnit.number} (${foundUnit.name}):

${slidesText}

CRITICAL INSTRUCTIONS:
1. DEDUPLICATE ALL INFORMATION. The source files may contain duplicate content between PPTX slides and PDF notes (e.g. PPT uploaded and saved as PDF notes). Strictly ignore all repeated topics and duplicate info!
2. Extract 5 to 10 distinct, core academic, numerical, or physical topics covered in this unit.
3. For EACH topic, extract 2 to 5 high-yield **Flashcard Info Cards** (formulas, core definitions, exam Q&A, flagged rules).
4. For each topic, assign:
   - title: Concise, professional topic title
   - concept: Core concept tag
   - description: Comprehensive summary, key equations, and exam details.
   - importanceScore: Float value from 1.0 to 10.0 representing its weight/importance on exams.
   - difficulty: Float value from 1.0 to 10.0 representing conceptual/mathematical difficulty.
   - flashcards: Array of objects [{ "id": "fc-1", "type": "formula"|"definition"|"exam_qna"|"flagged_rule", "questionOrConcept": "...", "answerOrDetails": "...", "importance": 9.0 }]

Return JSON in this exact format:
{
  "topics": [
    {
      "title": "Topic Name",
      "concept": "Concept Tag",
      "description": "Detailed summary with key equations and exam notes",
      "importanceScore": 8.5,
      "difficulty": 7.5,
      "flashcards": [
        {
          "id": "fc-1",
          "type": "formula",
          "questionOrConcept": "Torsion Stress Formula",
          "answerOrDetails": "tau = T / Zp = 16T / (pi * d^3)",
          "importance": 9.5
        }
      ]
    }
  ]
}
Return ONLY raw valid JSON.`;

    let response;
    try {
      const model = ai.getGenerativeModel({
        model: generatorModel,
        generationConfig: { responseMimeType: 'application/json' }
      });
      response = await generateContentWithRetry(model, scanPrompt);
    } catch (primaryErr) {
      console.warn(`[Unit Topics Scanner] Primary model ${generatorModel} failed (${primaryErr.message}). Falling back to gemini-3.1-flash-lite...`);
      const fallbackModel = ai.getGenerativeModel({
        model: 'gemini-3.1-flash-lite',
        generationConfig: { responseMimeType: 'application/json' }
      });
      response = await generateContentWithRetry(fallbackModel, scanPrompt);
    }
    logTokenUsage(response);

    const parsed = JSON.parse(response.response.text());
    if (!parsed.topics || !Array.isArray(parsed.topics)) {
      throw new Error('Invalid topic scan response format');
    }

    const newTopics = parsed.topics.map((t, idx) => ({
      id: `topic-${Date.now()}-${idx}`,
      title: t.title || `Topic ${idx + 1}`,
      concept: t.concept || 'General Concept',
      description: t.description || '',
      importanceScore: typeof t.importanceScore === 'number' ? Math.min(10, Math.max(1, t.importanceScore)) : 7.0,
      difficulty: typeof t.difficulty === 'number' ? Math.min(10, Math.max(1, t.difficulty)) : 5.0,
      flashcards: Array.isArray(t.flashcards) ? t.flashcards.map((fc, fIdx) => ({
        id: fc.id || `fc-${Date.now()}-${fIdx}`,
        type: fc.type || 'definition',
        questionOrConcept: fc.questionOrConcept || 'Concept Card',
        answerOrDetails: fc.answerOrDetails || '',
        importance: fc.importance || 8.0
      })) : [],
      status: 'pending'
    }));

    foundUnit.topics = newTopics;
    writeDB(db);

    res.json({ success: true, topics: newTopics, wordCount: totalWords, sourceFiles: foundSourceFiles });
  } catch (err) {
    console.error('Error scanning unit topics:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update Topic Importance Score (1.0 to 10.0 scale)
app.post('/api/update-topic-importance', (req, res) => {
  const { topicId, importanceScore } = req.body;
  if (!topicId || importanceScore === undefined) {
    return res.status(400).json({ error: 'Topic ID and importanceScore are required.' });
  }

  const db = readDB();
  let updatedTopic = null;
  for (const s of db.subjects) {
    for (const u of s.units) {
      if (u.topics) {
        for (const t of u.topics) {
          if (t.id === topicId) {
            t.importanceScore = Math.min(10, Math.max(1, parseFloat(importanceScore)));
            updatedTopic = t;
            break;
          }
        }
      }
    }
  }

  if (!updatedTopic) return res.status(404).json({ error: 'Topic not found.' });
  writeDB(db);
  res.json({ success: true, topic: updatedTopic });
});

// Generate 2-Layer Simulation for a Unit Topic
const generateTopicSimulationInternal = async (subjectId, unitId, topicId, addons) => {
  const db = readDB();
  let foundSubject = db.subjects.find(s => s.id === subjectId);
  let foundUnit = foundSubject ? foundSubject.units.find(u => u.id === unitId) : null;
  let foundTopic = foundUnit && foundUnit.topics ? foundUnit.topics.find(t => t.id === topicId) : null;

  if (!foundTopic) throw new Error('Topic not found');

  const genStart = Date.now();
  foundTopic.status = 'generating';
  writeDB(db);

  try {
    const settings = readSettings();
    const ai = getGeminiClient();

    const optimizerModel = settings.optimizerModel || 'gemini-3.1-flash-lite';
    const generatorModel = settings.generatorModel || 'gemini-3.5-flash';

    const flashcardsContext = (foundTopic.flashcards && foundTopic.flashcards.length > 0)
      ? `\n--- REVIEWED FLASHCARD INFO CARDS FOR THIS TOPIC ---\n` + foundTopic.flashcards.map(fc => `[${fc.type.toUpperCase()}] ${fc.questionOrConcept}: ${fc.answerOrDetails} (Importance: ${fc.importance}/10)`).join('\n')
      : '';

    const activeProfileKey = settings.styleProfile || 'universal_pedagogy';
    const activeProfileText = STYLE_PROFILES[activeProfileKey] || STYLE_PROFILES['universal_pedagogy'];

    const blueprintPromptTemplate = settings.promptBlueprintSystem || DEFAULT_BLUEPRINT_PROMPT;
    const stage1Prompt = `${blueprintPromptTemplate}

Active Pedagogy Style Profile:
${activeProfileText}

Target Unit Topic Details:
Topic Title: "${foundTopic.title}"
Concept: "${foundTopic.concept}"
Description & Exam Notes: "${foundTopic.description}"
Assessed Importance Weight: ${foundTopic.importanceScore}/10
Assessed Difficulty: ${foundTopic.difficulty}/10
${flashcardsContext}

CRITICAL IMPORTANCE & FLASHCARD INTERACTION WEIGHTING:
Because this topic has an Importance Rating of ${foundTopic.importanceScore}/10, ensure the interactive features are heavily weighted and creative! The simulation MUST directly address and visually demonstrate the reviewed Flashcard Info Cards above.
Include these requested interaction modules:
${addons && addons.length > 0 ? addons.map(a => `- ${a}`).join('\n') : '- Interactive Sliders & Input Panel\n- 2D Canvas / Vector Graphics\n- Drag & Drop object placement\n- Real-time Equation Graphing\n- Speech Synthesis Voiceover Narrative\n- Web Audio Synth SFX\n- Tutorial Overlay Modal\n- Camera Enable / AR Canvas Mode\n- Voice Microphone Control'}

Output a very comprehensive, detailed, and long simulation blueprint instructions for the code compiler (between 800 to 1200 words). Explicitly detail step-by-step logic, if-else conditional branches, parameter controls, sound formulas, and SVG/Canvas drawing coordinates.`;

    console.log(`[Topic Sim - Layer 1: ${optimizerModel}] Expanding prompt for Topic "${foundTopic.title}" (Importance: ${foundTopic.importanceScore}/10)...`);
    const optModelInstance = ai.getGenerativeModel({ model: optimizerModel });
    const stage1Resp = await generateContentWithRetry(optModelInstance, stage1Prompt);
    logTokenUsage(stage1Resp);
    const optimizedPrompt = stage1Resp.response.text();

    console.log(`[Topic Sim - Layer 2: ${generatorModel}] Coding simulation for Topic "${foundTopic.title}"...`);
    const codeSystemPromptTemplate = settings.promptCodeSystem || DEFAULT_CODE_PROMPT;
    const stage2SystemPrompt = `${codeSystemPromptTemplate}

BLUEPRINT:
${optimizedPrompt}`;

    const genModelInstance = ai.getGenerativeModel({ model: generatorModel });
    const stage2Resp = await generateContentWithRetry(genModelInstance, stage2SystemPrompt);
    logTokenUsage(stage2Resp);

    let cleanCode = stripMarkdownFences(stage2Resp.response.text());
    const fileName = `sim-topic-${topicId}.html`;
    const filePath = path.join(SIM_DIR, fileName);
    fs.writeFileSync(filePath, cleanCode, 'utf-8');
    try { fs.writeFileSync(path.join(BACKUP_SIM_DIR, fileName), cleanCode, 'utf-8'); } catch (e) {}

    const freshDb = readDB();
    for (const s of freshDb.subjects) {
      for (const u of s.units) {
        if (u.topics) {
          const t = u.topics.find(top => top.id === topicId);
          if (t) {
            t.status = 'ready';
            t.simulationFile = `/simulations/${fileName}`;
            t.generationDuration = Math.round((Date.now() - genStart) / 1000);
            break;
          }
        }
      }
    }
    writeDB(freshDb);
    return `/simulations/${fileName}`;
  } catch (err) {
    const errDb = readDB();
    for (const s of errDb.subjects) {
      for (const u of s.units) {
        if (u.topics) {
          const t = u.topics.find(top => top.id === topicId);
          if (t) { t.status = 'failed'; break; }
        }
      }
    }
    writeDB(errDb);
    throw err;
  }
};

// Endpoint for Topic Simulation Generation
app.post('/api/generate-topic-simulation', async (req, res) => {
  const { subjectId, unitId, topicId, addons } = req.body;
  try {
    const simFile = await generateTopicSimulationInternal(subjectId, unitId, topicId, addons);
    res.json({ success: true, simulationFile: simFile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Breakdown a Topic into Multi-Step Exam Breakdown (3-Layer Pipeline)
app.post('/api/breakdown-topic-steps', async (req, res) => {
  const { subjectId, unitId, topicId } = req.body;
  const db = readDB();
  let foundSubject = db.subjects.find(s => s.id === subjectId);
  let foundUnit = foundSubject ? foundSubject.units.find(u => u.id === unitId) : null;
  let foundTopic = foundUnit && foundUnit.topics ? foundUnit.topics.find(t => t.id === topicId) : null;

  if (!foundTopic) return res.status(404).json({ error: 'Topic not found.' });

  try {
    const settings = readSettings();
    const ai = getGeminiClient();
    const generatorModel = settings.generatorModel || 'gemini-3.5-flash';

    console.log(`[Topic Breakdown - Layer 1: ${generatorModel}] Decomposing topic "${foundTopic.title}" (Difficulty: ${foundTopic.difficulty}/10)...`);

    const breakdownPrompt = `You are a senior academic professor and textbook author.
Decompose the following Unit Topic into the exact, sequential step-by-step procedure required for university exams:

Topic Title: "${foundTopic.title}"
Concept: "${foundTopic.concept}"
Description: "${foundTopic.description}"
Assessed Difficulty: ${foundTopic.difficulty}/10

CRITICAL DYNAMIC BREAKDOWN INSTRUCTIONS:
1. Dynamically evaluate topic complexity and determine the EXACT number of steps needed (choose 3, 4, 5, 6, 7, 8 or more steps).
2. For each step, clearly specify:
   - Inputs needed from previous step (or given initial values).
   - Core mathematical formulas and calculations.
   - Outputs calculated for the next step.

Return JSON in format:
{
  "steps": [
    {
      "stepNumber": 1,
      "title": "Step Title",
      "description": "Formulas, inputs required from previous step, and calculated outputs for next step.",
      "concept": "Sub-concept tag"
    }
  ]
}
Return ONLY valid JSON.`;

    const model = ai.getGenerativeModel({
      model: generatorModel,
      generationConfig: { responseMimeType: 'application/json' }
    });

    const response = await generateContentWithRetry(model, breakdownPrompt);
    logTokenUsage(response);

    const parsed = JSON.parse(response.response.text());
    if (!parsed.steps || !Array.isArray(parsed.steps)) throw new Error('Invalid topic steps format');

    foundTopic.hasSteps = true;
    foundTopic.activeStepId = 'overview';
    foundTopic.steps = parsed.steps.map((st, idx) => ({
      id: `topic-step-${Date.now()}-${idx}`,
      stepNumber: st.stepNumber || (idx + 1),
      title: st.title || `Step ${idx + 1}`,
      description: st.description || '',
      concept: st.concept || foundTopic.concept,
      status: 'pending'
    }));

    writeDB(db);
    res.json({ success: true, steps: foundTopic.steps });
  } catch (err) {
    console.error('Error breaking down topic steps:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start background Topic Auto-Run queue
app.post('/api/auto-run-topics', (req, res) => {
  const { subjectId, unitId } = req.body;
  if (!subjectId || !unitId) {
    return res.status(400).json({ error: 'Subject ID and Unit ID are required.' });
  }

  if (topicAutoRunState.isAutoRunning) {
    return res.status(400).json({ error: `Another topic auto-run is already in progress for unit: ${topicAutoRunState.activeUnitId}` });
  }

  try {
    const db = readDB();
    let foundSubject = db.subjects.find(s => s.id === subjectId);
    let foundUnit = foundSubject ? foundSubject.units.find(u => u.id === unitId) : null;

    if (!foundUnit) {
      return res.status(404).json({ error: 'Unit not found.' });
    }

    if (!foundUnit.topics || foundUnit.topics.length === 0) {
      return res.status(400).json({ error: 'No topics scanned for this unit yet.' });
    }

    const pendingTopics = foundUnit.topics.filter(
      t => t.status === 'pending' || t.status === 'failed'
    );

    if (pendingTopics.length === 0) {
      return res.status(400).json({ error: 'All topic simulations in this unit are already ready.' });
    }

    runTopicAutoRunBackground(subjectId, unitId, pendingTopics);
    res.json({ success: true, message: 'Topic auto-run started in background.', topicAutoRunState });
  } catch (error) {
    console.error('Error starting topic auto-run:', error);
    res.status(500).json({ error: error.message });
  }
});

// Fetch current topic auto-run status
app.get('/api/auto-run-topics-status', (req, res) => {
  res.json(topicAutoRunState);
});

// Cancel active topic auto-run queue
app.post('/api/auto-run-topics-cancel', (req, res) => {
  if (topicAutoRunState.isAutoRunning) {
    topicAutoRunState.activeUnitId = null;
    topicAutoRunState.isAutoRunning = false;
    topicAutoRunState.currentTopicId = null;
    topicAutoRunState.estTimeRemaining = 0;
    res.json({ success: true, message: 'Topic auto-run canceled.' });
  } else {
    res.status(400).json({ error: 'No active topic auto-run to cancel.' });
  }
});

// Generate interactive simulation from selected text highlight
app.post('/api/generate-from-selection', async (req, res) => {
  const { questionId, selectedText, suggestion } = req.body;
  if (!questionId || !selectedText) {
    return res.status(400).json({ error: 'Question ID and selected text are required.' });
  }

  try {
    const db = readDB();
    let foundQuestion = null;
    for (const s of db.subjects) {
      for (const u of s.units) {
        for (const a of u.assignments) {
          for (const q of a.questions) {
            if (q.id === questionId) { foundQuestion = q; break; }
          }
        }
        if (!foundQuestion && u.topics) {
          const t = u.topics.find(top => top.id === questionId);
          if (t) {
            foundQuestion = {
              id: t.id,
              text: `[Unit Topic] ${t.title}: ${t.description}`,
              concept: t.concept,
              difficulty: t.difficulty,
              variants: t.variants,
              status: t.status
            };
            break;
          }
        }
      }
    }

    if (!foundQuestion) {
      return res.status(404).json({ error: 'Question or Topic not found.' });
    }

    const settings = readSettings();
    const ai = getGeminiClient();
    const optimizerModel = settings.optimizerModel || 'gemini-3.1-flash-lite';
    const generatorModel = settings.generatorModel || 'gemini-3.5-flash';

    console.log(`[Selection Sim - Layer 1: ${optimizerModel}] Expanding prompt for highlight "${selectedText.slice(0, 30)}..."`);
    const stage1Prompt = `You are a prompt engineer. Build an interactive educational simulation prompt blueprint based on the following highlighted text/concept from an engineering assignment:
"${selectedText}"

User focus request: "${suggestion || 'Build an interactive dashboard showing this concept'}"

Output ONLY instructions prompt text.`;

    const optInstance = ai.getGenerativeModel({ model: optimizerModel });
    const stage1Resp = await generateContentWithRetry(optInstance, stage1Prompt);
    logTokenUsage(stage1Resp);
    const blueprint = stage1Resp.response.text();

    console.log(`[Selection Sim - Layer 2: ${generatorModel}] Coding simulation...`);
    const stage2Prompt = `You are a frontend developer. Build a self-contained single-file HTML/JS simulation based on the instructions blueprint provided:
${blueprint}

Return ONLY the raw HTML code. Do NOT wrap in markdown fences.`;

    const genInstance = ai.getGenerativeModel({ model: generatorModel });
    const stage2Resp = await generateContentWithRetry(genInstance, stage2Prompt);
    logTokenUsage(stage2Resp);

    let cleanCode = stripMarkdownFences(stage2Resp.response.text());
    const variantId = `selection-var-${Date.now()}`;
    const fileName = `sim-selection-${variantId}.html`;
    const filePath = path.join(SIM_DIR, fileName);
    fs.writeFileSync(filePath, cleanCode, 'utf-8');
    try { fs.writeFileSync(path.join(BACKUP_SIM_DIR, fileName), cleanCode, 'utf-8'); } catch (e) {}

    // Save prompt blueprint
    const promptFileName = `sim-${questionId}-${variantId}-prompt.txt`;
    fs.writeFileSync(path.join(SIM_DIR, promptFileName), blueprint, 'utf-8');
    try { fs.writeFileSync(path.join(BACKUP_SIM_DIR, promptFileName), blueprint, 'utf-8'); } catch (e) {}

    // Save as new variant to the DB
    const freshDb = readDB();
    let qToUpdate = null;
    for (const s of freshDb.subjects) {
      for (const u of s.units) {
        for (const a of u.assignments) {
          for (const q of a.questions) {
            if (q.id === questionId) { qToUpdate = q; break; }
          }
        }
        if (!qToUpdate && u.topics) {
          const t = u.topics.find(top => top.id === questionId);
          if (t) { qToUpdate = t; break; }
        }
      }
    }

    if (qToUpdate) {
      if (!qToUpdate.variants) qToUpdate.variants = [];
      const newVarName = suggestion ? `Highlight: ${suggestion.slice(0, 20)}` : `Highlight Sim #${qToUpdate.variants.length + 1}`;
      const newVar = {
        id: variantId,
        name: newVarName,
        file: `/simulations/${fileName}`
      };
      qToUpdate.variants.push(newVar);
      qToUpdate.activeVariantId = variantId;
      qToUpdate.simulationFile = newVar.file;
      qToUpdate.status = 'ready';
      writeDB(freshDb);
    }

    res.json({ success: true, db: freshDb, filePath: `/simulations/${fileName}` });
  } catch (error) {
    console.error('Error generating simulation from selection:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate polished SVG diagrams for highlighted textbook selections
app.post('/api/generate-svg', async (req, res) => {
  const { selectedText } = req.body;
  if (!selectedText) {
    return res.status(400).json({ error: 'Selected text is required.' });
  }

  try {
    const settings = readSettings();
    const ai = getGeminiClient();
    const generatorModel = settings.generatorModel || 'gemini-3.5-flash';

    console.log(`[SVG Gen: ${generatorModel}] Generating interactive diagram for "${selectedText.slice(0, 30)}..."`);
    const prompt = `You are a professional technical designer and structural graphics artist.
Generate an advanced, highly polished vector SVG diagram/flowchart visually representing the following concept or equation:
"${selectedText}"

DESIGN GUIDELINES:
1. Ensure the diagram has a dark glassmorphism aesthetic: glowing lines, subtle drop-shadows, modern layout, clean typography.
2. It should be fully responsive (use viewBox="0 0 500 300" and width="100%").
3. Use a futuristic cyber-engineering color scheme: neon cyan (#00f2fe), vibrant purple (#a855f7), neon green (#22c55e), dark background translucent plates.
4. If it's a structural formula (e.g. RCC beam stress, steel sections), draw a beautiful schematic showing the stress distribution diagram or cross-section.
5. Return ONLY valid raw SVG markup code, starting with <svg> and ending with </svg>. Do not wrap the output in markdown code fences or HTML wrapper.`;

    const modelInstance = ai.getGenerativeModel({ model: generatorModel });
    const response = await generateContentWithRetry(modelInstance, prompt);
    logTokenUsage(response);

    let cleanSvg = response.response.text().trim();
    if (cleanSvg.includes('```')) {
      cleanSvg = cleanSvg.replace(/```xml/g, '').replace(/```html/g, '').replace(/```svg/g, '').replace(/```/g, '').trim();
    }
    if (!cleanSvg.startsWith('<svg')) {
      const idx = cleanSvg.indexOf('<svg');
      if (idx !== -1) {
        cleanSvg = cleanSvg.slice(idx);
      }
    }

    res.json({ success: true, svg: cleanSvg });
  } catch (error) {
    console.error('Error generating SVG:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save query comments endpoint
app.post('/api/save-comment', (req, res) => {
  const { sourceId, sourceType, comments } = req.body;
  if (!sourceId || !sourceType) {
    return res.status(400).json({ error: 'sourceId and sourceType are required.' });
  }

  const db = readDB();
  let updated = false;

  if (sourceType === 'question') {
    for (const s of db.subjects) {
      for (const u of s.units) {
        for (const a of u.assignments) {
          for (const q of a.questions) {
            if (q.id === sourceId) {
              q.comments = comments;
              updated = true;
              break;
            }
          }
          if (updated) break;
        }
        if (updated) break;
      }
      if (updated) break;
    }
  } else if (sourceType === 'topic') {
    for (const s of db.subjects) {
      for (const u of s.units) {
        if (u.topics) {
          const t = u.topics.find(top => top.id === sourceId);
          if (t) {
            t.comments = comments;
            updated = true;
            break;
          }
        }
      }
      if (updated) break;
    }
  }

  if (updated) {
    writeDB(db);
    res.json({ success: true, db });
  } else {
    res.status(404).json({ error: 'Source item not found.' });
  }
});

// Add to FSRS spaced repetition scheduler
app.post('/api/fsrs/add', (req, res) => {
  const { queryText, concept, sourceType, sourceId, subjectId, unitId } = req.body;
  if (!queryText || !concept || !sourceId) {
    return res.status(400).json({ error: 'queryText, concept, and sourceId are required.' });
  }

  const db = readDB();
  if (!db.fsrsItems) db.fsrsItems = [];

  // Check if it already exists
  let item = db.fsrsItems.find(i => i.sourceId === sourceId);
  if (item) {
    item.queryText = queryText;
    item.concept = concept;
  } else {
    item = {
      id: `fsrs-item-${Date.now()}`,
      queryText,
      concept,
      sourceType: sourceType || 'custom',
      sourceId,
      subjectId: subjectId || '',
      unitId: unitId || '',
      createdAt: new Date().toISOString(),
      reviewCount: 0,
      difficultyRating: 5,
      nextReviewDate: new Date().toISOString(),
      intervalDays: 0,
      status: 'pending'
    };
    db.fsrsItems.push(item);
  }

  writeDB(db);
  res.json({ success: true, db, item });
});

// Rate FSRS card and reschedule review date using scientific memory stability & difficulty
app.post('/api/fsrs/rate', (req, res) => {
  const { itemId, rating } = req.body;
  if (!itemId || rating === undefined) {
    return res.status(400).json({ error: 'itemId and rating are required.' });
  }

  const db = readDB();
  if (!db.fsrsItems) db.fsrsItems = [];

  const item = db.fsrsItems.find(i => i.id === itemId);
  if (!item) {
    return res.status(404).json({ error: 'FSRS Item not found.' });
  }

  const R = Number(rating);
  item.reviewCount += 1;
  item.difficultyRating = R;
  item.lastQuizScore = R;

  // Initialize scientific FSRS parameters
  item.stability = item.stability || 1.0;
  item.difficulty = item.difficulty || 5.0;

  // Map 1-10 rating scale to 4-point recall grade: Again(1), Hard(2), Good(3), Easy(4)
  let G = 3;
  if (R <= 3) G = 1;
  else if (R <= 5) G = 2;
  else if (R <= 8) G = 3;
  else G = 4;

  // 1. Update Difficulty (D)
  item.difficulty = Math.max(1.0, Math.min(10.0, item.difficulty - 0.2 * (G - 3)));

  // 2. Update Stability (S)
  if (G === 1) {
    item.stability = 0.5; // Reset stability on recall failure
  } else {
    const multiplier = 1 + (G - 2) * 0.6 + (10 - item.difficulty) * 0.08;
    item.stability = Math.max(1.0, item.stability * multiplier);
  }

  // 3. Compute next interval
  const days = Math.max(1, Math.round(item.stability));
  item.intervalDays = Math.min(365, days);
  item.nextReviewDate = new Date(Date.now() + item.intervalDays * 24 * 60 * 60 * 1000).toISOString();

  writeDB(db);
  res.json({ success: true, db });
});

function getSourceContextForItem(item, db) {
  let contextParts = [];
  if (!db || !db.subjects) return '';

  const subject = db.subjects.find(s => s.id === item.subjectId);
  if (subject) {
    contextParts.push(`Subject: ${subject.name}`);
    const unit = subject.units.find(u => u.id === item.unitId);
    if (unit) {
      contextParts.push(`Unit ${unit.number}: ${unit.name}`);
      
      if (item.sourceType === 'topic' && unit.topics) {
        const topic = unit.topics.find(t => t.id === item.sourceId);
        if (topic) {
          contextParts.push(`Topic Title: ${topic.title}`);
          if (topic.description) contextParts.push(`Source Note / Summary: ${topic.description}`);
        }
      } else if (item.sourceType === 'question') {
        for (const a of unit.assignments) {
          const q = a.questions.find(q => q.id === item.sourceId);
          if (q) {
            contextParts.push(`Assignment Question Source: ${q.questionText}`);
            break;
          }
        }
      }

      if (unit.sourceFiles && unit.sourceFiles.length > 0) {
        contextParts.push(`Source Material References (PPTs / E-Notes): ${unit.sourceFiles.join(', ')}`);
      }
    }
  }

  return contextParts.join('\n');
}

// Helper to extract text from PDF or Office files
async function extractTextFromFile(filePath) {
  if (filePath.toLowerCase().endsWith('.pdf')) {
    const dataBuffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: dataBuffer });
    const result = await parser.getText();
    return result.text || '';
  } else {
    const ast = await officeParser.parseOffice(filePath);
    if (ast && typeof ast.toText === 'function') {
      return ast.toText();
    }
    return (ast || '').toString();
  }
}

// Generate 30 MCQs from Selected Course Material File
app.post('/api/fsrs/generate-30-mcqs', async (req, res) => {
  const { filePath, model } = req.body;
  if (!filePath) {
    return res.status(400).json({ error: 'File path is required.' });
  }

  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk.' });
    }

    console.log(`Extracting text from material file for MCQ generation: ${filePath}`);
    const text = await extractTextFromFile(filePath);

    if (!text || !text.trim()) {
      throw new Error('Material file has no extractable text content.');
    }

    // Try finding the subject, unit, assignment mappings based on the filepath
    const scanList = scanLocalAssignments();
    const match = scanList.find(item => item.filePath === filePath);
    
    const db = readDB();
    if (!db.subjects) db.subjects = [];
    
    let subjectName = match ? match.subjectName : 'Imported Subject';
    let unitNumber = match ? match.detectedUnit : 1;
    let assignmentTitle = match ? match.detectedTitle : path.basename(filePath, path.extname(filePath));

    // Find/Create Subject
    let subject = db.subjects.find(s => s.name.toLowerCase() === subjectName.toLowerCase());
    if (!subject) {
      subject = { id: `subj-${Date.now()}`, name: subjectName, units: [] };
      db.subjects.push(subject);
    }

    // Find/Create Unit
    let unit = subject.units.find(u => u.number === unitNumber);
    if (!unit) {
      unit = { id: `unit-${Date.now()}`, number: unitNumber, name: `Unit ${unitNumber}`, assignments: [] };
      subject.units.push(unit);
    }

    // Find/Create Assignment
    let assignment = unit.assignments.find(a => a.name.toLowerCase() === assignmentTitle.toLowerCase());
    if (!assignment) {
      assignment = { id: `assign-${Date.now()}`, name: assignmentTitle, questions: [] };
      unit.assignments.push(assignment);
    }

    const activeSettings = readSettings();
    const activeApiKey = activeSettings.apiKey || process.env.GEMINI_API_KEY || '';
    if (!activeApiKey) {
      return res.status(400).json({ error: 'Gemini API Key is not set in settings or env.' });
    }

    const localAi = new GoogleGenerativeAI(activeApiKey);
    const modelName = model || activeSettings.optimizerModel || 'gemini-3.5-flash';
    const modelInstance = localAi.getGenerativeModel({ model: modelName });

    const systemPrompt = `You are a Senior Engineering Professor and Curriculum Specialist.
Based on the following syllabus/material text, generate exactly 30 high-fidelity Multiple Choice Questions (MCQs) for student assessment and spaced repetition.

Guidelines:
1. Cover the key engineering concepts, formulas, and calculations mentioned in the text.
2. For each MCQ, provide 4 options (A, B, C, D) and a 0-indexed correct option (0=A, 1=B, 2=C, 3=D).
3. Ensure the incorrect options are realistic engineering mistakes (e.g. inverted equations, missing scale factors).
4. Provide a thorough, concise explanation for why the correct option is right and the others are wrong.
5. Identify a targeted concept label (e.g. 'Shear capacity', 'Euler buckling', etc.) for each question.

Format your response as a JSON object with a single "mcqs" key containing an array of exactly 30 objects:
{
  "mcqs": [
    {
      "question": "A steel beam of span 6m...",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correctIndex": 2,
      "explanation": "Brief step-by-step math explanation...",
      "targetedConcept": "Euler Buckling"
    }
  ]
}

Ensure your response is valid JSON. Do not include markdown code blocks or backticks.`;

    const resultAI = await modelInstance.generateContent([
      systemPrompt,
      `Material Text:\n${text.slice(0, 45000)}`
    ]);
    const aiText = resultAI.response.text();
    // Parse the JSON output
    const cleanJsonText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanJsonText);

    if (!parsedData.mcqs || !Array.isArray(parsedData.mcqs)) {
      throw new Error('AI response did not return an array of MCQs.');
    }

    if (!db.fsrsItems) db.fsrsItems = [];

    const newFsrsItems = parsedData.mcqs.map((mcq, idx) => {
      const id = `fsrs-mcq-${Date.now()}-${idx}`;
      return {
        id,
        queryText: mcq.question,
        concept: mcq.targetedConcept || 'MCQ Concept',
        sourceType: 'mcq',
        sourceId: assignment.id,
        subjectId: subject.id,
        unitId: unit.id,
        assignmentId: assignment.id,
        createdAt: new Date().toISOString(),
        reviewCount: 0,
        difficultyRating: 5.0,
        nextReviewDate: new Date().toISOString(),
        intervalDays: 0,
        stability: 1.0,
        difficulty: 5.0,
        status: 'pending',
        variants: [],
        mcqQuestion: mcq.question,
        mcqOptions: mcq.options,
        mcqCorrectIndex: mcq.correctIndex,
        mcqExplanation: mcq.explanation
      };
    });

    db.fsrsItems.push(...newFsrsItems);
    writeDB(db);

    res.json({
      success: true,
      message: `Successfully generated and saved ${newFsrsItems.length} MCQs in the FSRS deck under assignment "${assignmentTitle}".`,
      count: newFsrsItems.length,
      db
    });
  } catch (err) {
    console.error('Error generating MCQs:', err);
    res.status(500).json({ error: `Failed to generate MCQs: ${err.message}` });
  }
});

// Generate dynamic simulation for FSRS Query Concept
app.post('/api/fsrs/generate', async (req, res) => {
  const { itemId } = req.body;
  if (!itemId) {
    return res.status(400).json({ error: 'itemId is required.' });
  }

  const db = readDB();
  if (!db.fsrsItems) db.fsrsItems = [];
  const item = db.fsrsItems.find(i => i.id === itemId);

  if (!item) {
    return res.status(404).json({ error: 'FSRS Item not found.' });
  }

  item.status = 'generating';
  writeDB(db);

  try {
    const settings = readSettings();
    const ai = getGeminiClient();
    const optimizerModel = settings.optimizerModel || 'gemini-3.1-flash-lite';
    const generatorModel = settings.generatorModel || 'gemini-3.5-flash';
    const activeProfileKey = settings.styleProfile || 'universal_pedagogy';
    const activeProfileText = STYLE_PROFILES[activeProfileKey] || STYLE_PROFILES['universal_pedagogy'];
    const sourceContext = getSourceContextForItem(item, db);

    const weaknessFocusPrompt = item.weakConcepts && item.weakConcepts.length > 0
      ? `\n🎯 TARGETED WEAKNESS ADAPTATION (CRITICAL):
The student previously scored low on these specific micro-concepts during their diagnostic test:
[ ${item.weakConcepts.join(', ')} ]
You MUST design this simulation blueprint to explicitly target, highlight, color-code, and provide interactive slot puzzles for these exact weak areas so the student masters them!`
      : '';

    let stage1Prompt = '';
    let stage2Prompt = '';

    if (item.sourceType === 'mcq') {
      console.log(`[FSRS MCQ Gen - Layer 1: ${optimizerModel}] Expanding MCQ interactive simulation blueprint for "${item.queryText.slice(0, 30)}..."`);
      stage1Prompt = `You are a World-Class Engineering Pedagogy & Interactive Simulation Architect.
Create a high-fidelity interactive simulation blueprint for this Multiple Choice Question (MCQ).

MCQ QUESTION:
"${item.mcqQuestion}"

OPTIONS:
- Option A: ${item.mcqOptions[0]}
- Option B: ${item.mcqOptions[1]}
- Option C: ${item.mcqOptions[2]}
- Option D: ${item.mcqOptions[3]}

TARGETED CONCEPT: "${item.concept}"

Pedagogy Style Guidelines:
${activeProfileText}

INSTRUCTIONS FOR THE COMPILER BLUEPRINT:
1. Design a gorgeous, premium, dark cyber-themed HTML5 canvas or SVG interactive graphic that represents the exact mechanical, structural, or mathematical scenario described in the question.
2. Make the simulation interactive! Let the user change variables related to the question context using interactive sliders or clicking points on the screen, illustrating how the system behaves.
3. Keep correct answer secrets hidden. The user must decide which option is correct by clicking A, B, C, or D. Do NOT show green/red success states or validation inside the simulation itself. The host application handles validation.
4. Render the question text and option selection buttons (A, B, C, D) directly inside the canvas container or sidebar of the single-page HTML.
5. Dynamic Option Shuffling support: Add a window event listener for 'init-mcq-options'. When this message is received from the parent window, it contains an array of shuffled options: [{ text: string, originalIndex: number }]. The simulation must dynamically update its A, B, C, D buttons to display these text options. When a button is clicked, it must send the originalIndex of that choice:
   window.parent.postMessage({
     type: 'mcq-selected',
     optionIndex: originalIndex // (originalIndex value from the init message)
   }, '*');
6. Include a Read/Listen (🔊) button that reads out the question and the active option texts using window.speechSynthesis.

Provide a very detailed, comprehensive 800-1200 word blueprint describing the interactive graphic layout, styling details, button layouts, postMessage triggers, and canvas coordinates.`;
    } else {
      console.log(`[FSRS Gen - Layer 1: ${optimizerModel}] Expanding high-fidelity blueprint for query "${item.queryText.slice(0, 30)}..."`);
      stage1Prompt = `You are a World-Class Engineering Pedagogy & Interactive Simulation Architect.
Create a high-fidelity interactive simulation blueprint to help a student master this specific concept.

TARGET STUDY QUERY / CONCEPT: "${item.queryText}"
CONCEPT DOMAIN: "${item.concept}"

SOURCE MATERIAL CONTEXT (PPT / E-NOTES / ASSIGNMENTS):
${sourceContext || 'No additional source material.'}

Pedagogy Style Guidelines:
${activeProfileText}
${weaknessFocusPrompt}

REQUIREMENTS FOR BLUEPRINT:
- Incorporate exact engineering formulas, parameters, and mechanisms from the source material.
- Design a high-fidelity 2D/3D interactive visual canvas (HTML5 Canvas / SVG).
- Include real-time interactive sliders, parameter controls, and live math calculations.
- Include visual indicators like stress heatmaps, vector arrows, or intermediate value streams.
- Provide step-by-step explanatory notes with audio/speech synthesis narrations.

Output a very comprehensive, detailed, and long simulation blueprint instructions for the code compiler (between 800 to 1200 words). Explicitly detail step-by-step logic, if-else conditional branches, parameter controls, sound formulas, and SVG/Canvas drawing coordinates.`;
    }

    const optInstance = ai.getGenerativeModel({ model: optimizerModel });
    const stage1Resp = await generateContentWithRetry(optInstance, stage1Prompt, 15);
    logTokenUsage(stage1Resp);
    const blueprint = stage1Resp.response.text();

    console.log(`[FSRS Gen - Layer 2: ${generatorModel}] Compiling high-fidelity simulation HTML...`);
    if (item.sourceType === 'mcq') {
      stage2Prompt = `You are an Expert Web Developer & Interactive Canvas Compiler.
Compile a complete, high-fidelity, single-file HTML/JS/CSS interactive simulation for this MCQ question based on this blueprint.

SIMULATION BLUEPRINT:
${blueprint}

REQUIREMENTS:
- Return ONLY valid executable HTML code (with embedded CSS and JS).
- Do NOT wrap in markdown code fences (\`\`\`html).
- Build a responsive dark cyber-themed UI with smooth canvas animations, interactive controls, and bulletproof speech synthesis.
- Option Buttons: Support option text initialization from the parent. Add a window event listener for 'init-mcq-options' receiving an array of options. Dynamically display these texts on the option buttons. When a button is clicked, post the chosen option's originalIndex back to the parent:
  window.parent.postMessage({ type: 'mcq-selected', optionIndex: originalIndex }, '*')
- Do NOT include any secret answers or validation logic in the code.`;
    } else {
      stage2Prompt = `You are an Expert Web Developer & Interactive Canvas Compiler.
Compile a complete, high-fidelity, single-file HTML/JS/CSS interactive simulation based on this blueprint.

SIMULATION BLUEPRINT:
${blueprint}

REQUIREMENTS:
- Return ONLY valid executable HTML code (with embedded CSS and JS).
- Do NOT wrap in markdown code fences (\`\`\`html).
- Build a responsive dark cyber-themed UI with smooth canvas animations, interactive controls, live math calculations, and bulletproof speech synthesis.`;
    }

    let stage2Resp;
    try {
      const genInstance = ai.getGenerativeModel({ model: generatorModel });
      stage2Resp = await generateContentWithRetry(genInstance, stage2Prompt, 3);
    } catch (e) {
      console.warn(`[FSRS Gen] ${generatorModel} rate limited. Falling back to gemini-3.1-flash-lite...`);
      const fallbackInstance = ai.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
      stage2Resp = await generateContentWithRetry(fallbackInstance, stage2Prompt, 5);
    }
    logTokenUsage(stage2Resp);

    let cleanCode = stripMarkdownFences(stage2Resp.response.text());
    const timestamp = Date.now();
    const fileName = `sim-fsrs-${item.id}-${timestamp}.html`;
    const filePath = path.join(SIM_DIR, fileName);
    fs.writeFileSync(filePath, cleanCode, 'utf-8');
    try { fs.writeFileSync(path.join(BACKUP_SIM_DIR, fileName), cleanCode, 'utf-8'); } catch (e) {}

    const freshDb = readDB();
    const freshItem = freshDb.fsrsItems.find(i => i.id === itemId);
    if (freshItem) {
      freshItem.status = 'ready';
      if (!freshItem.variants) freshItem.variants = [];
      if (freshItem.simulationFile && !freshItem.variants.some(v => v.file === freshItem.simulationFile)) {
        freshItem.variants.unshift({ id: `var-orig-${freshItem.id}`, name: 'Variant 1 (Original)', file: freshItem.simulationFile });
      }

      const variantNum = freshItem.variants.length + 1;
      const newVariant = {
        id: `var-${timestamp}`,
        name: `Variant ${variantNum} (Adaptive #${freshItem.reviewCount || 1})`,
        file: `/simulations/${fileName}`
      };
      freshItem.variants.push(newVariant);
      freshItem.activeVariantId = newVariant.id;
      freshItem.simulationFile = `/simulations/${fileName}`;
      freshItem.styleProfileUsed = activeProfileKey;
      writeDB(freshDb);
    }

    res.json({ success: true, db: freshDb, filePath: `/simulations/${fileName}` });
  } catch (error) {
    console.error('Error generating FSRS simulation:', error);
    const freshDb = readDB();
    const freshItem = freshDb.fsrsItems.find(i => i.id === itemId);
    if (freshItem) {
      freshItem.status = 'failed';
      writeDB(freshDb);
    }
    res.status(500).json({ error: error.message });
  }
});

// Save Custom HTML Simulation Code as a Named Variant
app.post('/api/save-custom-simulation', (req, res) => {
  const { targetType, targetId, variantName, customHtmlCode } = req.body;
  if (!targetId || !customHtmlCode) {
    return res.status(400).json({ error: 'targetId and customHtmlCode are required.' });
  }

  try {
    let cleanCode = stripMarkdownFences(customHtmlCode);
    const varId = `var-custom-${Date.now()}`;
    const fileName = `sim-custom-${targetId}-${Date.now()}.html`;
    const filePath = path.join(SIM_DIR, fileName);
    fs.writeFileSync(filePath, cleanCode, 'utf-8');
    try { fs.writeFileSync(path.join(BACKUP_SIM_DIR, fileName), cleanCode, 'utf-8'); } catch (e) {}

    const db = readDB();
    const nameLabel = variantName ? variantName.trim() : `Custom Variant (${new Date().toLocaleTimeString()})`;
    const newVariant = { id: varId, name: nameLabel, file: `/simulations/${fileName}` };

    if (targetType === 'fsrs') {
      if (!db.fsrsItems) db.fsrsItems = [];
      const item = db.fsrsItems.find(i => i.id === targetId);
      if (item) {
        if (!item.variants) item.variants = [];
        // Include current file as original if not in variants
        if (item.simulationFile && !item.variants.some(v => v.file === item.simulationFile)) {
          item.variants.unshift({ id: `var-orig-${item.id}`, name: 'Original Version (AI)', file: item.simulationFile });
        }
        item.variants.push(newVariant);
        item.activeVariantId = varId;
        item.simulationFile = `/simulations/${fileName}`;
        item.status = 'ready';
      }
    } else {
      let updated = false;
      for (const s of db.subjects) {
        for (const u of s.units) {
          for (const a of u.assignments) {
            const q = a.questions.find(q => q.id === targetId);
            if (q) {
              if (!q.variants) q.variants = [];
              if (q.simulationFile && !q.variants.some(v => v.file === q.simulationFile)) {
                q.variants.unshift({ id: `var-orig-${q.id}`, name: 'Original Version (AI)', file: q.simulationFile });
              }
              q.variants.push(newVariant);
              q.activeVariantId = varId;
              q.simulationFile = `/simulations/${fileName}`;
              q.status = 'ready';
              updated = true;
              break;
            }
          }
          if (updated) break;
          if (u.topics) {
            const t = u.topics.find(t => t.id === targetId);
            if (t) {
              if (!t.variants) t.variants = [];
              if (t.simulationFile && !t.variants.some(v => v.file === t.simulationFile)) {
                t.variants.unshift({ id: `var-orig-${t.id}`, name: 'Original Version (AI)', file: t.simulationFile });
              }
              t.variants.push(newVariant);
              t.activeVariantId = varId;
              t.simulationFile = `/simulations/${fileName}`;
              t.status = 'ready';
              updated = true;
              break;
            }
          }
        }
        if (updated) break;
      }
    }

    writeDB(db);
    res.json({ success: true, db, filePath: `/simulations/${fileName}` });
  } catch (error) {
    console.error('Error saving custom simulation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Select Active Simulation Variant
app.post('/api/select-simulation-variant', (req, res) => {
  const { targetType, targetId, variantId } = req.body;
  const db = readDB();

  if (targetType === 'fsrs') {
    if (!db.fsrsItems) db.fsrsItems = [];
    const item = db.fsrsItems.find(i => i.id === targetId);
    if (item && item.variants) {
      const foundV = item.variants.find(v => v.id === variantId);
      if (foundV) {
        item.activeVariantId = variantId;
        item.simulationFile = foundV.file;
        writeDB(db);
        return res.json({ success: true, db, simulationFile: foundV.file });
      }
    }
  } else {
    let updated = false;
    for (const s of db.subjects) {
      for (const u of s.units) {
        for (const a of u.assignments) {
          const q = a.questions.find(q => q.id === targetId);
          if (q && q.variants) {
            const foundV = q.variants.find(v => v.id === variantId);
            if (foundV) {
              q.activeVariantId = variantId;
              q.simulationFile = foundV.file;
              updated = true;
              break;
            }
          }
        }
        if (updated) break;
        if (u.topics) {
          const t = u.topics.find(t => t.id === targetId);
          if (t && t.variants) {
            const foundV = t.variants.find(v => v.id === variantId);
            if (foundV) {
              t.activeVariantId = variantId;
              t.simulationFile = foundV.file;
              updated = true;
              break;
            }
          }
        }
      }
      if (updated) break;
    }
    if (updated) {
      writeDB(db);
      return res.json({ success: true, db });
    }
  }

  res.status(400).json({ error: 'Variant or item not found.' });
});

// Generate 5 Diagnostic MCQs for FSRS Concept derived directly from Source Materials
app.post('/api/fsrs/generate-mcqs', async (req, res) => {
  const { itemId } = req.body;
  const db = readDB();
  if (!db.fsrsItems) db.fsrsItems = [];
  const item = db.fsrsItems.find(i => i.id === itemId);

  if (!item) {
    return res.status(404).json({ error: 'FSRS Item not found.' });
  }

  try {
    const settings = readSettings();
    const ai = getGeminiClient();
    const model = ai.getGenerativeModel({
      model: settings.optimizerModel || 'gemini-3.1-flash-lite',
      generationConfig: { responseMimeType: 'application/json' }
    });
    const sourceContext = getSourceContextForItem(item, db);

    // Clean query text of raw note meta headers
    const cleanQuery = (item.queryText || '').replace(/^\[FSRS Note\]\s*/i, '').replace(/\[Note\].*$/i, '').trim();

    const mcqPrompt = `You are a Student-Friendly Pedagogy Examiner.
Generate 5 EASY-TO-MODERATE, SHORT, AND CONCISE Multiple Choice Questions (MCQs) for this concept:

TARGET TOPIC / QUERY: "${cleanQuery || item.concept}"
CONCEPT DOMAIN: "${item.concept}"

SOURCE MATERIAL CONTEXT:
${sourceContext || 'No additional source material.'}

STRICT REQUIREMENTS FOR ACCESSIBILITY:
- DIFFICULTY: Easy to Moderate level (clear, intuitive, bite-sized questions).
- QUESTION LENGTH: VERY SHORT 1-sentence questions (maximum 10-15 words).
- OPTION LENGTH: VERY SHORT 1-4 word answer choices (e.g. "Increases", "Decreases", "Stays Constant", "Zero").
- Output raw JSON array ONLY matching this structure:
[
  {
    "id": "mcq-1",
    "question": "Short clear 1-sentence question?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Short 1-sentence explanation.",
    "targetedConcept": "Micro-Concept"
  }
]`;

    console.log(`[FSRS MCQ Gen] Generating 5 Source-Derived MCQs for "${cleanQuery.slice(0, 30)}..."`);
    const resp = await generateContentWithRetry(model, mcqPrompt, 10);
    logTokenUsage(resp);

    let cleanJson = stripMarkdownFences(resp.response.text());
    let parsedMcqs = [];
    try {
      const firstBracket = cleanJson.indexOf('[');
      const lastBracket = cleanJson.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1) {
        cleanJson = cleanJson.substring(firstBracket, lastBracket + 1);
      }
      parsedMcqs = JSON.parse(cleanJson);
      // Ensure exactly 5 unique MCQs
      if (parsedMcqs.length > 5) parsedMcqs = parsedMcqs.slice(0, 5);
    } catch (pErr) {
      console.warn('[FSRS MCQ JSON Parse Warning]: Raw response was not clean JSON. Building 5 structured fallback MCQs...');
      parsedMcqs = Array.from({ length: 5 }).map((_, idx) => ({
        id: `mcq-fb-${idx + 1}`,
        question: `Analytical Question ${idx + 1} regarding ${item.concept}: What is the primary governing relationship for "${cleanQuery || item.concept}"?`,
        options: [
          `Proportional scaling based on source parameters for ${item.concept}`,
          `Inverse square reduction under load conditions`,
          `Constant neutral limit state boundary`,
          `Zero-displacement equilibrium point`
        ],
        correctIndex: 0,
        explanation: `Based on the source material for ${item.concept}, proportional scaling governs the response of ${cleanQuery || item.concept}.`,
        targetedConcept: `${item.concept} Aspect ${idx + 1}`
      }));
    }

    const freshDb = readDB();
    const freshItem = freshDb.fsrsItems.find(i => i.id === itemId);
    if (freshItem) {
      freshItem.mcqs = parsedMcqs;
      writeDB(freshDb);
    }

    res.json({ success: true, mcqs: parsedMcqs, db: freshDb });
  } catch (error) {
    console.error('Error generating FSRS MCQs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Submit FSRS MCQ Quiz & Automatically Determine FSRS Retention Score
app.post('/api/fsrs/submit-quiz', (req, res) => {
  const { itemId, selectedIndices } = req.body;
  const db = readDB();
  if (!db.fsrsItems) db.fsrsItems = [];
  const item = db.fsrsItems.find(i => i.id === itemId);

  if (!item || !item.mcqs || item.mcqs.length === 0) {
    return res.status(400).json({ error: 'FSRS item or MCQs not found.' });
  }

  let correctCount = 0;
  const missedConcepts = [];

  item.mcqs.forEach((mcq, idx) => {
    const userSelected = selectedIndices[idx];
    if (userSelected === mcq.correctIndex) {
      correctCount++;
    } else {
      if (mcq.targetedConcept) {
        missedConcepts.push(mcq.targetedConcept);
      }
    }
  });

  const totalQuestions = item.mcqs.length;
  const score = correctCount;
  item.lastQuizScore = score;
  item.weakConcepts = [...new Set(missedConcepts)];

  // Scale score to 10 for retention rating
  const scaledRating = Math.round((correctCount / totalQuestions) * 10);
  item.difficultyRating = scaledRating;

  let grade = 3;
  if (scaledRating <= 3) grade = 1;
  else if (scaledRating <= 6) grade = 2;
  else if (scaledRating <= 8) grade = 3;
  else grade = 4;

  let currentD = item.difficulty || 5.0;
  let currentS = item.stability || 1.0;

  let newD = Math.max(1, Math.min(10, currentD - 0.2 * (grade - 3)));

  let newS;
  if (grade === 1) {
    newS = 0.5;
  } else {
    newS = currentS * (1 + (grade - 2) * 0.6 + (10 - newD) * 0.08);
  }

  const nextD = new Date();
  nextD.setDate(nextD.getDate() + Math.max(1, Math.round(newS)));

  item.stability = newS;
  item.difficulty = newD;
  item.intervalDays = Math.round(newS);
  writeDB(db);

  res.json({
    success: true,
    score,
    total: item.mcqs.length,
    weakConcepts: item.weakConcepts,
    fsrsItem: item,
    db
  });
});

// Rate a Pedagogy Style Profile (1 to 10 scale)
app.post('/api/rate-style-profile', (req, res) => {
  const { targetType, targetId, styleKey, rating } = req.body;
  if (!styleKey || !rating) {
    return res.status(400).json({ error: 'Missing styleKey or rating.' });
  }

  const db = readDB();
  if (!db.styleRatings) db.styleRatings = [];

  const newRecord = {
    id: `rate-${Date.now()}`,
    styleKey,
    rating: Number(rating),
    targetId: targetId || '',
    timestamp: new Date().toISOString()
  };
  db.styleRatings.push(newRecord);

  // Update target object if present
  if (targetType === 'fsrs' && db.fsrsItems) {
    const item = db.fsrsItems.find(i => i.id === targetId);
    if (item) item.styleRating = Number(rating);
  } else if (targetType === 'question' && db.subjects) {
    for (const s of db.subjects) {
      for (const u of s.units) {
        for (const a of u.assignments) {
          const q = a.questions.find(item => item.id === targetId);
          if (q) q.styleRating = Number(rating);
        }
      }
    }
  } else if (targetType === 'topic' && db.subjects) {
    for (const s of db.subjects) {
      for (const u of s.units) {
        if (u.topics) {
          const t = u.topics.find(item => item.id === targetId);
          if (t) t.styleRating = Number(rating);
        }
      }
    }
  }

  writeDB(db);

  const stats = {};
  Object.keys(STYLE_PROFILES).forEach(k => {
    const matching = db.styleRatings.filter(r => r.styleKey === k);
    if (matching.length > 0) {
      const sum = matching.reduce((acc, curr) => acc + curr.rating, 0);
      stats[k] = { average: Number((sum / matching.length).toFixed(1)), count: matching.length };
    } else {
      stats[k] = { average: 0, count: 0 };
    }
  });

  res.json({ success: true, db, stats });
});

// Get style profile rating statistics
app.get('/api/style-profile-stats', (req, res) => {
  const db = readDB();
  const ratings = db.styleRatings || [];
  const stats = {};

  Object.keys(STYLE_PROFILES).forEach(k => {
    const matching = ratings.filter(r => r.styleKey === k);
    if (matching.length > 0) {
      const sum = matching.reduce((acc, curr) => acc + curr.rating, 0);
      stats[k] = { average: Number((sum / matching.length).toFixed(1)), count: matching.length };
    } else {
      stats[k] = { average: 0, count: 0 };
    }
  });

  res.json({ success: true, stats });
});

// Run UMS Scraper script from darshan-tracker
let isUmsScraperRunning = false;
let umsScraperLog = '';

app.post('/api/run-ums-scraper', (req, res) => {
  if (isUmsScraperRunning) {
    return res.status(409).json({ error: 'UMS Scraper is already running in background.' });
  }

  isUmsScraperRunning = true;
  umsScraperLog = 'Starting Darshan UMS Scraper process...';

  const scriptPath = process.env.SCRAPER_SCRIPT_PATH || path.join(os.homedir(), '.gemini/antigravity/scratch/darshan-tracker/run_scraper.sh');
  const child = exec(`bash "${scriptPath}"`, (error, stdout, stderr) => {
    isUmsScraperRunning = false;
    if (error) {
      console.error('UMS Scraper error:', error);
      umsScraperLog = `Error: ${error.message}`;
    } else {
      console.log('UMS Scraper finished successfully.');
      umsScraperLog = stdout || 'Scraper completed successfully.';
      try {
        const freshDb = readDB();
        writeDB(freshDb);
      } catch (e) {}
    }
  });

  res.json({ success: true, message: 'UMS Scraper started in background.' });
});

// Save original gemini canvas link endpoint
app.post('/api/guided-learning/save-link', async (req, res) => {
  const { questionId, geminiLink } = req.body;
  if (!questionId) {
    return res.status(400).json({ error: 'Question ID is required.' });
  }

  const db = readDB();
  let updated = false;

  if (db.subjects) {
    for (const s of db.subjects) {
      for (const u of s.units) {
        if (u.assignments) {
          for (const a of u.assignments) {
            if (a.questions) {
              for (const q of a.questions) {
                if (q.id === questionId) {
                  q.geminiLink = geminiLink;
                  updated = true;
                  break;
                }
              }
            }
          }
        }
      }
    }
  }

  if (db.fsrsItems) {
    for (const item of db.fsrsItems) {
      if (item.id === questionId) {
        item.geminiLink = geminiLink;
        updated = true;
        break;
      }
    }
  }

  if (updated) {
    writeDB(db);
    res.json({ success: true, db });
  } else {
    res.status(404).json({ error: 'Question or FSRS Item not found in database.' });
  }
});

// Endpoint to save guided learning conversation
app.post('/api/guided-learning/save-conversation', (req, res) => {
  const { questionId, guidedLog, isGuidedStarted } = req.body;
  if (!questionId) {
    return res.status(400).json({ error: 'Question ID is required.' });
  }

  const db = readDB();
  let foundQuestion = null;
  for (const subject of db.subjects) {
    for (const unit of subject.units) {
      for (const assignment of unit.assignments) {
        foundQuestion = assignment.questions.find(q => q.id === questionId);
        if (foundQuestion) break;
      }
      if (foundQuestion) break;
    }
    if (foundQuestion) break;
  }

  if (foundQuestion) {
    foundQuestion.guidedLog = guidedLog || [];
    foundQuestion.isGuidedStarted = !!isGuidedStarted;
    writeDB(db);
    res.json({ success: true, db });
  } else {
    res.status(404).json({ error: 'Question not found in database.' });
  }
});

// Guided learning chat tutor endpoint
app.post('/api/guided-learning/chat', async (req, res) => {
  const { concept, questionContext, chatHistory, userMessage } = req.body;
  if (!concept) {
    return res.status(400).json({ error: 'Concept name is required.' });
  }

  try {
    const activeSettings = readSettings();
    const activeApiKey = activeSettings.apiKey || process.env.GEMINI_API_KEY || '';
    if (!activeApiKey) {
      return res.status(400).json({ error: 'Gemini API Key is not set in settings or env.' });
    }

    const localAi = getGeminiClient(activeApiKey);
    const modelName = activeSettings.optimizerModel || 'gemini-3.1-flash-lite';
    const modelInstance = localAi.getGenerativeModel({ model: modelName });

    // Format chat history for prompt
    let formattedHistory = '';
    if (chatHistory && chatHistory.length > 0) {
      formattedHistory = chatHistory.map(h => `${h.role === 'user' ? 'Student' : 'Tutor'}: ${h.content}`).join('\n');
    }

    const systemPrompt = `You are a World-Class Engineering Tutor and Pedagogy Expert specializing in Active Recall, just like the Google Gemini app's Guided Learning experience.
Your goal is to guide the student through mastering the following concept: "${concept}".
Current Question/Problem Context: "${questionContext || 'No context provided.'}"

ACTIVE RECALL & GUIDED LEARNING PRINCIPLES:
1. **Bite-Sized & Concise (CRITICAL)**: Keep your responses extremely short (max 2-3 sentences or 80 words per turn). Avoid large walls of text, introductory filler, or listing multiple steps at once. Explain only the immediate single concept or variable.
2. **Active Recalling**: Do not calculate values or reveal formulas for the student. Instead, prompt them to actively recall them. Ask questions like:
   - "What is the formula for calculating $M_{u,lim}$ under IS 456?"
   - "From the problem statement, what is the value of the effective depth $d$?"
   - "What do you think is the first step to find the neutral axis?"
3. **One Check at a Time**: Wait for the student to respond with their answer/calculation before validating it and presenting the next micro-step.
4. **Format Mathematics**: Always use LaTeX math format with $...$ for inline equations and $$...$$ for block equations so the frontend MathJax/KaTeX renderer displays it perfectly.
5. **Encouraging Tone**: Maintain a friendly, supportive, and conversational tone.`;

    const chatPrompt = `${systemPrompt}

Conversation History:
${formattedHistory}

Student's Latest Message: "${userMessage}"

Assistant Response:`;

    const response = await generateContentWithRetry(modelInstance, chatPrompt, 5);
    logTokenUsage(response);
    const tutorResponse = response.response.text();

    res.json({ success: true, assistantResponse: tutorResponse });
  } catch (error) {
    console.error('Error in guided learning chat:', error);
    res.status(500).json({ error: error.message });
  }
});

// Guided learning step simulation compiler endpoint
app.post('/api/guided-learning/compile-simulation', async (req, res) => {
  const { concept, tutorExplanation, questionId, stepNumber } = req.body;
  if (!concept || !tutorExplanation) {
    return res.status(400).json({ error: 'Concept and tutorExplanation are required.' });
  }

  try {
    const activeSettings = readSettings();
    const activeApiKey = activeSettings.apiKey || process.env.GEMINI_API_KEY || '';
    if (!activeApiKey) {
      return res.status(400).json({ error: 'Gemini API Key is not set.' });
    }

    const localAi = getGeminiClient(activeApiKey);
    const modelName = activeSettings.generatorModel || 'gemini-3.5-flash';
    const modelInstance = localAi.getGenerativeModel({ model: modelName });

    const systemPrompt = `You are an expert Educational UI/UX Developer and Simulation Engineer.
Your task is to build a complete, single-file interactive visual simulation (HTML + CSS + Javascript) that visually demonstrates the exact micro-concept or math calculation step described in this tutor response:
"${tutorExplanation}"
For the concept: "${concept}"

DESIGN & TECHNICAL SPECIFICATIONS:
1. **Interactive Visual Canvas**: Render an HTML5 Canvas, responsive SVG, or direct graphical widgets.
2. **Double-Engine Principle**: The simulation must be highly focused on the specific step described. Let the AI think what is the best visualization for this specific calculation or physical rule (e.g., interactive beam tension sliders, soil particle layout, structural shear graphs).
3. **Dark Premium Theme**: Use a premium cyber-engineering dark dashboard backdrop with glowing neon colors (cyan, purple, green).
4. **Parameter Controls**: Provide simple range sliders or clickable parameter inputs so the user can interactively change the variables and see the immediate mathematical and graphical update.
5. **No Extra Libraries**: Only use native JavaScript APIs. Do not include external packages or CDNs (no Tailwind, no external libraries unless native standard browser features).
6. **No fluff**: Output ONLY the raw HTML code inside standard \`\`\`html code fences.`;

    const response = await generateContentWithRetry(modelInstance, systemPrompt, 5);
    logTokenUsage(response);
    const rawCode = response.response.text();
    const cleanCode = stripMarkdownFences(rawCode);

    // Save step simulation file
    const safeConceptName = concept.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
    const fileName = `sim-guided-${safeConceptName}-${Date.now()}.html`;
    const filePath = path.join(SIM_DIR, fileName);
    fs.writeFileSync(filePath, cleanCode, 'utf-8');

    // Mirror to persistent BACKUP_SIM_DIR
    try {
      fs.writeFileSync(path.join(BACKUP_SIM_DIR, fileName), cleanCode, 'utf-8');
    } catch (e) {}

    // Save as question variant in db.json if questionId is provided
    if (questionId) {
      try {
        const db = readDB();
        let foundQuestion = null;
        for (const subject of db.subjects) {
          for (const unit of subject.units) {
            for (const assignment of unit.assignments) {
              foundQuestion = assignment.questions.find(q => q.id === questionId);
              if (foundQuestion) break;
            }
            if (foundQuestion) break;
          }
          if (foundQuestion) break;
        }

        if (foundQuestion) {
          if (!foundQuestion.variants || !Array.isArray(foundQuestion.variants)) {
            foundQuestion.variants = [];
            if (foundQuestion.simulationFile) {
              foundQuestion.variants.push({
                id: `var-orig-${foundQuestion.id}`,
                name: 'Variant 1 (Original)',
                file: foundQuestion.simulationFile
              });
            }
          }

          const stepNum = stepNumber || (foundQuestion.variants.filter(v => v.name.startsWith('guidedlearning steps')).length + 1);
          const variantName = `guidedlearning steps ${stepNum}`;

          foundQuestion.variants.push({
            id: `var-guided-${Date.now()}`,
            name: variantName,
            file: `/simulations/${fileName}`
          });

          writeDB(db);
          console.log(`[Variants System] Saved variant "${variantName}" for Question ${questionId}`);
        }
      } catch (err) {
        console.error('Failed to save simulation step as variant in db.json:', err);
      }
    }

    res.json({ success: true, filePath: `/simulations/${fileName}` });
  } catch (error) {
    console.error('Error compiling guided simulation step:', error);
    res.status(500).json({ error: error.message });
  }
});
// Generate Adaptive Prep Study Routine based on UMS data + FSRS history
app.post('/api/prepplanner/generate-routine', async (req, res) => {
  const { examDate, confidence, studyHours, userState } = req.body;
  
  try {
    const db = readDB();
    const settings = readSettings();
    const ai = getGeminiClient();
    const modelName = settings.generatorModel || 'gemini-3.5-flash';
    
    // Compile FSRS context to guide the AI on what's difficult
    const fsrsSummary = (db.fsrsItems || []).map(item => ({
      concept: item.concept,
      reviews: item.reviewCount || 0,
      difficultyRating: item.difficultyRating || 5,
      stability: item.stability || 1.0,
      queryText: item.queryText ? item.queryText.slice(0, 50) : ''
    }));

    const subjectSummary = (db.subjects || []).map(s => ({
      name: s.name,
      units: s.units.map(u => ({
        number: u.number,
        name: u.name,
        assignmentsCount: u.assignments ? u.assignments.length : 0
      }))
    }));

    const prompt = `You are a World-Class Academic Coach and Intelligent Exam Prep Advisor.
Your job is to analyze this student's exam date, current study state, and spaced repetition (FSRS) performance, and build a highly customized, day-by-day Study Plan and Preparation Routine leading up to their exams.

STUDENT PROFILE & CONTEXT:
- Target Exam Date: ${examDate || 'Next 10 days'}
- Student Confidence Level (1-10): ${confidence || 5}
- Daily Study Allocation: ${studyHours || 2} hours per day
- Student Current Status / Feelings: "${userState || 'Stressed but willing to prepare.'}"

COURSE SYLLABUS STRUCTURE:
${JSON.stringify(subjectSummary, null, 2)}

STUDENT SPACED REPETITION (FSRS) PERFORMANCE LOGS:
${JSON.stringify(fsrsSummary.slice(0, 30), null, 2)}

INSTRUCTIONS:
1. Target Weaknesses: Explicitly schedule more review time for concepts where FSRS stability is low, or where difficultyRating is high (closer to 1-3 indicates failing/hard cards).
2. Day-by-Day Schedule: Structure a clear, chronological preparation roadmap. For each day, specify:
   - What topic/unit to study
   - Specific FSRS flashcards or simulations to practice
   - Focus duration
3. Dynamic Advice: Provide actionable cognitive hacks, time management tactics, and stress reduction strategies based on their reported feelings.
4. Output JSON Format only, matching this structure:
{
  "routineSummary": "brief high-level advice summary based on student state",
  "recommendedHoursPerDay": number,
  "anxietyAdvice": "tailored cognitive or stress relief tip",
  "schedule": [
    {
      "dayNumber": number,
      "dateString": "e.g., Aug 6",
      "topics": ["subject/unit name"],
      "focus": "specific concepts or assignments to practice",
      "durationMinutes": number,
      "priority": "High" | "Medium" | "Low"
    }
  ]
}

Return ONLY the raw JSON content. Do NOT wrap in markdown code blocks.`;

    const geminiModel = ai.getGenerativeModel({ 
      model: modelName,
      generationConfig: { responseMimeType: "application/json" }
    });
    const response = await generateContentWithRetry(geminiModel, prompt, 3);
    logTokenUsage(response);

    const rawText = response.response.text();
    // Extract JSON block in case any external headers/HTML get prepended
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const planText = jsonMatch ? jsonMatch[0] : stripMarkdownFences(rawText);
    
    // Save to study_plan.json for persistence
    const planPath = path.join(DATA_DIR, 'study_plan.json');
    fs.writeFileSync(planPath, planText, 'utf-8');

    res.json(JSON.parse(planText));
  } catch (error) {
    console.error('Error generating study routine:', error);
    res.status(500).json({ error: error.message });
  }
});

// Compile detailed study script/blueprint for a creative study suggestion
app.post('/api/prepplanner/generate-suggestion', async (req, res) => {
  const { concept, format } = req.body;
  if (!concept || !format) {
    return res.status(400).json({ error: 'Concept and Format are required.' });
  }

  try {
    const settings = readSettings();
    const ai = getGeminiClient();
    const modelName = settings.generatorModel || 'gemini-3.5-flash';

    let formatInstructions = '';
    if (format === 'podcast') {
      formatInstructions = 'Draft an engaging, conversational 2-person podcast script (between a student and a friendly expert). Use simple analogies, clear pacing, and quick Q&A format explaining this concept.';
    } else if (format === 'simulation') {
      formatInstructions = 'Write a detailed mechanical/physical simulation blueprint. Explain what visual assets (slits, beams, particles, arrows) are needed, how parameter sliders behave, and the math formulas that drive live updates.';
    } else if (format === 'explainer') {
      formatInstructions = 'Draft a highly structured explainer video script. Describe exactly what to show on screen (chalkboard drawings, highlights) and what the voiceover should say to step through formula derivations.';
    } else if (format === 'infographic') {
      formatInstructions = 'Design a text-based blueprint outline for an interactive infographic. Outline color schemes, card comparisons, hierarchical flowcharts, and key equations that contrast details.';
    } else if (format === 'notebooklm') {
      formatInstructions = 'Generate a structured text document (Summary, FAQ Sheet, Glossary, Key Equations list) optimized to be uploaded as a custom source text to NotebookLM to train its study guide.';
    }

    const prompt = `You are a Creative Educational Media Architect.
Design a highly detailed, premium study resource blueprint for this concept.

CONCEPT TO EXPLAIN: "${concept}"
REQUESTED LEARNING FORMAT: "${format.toUpperCase()}"

INSTRUCTIONS:
${formatInstructions}

Ensure the output is comprehensive, pedagogical, and highly structured (using headers, bullet points, and dialogs where applicable). Explain the concept thoroughly so the student walks away with 100% clarity.`;

    const geminiModel = ai.getGenerativeModel({ model: modelName });
    const response = await generateContentWithRetry(geminiModel, prompt, 3);
    logTokenUsage(response);

    res.json({ result: response.response.text() });
  } catch (error) {
    console.error('Error generating study format suggestion:', error);
    res.status(500).json({ error: error.message });
  }
});

// Load persistent study plan if exists
app.get('/api/prepplanner/load-plan', (req, res) => {
  const planPath = path.join(DATA_DIR, 'study_plan.json');
  if (fs.existsSync(planPath)) {
    try {
      const data = fs.readFileSync(planPath, 'utf-8');
      return res.json(JSON.parse(data));
    } catch (e) {
      return res.json({ error: 'Failed to read plan' });
    }
  }
  res.json(null);
});

app.post('/api/prepplanner/save-plan', (req, res) => {
  const planPath = path.join(DATA_DIR, 'study_plan.json');
  try {
    fs.writeFileSync(planPath, JSON.stringify(req.body, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Fallback to serving Vite app in production
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
