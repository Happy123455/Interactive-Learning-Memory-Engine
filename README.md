# 🧠 SynapseLab AI - Interactive Learning & Memory Engine

> A next-generation, AI-powered educational web application combining **FSRS Spaced Repetition**, **Gizmo-style Interactive Canvas Simulations**, **Automated 30-MCQ Generation from PDF/Office Courseware**, and **5-Tier Hierarchical Concept Mind Maps**.

---

## 🌟 Key Features Overview

### 1. 🎯 Gizmo-Style Interactive MCQ Simulation Reviewer
* **Dual-Pane Split Screen**:
  * **Left Panel**: Compiled interactive 2D HTML5 Canvas / SVG simulation sandbox.
  * **Right Panel**: Real-time evaluation dashboard with question text, option choices, mathematical derivations, and FSRS scheduling metrics.
* **🔀 Dynamic Option Shuffling**: Options are randomized upon card load using the Fisher-Yates algorithm while preserving underlying answer key mappings.
* **🔗 Bidirectional `postMessage` Protocol**: Secure communication between the compiled simulation `iframe` and the parent React app. Answer keys are strictly retained on the host application for maximum security.
* **🔊 Audio Text-to-Speech (TTS)**: Built-in Web Speech API narration reads out questions, options, and conceptual explanations.
* **⏭️ Continuous Review Flow**: One-click "Next MCQ" navigation lets students progress seamlessly through their active deck.

---

### 2. 📚 Automated 30-MCQ Generator & Multi-Format Course Scanner
* **Courseware Material Scanner**:
  * Recursively scans course material directories for three distinct material types:
    * 📝 **Assignments** (`.pdf`, `.docx`)
    * 💻 **Presentations / PPTs** (`.pptx`, `.ppt`)
    * 📖 **E-Notes & Handouts** (`.pdf`, `.docx`)
* **Hierarchical Selector**: Materials are cleanly categorized in frontend dropdowns under:
  $$\text{Subject} \rightarrow \text{Unit Number} \rightarrow \text{Material Type (Assignment / PPT / E-Note)}$$
* **Automated AI Question Generation**: Converts extracted text into exactly 30 structured, syllabus-aligned multiple-choice questions with step-by-step derivations and FSRS database registration.
* **Multi-Model Selector**: Support for `gemini-3.5-flash`, `gemini-2.5-flash`, and `gemini-3.1-flash-lite`.

---

### 3. ⚡ FSRS Spaced Repetition Engine & Analytics
* **Mathematical Memory Modeling**: Implements the Free Spaced Repetition Scheduler algorithm ($R = e^{-t/S}$) tracking memory stability ($S$) and item difficulty.
* **7-Day Review Schedule Forecast**: Bar timeline showing card review load across upcoming days.
* **Student Mastery Analytics**: Graphs tracking student score improvement trends and average difficulty progression.
* **Dynamic Rating System**: Review outcomes dynamically reschedule cards:
  * **Good (8)** / **Easy (10)**: Increases stability interval.
  * **Again (1)**: Resets stability interval for immediate active review.

---

### 4. 🗺️ 5-Tier Hierarchical Mind Map Explorer
* High-fidelity, responsive tree navigator mapping study items across:
  $$\text{FSRS Deck} \rightarrow \text{Subject Hub} \rightarrow \text{Unit} \rightarrow \text{Assignment} \rightarrow \text{MCQ / Concept Group} \rightarrow \text{Card Nodes}$$
* Clickable card nodes with instant review launchers and status indicators (**DUE**, **Good**, **Hard**).

---

### 5. 🔬 Multi-Layer AI Simulation Compiler (Two-Stage Architecture)
* **Stage 1 (Blueprint Generator)**: Prompts Gemini models to write comprehensive 800-1200 word pedagogical blueprints detailing physics loops, vector graphics, drag-and-drop slots, and Web Audio triggers.
* **Stage 2 (Canvas Code Compiler)**: Compiles single-file HTML/CSS/JS interactive sandboxes with dark cyber glassmorphism, responsive Retina canvas scaling, and fluid animations.
* **Variant Management**: Support for original simulations, adaptive review variants, and custom user-pasted HTML/JS code snippets.

---

### 6. 💬 Persistent Guided Learning & Conversation Autosaving
* **Debounced Autosave**: Guided learning chat history automatically syncs to `db.json` after a 500ms typing pause.
* **Safe Circular Copy Utility**: Safari-safe clipboard copying with fallback selection ranges and interactive prompt dialogs.

---

### 7. 🏛️ RCC Beam & Structural Engineering Pedagogy Engine
* Interactive parameter highlight checklists ($b, D, c, A_{st}, A_{sc}$).
* Real-time canvas section drafting animations with staggered leader callouts.
* Gamified IS 456 Codebook reference lookup challenges.
* Parallel concrete parabolic stress block & strain profile visualizers.

---

## 🏗️ Tech Stack

* **Frontend**: React 19, TypeScript, Vite, Lucide React Icons, Vanilla Glassmorphism CSS.
* **Backend**: Node.js, Express 5, `pdf-parse`, `officeparser`, CORS.
* **AI Engine**: `@google/generative-ai` (Gemini 3.5 Flash, Gemini 3.1 Flash Lite).
* **Storage**: Local JSON database (`data/db.json`, `data/settings.json`) with automated file system backups.

---

## 🚀 Getting Started

### 1. Prerequisites
* **Node.js** (v18 or higher)
* **npm** or **yarn**
* A **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/)

---

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name

# Install dependencies
npm install
```

---

### 3. Running the Application

You can launch both the backend server and frontend client concurrently:

```bash
# Run backend server (port 5050) & frontend Vite dev server (port 5173)
npm run dev
```

Open your browser and navigate to:
* **Local Web Interface**: [http://localhost:5173/](http://localhost:5173/)
* **Network Sharing (Mobile / Tablet)**: Run `npx vite --host` to access over local Wi-Fi.

---

### 4. Configuration

1. Click on the **⚙️ Settings** icon in the app header.
2. Enter your **Gemini API Key**.
3. Select your preferred **Optimizer** and **Generator** AI models.
4. Save settings.

---

## 📜 License

This project is open-source under the MIT License.
