import React, { useState, useEffect } from 'react';
import { PROBLEMS_DB } from './solvers';
import { Layers, CheckCircle, AlertTriangle, Settings, Key, Info, Search, RotateCcw } from 'lucide-react';

interface StructuralWorkspaceProps {
  onBackToSim: () => void;
}

export const StructuralWorkspace: React.FC<StructuralWorkspaceProps> = ({ onBackToSim }) => {
  // Problems database selection
  const [activeProblemId, setActiveProblemId] = useState("t2-q1");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  
  // Active problem inputs
  const [inputs, setInputs] = useState<Record<string, number>>({});
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  
  // Sockets focus state (which socket is waiting for a brick value)
  const [selectedSocketKey, setSelectedSocketKey] = useState<string | null>(null);

  // Settings
  const [customApiKey, setCustomApiKey] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [isApiKeySaved, setIsApiKeySaved] = useState(false);

  // Load active problem
  const activeProblem = PROBLEMS_DB.find(p => p.id === activeProblemId) || PROBLEMS_DB[0];

  // Initialize inputs when active problem changes
  useEffect(() => {
    setInputs({ ...activeProblem.defaultInputs });
    setActiveStepIndex(0);
    setSelectedSocketKey(null);
  }, [activeProblemId]);

  // Compute solver outputs
  const outputs = activeProblem.runSolver(inputs);

  // Filter problems by search & tag
  const filteredProblems = PROBLEMS_DB.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.tutorial.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTag = selectedTag ? p.tags.includes(selectedTag) : true;
    return matchesSearch && matchesTag;
  });

  // Extract all unique tags
  const allTags = Array.from(new Set(PROBLEMS_DB.flatMap(p => p.tags)));

  // Parameter bricks available to drag/click
  const concreteBricks = [20, 25, 30, 40];
  const steelBricks = [250, 415, 500];
  
  // Custom click-to-dock logic
  const handleBrickClick = (value: number, type: 'fck' | 'fy' | 'fy_stirrups') => {
    // If a socket is selected, place it there
    if (selectedSocketKey && (selectedSocketKey === type || (selectedSocketKey === 'fy_stirrups' && type === 'fy'))) {
      setInputs(prev => ({ ...prev, [selectedSocketKey]: value }));
      setSelectedSocketKey(null);
    } else {
      // Find matching socket key automatically
      if (type === 'fck' && 'fck' in inputs) {
        setInputs(prev => ({ ...prev, fck: value }));
      } else if (type === 'fy' && 'fy' in inputs) {
        setInputs(prev => ({ ...prev, fy: value }));
      } else if (type === 'fy_stirrups' && 'fy_stirrups' in inputs) {
        setInputs(prev => ({ ...prev, fy_stirrups: value }));
      }
    }
  };

  const handleResetInputs = () => {
    setInputs({ ...activeProblem.defaultInputs });
    setActiveStepIndex(0);
  };

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    setIsApiKeySaved(true);
    setShowSettings(false);
  };

  const activeStep = activeProblem.steps[activeStepIndex] || activeProblem.steps[0];
  const formulaString = activeStep.getFormula(inputs, outputs);
  const substitutionString = activeStep.getSubstitution(inputs, outputs);
  const checkResult = activeStep.getCheck(inputs, outputs);

  // Helper to render math-like string cleanly
  const renderCleanMath = (str: string) => {
    return str.split('\\\\').map((line, idx) => {
      let cleanLine = line
        .replace(/\\cdot/g, ' · ')
        .replace(/\\times/g, ' × ')
        .replace(/\\frac{([^}]+)}{([^}]+)}/g, '($1)/($2)')
        .replace(/\\sqrt{([^}]+)}/g, '√($1)')
        .replace(/\\text{([^}]+)}/g, '$1')
        .replace(/\^2/g, '²')
        .replace(/\^3/g, '³')
        .replace(/\\phi/g, 'Ø')
        .replace(/\\cdot/g, '·')
        .replace(/\\quad/g, '   ')
        .replace(/\\%/g, '%')
        .replace(/\\le/g, '≤')
        .replace(/\\ge/g, '≥')
        .replace(/\\approx/g, '≈')
        .replace(/\\cdot/g, '·')
        .replace(/_{([^}]+)}/g, '_$1'); // subscripts
      return (
        <div key={idx} className="math-line" style={{ padding: '4px 0', fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#e2e8f0' }}>
          {cleanLine}
        </div>
      );
    });
  };

  return (
    <div className="structural-workspace" style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0f172a', color: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Workspace Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid #1e293b', background: '#1e293b80', backdropFilter: 'blur(8px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '8px', borderRadius: '8px', background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', color: '#fff' }}>
            <Layers size={18} />
          </div>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 'bold', letterSpacing: '0.5px' }}>SUM MASTERING (MIDTERM PREP)</h1>
            <span style={{ fontSize: '10px', color: '#94a3b8' }}>RCC Beam Design & Analysis Solver</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '11px', background: '#0e749033', color: '#22d3ee', padding: '4px 10px', borderRadius: '12px', border: '1px solid #22d3ee44', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22d3ee', display: 'inline-block' }}></span>
            15 Days Remaining
          </div>
          
          <button 
            onClick={() => setShowSettings(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: '1px solid #334155', borderRadius: '6px', background: 'transparent', fontSize: '11px', color: '#94a3b8', cursor: 'pointer' }}
          >
            <Settings size={14} /> API Settings
          </button>

          <button 
            onClick={onBackToSim}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontSize: '11px', borderRadius: '6px', fontWeight: '6px', background: 'linear-gradient(90deg, #0891b2, #0284c7)', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            Back to Simulator
          </button>
        </div>
      </header>

      {/* Main Workspace Panels */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT PANEL: Classification & Library */}
        <aside style={{ width: '280px', display: 'flex', flexDirection: 'column', borderRight: '1px solid #1e293b', background: '#0f172af0' }}>
          
          {/* Section 1: Classification Search */}
          <div style={{ padding: '16px', borderBottom: '1px solid #1e293b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Search size={14} style={{ color: '#64748b' }} />
              <input 
                type="text" 
                placeholder="Search tutorials..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: '12px', color: '#f8fafc' }}
              />
            </div>
            
            {/* Tags scrolling list */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
              <button 
                onClick={() => setSelectedTag(null)}
                style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: !selectedTag ? '#22d3ee' : '#1e293b', color: !selectedTag ? '#0f172a' : '#94a3b8', cursor: 'pointer', border: 'none' }}
              >
                All
              </button>
              {allTags.map(tag => (
                <button 
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: selectedTag === tag ? '#22d3ee' : '#1e293b', color: selectedTag === tag ? '#0f172a' : '#94a3b8', cursor: 'pointer', border: 'none', whiteSpace: 'nowrap' }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Tutorials Tree */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', paddingLeft: '6px' }}>PROBLEMS CLASSIFICATION TREE</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
              {filteredProblems.map(p => (
                <button
                  key={p.id}
                  onClick={() => setActiveProblemId(p.id)}
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'flex-start',
                    textAlign: 'left',
                    padding: '10px', 
                    borderRadius: '8px', 
                    background: activeProblemId === p.id ? '#1e293b' : 'transparent', 
                    border: '1px solid ' + (activeProblemId === p.id ? '#334155' : 'transparent'),
                    cursor: 'pointer',
                    color: '#f8fafc',
                    width: '100%',
                    transition: 'all 0.2s'
                  }}
                >
                  <span style={{ fontSize: '9px', color: '#06b6d4', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>T{p.qNumber} - {p.tutorial.split(':')[0]}</span>
                  <span style={{ fontSize: '11px', fontWeight: '600', marginTop: '2px' }}>{p.title}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                    {p.tags.slice(0, 2).map(t => (
                      <span key={t} style={{ fontSize: '8px', color: '#94a3b8', background: '#334155', padding: '1px 4px', borderRadius: '4px' }}>{t}</span>
                    ))}
                  </div>
                </button>
              ))}
              {filteredProblems.length === 0 && (
                <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', padding: '20px 0' }}>No matching problems found.</div>
              )}
            </div>
          </div>

          {/* Section 3: Parameter Bricks Library */}
          <div style={{ padding: '16px', borderTop: '1px solid #1e293b', background: '#1e293b40' }}>
            <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '10px' }}>PARAMETER BRICKS LIBRARY</span>
            
            {/* Concrete fck Bricks */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Concrete grade (fck)</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {concreteBricks.map(v => (
                  <button 
                    key={v}
                    onClick={() => handleBrickClick(v, 'fck')}
                    style={{ flex: 1, fontSize: '10px', fontWeight: 'bold', padding: '6px 0', border: '1px solid #22d3ee', borderRadius: '6px', background: inputs.fck === v ? '#22d3ee33' : '#0f172a', color: '#22d3ee', cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    M{v}
                  </button>
                ))}
              </div>
            </div>

            {/* Steel fy Bricks */}
            <div>
              <label style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Steel Grade (fy)</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {steelBricks.map(v => (
                  <button 
                    key={v}
                    onClick={() => handleBrickClick(v, 'fy')}
                    style={{ flex: 1, fontSize: '10px', fontWeight: 'bold', padding: '6px 0', border: '1px solid #3b82f6', borderRadius: '6px', background: inputs.fy === v || inputs.fy_stirrups === v ? '#3b82f633' : '#0f172a', color: '#60a5fa', cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    Fe{v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER PANEL: Interactive Dock, Beam Visualizer & Walker */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0b0f19', borderRight: '1px solid #1e293b', overflowY: 'auto', padding: '20px' }}>
          
          {/* Header section of center panel */}
          <div style={{ borderBottom: '1px solid #1e293b', paddingBottom: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: '15px', fontWeight: 'bold', color: '#38bdf8' }}>{activeProblem.title}</h2>
                <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', lineHeight: '1.4' }}>{activeProblem.description}</p>
              </div>
              <button 
                onClick={handleResetInputs}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', border: '1px solid #334155', borderRadius: '4px', background: 'transparent', fontSize: '10px', color: '#94a3b8', cursor: 'pointer' }}
                title="Reset default C-3 parameters"
              >
                <RotateCcw size={10} /> Reset C-3
              </button>
            </div>

            {/* Render active problem tags */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
              {activeProblem.tags.map(t => (
                <span key={t} style={{ fontSize: '9px', background: '#0e749020', border: '1px solid #0e749050', color: '#22d3ee', padding: '2px 8px', borderRadius: '4px' }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Section: Sockets Input Dock */}
          <div className="input-dock-section" style={{ background: '#1e293b30', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
            <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '12px' }}>INPUT DOCK SOCKETS (C-3 ACTIVE PARAMETERS)</span>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
              {Object.keys(inputs).map(key => (
                <div 
                  key={key} 
                  onClick={() => setSelectedSocketKey(key)}
                  style={{ 
                    background: selectedSocketKey === key ? '#22d3ee10' : '#0f172a',
                    border: '1px solid ' + (selectedSocketKey === key ? '#22d3ee' : '#334155'),
                    borderRadius: '8px', 
                    padding: '8px 12px',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.2s'
                  }}
                >
                  <span style={{ fontSize: '9px', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>{key} socket</span>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff', marginTop: '4px', display: 'block' }}>
                    {key === 'fck' ? `M${inputs[key]}` : key.startsWith('fy') ? `Fe${inputs[key]}` : `${inputs[key]}${key === 'span' || key === 'L_eff' ? ' m' : key.includes('Width') || key === 'b' || key === 'd' || key === 'D' || key === 'dc' || key === 'Df' || key === 'bf' || key === 'bw' || key === 'barDia' || key === 'barDiaTension' || key === 'barDiaComp' || key === 'dia_stirrups' ? ' mm' : key === 'Vu' ? ' kN' : key === 'Mu' ? ' kN-m' : key === 'Tu' ? ' kN-m' : ''}`}
                  </span>
                  
                  {/* Slider option for spans and loads */}
                  {(key === 'span' || key === 'DL' || key === 'LL' || key === 'Vu' || key === 'Mu' || key === 'Tu' || key === 'b' || key === 'd' || key === 'D') && (
                    <div style={{ marginTop: '6px' }} onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="range"
                        min={key === 'span' ? 2 : key === 'DL' || key === 'LL' || key === 'Vu' || key === 'Mu' || key === 'Tu' ? 5 : 100}
                        max={key === 'span' ? 10 : key === 'DL' || key === 'LL' ? 100 : key === 'Vu' ? 300 : key === 'Mu' ? 600 : key === 'Tu' ? 100 : 1000}
                        step={key === 'span' ? 0.5 : key === 'b' || key === 'd' || key === 'D' ? 10 : 5}
                        value={inputs[key]}
                        onChange={(e) => setInputs(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                        style={{ width: '100%', height: '4px', background: '#334155', outline: 'none' }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section: Live SVG Structural Visualizer */}
          <div style={{ background: '#1e293b15', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px', marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', alignSelf: 'flex-start', marginBottom: '12px' }}>BEAM DIAGRAM & CROSS SECTION VISUALIZATION</span>
            
            <div style={{ display: 'flex', gap: '20px', width: '100%', justifyContent: 'space-around', flexWrap: 'wrap' }}>
              
              {/* Beam Elevation View */}
              <svg width="280" height="120" style={{ background: '#0b111e', borderRadius: '8px', border: '1px solid #1e293b' }}>
                {/* Supports */}
                <path d="M 30,80 L 40,95 L 20,95 Z" fill="#64748b" />
                <path d="M 250,80 L 260,95 L 240,95 Z" fill="#64748b" />
                {/* Beam body */}
                <rect x="25" y="45" width="230" height="35" fill="#475569" stroke="#94a3b8" strokeWidth="1" />
                {/* UDL representation */}
                <path d="M 30,35 Q 40,25 50,35 Q 60,25 70,35 Q 80,25 90,35 Q 100,25 110,35 Q 120,25 130,35 Q 140,25 150,35 Q 160,25 170,35 Q 180,25 190,35 Q 200,25 210,35 Q 220,25 230,35 Q 240,25 250,35" fill="none" stroke="#eab308" strokeWidth="1.5" />
                <text x="140" y="20" fill="#eab308" fontSize="9" textAnchor="middle" fontFamily="monospace">
                  {inputs.DL || inputs.Vu ? `UDL = ${inputs.DL ? (inputs.DL + (outputs.selfWeight || 0)).toFixed(1) : (inputs.Vu ? (inputs.Vu/3).toFixed(1) : '20.0')} kN/m` : 'Balanced Loading'}
                </text>
                
                {/* Span text */}
                <text x="140" y="112" fill="#94a3b8" fontSize="10" textAnchor="middle" fontFamily="monospace">
                  Span = {inputs.span || 3.0} m
                </text>
                <line x1="30" y1="102" x2="250" y2="102" stroke="#475569" strokeWidth="1" />
                <line x1="30" y1="98" x2="30" y2="106" stroke="#475569" strokeWidth="1" />
                <line x1="250" y1="98" x2="250" y2="106" stroke="#475569" strokeWidth="1" />
              </svg>

              {/* Beam Cross Section View */}
              <svg width="180" height="120" style={{ background: '#0b111e', borderRadius: '8px', border: '1px solid #1e293b' }}>
                {/* Concrete rect */}
                <rect x="55" y="15" width="70" height="90" fill="#334155" stroke="#94a3b8" strokeWidth="1" />
                {/* Reinforcement Steel dots */}
                {/* Tension steel */}
                <circle cx="67" cy="92" r="4" fill="#60a5fa" />
                <circle cx="90" cy="92" r="4" fill="#60a5fa" />
                <circle cx="113" cy="92" r="4" fill="#60a5fa" />
                
                {/* Compression steel (if doubly) */}
                {('Asc' in outputs && outputs.Asc > 0) && (
                  <>
                    <circle cx="67" cy="28" r="3" fill="#ef4444" />
                    <circle cx="90" cy="28" r="3" fill="#ef4444" />
                    <circle cx="113" cy="28" r="3" fill="#ef4444" />
                  </>
                )}

                {/* Stirrup outline */}
                <rect x="62" y="22" width="56" height="76" fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray={inputs.Vu ? "none" : "3,3"} />

                {/* Section labels */}
                <text x="90" y="112" fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="monospace">
                  b = {inputs.b || 230} mm
                </text>
                <text x="25" y="65" fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="monospace">
                  D={inputs.D || inputs.d || 500}
                </text>
                <line x1="45" y1="15" x2="45" y2="105" stroke="#475569" strokeWidth="1" />
              </svg>

            </div>
          </div>

          {/* Section: Engineer Journey Mascot Walking Timeline */}
          <div style={{ background: '#1e293b15', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px 20px', position: 'relative' }}>
            <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '16px' }}>MASCOT JOURNEY PATHWAY (CALCULATION TIMELINE)</span>
            
            {/* Timeline nodes */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', padding: '0 20px' }}>
              <div style={{ position: 'absolute', top: '15px', left: '40px', right: '40px', height: '3px', background: '#334155', zIndex: 1 }}></div>
              <div style={{ position: 'absolute', top: '15px', left: '40px', width: `${(activeStepIndex / (activeProblem.steps.length - 1)) * 100}%`, height: '3px', background: 'linear-gradient(90deg, #22d3ee, #3b82f6)', zIndex: 1, transition: 'all 0.3s' }}></div>

              {activeProblem.steps.map((_, idx) => {
                const isCompleted = idx < activeStepIndex;
                const isActive = idx === activeStepIndex;
                return (
                  <button
                    key={idx}
                    onClick={() => setActiveStepIndex(idx)}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: isCompleted ? '#22d3ee' : isActive ? '#0f172a' : '#1e293b',
                      border: '2.5px solid ' + (isActive ? '#22d3ee' : isCompleted ? '#22d3ee' : '#475569'),
                      color: isCompleted ? '#0f172a' : isActive ? '#22d3ee' : '#94a3b8',
                      fontWeight: 'bold',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2,
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                  >
                    {idx + 1}
                    {isActive && (
                      <span style={{
                        position: 'absolute',
                        top: '-36px',
                        fontSize: '18px',
                        animation: 'bounce 1s infinite'
                      }}>
                        👷
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Step navigation buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
              <button
                disabled={activeStepIndex === 0}
                onClick={() => setActiveStepIndex(prev => Math.max(0, prev - 1))}
                style={{ 
                  padding: '6px 16px', 
                  borderRadius: '6px', 
                  border: '1px solid #334155', 
                  background: 'transparent', 
                  color: activeStepIndex === 0 ? '#475569' : '#94a3b8', 
                  cursor: activeStepIndex === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '11px'
                }}
              >
                Previous Step
              </button>
              
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Step {activeStepIndex + 1} of {activeProblem.steps.length}
              </div>

              <button
                disabled={activeStepIndex === activeProblem.steps.length - 1}
                onClick={() => setActiveStepIndex(prev => Math.min(activeProblem.steps.length - 1, prev + 1))}
                style={{ 
                  padding: '6px 16px', 
                  borderRadius: '6px', 
                  border: 'none', 
                  background: activeStepIndex === activeProblem.steps.length - 1 ? '#334155' : 'linear-gradient(90deg, #22d3ee, #3b82f6)', 
                  color: activeStepIndex === activeProblem.steps.length - 1 ? '#64748b' : '#0f172a', 
                  fontWeight: 'bold',
                  cursor: activeStepIndex === activeProblem.steps.length - 1 ? 'not-allowed' : 'pointer',
                  fontSize: '11px'
                }}
              >
                Next Step
              </button>
            </div>
          </div>

        </main>

        {/* RIGHT PANEL: Calculation steps, LaTeX Pane, IS Lookup */}
        <aside style={{ width: '380px', display: 'flex', flexDirection: 'column', background: '#0f172af0' }}>
          
          {/* Section 1: Active Calculation Step Card */}
          <div style={{ padding: '20px', borderBottom: '1px solid #1e293b', flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>CALCULATION PANE</span>
            
            <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#38bdf8' }}>{activeStep.title}</h4>
                <span style={{ fontSize: '9px', background: '#1e293b', color: '#94a3b8', padding: '2px 6px', borderRadius: '4px' }}>{activeStep.clause}</span>
              </div>
              <p style={{ fontSize: '11px', color: '#94a3b8', lineHeight: '1.4', marginBottom: '12px' }}>{activeStep.description}</p>
              
              {/* Formula Render Block */}
              <div style={{ background: '#090d16', borderLeft: '3px solid #22d3ee', padding: '10px 12px', borderRadius: '0 6px 6px 0', marginBottom: '12px' }}>
                <span style={{ fontSize: '8px', color: '#64748b', display: 'block', marginBottom: '4px' }}>FORMULA CODE REFERENCE</span>
                {renderCleanMath(formulaString)}
              </div>

              {/* Substitution Block */}
              <div style={{ background: '#090d16', borderLeft: '3px solid #eab308', padding: '10px 12px', borderRadius: '0 6px 6px 0' }}>
                <span style={{ fontSize: '8px', color: '#64748b', display: 'block', marginBottom: '4px' }}>VALUE SUBSTITUTION & RESOLUTION</span>
                {renderCleanMath(substitutionString)}
              </div>
            </div>

            {/* Safety Check Badge */}
            {checkResult && (
              <div style={{ 
                display: 'flex', 
                gap: '10px', 
                alignItems: 'center', 
                padding: '10px 14px', 
                borderRadius: '8px', 
                background: checkResult.success ? '#06b6d415' : '#eab30815', 
                border: '1px solid ' + (checkResult.success ? '#06b6d433' : '#eab30833'),
                color: checkResult.success ? '#22d3ee' : '#fbbf24',
                fontSize: '11px',
                lineHeight: '1.4'
              }}>
                {checkResult.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                <div>
                  <strong style={{ fontWeight: 'bold' }}>{checkResult.success ? 'Safe Check Passed: ' : 'Attention Required: '}</strong>
                  {checkResult.text}
                </div>
              </div>
            )}
          </div>

          {/* Section 2: IS Code Value Lookup */}
          <div style={{ padding: '16px', borderTop: '1px solid #1e293b', background: '#1e293b20', maxHeight: '200px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>IS CODE VALUE LOOKUP</span>
              <span style={{ fontSize: '9px', color: '#22d3ee', fontWeight: 'bold' }}>IS 456 Table 19</span>
            </div>

            <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse', color: '#94a3b8' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', color: '#f8fafc' }}>
                  <th style={{ textAlign: 'left', padding: '4px 0' }}>Pt (%)</th>
                  <th style={{ textAlign: 'right', padding: '4px 0' }}>M20</th>
                  <th style={{ textAlign: 'right', padding: '4px 0' }}>M25</th>
                  <th style={{ textAlign: 'right', padding: '4px 0' }}>M30</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '4px 0' }}>0.25%</td>
                  <td style={{ textAlign: 'right', color: '#fff' }}>0.36</td>
                  <td style={{ textAlign: 'right' }}>0.36</td>
                  <td style={{ textAlign: 'right' }}>0.37</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '4px 0' }}>0.50%</td>
                  <td style={{ textAlign: 'right', color: '#fff' }}>0.48</td>
                  <td style={{ textAlign: 'right' }}>0.49</td>
                  <td style={{ textAlign: 'right' }}>0.50</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '4px 0' }}>0.75%</td>
                  <td style={{ textAlign: 'right', color: '#fff' }}>0.56</td>
                  <td style={{ textAlign: 'right' }}>0.57</td>
                  <td style={{ textAlign: 'right' }}>0.59</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 0' }}>1.00%</td>
                  <td style={{ textAlign: 'right', color: '#fff' }}>0.62</td>
                  <td style={{ textAlign: 'right' }}>0.64</td>
                  <td style={{ textAlign: 'right' }}>0.66</td>
                </tr>
              </tbody>
            </table>
            
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '8px', fontStyle: 'italic', display: 'flex', gap: '4px', alignItems: 'center' }}>
              <Info size={10} /> Interpolated shear strength (τ_c) is computed dynamically.
            </div>
          </div>
        </aside>

      </div>

      {/* Settings Modal (API Key configuration override) */}
      {showSettings && (
        <div className="modal-overlay">
          <div className="modal-box glass-panel" style={{ maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={16} /> API Key Configuration Override
              </h3>
              <button onClick={() => setShowSettings(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '18px', cursor: 'pointer' }}>&times;</button>
            </div>
            
            <form onSubmit={handleSaveApiKey} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px' }}>
              <p style={{ fontSize: '11px', color: '#94a3b8', lineHeight: '1.4' }}>
                By default, this solver workspace uses the global API key configured on your dashboard. Supply a separate key below if you wish to override it.
              </p>
              
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '11px' }}>Custom API Key</label>
                <input 
                  type="password" 
                  placeholder={isApiKeySaved ? "••••••••••••••••" : "Paste your custom AIzaSy... key"}
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  style={{ width: '100%', fontSize: '11px', fontFamily: 'monospace' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowSettings(false)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '11px' }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: '6px 12px', fontSize: '11px' }}>Save Override</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
