import React, { useState, useRef, useEffect } from 'react';
import type { Database, Question, Unit, Assignment, FsrsItem, Subject } from '../types';
import { ZoomIn, ZoomOut, Maximize2, Plus, X, Folder, File, Layers } from 'lucide-react';

interface MindMapProps {
  db: Database;
  onSelectQuestion: (question: Question) => void;
  onRefreshDB: () => void;
}

interface NodeData {
  id: string;
  type: 'root' | 'subject' | 'unit' | 'category' | 'assignment' | 'question' | 'topic' | 'enote' | 'ppt';
  label: string;
  x: number;
  y: number;
  parentId?: string;
  difficulty?: number;
  status?: string;
  originalData?: any;
}

interface LinkData {
  sourceId: string;
  targetId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

export const MindMap: React.FC<MindMapProps> = ({ db, onSelectQuestion, onRefreshDB }) => {
  // Navigation expand states
  const [mapMode, setMapMode] = useState<'assignments' | 'topics'>('assignments');
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [expandedAssignments, setExpandedAssignments] = useState<Record<string, boolean>>({});

  // Local materials list state
  const [materials, setMaterials] = useState<any[]>([]);

  // Add Subject/Unit Modal states
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [selectedSubId, setSelectedSubId] = useState('');
  const [newUnitNumber, setNewUnitNumber] = useState<number>(1);
  const [newUnitName, setNewUnitName] = useState('');

  // Fetch local materials on mount
  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const res = await fetch('/api/local-assignments');
        if (res.ok) {
          const data = await res.json();
          setMaterials(data);
        }
      } catch (e) {
        console.error('Failed to load local materials in MindMap:', e);
      }
    };
    fetchMaterials();
  }, []);

  // Initialize first subject expanded
  useEffect(() => {
    if (db.subjects.length > 0) {
      setExpandedSubjects(prev => ({ [db.subjects[0].id]: true, ...prev }));
      setSelectedSubId(db.subjects[0].id);
    }
  }, [db]);

  // Matching helper for local materials
  const isMatch = (mat: any, sub: Subject, unit: Unit) => {
    const matSub = mat.subjectName.toLowerCase();
    const subName = sub.name.toLowerCase();
    const subFolder = mat.subjectFolder.toLowerCase();
    const isSubjectMatched = subName.includes(matSub) || matSub.includes(subName) || subFolder.includes(subName);
    return isSubjectMatched && mat.detectedUnit === unit.number;
  };

  const getFsrsColorForNode = (nodeId: string, nodeType: string) => {
    const items = db.fsrsItems || [];
    let associated: FsrsItem[] = [];

    if (nodeType === 'question' || nodeType === 'topic') {
      associated = items.filter(i => i.sourceId === nodeId);
    } else if (nodeType === 'unit') {
      associated = items.filter(i => i.unitId === nodeId);
    }

    if (associated.length === 0) return null;

    const total = associated.reduce((acc, curr) => acc + curr.difficultyRating, 0);
    const avg = total / associated.length;

    if (avg < 4.5) return '#ef4444'; // Red (Hard)
    if (avg >= 7.0) return '#10b981'; // Green (Easy)
    return '#fbbf24'; // Yellow/Orange (Medium)
  };

  // SVG Pan & Zoom state
  const [pan, setPan] = useState({ x: 100, y: 300 });
  const [zoom, setZoom] = useState(0.8);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute Layout Nodes and Links
  const computeLayout = (): { nodes: NodeData[]; links: LinkData[] } => {
    const nodes: NodeData[] = [];
    const links: LinkData[] = [];

    // Helper to calculate the visible height (in leaf slots) of a subtree
    const getSpacingHeight = (nodeId: string, type: 'root' | 'subject' | 'unit' | 'category' | 'assignment'): number => {
      if (type === 'root') {
        return db.subjects.reduce((sum, sub) => sum + getSpacingHeight(sub.id, 'subject'), 0) || 1;
      }
      if (type === 'subject') {
        if (!expandedSubjects[nodeId]) return 1;
        const subject = db.subjects.find(s => s.id === nodeId);
        const units = subject?.units || [];
        return units.reduce((sum, u) => sum + getSpacingHeight(`${nodeId}-${u.id}`, 'unit'), 0) || 1;
      }
      if (type === 'unit') {
        if (!expandedUnits[nodeId]) return 1;
        const parts = nodeId.split('-');
        const subId = parts[0];
        const unitId = parts[1];
        const subject = db.subjects.find(s => s.id === subId);
        if (!subject) return 1;
        const unit = subject.units.find(u => u.id === unitId);
        if (!unit) return 1;

        if (mapMode === 'topics') {
          const topics = unit?.topics || [];
          return topics.length || 1;
        }

        // Partition materials
        const unitMats = materials.filter(m => isMatch(m, subject, unit));
        const hasEnotes = unitMats.some(m => m.materialType === 'enote');
        const hasPpts = unitMats.some(m => m.materialType === 'ppt');
        const hasAssignments = unit.assignments.length > 0 || unitMats.some(m => m.materialType === 'assignment');

        let height = 0;
        if (hasEnotes) {
          height += expandedCategories[`${nodeId}-enote`] ? unitMats.filter(m => m.materialType === 'enote').length : 1;
        }
        if (hasPpts) {
          height += expandedCategories[`${nodeId}-ppt`] ? unitMats.filter(m => m.materialType === 'ppt').length : 1;
        }
        if (hasAssignments) {
          if (expandedCategories[`${nodeId}-assignment`]) {
            height += unit.assignments.reduce((sum, ass) => sum + getSpacingHeight(`${nodeId}-${ass.id}`, 'assignment'), 0) || 1;
          } else {
            height += 1;
          }
        }
        return height || 1;
      }
      if (type === 'assignment') {
        if (!expandedAssignments[nodeId]) return 1;
        const parts = nodeId.split('-');
        const subId = parts[0];
        const unitId = parts[1];
        const assId = parts[3]; // format is subId-unitId-assignment-assId
        const assignment = db.subjects.find(s => s.id === subId)
          ?.units.find(u => u.id === unitId)
          ?.assignments.find(a => a.id === assId);
        const questions = assignment?.questions || [];
        return questions.length || 1;
      }
      return 1;
    };

    const totalSlots = getSpacingHeight('root', 'root');
    let currentSlot = 0;

    const layoutNode = (
      nodeId: string,
      type: 'root' | 'subject' | 'unit' | 'category' | 'assignment' | 'question' | 'topic' | 'enote' | 'ppt',
      x: number,
      parentId: string | undefined,
      label: string,
      originalData: any
    ) => {
      const startSlot = currentSlot;

      if (type === 'root') {
        db.subjects.forEach(subject => {
          layoutNode(subject.id, 'subject', 200, 'root', subject.name, subject);
        });
      } else if (type === 'subject') {
        if (expandedSubjects[nodeId]) {
          const units = originalData.units || [];
          units.forEach((unit: Unit) => {
            const uId = `${nodeId}-${unit.id}`;
            layoutNode(uId, 'unit', x + 240, nodeId, `Unit ${unit.number}: ${unit.name}`, unit);
          });
        } else {
          currentSlot += 1;
        }
      } else if (type === 'unit') {
        if (expandedUnits[nodeId]) {
          if (mapMode === 'topics') {
            const topics = originalData.topics || [];
            if (topics.length === 0) {
              currentSlot += 1;
            } else {
              topics.forEach((t: any) => {
                const tId = `${nodeId}-topic-${t.id}`;
                layoutNode(tId, 'topic', x + 260, nodeId, t.title, t);
              });
            }
          } else {
            const parts = nodeId.split('-');
            const subId = parts[0];
            const subject = db.subjects.find(s => s.id === subId)!;
            const unit = originalData as Unit;
            const unitMats = materials.filter(m => isMatch(m, subject, unit));

            const hasEnotes = unitMats.some(m => m.materialType === 'enote');
            const hasPpts = unitMats.some(m => m.materialType === 'ppt');
            const hasAssignments = unit.assignments.length > 0 || unitMats.some(m => m.materialType === 'assignment');

            if (hasEnotes) {
              const catId = `${nodeId}-enote`;
              layoutNode(catId, 'category', x + 240, nodeId, '📄 E-Notes', { type: 'enote', files: unitMats.filter(m => m.materialType === 'enote') });
            }
            if (hasPpts) {
              const catId = `${nodeId}-ppt`;
              layoutNode(catId, 'category', x + 240, nodeId, '🎬 Presentations', { type: 'ppt', files: unitMats.filter(m => m.materialType === 'ppt') });
            }
            if (hasAssignments) {
              const catId = `${nodeId}-assignment`;
              layoutNode(catId, 'category', x + 240, nodeId, '📚 Assignments', { type: 'assignment', assignments: unit.assignments });
            }
            if (!hasEnotes && !hasPpts && !hasAssignments) {
              currentSlot += 1;
            }
          }
        } else {
          currentSlot += 1;
        }
      } else if (type === 'category') {
        const catKey = nodeId;
        const catType = originalData.type;
        if (expandedCategories[catKey]) {
          if (catType === 'assignment') {
            const dbAsses = originalData.assignments || [];
            if (dbAsses.length === 0) {
              currentSlot += 1;
            } else {
              dbAsses.forEach((ass: Assignment) => {
                const assId = `${parentId}-assignment-${ass.id}`;
                layoutNode(assId, 'assignment', x + 260, catKey, ass.name, ass);
              });
            }
          } else {
            const files = originalData.files || [];
            if (files.length === 0) {
              currentSlot += 1;
            } else {
              files.forEach((file: any, fIdx: number) => {
                const fileId = `${catKey}-file-${fIdx}`;
                layoutNode(fileId, file.materialType, x + 260, catKey, file.detectedTitle, file);
              });
            }
          }
        } else {
          currentSlot += 1;
        }
      } else if (type === 'assignment') {
        if (expandedAssignments[nodeId]) {
          const questions = originalData.questions || [];
          if (questions.length === 0) {
            currentSlot += 1;
          } else {
            questions.forEach((q: Question) => {
              layoutNode(q.id, 'question', x + 280, nodeId, q.text, q);
            });
          }
        } else {
          currentSlot += 1;
        }
      } else if (type === 'question' || type === 'topic' || type === 'enote' || type === 'ppt') {
        currentSlot += 1;
      }

      const endSlot = currentSlot;
      const middleSlot = (startSlot + endSlot) / 2;
      const y = (middleSlot - totalSlots / 2) * 90;

      nodes.push({
        id: nodeId,
        type,
        label,
        x,
        y,
        parentId,
        originalData,
        ...(type === 'question' ? {
          difficulty: originalData.difficulty,
          status: originalData.status,
          simulationFile: originalData.simulationFile
        } : {})
      });
    };

    // Calculate layout starting from root
    layoutNode('root', 'root', 0, undefined, 'Semester 5 Workspace', null);

    // Build link Bezier endpoints from node coordinates
    nodes.forEach(node => {
      if (node.parentId) {
        const parentNode = nodes.find(n => n.id === node.parentId);
        if (parentNode) {
          let color = 'rgba(255, 255, 255, 0.1)';
          if (node.type === 'subject') color = 'var(--accent-cyan)';
          else if (node.type === 'unit') color = 'var(--accent-purple)';
          else if (node.type === 'category') color = 'var(--accent-yellow)';
          else if (node.type === 'enote') color = '#10b981';
          else if (node.type === 'ppt') color = '#38bdf8';
          else if (node.type === 'assignment') color = 'var(--accent-blue)';
          else if (node.type === 'topic') color = '#a855f7';
          else if (node.type === 'question') {
            const hue = ((10 - (node.difficulty || 5)) / 9) * 120;
            color = `hsl(${hue}, 90%, 45%)`;
          }

          links.push({
            sourceId: node.parentId,
            targetId: node.id,
            x1: parentNode.x,
            y1: parentNode.y,
            x2: node.x,
            y2: node.y,
            color
          });
        }
      }
    });

    return { nodes, links };
  };

  const { nodes, links } = computeLayout();

  // Mouse Drag handlers for Pan
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return; // Only left click
    isDragging.current = true;
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging.current) return;
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  // Zoom Handler
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    const newZoom = e.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
    setZoom(Math.max(0.15, Math.min(newZoom, 3.5)));
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '=' || e.key === '+') {
        setZoom(z => Math.min(z * 1.1, 3.5));
      } else if (e.key === '-') {
        setZoom(z => Math.max(z / 1.1, 0.15));
      } else if (e.key === 'ArrowLeft') {
        setPan(p => ({ ...p, x: p.x + 40 }));
      } else if (e.key === 'ArrowRight') {
        setPan(p => ({ ...p, x: p.x - 40 }));
      } else if (e.key === 'ArrowUp') {
        setPan(p => ({ ...p, y: p.y + 40 }));
      } else if (e.key === 'ArrowDown') {
        setPan(p => ({ ...p, y: p.y - 40 }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pan, zoom]);

  const handleNodeClick = (node: NodeData) => {
    if (node.type === 'subject') {
      setExpandedSubjects(prev => ({
        ...prev,
        [node.id]: !prev[node.id]
      }));
    } else if (node.type === 'unit') {
      setExpandedUnits(prev => ({
        ...prev,
        [node.id]: !prev[node.id]
      }));
    } else if (node.type === 'category') {
      setExpandedCategories(prev => ({
        ...prev,
        [node.id]: !prev[node.id]
      }));
    } else if (node.type === 'assignment') {
      setExpandedAssignments(prev => ({
        ...prev,
        [node.id]: !prev[node.id]
      }));
    } else if (node.type === 'enote' || node.type === 'ppt') {
      const file = node.originalData;
      const fileUrl = `http://localhost:5050/${file.filePath.slice(file.filePath.indexOf('downloads'))}`;
      window.open(fileUrl, '_blank');
    } else if (node.type === 'question') {
      onSelectQuestion(node.originalData as Question);
    } else if (node.type === 'topic') {
      const top = node.originalData;
      onSelectQuestion({
        id: top.id,
        text: `[Unit Topic] ${top.title}: ${top.description}`,
        concept: top.concept,
        difficulty: top.difficulty,
        status: top.status,
        simulationFile: top.simulationFile || '',
        hasSteps: top.hasSteps,
        activeStepId: top.activeStepId,
        steps: top.steps
      });
    }
  };

  const getDifficultyColor = (difficulty: number) => {
    const hue = ((10 - difficulty) / 9) * 120;
    return `hsl(${hue}, 100%, 50%)`;
  };

  // Add Subject handler
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;

    try {
      const updatedDb = { ...db };
      const newSubject: Subject = {
        id: `subject-${Date.now()}`,
        name: newSubjectName.trim(),
        units: []
      };
      updatedDb.subjects.push(newSubject);

      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDb)
      });

      if (res.ok) {
        setNewSubjectName('');
        setShowAddSubject(false);
        onRefreshDB();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add Unit handler
  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitName.trim() || !selectedSubId) return;

    try {
      const updatedDb = { ...db };
      const subject = updatedDb.subjects.find(s => s.id === selectedSubId);
      if (subject) {
        const newUnit: Unit = {
          id: `unit-${Date.now()}`,
          number: Number(newUnitNumber),
          name: newUnitName.trim(),
          assignments: [],
          topics: []
        };
        subject.units.push(newUnit);

        const res = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedDb)
        });

        if (res.ok) {
          setNewUnitName('');
          setNewUnitNumber(subject.units.length + 1);
          setShowAddUnit(false);
          onRefreshDB();
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="mindmap-container" ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      
      {/* Floating Control Panel */}
      <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 10, display: 'flex', gap: '8px' }}>
        <button
          onClick={() => setShowAddSubject(true)}
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: '8px',
            color: '#38bdf8',
            padding: '8px 14px',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.2s'
          }}
        >
          <Plus size={12} /> Add Subject
        </button>
        <button
          onClick={() => {
            if (db.subjects.length > 0) {
              setSelectedSubId(db.subjects[0].id);
              setNewUnitNumber(db.subjects[0].units.length + 1);
              setShowAddUnit(true);
            } else {
              alert('Please create a subject first!');
            }
          }}
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(168, 85, 247, 0.4)',
            borderRadius: '8px',
            color: '#c084fc',
            padding: '8px 14px',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.2s'
          }}
        >
          <Plus size={12} /> Add Unit
        </button>
      </div>

      {/* Floating Toolbar (Right) */}
      <div className="mindmap-toolbar">
        <button className="toolbar-btn" onClick={() => setZoom(z => Math.min(z * 1.2, 3.5))} title="Zoom In"><ZoomIn size={16} /></button>
        <button className="toolbar-btn" onClick={() => setZoom(z => Math.max(z / 1.2, 0.15))} title="Zoom Out"><ZoomOut size={16} /></button>
        <button className="toolbar-btn" onClick={() => { setPan({ x: 150, y: 300 }); setZoom(0.8); }} title="Fit Screen"><Maximize2 size={16} /></button>
        <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
        <button
          className={`toolbar-btn ${mapMode === 'assignments' ? 'active' : ''}`}
          onClick={() => setMapMode('assignments')}
          title="Switch to Assignments view"
          style={{ fontSize: '10px', width: 'auto', padding: '0 10px', color: mapMode === 'assignments' ? '#38bdf8' : '#94a3b8' }}
        >
          📚 Materials Mode
        </button>
        <button
          className={`toolbar-btn ${mapMode === 'topics' ? 'active' : ''}`}
          onClick={() => setMapMode('topics')}
          title="Switch to Topics view"
          style={{ fontSize: '10px', width: 'auto', padding: '0 10px', color: mapMode === 'topics' ? '#c084fc' : '#94a3b8' }}
        >
          🧬 Unit Topics Mode
        </button>
      </div>

      {/* Mind Map SVG Canvas */}
      <svg
        className="mindmap-svg"
        style={{ cursor: isDragging.current ? 'grabbing' : 'grab', width: '100%', height: '100%' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          <defs>
            <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-purple" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-blue" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Render Connections */}
          {links.map((link, idx) => {
            const dx = Math.abs(link.x2 - link.x1) * 0.5;
            const pathData = `M ${link.x1} ${link.y1} C ${link.x1 + dx} ${link.y1}, ${link.x2 - dx} ${link.y2}, ${link.x2} ${link.y2}`;
            return (
              <path
                key={`link-${idx}`}
                d={pathData}
                fill="none"
                stroke={link.color}
                strokeWidth={2}
                opacity={0.35}
                strokeDasharray={link.targetId.includes('q-') ? 'none' : '4, 4'}
              />
            );
          })}

          {/* Render Nodes */}
          {nodes.map((node) => {
            if (node.type === 'root') {
              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  <circle r="40" fill="#141724" stroke="var(--accent-cyan)" strokeWidth="3" filter="url(#glow-cyan)" />
                  <text textAnchor="middle" dy="5" fill="#ffffff" fontWeight="bold" fontSize="13" fontFamily="Space Grotesk">
                    {node.label}
                  </text>
                </g>
              );
            }

            if (node.type === 'subject') {
              const isExpanded = expandedSubjects[node.id];
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer"
                  onClick={() => handleNodeClick(node)}
                >
                  <rect
                    x="-65"
                    y="-22"
                    width="130"
                    height="44"
                    rx="8"
                    fill="#151829"
                    stroke={isExpanded ? 'var(--accent-cyan)' : 'rgba(0, 242, 254, 0.4)'}
                    strokeWidth="2"
                    filter={isExpanded ? 'url(#glow-cyan)' : ''}
                  />
                  <text textAnchor="middle" dy="4" fill="#ffffff" fontSize="12" fontWeight="500">
                    {node.label}
                  </text>
                </g>
              );
            }

            if (node.type === 'unit') {
              const isExpanded = expandedUnits[node.id];
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer"
                  onClick={() => handleNodeClick(node)}
                >
                  <rect
                    x="-75"
                    y="-20"
                    width="150"
                    height="40"
                    rx="6"
                    fill="#181427"
                    stroke={isExpanded ? 'var(--accent-purple)' : 'rgba(155, 81, 224, 0.4)'}
                    strokeWidth="2"
                    filter={isExpanded ? 'url(#glow-purple)' : ''}
                  />
                  <text textAnchor="middle" dy="4" fill={getFsrsColorForNode(node.id, 'unit') || '#f3f4f6'} fontSize="11" fontWeight="500">
                    {node.label.length > 22 ? `${node.label.slice(0, 20)}...` : node.label}
                  </text>
                </g>
              );
            }

            if (node.type === 'category') {
              const isExpanded = expandedCategories[node.id];
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer"
                  onClick={() => handleNodeClick(node)}
                >
                  <rect
                    x="-65"
                    y="-16"
                    width="130"
                    height="32"
                    rx="5"
                    fill="#111827"
                    stroke={isExpanded ? 'var(--accent-yellow)' : 'rgba(251, 191, 36, 0.4)'}
                    strokeWidth="1.5"
                  />
                  <text textAnchor="middle" dy="4" fill="#f3f4f6" fontSize="10" fontWeight="bold">
                    {node.label}
                  </text>
                </g>
              );
            }

            if (node.type === 'assignment') {
              const isExpanded = expandedAssignments[node.id];
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer"
                  onClick={() => handleNodeClick(node)}
                >
                  <rect
                    x="-65"
                    y="-18"
                    width="130"
                    height="36"
                    rx="6"
                    fill="#111827"
                    stroke={isExpanded ? 'var(--accent-blue)' : 'rgba(79, 172, 254, 0.4)'}
                    strokeWidth="1.5"
                    filter={isExpanded ? 'url(#glow-blue)' : ''}
                  />
                  <text textAnchor="middle" dy="4" fill="#e5e7eb" fontSize="10">
                    {node.label.length > 22 ? `${node.label.slice(0, 20)}...` : node.label}
                  </text>
                </g>
              );
            }

            if (node.type === 'enote' || node.type === 'ppt') {
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer group"
                  onClick={() => handleNodeClick(node)}
                >
                  <rect
                    x="-65"
                    y="-14"
                    width="130"
                    height="28"
                    rx="4"
                    fill="#0f172a"
                    stroke={node.type === 'enote' ? '#10b981' : '#38bdf8'}
                    strokeWidth="1"
                  />
                  <text textAnchor="middle" dy="4" fill="#e2e8f0" fontSize="9">
                    {node.label.length > 22 ? `${node.label.slice(0, 20)}...` : node.label}
                  </text>
                  <title>{node.originalData.fileName}</title>
                </g>
              );
            }

            if (node.type === 'topic') {
              const top = node.originalData;
              const diffColor = getDifficultyColor(top.difficulty || 5);
              const statusColor = 
                top.status === 'ready' ? 'var(--accent-green)' :
                top.status === 'generating' ? 'var(--accent-cyan)' :
                top.status === 'failed' ? '#ef4444' : '#6b7280';

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer group"
                  onClick={() => handleNodeClick(node)}
                >
                  <circle
                    r="9"
                    fill="#1e1b4b"
                    stroke={diffColor}
                    strokeWidth="2.5"
                    style={{ filter: `drop-shadow(0 0 6px ${diffColor})` }}
                  />
                  <circle r="4" fill="#c084fc" />
                  <circle cx="9" cy="-9" r="3.5" fill={statusColor} />

                  <text
                    x="18"
                    y="1"
                    fill={getFsrsColorForNode(top.id, 'topic') || '#f3f4f6'}
                    fontSize="11"
                    fontWeight="bold"
                    className="group-hover:fill-purple-300 transition-colors"
                  >
                    {node.label.length > 32 ? `${node.label.slice(0, 30)}...` : node.label}
                  </text>
                  <text
                    x="18"
                    y="15"
                    fill="#c084fc"
                    fontSize="9"
                    fontWeight="600"
                  >
                    ★ Imp: {top.importanceScore}/10  |  Diff: {top.difficulty}/10
                  </text>

                  <title>{`${top.title}\nConcept: ${top.concept}\nImportance: ${top.importanceScore}/10\nDifficulty: ${top.difficulty}/10\nStatus: ${top.status}`}</title>
                </g>
              );
            }

            // Question Node (Leaf Node)
            const diffColor = getDifficultyColor(node.difficulty || 5);
            const statusColor = 
              node.status === 'ready' ? 'var(--accent-green)' :
              node.status === 'generating' ? 'var(--accent-cyan)' :
              node.status === 'failed' ? '#ef4444' : '#6b7280';

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                className="cursor-pointer group"
                onClick={() => handleNodeClick(node)}
              >
                <circle
                  r="8"
                  fill="none"
                  stroke={diffColor}
                  strokeWidth="3"
                  style={{ filter: `drop-shadow(0 0 4px ${diffColor})` }}
                />
                <circle r="4" fill="#ffffff" />
                <circle cx="8" cy="-8" r="3" fill={statusColor} />

                <text
                  x="16"
                  y="4"
                  fill={getFsrsColorForNode(node.id, 'question') || '#f3f4f6'}
                  fontSize="11"
                  className="group-hover:fill-cyan-400 transition-colors"
                >
                  {node.label.length > 35 ? `${node.label.slice(0, 32)}...` : node.label}
                </text>
                <title>{`${node.label}\nDifficulty: ${node.difficulty}/10\nStatus: ${node.status}`}</title>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Add Subject Modal */}
      {showAddSubject && (
        <div className="modal-overlay" style={{ display: 'flex', zIndex: 100 }}>
          <div className="modal-box glass-panel" style={{ background: '#080a10', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', margin: 0 }}>Add New Subject</h3>
              <X size={16} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setShowAddSubject(false)} />
            </div>
            <form onSubmit={handleAddSubject} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--text-secondary)' }}>Subject Name</label>
                <input
                  type="text"
                  placeholder="E.g., Design of Steel Structures"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  required
                  style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '8px 10px', color: 'white' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '12px' }}>
                <button type="button" onClick={() => setShowAddSubject(false)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '11px' }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: '6px 12px', fontSize: '11px' }}>Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Unit Modal */}
      {showAddUnit && (
        <div className="modal-overlay" style={{ display: 'flex', zIndex: 100 }}>
          <div className="modal-box glass-panel" style={{ background: '#080a10', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: '#c084fc', margin: 0 }}>Add New Unit</h3>
              <X size={16} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setShowAddUnit(false)} />
            </div>
            <form onSubmit={handleAddUnit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--text-secondary)' }}>Subject</label>
                <select
                  value={selectedSubId}
                  onChange={(e) => {
                    setSelectedSubId(e.target.value);
                    const sub = db.subjects.find(s => s.id === e.target.value);
                    if (sub) {
                      setNewUnitNumber(sub.units.length + 1);
                    }
                  }}
                  required
                  style={{ width: '100%', background: '#0c0f1d', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '8px 10px', color: 'white' }}
                >
                  {db.subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div className="form-group" style={{ width: '80px' }}>
                  <label className="form-label" style={{ color: 'var(--text-secondary)' }}>Unit #</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={newUnitNumber}
                    onChange={(e) => setNewUnitNumber(Number(e.target.value))}
                    required
                    style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '8px 10px', color: 'white' }}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label" style={{ color: 'var(--text-secondary)' }}>Unit Title</label>
                  <input
                    type="text"
                    placeholder="E.g., Tension Member Design"
                    value={newUnitName}
                    onChange={(e) => setNewUnitName(e.target.value)}
                    required
                    style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '8px 10px', color: 'white' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '12px' }}>
                <button type="button" onClick={() => setShowAddUnit(false)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '11px' }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: '6px 12px', fontSize: '11px' }}>Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
