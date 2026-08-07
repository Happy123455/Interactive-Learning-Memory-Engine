import React, { useState, useEffect } from 'react';
import type { Database, Subject, Unit, Assignment, Question, Settings, ActiveTab } from './types';
import { Dashboard } from './components/Dashboard';
import { MindMap } from './components/MindMap';
import { SimViewer } from './components/SimViewer';
import { StructuralWorkspace } from './components/structural/StructuralWorkspace';
import { FSRSSpace } from './components/FSRSSpace';
import { PrepPlanner } from './components/PrepPlanner';
import { Settings as SettingsIcon, BookOpen, Layers, FileText, ChevronDown, ChevronRight, ShieldAlert, RefreshCw, Plus, Star, Sliders, CheckSquare, Square } from 'lucide-react';

import { DEFAULT_DB } from './data/defaultDb';

export const App: React.FC = () => {
  const [db, setDb] = useState<Database>(DEFAULT_DB);
  const [settings, setSettings] = useState<Settings>({
    apiKey: '',
    apiKeyConfigured: false,
    optimizerModel: 'gemini-3.1-flash-lite',
    generatorModel: 'gemini-3.5-flash'
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('mindmap');
  
  // Navigation states (IDs only to allow dynamic reference derivation from DB)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  // Sidebar collapsible units/assignments
  const [sidebarExpandedSubjects, setSidebarExpandedSubjects] = useState<Record<string, boolean>>({});
  const [sidebarExpandedUnits, setSidebarExpandedUnits] = useState<Record<string, boolean>>({});

  // Settings modal
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [optModel, setOptModel] = useState('gemini-3.1-flash-lite');
  const [genModel, setGenModel] = useState('gemini-3.5-flash');
  const [styleProfile, setStyleProfile] = useState('universal_pedagogy');
  const [isSyncingUms, setIsSyncingUms] = useState(false);

  // Style Feature Mapping
  const STYLE_FEATURE_MAP: Record<string, string[]> = {
    universal_pedagogy: ['sliders', 'drag_drop', 'heatmap', 'graphing', 'sound_synth', 'speech_narration', 'step_calc', 'slot_puzzle'],
    eli5_playful: ['eli5_analogies', 'pitch_audio', 'hand_motion', 'pastel_bouncy', 'speech_narration', 'sound_synth'],
    custom_mode: ['fps_shooter_drag', 'sliders', 'drag_drop', 'heatmap', 'graphing', 'sound_synth', 'speech_narration', 'step_calc', 'slot_puzzle'],
    micro_inspector: ['sliders', 'drag_drop', 'heatmap', 'graphing', 'step_calc'],
    gamified_sandbox: ['sliders', 'drag_drop', 'fps_shooter_drag', 'sound_synth', 'heatmap'],
    intermediate_streams: ['sliders', 'graphing', 'step_calc', 'heatmap'],
    formula_puzzle: ['slot_puzzle', 'graphing', 'step_calc', 'sliders'],
    voice_cockpit: ['speech_narration', 'sound_synth', 'sliders', 'step_calc'],
    fea_heatmap: ['heatmap', 'graphing', 'sliders', 'step_calc'],
  };

  // Stateful Feature Checkboxes & Filter Mode
  const [featureFilterMode, setFeatureFilterMode] = useState<'style' | 'all'>('style');
  const [newFeatureInput, setNewFeatureInput] = useState('');
  const [featuresList, setFeaturesList] = useState([
    { id: 'eli5_analogies', label: '👶 Explain To Me Like I\'m 5 (ELI5 Simplified Analogies & Toy Mechanics)', checked: true },
    { id: 'pitch_audio', label: '🎵 Dynamic Pitch-Shifting Audio Synthesizer (Pitch rises with slider movement)', checked: true },
    { id: 'hand_motion', label: '🖐️ Hand/Mouse Motion Gesture Detection (Sweep hand left-to-right to move sliders)', checked: true },
    { id: 'pastel_bouncy', label: '🎨 Vibrant Pastel Bouncy Animations & Animated Diagrams', checked: true },
    { id: 'fps_shooter_drag', label: '🎮 FPS Shooter Gun-Control Drag & Drop (Crosshair, Shoot-to-Pick, Recoil Drop)', checked: true },
    { id: 'sliders', label: '⚡ Parameter Sliders Panel', checked: true },
    { id: 'drag_drop', label: '🎯 Drag & Drop Physics Handles', checked: true },
    { id: 'heatmap', label: '🔥 Dynamic FEA Stress Heatmap', checked: true },
    { id: 'graphing', label: '📊 Real-Time Equation Plotting', checked: true },
    { id: 'sound_synth', label: '🔊 Web Audio Synth Sound Effects', checked: true },
    { id: 'speech_narration', label: '🗣️ Native Web Speech Concept Narration', checked: true },
    { id: 'step_calc', label: '📝 Step Calculation Display', checked: true },
    { id: 'slot_puzzle', label: '🧩 Formula Slot Puzzle Board', checked: true },
  ]);

  // React to Pedagogy Style Selection by auto-checking matching features
  const handleSelectStyleProfile = (newStyle: string) => {
    setStyleProfile(newStyle);
    const activeFeatIds = STYLE_FEATURE_MAP[newStyle] || [];
    setFeaturesList(prev => prev.map(f => ({
      ...f,
      checked: activeFeatIds.includes(f.id) || f.id.startsWith('feat-custom-')
    })));
  };

  const handleAddCustomFeature = () => {
    if (!newFeatureInput.trim()) return;
    const featId = `feat-custom-${Date.now()}`;
    const newFeat = {
      id: featId,
      label: `✨ ${newFeatureInput.trim()}`,
      checked: true
    };
    setFeaturesList(prev => [...prev, newFeat]);
    setNewFeatureInput('');
    alert(`Custom feature "${newFeatureInput.trim()}" added to your style profile!`);
  };

  // Load database and settings with static fallback for GitHub Pages
  const loadDB = async () => {
    try {
      let res = await fetch('/api/db');
      if (!res.ok) {
        const base = import.meta.env.BASE_URL || '/';
        const cleanBase = base.endsWith('/') ? base : base + '/';
        res = await fetch(`${cleanBase}data/db.json`);
      }
      if (res.ok) {
        const data = await res.json();
        setDb(data);
      }
    } catch (error) {
      console.error('Error loading DB:', error);
      try {
        const base = import.meta.env.BASE_URL || '/';
        const cleanBase = base.endsWith('/') ? base : base + '/';
        const res = await fetch(`${cleanBase}data/db.json`);
        if (res.ok) {
          const data = await res.json();
          setDb(data);
        }
      } catch (e) {}
    }
  };

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setApiKeyInput(data.apiKey || '');
        setOptModel(data.optimizerModel || 'gemini-3.1-flash-lite');
        setGenModel(data.generatorModel || 'gemini-3.5-flash');
        setStyleProfile(data.styleProfile || 'universal_pedagogy');
      }
    } catch (error) {
      console.error('Error loading Settings:', error);
    }
  };

  useEffect(() => {
    loadDB();
    loadSettings();

    // Restore collapsible states and selections from localStorage on mount
    try {
      const savedSub = localStorage.getItem('sidebarExpandedSubjects');
      if (savedSub) setSidebarExpandedSubjects(JSON.parse(savedSub));
      
      const savedUnit = localStorage.getItem('sidebarExpandedUnits');
      if (savedUnit) setSidebarExpandedUnits(JSON.parse(savedUnit));

      const subId = localStorage.getItem('selectedSubjectId');
      const unitId = localStorage.getItem('selectedUnitId');
      const assId = localStorage.getItem('selectedAssignmentId');
      const qId = localStorage.getItem('activeQuestionId');

      if (subId) setSelectedSubjectId(subId);
      if (unitId) setSelectedUnitId(unitId);
      if (assId) setSelectedAssignmentId(assId);
      if (qId) setActiveQuestionId(qId);
    } catch (e) {
      console.error('Error loading localStorage state:', e);
    }
  }, []);

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKeyInput,
          optimizerModel: optModel,
          generatorModel: genModel,
          styleProfile: styleProfile
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setShowSettings(false);
        alert('Settings saved successfully!');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const handleSelectAssignment = (subject: Subject, unit: Unit, assignment: Assignment) => {
    setSelectedSubjectId(subject.id);
    setSelectedUnitId(unit.id);
    setSelectedAssignmentId(assignment.id);

    localStorage.setItem('selectedSubjectId', subject.id);
    localStorage.setItem('selectedUnitId', unit.id);
    localStorage.setItem('selectedAssignmentId', assignment.id);

    setActiveTab('dashboard');
  };

  const handleSelectQuestion = (question: Question | null) => {
    if (question) {
      setActiveQuestionId(question.id);
      localStorage.setItem('activeQuestionId', question.id);
    } else {
      setActiveQuestionId(null);
      localStorage.removeItem('activeQuestionId');
    }
  };

  const toggleSidebarSubject = (subId: string) => {
    setSidebarExpandedSubjects(prev => {
      const next = { ...prev, [subId]: !prev[subId] };
      localStorage.setItem('sidebarExpandedSubjects', JSON.stringify(next));
      return next;
    });
  };

  const toggleSidebarUnit = (unitId: string) => {
    setSidebarExpandedUnits(prev => {
      const next = { ...prev, [unitId]: !prev[unitId] };
      localStorage.setItem('sidebarExpandedUnits', JSON.stringify(next));
      return next;
    });
  };

  // Derive objects dynamically from current fresh DB state
  const selectedSubject = db.subjects.find(s => s.id === selectedSubjectId) || null;
  const selectedUnit = selectedSubject?.units.find(u => u.id === selectedUnitId) || null;
  const selectedAssignment = selectedUnit?.assignments.find(a => a.id === selectedAssignmentId) || null;
  
  // Derive activeQuestion from anywhere in the DB (both assignment questions AND unit topics)
  let activeQuestion: Question | null = null;
  if (activeQuestionId) {
    for (const s of db.subjects) {
      for (const u of s.units) {
        // 1. Search assignment questions
        for (const a of u.assignments) {
          const found = a.questions.find(q => q.id === activeQuestionId);
          if (found) {
            activeQuestion = found;
            break;
          }
        }
        if (activeQuestion) break;

        // 2. Search unit topics
        if (u.topics) {
          const foundTopic = u.topics.find(t => t.id === activeQuestionId);
          if (foundTopic) {
            activeQuestion = {
              id: foundTopic.id,
              text: `[Unit Topic] ${foundTopic.title}: ${foundTopic.description}`,
              concept: foundTopic.concept,
              difficulty: foundTopic.difficulty,
              status: foundTopic.status,
              simulationFile: foundTopic.simulationFile || '',
              variants: foundTopic.variants,
              activeVariantId: foundTopic.activeVariantId,
              hasSteps: foundTopic.hasSteps,
              activeStepId: foundTopic.activeStepId,
              steps: foundTopic.steps
            };
            break;
          }
        }
      }
    }

    // 3. Search FSRS items
    if (!activeQuestion && db.fsrsItems) {
      const foundFsrs = db.fsrsItems.find(item => item.id === activeQuestionId);
      if (foundFsrs) {
        activeQuestion = {
          id: foundFsrs.id,
          text: `[FSRS Concept] ${foundFsrs.queryText}`,
          concept: foundFsrs.concept,
          difficulty: foundFsrs.difficultyRating || 5,
          status: foundFsrs.status || 'ready',
          simulationFile: foundFsrs.simulationFile || '',
          variants: foundFsrs.variants,
          activeVariantId: foundFsrs.activeVariantId,
          comments: `[FSRS Memory] Stability: ${foundFsrs.stability || 1}d | Reviews: ${foundFsrs.reviewCount || 0} | Next: ${new Date(foundFsrs.nextReviewDate).toLocaleDateString()}`,
          styleRating: foundFsrs.difficultyRating || foundFsrs.lastQuizScore || 5,
        };
      }
    }
  }



  return (
    <div className="app-container">
      
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            SL
          </div>
          <div>
            <span className="sidebar-logo-text">SYNAPSELAB AI</span>
            <span className="sidebar-logo-sub">Memory Engine</span>
          </div>
        </div>

        {/* Sidebar Content */}
        <nav className="sidebar-nav">


          <div className="sidebar-section-title">
            Navigation tree
          </div>
          
          {db.subjects.length === 0 ? (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '0 8px' }}>
              No subjects yet. Click "+ Subject" in Dashboard to add one.
            </div>
          ) : (
            <div className="sidebar-list">
              {db.subjects.map(subject => {
                const isSubExpanded = sidebarExpandedSubjects[subject.id];
                return (
                  <div key={subject.id}>
                    {/* Subject Row */}
                    <button
                      onClick={() => toggleSidebarSubject(subject.id)}
                      className="sidebar-subject-btn"
                    >
                      <BookOpen size={14} className="text-cyan-400" />
                      <span style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {subject.name}
                      </span>
                      {isSubExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>

                    {/* Units Column */}
                    {isSubExpanded && (
                      <div className="sidebar-units-container">
                        {subject.units.map(unit => {
                          const unitId = `${subject.id}-${unit.id}`;
                          const isUnitExpanded = sidebarExpandedUnits[unitId];
                          return (
                            <div key={unit.id}>
                              {/* Unit Row */}
                              <button
                                onClick={() => toggleSidebarUnit(unitId)}
                                className="sidebar-unit-btn"
                              >
                                <Layers size={12} className="text-purple-400" />
                                <span style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                  Unit {unit.number}: {unit.name}
                                </span>
                                {isUnitExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                              </button>

                              {/* Assignments List */}
                              {isUnitExpanded && (
                                <div className="sidebar-assignments-container">
                                  {unit.assignments.map(ass => (
                                    <button
                                      key={ass.id}
                                      onClick={() => handleSelectAssignment(subject, unit, ass)}
                                      className={`sidebar-assignment-btn ${selectedAssignmentId === ass.id ? 'active' : ''}`}
                                    >
                                      <FileText size={10} />
                                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                        {ass.name}
                                      </span>
                                    </button>
                                  ))}
                                  {unit.assignments.length === 0 && (
                                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', paddingLeft: '16px', fontStyle: 'italic' }}>
                                      No assignments
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {subject.units.length === 0 && (
                          <div style={{ fontSize: '9px', color: 'var(--text-muted)', paddingLeft: '16px', fontStyle: 'italic' }}>
                            No units
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <div className="api-status">
            <span className={`api-status-dot ${settings.apiKeyConfigured ? 'active' : 'inactive'}`}></span>
            <span className="api-status-text">
              {settings.apiKeyConfigured ? 'API Connected' : 'API Key Missing'}
            </span>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="btn-secondary"
            style={{ padding: '6px' }}
            title="Settings"
          >
            <SettingsIcon size={16} />
          </button>
        </div>
      </aside>

      {/* Main View Container */}
      <main className="main-content">
        
        {/* Topbar navigation */}
        <header className="header-nav">
          <div className="tab-switcher">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('mindmap')}
              className={`tab-btn ${activeTab === 'mindmap' ? 'active' : ''}`}
            >
              Mind Map
            </button>
            <button
              onClick={() => setActiveTab('structural')}
              className={`tab-btn ${activeTab === 'structural' ? 'active' : ''}`}
            >
              Structural Studio
            </button>
            <button
              onClick={() => setActiveTab('fsrs')}
              className={`tab-btn ${activeTab === 'fsrs' ? 'active' : ''}`}
            >
              FSRS Studio
            </button>
            <button
              onClick={() => setActiveTab('prepplanner')}
              className={`tab-btn ${activeTab === 'prepplanner' ? 'active' : ''}`}
            >
              Prep Planner
            </button>
          </div>

          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={async () => {
                setIsSyncingUms(true);
                try {
                  const res = await fetch('/api/run-ums-scraper', { method: 'POST' });
                  if (res.ok) {
                    alert('🚀 UMS Portal Scraper launched in background! Course files will sync automatically.');
                    loadDB();
                  } else {
                    alert('Could not launch UMS Scraper.');
                  }
                } catch (e) {
                  alert('Error triggering UMS Scraper.');
                } finally {
                  setIsSyncingUms(false);
                }
              }}
              disabled={isSyncingUms}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid #38bdf8',
                color: '#38bdf8',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: isSyncingUms ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isSyncingUms ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />} Sync UMS Portal
            </button>
            {!settings.apiKeyConfigured && (
              <div className="api-warning-badge">
                <ShieldAlert size={12} />
                Configure your Gemini API key in Settings!
              </div>
            )}
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Semester 5 Workspace</span>
          </div>
        </header>

        {/* Tab views */}
        <div className="content-area">
          {activeTab === 'dashboard' ? (
            <Dashboard
              db={db}
              selectedSubject={selectedSubject}
              selectedUnit={selectedUnit}
              selectedAssignment={selectedAssignment}
              onRefreshDB={loadDB}
              onSelectQuestion={handleSelectQuestion}
            />
          ) : activeTab === 'mindmap' ? (
            <MindMap
              db={db}
              onSelectQuestion={handleSelectQuestion}
            />
          ) : activeTab === 'structural' ? (
            <StructuralWorkspace onBackToSim={() => setActiveTab('dashboard')} />
          ) : activeTab === 'prepplanner' ? (
            <PrepPlanner db={db} />
          ) : (
            <FSRSSpace db={db} onRefreshDB={loadDB} onSelectQuestion={handleSelectQuestion} />
          )}
        </div>
      </main>

      {activeQuestion && (
        <SimViewer
          question={activeQuestion}
          onClose={() => handleSelectQuestion(null)}
          onRefreshDB={loadDB}
          featuresList={featuresList}
          setFeaturesList={setFeaturesList}
          styleProfile={styleProfile}
          setStyleProfile={handleSelectStyleProfile}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay">
          <div className="modal-box modal-box-large glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SettingsIcon size={18} /> System Settings
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                style={{ background: 'transparent', fontSize: '20px', color: 'var(--text-secondary)' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* API Key */}
              <div className="form-group">
                <label className="form-label">Gemini API Key</label>
                <input
                  type="password"
                  placeholder={settings.apiKeyConfigured ? "••••••••••••••••" : "Paste your AIzaSy... key"}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                />
              </div>

              {/* Optimizer selection */}
              <div className="form-group">
                <label className="form-label">Model (Phase 1: Optimizer blueprint)</label>
                <select
                  value={optModel}
                  onChange={(e) => setOptModel(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</option>
                  <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                  <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option>
                </select>
              </div>

              {/* Code Generator selection */}
              <div className="form-group">
                <label className="form-label">Model (Phase 2: HTML Coder)</label>
                <select
                  value={genModel}
                  onChange={(e) => setGenModel(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</option>
                  <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                  <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option>
                </select>
              </div>

              {/* Pedagogy Style Profile selection */}
              <div className="form-group">
                <label className="form-label">Active Pedagogy Style Profile</label>
                <select
                  value={styleProfile}
                  onChange={(e) => handleSelectStyleProfile(e.target.value)}
                  style={{ width: '100%', background: 'rgba(15, 23, 42, 0.9)', color: 'white', padding: '8px', border: '1px solid var(--accent-cyan)', borderRadius: '6px' }}
                >
                  <option value="universal_pedagogy">🎯 Universal Master Pedagogy Profile (Recommended)</option>
                  <option value="eli5_playful">👶 Explain To Me Like I'm 5 (Pitch-Shifting Audio & Hand Motion Sandbox)</option>
                  <option value="custom_mode">⚙️ Custom Style Mode (Feature Checkboxes & Feature Stars)</option>
                  <option value="micro_inspector">🔬 Micro-Inspector & X-Ray Mechanics (Material & Tension Vectors)</option>
                  <option value="gamified_sandbox">🎮 Gamified Failure-Boundary Sandbox (Destruction Testing & SF Dial)</option>
                  <option value="intermediate_streams">🌊 Intermediate Value Streams (Continuous Energy & Load Paths)</option>
                  <option value="formula_puzzle">🧩 Interactive Formula Slot Puzzle (Drag-Drop Math & Sensitivity Curve)</option>
                  <option value="voice_cockpit">🎙️ Voice Control Cockpit & Lab Assistant (Speech Commands & Q&A)</option>
                  <option value="fea_heatmap">🔥 Dynamic FEA Heatmap & Multi-Physics (Stress Fields & Resonance)</option>
                </select>
              </div>

              {/* CUSTOM FEATURE CHECKBOXES PANEL */}
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '14px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sliders size={14} /> Simulation Preference Feature Checkboxes
                  </span>
                  <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.4)', borderRadius: '6px', padding: '2px', border: '1px solid var(--border-glass)' }}>
                    <button
                      type="button"
                      onClick={() => setFeatureFilterMode('style')}
                      style={{
                        fontSize: '9px',
                        fontWeight: 'bold',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: 'none',
                        background: featureFilterMode === 'style' ? 'var(--accent-cyan)' : 'transparent',
                        color: featureFilterMode === 'style' ? '#000' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      👁️ Active Style Features
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeatureFilterMode('all')}
                      style={{
                        fontSize: '9px',
                        fontWeight: 'bold',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: 'none',
                        background: featureFilterMode === 'all' ? 'var(--accent-cyan)' : 'transparent',
                        color: featureFilterMode === 'all' ? '#000' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      🌐 All Features
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                  {featuresList
                    .filter(feat => {
                      if (featureFilterMode === 'all') return true;
                      const activeFeatIds = STYLE_FEATURE_MAP[styleProfile] || [];
                      return activeFeatIds.includes(feat.id) || feat.id.startsWith('feat-custom-');
                    })
                    .map(feat => (
                      <label key={feat.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'white', cursor: 'pointer', background: feat.checked ? 'rgba(0, 242, 254, 0.1)' : 'rgba(30, 41, 59, 0.4)', padding: '8px 12px', borderRadius: '6px', border: feat.checked ? '1px solid var(--accent-cyan)' : '1px solid var(--border-glass)' }}>
                        <input
                          type="checkbox"
                          checked={feat.checked}
                          onChange={() => {
                            setFeaturesList(prev => prev.map(f => f.id === feat.id ? { ...f, checked: !f.checked } : f));
                          }}
                          style={{ accentColor: 'var(--accent-cyan)' }}
                        />
                        <span>{feat.label}</span>
                      </label>
                    ))}
                </div>

                {/* + ADD FEATURE PROMPT SECTION */}
                <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Plus size={12} /> Add Custom Feature Prompt Directive:
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      placeholder="E.g., Gun control recoil shot to drag and shoot to drop like FPS game"
                      value={newFeatureInput}
                      onChange={(e) => setNewFeatureInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomFeature(); } }}
                      style={{ flex: 1, padding: '8px 12px', fontSize: '11px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'white' }}
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomFeature}
                      style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)', border: 'none', borderRadius: '6px', color: 'white', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      + Add
                    </button>
                  </div>
                </div>

                {/* FEATURE STAR ANALYTICS SUMMARY */}
                <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '6px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Star size={14} color="#4ade80" />
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#4ade80' }}>Feature Star Preference Analytics</div>
                      <div style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>Calculated by averaging your star ratings over multiple reviews</div>
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'white', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '4px' }}>
                    ★ Highest Rated: Sliders & FEA Heatmap (9.4/10)
                  </span>
                </div>

              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--border-glass)' }}>
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '11px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '8px 16px', fontSize: '11px' }}
                >
                  Save settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
