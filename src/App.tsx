import React, { useState, useEffect, useRef } from 'react';
import type { Database, Subject, Unit, Assignment, Question, Settings, ActiveTab } from './types';
import { Dashboard } from './components/Dashboard';
import { MindMap } from './components/MindMap';
import { SimViewer } from './components/SimViewer';
import { StructuralWorkspace } from './components/structural/StructuralWorkspace';
import { FSRSSpace } from './components/FSRSSpace';
import { PrepPlanner } from './components/PrepPlanner';
import { Settings as SettingsIcon, BookOpen, Layers, FileText, ChevronDown, ChevronRight, ShieldAlert, RefreshCw, Plus, Star, Sliders, CheckSquare, Square, BarChart3, CheckCircle, Terminal } from 'lucide-react';
import { getSimUrl } from './utils/url';
import { safeJsonParse } from './utils/json';

import { DEFAULT_DB } from './data/defaultDb';

export const App: React.FC = () => {
  const DEFAULT_API_KEY = '';
  const DEFAULT_UMS_USER = '';
  const DEFAULT_UMS_PASS = '';

  const [db, setDb] = useState<Database>(DEFAULT_DB);
  const [settings, setSettings] = useState<Settings>({
    apiKey: DEFAULT_API_KEY,
    apiKeyConfigured: true,
    optimizerModel: 'gemini-3.5-flash',
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
  const [apiKeyInput, setApiKeyInput] = useState(DEFAULT_API_KEY);
  const [optModel, setOptModel] = useState('gemini-3.5-flash');
  const [genModel, setGenModel] = useState('gemini-3.5-flash');
  const [styleProfile, setStyleProfile] = useState('universal_pedagogy');
  const [isSyncingUms, setIsSyncingUms] = useState(false);
  const [syncProgressStep, setSyncProgressStep] = useState(1);
  const [syncProgressMessage, setSyncProgressMessage] = useState('');
  const [syncCompleted, setSyncCompleted] = useState(false);
  const [showUmsDashboardModal, setShowUmsDashboardModal] = useState(false);
  const [umsUsernameInput, setUmsUsernameInput] = useState(DEFAULT_UMS_USER);
  const [umsPasswordInput, setUmsPasswordInput] = useState(DEFAULT_UMS_PASS);
  const [showUmsUsername, setShowUmsUsername] = useState(false);
  const [showSubjectFilterPanel, setShowSubjectFilterPanel] = useState(false);
  const [lastCheckedTime, setLastCheckedTime] = useState<string>(() => {
    return localStorage.getItem('ums_last_checked') || new Date().toLocaleTimeString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  });

  // Subject Visibility State (Default hide non-core subjects: Career Orientation, GPSC Civil, CADD)
  const [hiddenSubjectIds, setHiddenSubjectIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('hidden_subject_ids');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return ['career orientation', 'gpsc civil', 'computer aided design & drawing'];
  });

  const toggleSubjectVisibility = (subjectNameOrId: string) => {
    const norm = subjectNameOrId.toLowerCase();
    setHiddenSubjectIds(prev => {
      const updated = prev.includes(norm) ? prev.filter(x => x !== norm) : [...prev, norm];
      localStorage.setItem('hidden_subject_ids', JSON.stringify(updated));
      return updated;
    });
  };

  const isSubjectHidden = (s: Subject) => {
    const normName = s.name.toLowerCase();
    return hiddenSubjectIds.some(h => normName.includes(h) || s.id.toLowerCase() === h);
  };

  const visibleSubjects = db.subjects
    .filter(s => !isSubjectHidden(s))
    .map(s => ({
      ...s,
      units: [...(s.units || [])].sort((a, b) => {
        const numA = typeof a.number === 'number' ? a.number : (parseInt(String(a.name).match(/\d+/)?.[0] || '99', 10));
        const numB = typeof b.number === 'number' ? b.number : (parseInt(String(b.name).match(/\d+/)?.[0] || '99', 10));
        return numA - numB;
      })
    }));

  const filteredDb: Database = {
    ...db,
    subjects: visibleSubjects
  };

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
    { id: 'fps_shooter_drag', label: '🎮 FPS 3D Drag & Drop Target Shooter (Shoot/Drag answer cards into structural targets)', checked: true },
    { id: 'sliders', label: '🎚️ Interactive Parameter Sliders with Real-Time Physics Canvas Updates', checked: true },
    { id: 'drag_drop', label: '🧩 Drag & Drop Formula/Component Slots with Audio Snap & Visual Effects', checked: true },
    { id: 'heatmap', label: '🔥 Finite Element Heatmaps & Stress-Strain Deformation Overlays', checked: true },
    { id: 'graphing', label: '📈 Live Dynamic Charting & Bending Moment / Shear Force Vector Plotters', checked: true },
    { id: 'sound_synth', label: '🔊 Web Audio Synth Effects (Tones shift dynamically with structural load)', checked: true },
    { id: 'speech_narration', label: '🗣️ Web Speech API Audio Narration & Guided Pedagogical Explanations', checked: true },
    { id: 'step_calc', label: '🔢 Step-by-Step Interactive Derivation Solver & Variable Checklist', checked: true },
    { id: 'slot_puzzle', label: '🧩 IS 456 Codebook Clause Lookup & Drag-to-Balance Equation Puzzles', checked: true }
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
        const data = await safeJsonParse(res);
        if (data && data.subjects) setDb(data);
      }
    } catch (error) {
      console.error('Error loading DB:', error);
      try {
        const base = import.meta.env.BASE_URL || '/';
        const cleanBase = base.endsWith('/') ? base : base + '/';
        const res = await fetch(`${cleanBase}data/db.json`);
        if (res.ok) {
          const data = await safeJsonParse(res);
          if (data && data.subjects) setDb(data);
        }
      } catch (e) {}
    }
  };

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await safeJsonParse(res);
        const localKey = localStorage.getItem('gemini_api_key') || data.apiKey || DEFAULT_API_KEY;
        setApiKeyInput(localKey);
        localStorage.setItem('gemini_api_key', localKey);
        setSettings({
          ...data,
          apiKeyConfigured: true
        });
        setOptModel(data.optimizerModel || 'gemini-3.5-flash');
        setGenModel(data.generatorModel || 'gemini-3.5-flash');
        setStyleProfile(data.styleProfile || 'universal_pedagogy');
        setUmsUsernameInput(data.umsUsername || DEFAULT_UMS_USER);
        setUmsPasswordInput(data.umsPassword || DEFAULT_UMS_PASS);
      }
    } catch (error) {
      console.error('Error loading Settings:', error);
      const localKey = localStorage.getItem('gemini_api_key') || DEFAULT_API_KEY;
      setApiKeyInput(localKey);
      localStorage.setItem('gemini_api_key', localKey);
      setSettings(prev => ({ ...prev, apiKeyConfigured: true }));
    }
  };

  const [liveScraperLog, setLiveScraperLog] = useState<string>('');
  const terminalRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [liveScraperLog]);

  const maskId = (id: string) => {
    if (!id) return '';
    if (id.length <= 3) return id;
    return id.substring(0, 3) + '*'.repeat(Math.max(0, id.length - 3));
  };

  const runUmsSyncWithProgress = async () => {
    setIsSyncingUms(true);
    setSyncCompleted(false);
    setSyncProgressStep(1);
    setLiveScraperLog('🎓 Initializing Playwright Scraper Engine for Darshan UMS Portal...\n🔐 Authenticating student credentials...');

    try {
      await fetch('/api/run-ums-scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: settings.umsUsername || DEFAULT_UMS_USER,
          password: settings.umsPassword || DEFAULT_UMS_PASS
        })
      });
    } catch (e) {
      console.warn('Backend sync trigger:', e);
    }

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/ums-scraper-status');
        if (res.ok) {
          const data = await safeJsonParse(res);
          if (data.log) {
            setLiveScraperLog(data.log);
            if (data.log.includes('Logging in')) setSyncProgressStep(2);
            if (data.log.includes('Discovering subject')) setSyncProgressStep(3);
            if (data.log.includes('Navigating to') || data.log.includes('Scraping')) setSyncProgressStep(4);
          }
          if (!data.isRunning) {
            clearInterval(pollInterval);
            setSyncProgressStep(5);
            setSyncCompleted(true);
            const nowFormatted = new Date().toLocaleTimeString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            setLastCheckedTime(nowFormatted);
            localStorage.setItem('ums_last_checked', nowFormatted);
            loadDB();
          }
        }
      } catch (err) {
        console.warn('Error polling scraper log:', err);
      }
    }, 800);
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
    if (apiKeyInput) {
      localStorage.setItem('gemini_api_key', apiKeyInput);
    }
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKeyInput,
          optimizerModel: optModel,
          generatorModel: genModel,
          styleProfile: styleProfile,
          umsUsername: umsUsernameInput,
          umsPassword: umsPasswordInput
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        if (apiKeyInput) {
          setSettings(prev => ({ ...prev, apiKeyConfigured: true }));
        }
        setShowSettings(false);
        alert('Settings saved successfully!');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      if (apiKeyInput) {
        setSettings(prev => ({ ...prev, apiKeyConfigured: true }));
        setShowSettings(false);
        alert('API Key saved locally in browser!');
      }
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


          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div className="sidebar-section-title" style={{ margin: 0 }}>
              Navigation tree
            </div>
            <button
              onClick={() => setShowSubjectFilterPanel(!showSubjectFilterPanel)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border-glass)',
                borderRadius: '4px',
                color: 'var(--accent-cyan)',
                fontSize: '10px',
                fontWeight: 'bold',
                padding: '2px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              👁️ Filter ({visibleSubjects.length}/{db.subjects.length})
            </button>
          </div>

          {showSubjectFilterPanel && (
            <div style={{ padding: '10px', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', border: '1px solid var(--border-glass)', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Show/Hide Subjects:</div>
              {db.subjects.map(s => {
                const hidden = isSubjectHidden(s);
                return (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: hidden ? 'var(--text-muted)' : 'white', cursor: 'pointer' }}>
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', opacity: hidden ? 0.5 : 1 }}>
                      {s.name}
                    </span>
                    <input
                      type="checkbox"
                      checked={!hidden}
                      onChange={() => toggleSubjectVisibility(s.name)}
                      style={{ accentColor: 'var(--accent-cyan)' }}
                    />
                  </label>
                );
              })}
            </div>
          )}
          
          {visibleSubjects.length === 0 ? (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '0 8px' }}>
              No visible subjects. Use filter above to unhide subjects.
            </div>
          ) : (
            <div className="sidebar-list">
              {visibleSubjects.map(subject => {
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
              onClick={() => setShowUmsDashboardModal(true)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                background: 'rgba(168, 85, 247, 0.15)',
                border: '1px solid #a855f7',
                color: '#c084fc',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="View Darshan UMS Content Tracker Dashboard"
            >
              <BarChart3 size={12} /> UMS Dashboard
            </button>
            <button
              onClick={runUmsSyncWithProgress}
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
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
              🕒 Last checked: <strong style={{ color: 'white' }}>{lastCheckedTime}</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#34d399', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>
              <CheckCircle size={12} /> Gemini API Connected
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Semester 5 Workspace</span>
          </div>
        </header>

        {/* Tab views */}
        <div className="content-area">
          {activeTab === 'dashboard' ? (
            <Dashboard
              db={filteredDb}
              selectedSubject={selectedSubject}
              selectedUnit={selectedUnit}
              selectedAssignment={selectedAssignment}
              onRefreshDB={loadDB}
              onSelectQuestion={handleSelectQuestion}
            />
          ) : activeTab === 'mindmap' ? (
            <MindMap
              db={filteredDb}
              onSelectQuestion={handleSelectQuestion}
            />
          ) : activeTab === 'structural' ? (
            <StructuralWorkspace onBackToSim={() => setActiveTab('dashboard')} />
          ) : activeTab === 'prepplanner' ? (
            <PrepPlanner db={filteredDb} />
          ) : (
            <FSRSSpace db={filteredDb} onRefreshDB={loadDB} onSelectQuestion={handleSelectQuestion} />
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

              {/* UMS Login Credentials */}
              <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <label className="form-label" style={{ margin: 0 }}>UMS Username / Phone</label>
                    <button
                      type="button"
                      onClick={() => setShowUmsUsername(!showUmsUsername)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      {showUmsUsername ? '🙈 Hide' : '👁️ Show'}
                    </button>
                  </div>
                  <input
                    type={showUmsUsername ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={umsUsernameInput}
                    onChange={(e) => setUmsUsernameInput(e.target.value)}
                    className="form-input"
                    style={{ letterSpacing: showUmsUsername ? 'normal' : '2px' }}
                  />
                </div>
                <div>
                  <label className="form-label">UMS Password</label>
                  <input
                    type="password"
                    placeholder="Enter UMS password"
                    value={umsPasswordInput}
                    onChange={(e) => setUmsPasswordInput(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              {/* SUBJECT VISIBILITY SETTINGS CARD */}
              <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BookOpen size={14} /> Subject Visibility & Mind Map Filtering ({visibleSubjects.length}/{db.subjects.length} Shown)
                  </label>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Toggle subjects to show/hide across app</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {db.subjects.map(s => {
                    const hidden = isSubjectHidden(s);
                    return (
                      <label key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: hidden ? 'var(--text-muted)' : 'white', cursor: 'pointer', background: !hidden ? 'rgba(0, 242, 254, 0.08)' : 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '6px', border: !hidden ? '1px solid var(--accent-cyan)' : '1px solid var(--border-glass)' }}>
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', opacity: hidden ? 0.5 : 1 }}>
                          {!hidden ? '👁️' : '🙈'} {s.name}
                        </span>
                        <input
                          type="checkbox"
                          checked={!hidden}
                          onChange={() => toggleSubjectVisibility(s.name)}
                          style={{ accentColor: 'var(--accent-cyan)' }}
                        />
                      </label>
                    );
                  })}
                </div>
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

      {/* UMS TRACKER DASHBOARD MODAL */}
      {showUmsDashboardModal && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }}>
          <div className="modal-content glass-card" style={{ maxWidth: '1200px', width: '95vw', height: '90vh', display: 'flex', flexDirection: 'column', padding: '20px', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <BarChart3 size={20} color="#c084fc" />
                <h3 style={{ margin: 0, fontSize: '16px', color: 'white', fontWeight: 'bold' }}>
                  UMS LMS Content Tracker Dashboard
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <a
                  href={getSimUrl('data/ums-dashboard/dashboard.html')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '11px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  Open in New Tab ↗
                </a>
                <button
                  onClick={() => setShowUmsDashboardModal(false)}
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid #ef4444',
                    color: '#f87171',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2)'
                  }}
                  title="Close Dashboard"
                >
                  Close ✖
                </button>
              </div>
            </div>
            <iframe
              src={getSimUrl('data/ums-dashboard/dashboard.html')}
              style={{ width: '100%', height: '100%', border: '1px solid var(--border-glass)', borderRadius: '10px', background: '#07080d' }}
              title="UMS Tracker Dashboard"
            />
          </div>
        </div>
      )}
      {/* UMS PROGRESS TRACKER MODAL */}
      {isSyncingUms && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="modal-content glass-card" style={{ maxWidth: '650px', width: '92vw', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center', borderRadius: '16px', border: '1px solid var(--accent-cyan)' }}>
            
            {/* Spinning Wheel / Success Check Indicator */}
            <div style={{ position: 'relative', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(6, 182, 212, 0.1)', borderRadius: '50%', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
              {!syncCompleted ? (
                <RefreshCw size={34} color="var(--accent-cyan)" className="animate-spin" />
              ) : (
                <CheckCircle size={38} color="#10b981" />
              )}
            </div>

            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 'bold', color: 'white', margin: 0 }}>
                {syncCompleted ? '✨ Darshan UMS Playwright Sync Complete!' : '🔄 Darshan UMS Playwright Scraper Active...'}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
                Portal Account: <strong style={{ color: 'var(--accent-cyan)' }}>{maskId(settings.umsUsername || DEFAULT_UMS_USER)}</strong>
              </p>
            </div>

            {/* REAL-TIME PLAYWRIGHT SCRAPER LIVE TERMINAL LOG CONSOLE */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                <span style={{ fontWeight: 'bold', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Terminal size={14} /> Live Playwright Scraper Terminal Output
                </span>
                <span style={{ fontSize: '10px', color: syncCompleted ? '#34d399' : '#00f2fe' }}>
                  {syncCompleted ? '● Completed' : '● Live Stream'}
                </span>
              </div>
              
              <pre
                ref={terminalRef}
                style={{
                  width: '100%',
                  height: '220px',
                  overflowY: 'auto',
                  background: '#090d16',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '10px',
                  padding: '12px',
                  fontSize: '11px',
                  fontFamily: 'Consolas, Monaco, "Andale Mono", monospace',
                  color: '#38bdf8',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: 0,
                  lineHeight: '1.5'
                }}
              >
                {liveScraperLog || 'Starting scraper engine...'}
              </pre>
            </div>

            {syncCompleted && (
              <button
                onClick={() => setIsSyncingUms(false)}
                className="btn-primary"
                style={{ width: '100%', padding: '10px', fontSize: '13px', fontWeight: 'bold' }}
              >
                Great! Close Progress Tracker
              </button>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

export default App;
