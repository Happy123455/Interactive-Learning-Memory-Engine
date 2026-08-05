import React, { useState, useRef, useEffect } from 'react';
import type { Database, Question, Unit, Assignment, FsrsItem } from '../types';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface MindMapProps {
  db: Database;
  onSelectQuestion: (question: Question) => void;
}

interface NodeData {
  id: string;
  type: 'root' | 'subject' | 'unit' | 'assignment' | 'question' | 'topic';
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

export const MindMap: React.FC<MindMapProps> = ({ db, onSelectQuestion }) => {
  // Navigation expand states
  const [mapMode, setMapMode] = useState<'assignments' | 'topics'>('assignments');
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});
  const [expandedAssignments, setExpandedAssignments] = useState<Record<string, boolean>>({});

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

  // Initialize first subject expanded
  useEffect(() => {
    if (db.subjects.length > 0) {
      setExpandedSubjects(prev => ({ [db.subjects[0].id]: true, ...prev }));
    }
  }, [db]);

  // Compute Layout Nodes and Links
  const computeLayout = (): { nodes: NodeData[]; links: LinkData[] } => {
    const nodes: NodeData[] = [];
    const links: LinkData[] = [];

    // Helper to calculate the visible height (in leaf slots) of a subtree
    const getSpacingHeight = (nodeId: string, type: 'root' | 'subject' | 'unit' | 'assignment'): number => {
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
        const unit = db.subjects.find(s => s.id === subId)?.units.find(u => u.id === unitId);

        if (mapMode === 'topics') {
          const topics = unit?.topics || [];
          return topics.length || 1;
        }

        const assignments = unit?.assignments || [];
        return assignments.reduce((sum, ass) => sum + getSpacingHeight(`${nodeId}-${ass.id}`, 'assignment'), 0) || 1;
      }
      if (type === 'assignment') {
        if (!expandedAssignments[nodeId]) return 1;
        const parts = nodeId.split('-');
        const subId = parts[0];
        const unitId = parts[1];
        const assId = parts[2];
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
      type: 'root' | 'subject' | 'unit' | 'assignment' | 'question' | 'topic',
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
            const assignments = originalData.assignments || [];
            assignments.forEach((ass: Assignment) => {
              const assId = `${nodeId}-${ass.id}`;
              layoutNode(assId, 'assignment', x + 260, nodeId, ass.name, ass);
            });
          }
        } else {
          currentSlot += 1;
        }
      } else if (type === 'assignment') {
        if (expandedAssignments[nodeId]) {
          const questions = originalData.questions || [];
          questions.forEach((q: Question) => {
            layoutNode(q.id, 'question', x + 280, nodeId, q.text, q);
          });
        } else {
          currentSlot += 1;
        }
      } else if (type === 'question' || type === 'topic') {
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
    layoutNode('root', 'root', 0, undefined, 'Semester 5', null);

    // Build link Bezier endpoints from node coordinates
    nodes.forEach(node => {
      if (node.parentId) {
        const parentNode = nodes.find(n => n.id === node.parentId);
        if (parentNode) {
          let color = 'rgba(255, 255, 255, 0.1)';
          if (node.type === 'subject') color = 'var(--accent-cyan)';
          else if (node.type === 'unit') color = 'var(--accent-purple)';
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

  // Dragging mechanics
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  // Zoom centered around the mouse cursor
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const zoomFactor = 1.15;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const canvasX = (mouseX - pan.x) / zoom;
    const canvasY = (mouseY - pan.y) / zoom;

    let nextZoom = zoom;
    if (e.deltaY < 0) {
      nextZoom = Math.min(zoom * zoomFactor, 2.5);
    } else {
      nextZoom = Math.max(zoom / zoomFactor, 0.2);
    }

    setZoom(nextZoom);
    setPan({
      x: mouseX - canvasX * nextZoom,
      y: mouseY - canvasY * nextZoom
    });
  };

  // Keyboard controls for zooming (+/-) and panning (arrow keys / WASD)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toLowerCase();
      const zoomFactor = 1.15;

      if (key === '+' || key === '=' || e.keyCode === 187) {
        e.preventDefault();
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const midX = rect.width / 2;
          const midY = rect.height / 2;
          const canvasX = (midX - pan.x) / zoom;
          const canvasY = (midY - pan.y) / zoom;
          const nextZoom = Math.min(zoom * zoomFactor, 2.5);
          setZoom(nextZoom);
          setPan({
            x: midX - canvasX * nextZoom,
            y: midY - canvasY * nextZoom
          });
        } else {
          setZoom(z => Math.min(z * zoomFactor, 2.5));
        }
      } else if (key === '-' || key === '_' || e.keyCode === 189) {
        e.preventDefault();
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const midX = rect.width / 2;
          const midY = rect.height / 2;
          const canvasX = (midX - pan.x) / zoom;
          const canvasY = (midY - pan.y) / zoom;
          const nextZoom = Math.max(zoom / zoomFactor, 0.2);
          setZoom(nextZoom);
          setPan({
            x: midX - canvasX * nextZoom,
            y: midY - canvasY * nextZoom
          });
        } else {
          setZoom(z => Math.max(z / zoomFactor, 0.2));
        }
      } else if (key === '0' || key === 'r') {
        e.preventDefault();
        setZoom(0.8);
        setPan({ x: 100, y: 300 });
      } else if (key === 'arrowleft' || key === 'a') {
        e.preventDefault();
        setPan(p => ({ ...p, x: p.x + 40 }));
      } else if (key === 'arrowright' || key === 'd') {
        e.preventDefault();
        setPan(p => ({ ...p, x: p.x - 40 }));
      } else if (key === 'arrowup' || key === 'w') {
        e.preventDefault();
        setPan(p => ({ ...p, y: p.y + 40 }));
      } else if (key === 'arrowdown' || key === 's') {
        e.preventDefault();
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
    } else if (node.type === 'assignment') {
      setExpandedAssignments(prev => ({
        ...prev,
        [node.id]: !prev[node.id]
      }));
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

  // Helper for Difficulty gradient calculation
  const getDifficultyColor = (difficulty: number) => {
    const hue = ((10 - difficulty) / 9) * 120; // 10 -> 0 (red), 1 -> 120 (green)
    return `hsl(${hue}, 100%, 50%)`;
  };


  return (
    <div className="mindmap-container" ref={containerRef}>
      {/* HUD Toolbar */}
      <div className="mindmap-toolbar glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.4)', borderRadius: '6px', padding: '2px' }}>
          <button
            onClick={() => setMapMode('assignments')}
            style={{
              padding: '4px 8px',
              fontSize: '10px',
              fontWeight: 'bold',
              borderRadius: '4px',
              border: 'none',
              background: mapMode === 'assignments' ? 'var(--accent-cyan)' : 'transparent',
              color: mapMode === 'assignments' ? '#05060b' : 'var(--text-secondary)'
            }}
          >
            📚 Assignment Questions
          </button>
          <button
            onClick={() => setMapMode('topics')}
            style={{
              padding: '4px 8px',
              fontSize: '10px',
              fontWeight: 'bold',
              borderRadius: '4px',
              border: 'none',
              background: mapMode === 'topics' ? 'var(--accent-purple)' : 'transparent',
              color: mapMode === 'topics' ? '#ffffff' : 'var(--text-secondary)'
            }}
          >
            🎓 Unit PPT Topics
          </button>
        </div>

        <button
          onClick={() => setZoom(z => Math.min(z * 1.2, 2.5))}
          title="Zoom In"
        >
          <ZoomIn size={18} />
        </button>
        <button
          onClick={() => setZoom(z => Math.max(z / 1.2, 0.2))}
          title="Zoom Out"
        >
          <ZoomOut size={18} />
        </button>
        <button
          onClick={() => {
            setZoom(0.8);
            setPan({ x: 100, y: 300 });
          }}
          title="Reset View"
        >
          <Maximize2 size={18} />
        </button>
      </div>

      <div className="mindmap-legend glass-panel pointer-events-none">
        <div className="mindmap-legend-title">Difficulty Grade</div>
        <div className="mindmap-legend-row">
          <span className="mindmap-dot green"></span>
          <span>Easy</span>
          <span style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>→</span>
          <span className="mindmap-dot red"></span>
          <span>Hard</span>
        </div>
      </div>

      {/* SVG Canvas */}
      <svg
        className="mindmap-svg"
        style={{ cursor: isDragging.current ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Defs for Glows and Gradients */}
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
                  <text textAnchor="middle" dy="4" fill="#e5e7eb" fontSize="11">
                    {node.label}
                  </text>
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
                {/* Glow ring */}
                <circle
                  r="8"
                  fill="none"
                  stroke={diffColor}
                  strokeWidth="3"
                  style={{ filter: `drop-shadow(0 0 4px ${diffColor})` }}
                />
                <circle r="4" fill="#ffffff" />
                
                {/* Status Dot */}
                <circle cx="8" cy="-8" r="3" fill={statusColor} />

                {/* Text Label */}
                <text
                  x="16"
                  y="4"
                  fill={getFsrsColorForNode(node.id, 'question') || '#f3f4f6'}
                  fontSize="11"
                  className="group-hover:fill-cyan-400 transition-colors"
                >
                  {node.label.length > 35 ? `${node.label.slice(0, 32)}...` : node.label}
                </text>

                {/* Tooltip on hover */}
                <title>{`${node.label}\nDifficulty: ${node.difficulty}/10\nStatus: ${node.status}`}</title>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};
