import React, { useState, useEffect } from 'react';
import type { Database, Subject, Unit, Assignment, Question } from '../types';
import { Plus, Upload, BookOpen, Layers, FileText, BarChart2, AlertCircle, RefreshCw, Play, Loader, XCircle, GitBranch, ListOrdered, Sparkles, Copy } from 'lucide-react';
import { safeJsonParse } from '../utils/json';

interface DashboardProps {
  db: Database;
  selectedSubject: Subject | null;
  selectedUnit: Unit | null;
  selectedAssignment: Assignment | null;
  onRefreshDB: () => void;
  onSelectQuestion: (question: Question) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  db,
  selectedSubject,
  selectedUnit,
  selectedAssignment,
  onRefreshDB,
  onSelectQuestion
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [assignmentText, setAssignmentText] = useState('');
  const [assignmentName, setAssignmentName] = useState('');
  const [selectedSubId, setSelectedSubId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  
  // Breakdown steps state
  const [breakingDownId, setBreakingDownId] = useState<string | null>(null);
  
  // Unit Topic state
  const [scanningUnitId, setScanningUnitId] = useState<string | null>(null);
  const [generatingTopicId, setGeneratingTopicId] = useState<string | null>(null);
  const [breakingDownTopicId, setBreakingDownTopicId] = useState<string | null>(null);
  const [activeRightTab, setActiveRightTab] = useState<'assignment' | 'unit-topics'>('assignment');
  const [expandedFlashcardTopicId, setExpandedFlashcardTopicId] = useState<string | null>(null);
  
  // Local PDFs scan state
  const [localPdfs, setLocalPdfs] = useState<any[]>([]);
  const [selectedLocalPdf, setSelectedLocalPdf] = useState<string>('');
  const [importMode, setImportMode] = useState<'local' | 'manual'>('local');
  const [isPromptOnlyMode, setIsPromptOnlyMode] = useState<boolean>(false);
  const [promptWordCounts, setPromptWordCounts] = useState<Record<string, number>>({});

  // Token usage state
  const [tokenStats, setTokenStats] = useState({ requestsToday: 0, tokensToday: 0, limitRequests: 1500 });

  // Auto-run backend status state
  const [autoRunState, setAutoRunState] = useState({
    isAutoRunning: false,
    activeAssignmentId: null as string | null,
    progressCurrent: 0,
    progressTotal: 0,
    estTimeRemaining: 0,
    currentQuestionId: null as string | null,
    error: null as string | null
  });

  // Topic auto-run backend status state
  const [topicAutoRunState, setTopicAutoRunState] = useState({
    isAutoRunning: false,
    activeUnitId: null as string | null,
    progressCurrent: 0,
    progressTotal: 0,
    estTimeRemaining: 0,
    currentTopicId: null as string | null,
    error: null as string | null
  });

  // Modals for adding new subject/unit
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [newUnitNumber, setNewUnitNumber] = useState(1);
  const [newUnitName, setNewUnitName] = useState('');

  // Fetch local assignments from the scanned folder
  const fetchLocalAssignments = async () => {
    try {
      const res = await fetch('/api/local-assignments');
      if (res.ok) {
        const data = await safeJsonParse(res);
        if (Array.isArray(data)) {
          setLocalPdfs(data);
          if (data.length > 0) {
            setSelectedLocalPdf(data[0].filePath);
            setImportMode('local');
          } else {
            setImportMode('manual');
          }
        }
      }
    } catch (error) {
      console.error('Error fetching local assignments:', error);
    }
  };

  // Fetch token stats from settings endpoint
  const fetchTokenStats = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await safeJsonParse(res);
        setTokenStats({
          requestsToday: data.requestsToday || 0,
          tokensToday: data.tokensToday || 0,
          limitRequests: data.limitRequests || 1500
        });
      }
    } catch (error) {
      console.error('Error fetching token stats:', error);
    }
  };

  // Fetch background queue status
  const fetchAutoRunStatus = async () => {
    try {
      const res = await fetch('/api/auto-run-status');
      if (res.ok) {
        const data = await safeJsonParse(res);
        if (data && typeof data === 'object') {
          setAutoRunState(data);
        }
      }
    } catch (error) {
      console.error('Error fetching auto-run status:', error);
    }
  };

  // Fetch background topic queue status
  const fetchTopicAutoRunStatus = async () => {
    try {
      const res = await fetch('/api/auto-run-topics-status');
      if (res.ok) {
        const data = await safeJsonParse(res);
        if (data && typeof data === 'object') {
          setTopicAutoRunState(data);
        }
      }
    } catch (error) {
      console.error('Error fetching topic auto-run status:', error);
    }
  };

  useEffect(() => {
    fetchLocalAssignments();
    fetchTokenStats();
    fetchAutoRunStatus();
    fetchTopicAutoRunStatus();

    // Poll status, tokens, and refresh DB every 2 seconds
    const interval = setInterval(() => {
      fetchTokenStats();
      fetchAutoRunStatus();
      fetchTopicAutoRunStatus();
      onRefreshDB();
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);

  // Pre-fetch prompt word counts for questions & unit topics
  useEffect(() => {
    const listToFetch: string[] = [];
    if (selectedAssignment && selectedAssignment.questions) {
      selectedAssignment.questions.forEach(q => listToFetch.push(q.id));
    }
    if (selectedUnit && selectedUnit.topics) {
      selectedUnit.topics.forEach(t => listToFetch.push(t.id));
    }
    if (listToFetch.length === 0) return;

    listToFetch.forEach(async (id) => {
      if (promptWordCounts[id] !== undefined) return;
      try {
        const res = await fetch(`/api/simulation-prompt?questionId=${id}`);
        if (res.ok) {
          const data = await safeJsonParse(res);
          if (data && data.prompt) {
            const count = data.prompt.trim().split(/\s+/).filter(Boolean).length;
            setPromptWordCounts(prev => ({ ...prev, [id]: count }));
          }
        }
      } catch (err) {}
    });
  }, [selectedAssignment, selectedUnit]);

  // Handle parsing text assignment
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentText.trim() || !selectedSubId || !selectedUnitId) return;

    setIsUploading(true);
    try {
      const res = await fetch('/api/parse-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: assignmentText,
          subjectId: selectedSubId,
          unitId: selectedUnitId,
          assignmentName: assignmentName.trim() || undefined
        })
      });

      if (!res.ok) {
        const err = await safeJsonParse(res);
        throw new Error(err.error || 'Failed to upload assignment.');
      }

      setAssignmentText('');
      setAssignmentName('');
      alert('Assignment text parsed and imported successfully!');
      onRefreshDB();
      fetchTokenStats();
    } catch (error: any) {
      alert(`Error parsing assignment: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle local PDF import
  const handleLocalPdfImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocalPdf || isUploading) return;

    setIsUploading(true);
    try {
      const res = await fetch('/api/import-local-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: selectedLocalPdf })
      });

      if (!res.ok) {
        const err = await safeJsonParse(res);
        throw new Error(err.error || 'Failed to import local assignment.');
      }

      alert('Local PDF assignment parsed and imported successfully!');
      onRefreshDB();
      fetchTokenStats();
      fetchLocalAssignments();
    } catch (error: any) {
      alert(`Import failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Trigger backend background queue
  const handleAutoRun = async () => {
    if (!selectedAssignment || autoRunState.isAutoRunning) return;

    const pendingQuestions = selectedAssignment.questions.filter(
      q => q.status === 'pending' || q.status === 'failed'
    );

    if (pendingQuestions.length === 0) {
      alert('✨ All simulations in this assignment are already ready!');
      return;
    }

    const confirmRun = window.confirm(`🚀 Start background automatic generation for all ${pendingQuestions.length} pending simulations?`);
    if (!confirmRun) return;

    setAutoRunState(prev => ({
      ...prev,
      isAutoRunning: true,
      activeAssignmentId: selectedAssignment.id,
      progressCurrent: 0,
      progressTotal: pendingQuestions.length,
      estTimeRemaining: pendingQuestions.length * 15
    }));

    try {
      const res = await fetch('/api/auto-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId: selectedAssignment.id, promptOnly: isPromptOnlyMode })
      });

      if (!res.ok) {
        const err = await safeJsonParse(res);
        console.warn('Auto-run status response:', err);
      }

      fetchAutoRunStatus();
    } catch (error: any) {
      console.warn('Auto-run active in background:', error);
      fetchAutoRunStatus();
    }
  };

  // Cancel background queue
  const handleCancelAutoRun = async () => {
    const confirmCancel = window.confirm('Are you sure you want to cancel the background auto-run queue?');
    if (!confirmCancel) return;

    try {
      const res = await fetch('/api/auto-run-cancel', { method: 'POST' });
      if (res.ok) {
        fetchAutoRunStatus();
      }
    } catch (error) {
      console.error('Error cancelling auto-run:', error);
    }
  };

  // Trigger step breakdown for a complex question
  const handleBreakdownSteps = async (questionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (breakingDownId) return;

    setBreakingDownId(questionId);
    try {
      const res = await fetch('/api/breakdown-steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId })
      });

      if (!res.ok) {
        const err = await safeJsonParse(res);
        throw new Error(err.error || 'Failed to break down question steps.');
      }

      onRefreshDB();
      fetchTokenStats();
    } catch (err: any) {
      alert(`Error decomposing steps: ${err.message}`);
    } finally {
      setBreakingDownId(null);
    }
  };

  // Scan unit presentation & E-notes for topics
  const handleScanUnitTopics = async (subjectId: string, unitId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (scanningUnitId) return;

    setScanningUnitId(unitId);
    try {
      const res = await fetch('/api/scan-unit-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId, unitId })
      });

      if (!res.ok) {
        const err = await safeJsonParse(res);
        throw new Error(err.error || 'Failed to scan unit topics.');
      }

      onRefreshDB();
      setActiveRightTab('unit-topics');
    } catch (err: any) {
      alert(`Error scanning unit topics: ${err.message}`);
    } finally {
      setScanningUnitId(null);
    }
  };

  // Copy Canvas Prompt to Clipboard with robust browser fallback
  const handleCopyPrompt = async (qId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/simulation-prompt?questionId=${qId}`);
      let promptText = '';
      if (res.ok) {
        const data = await safeJsonParse(res);
        promptText = data.prompt || '';
      }
      if (!promptText) {
        alert('Could not load prompt blueprint for this question.');
        return;
      }

      const wordCount = promptText.trim().split(/\s+/).filter(Boolean).length;
      setPromptWordCounts(prev => ({ ...prev, [qId]: wordCount }));

      // Dual clipboard copy strategy
      let copySuccess = false;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(promptText);
          copySuccess = true;
        } catch (err) {}
      }

      if (!copySuccess) {
        try {
          const textarea = document.createElement('textarea');
          textarea.value = promptText;
          textarea.style.position = 'fixed';
          textarea.style.left = '-9999px';
          document.body.appendChild(textarea);
          textarea.select();
          copySuccess = document.execCommand('copy');
          document.body.removeChild(textarea);
        } catch (err) {}
      }

      if (copySuccess) {
        alert(`📋 Copied Gemini Canvas blueprint prompt (${wordCount} words) to clipboard!\n\nYou can now paste this prompt directly into Gemini Canvas to generate your simulation code.`);
      } else {
        alert(`Prompt ready (${wordCount} words), but automatic clipboard access was blocked by your browser. You can view or copy it directly in the prompt modal.`);
      }
    } catch (err) {
      console.error('Failed to copy prompt:', err);
    }
  };

  // Update topic importance score (1 to 10)
  const handleUpdateTopicImportance = async (topicId: string, importanceScore: number) => {
    try {
      const res = await fetch('/api/update-topic-importance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId, importanceScore })
      });
      if (res.ok) {
        onRefreshDB();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Generate 2-layer simulation for topic
  const handleGenerateTopicSim = async (subjectId: string, unitId: string, topicId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (generatingTopicId) return;

    setGeneratingTopicId(topicId);
    try {
      const res = await fetch('/api/generate-topic-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId, unitId, topicId })
      });

      if (!res.ok) {
        const err = await safeJsonParse(res);
        throw new Error(err.error || 'Failed to generate topic simulation.');
      }

      onRefreshDB();
      fetchTokenStats();
    } catch (err: any) {
      alert(`Error generating topic simulation: ${err.message}`);
    } finally {
      setGeneratingTopicId(null);
    }
  };

  // Trigger 3-layer step breakdown for topic
  const handleBreakdownTopicSteps = async (subjectId: string, unitId: string, topicId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (breakingDownTopicId) return;

    setBreakingDownTopicId(topicId);
    try {
      const res = await fetch('/api/breakdown-topic-steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId, unitId, topicId })
      });

      if (!res.ok) {
        const err = await safeJsonParse(res);
        throw new Error(err.error || 'Failed to decompose topic steps.');
      }

      onRefreshDB();
      fetchTokenStats();
    } catch (err: any) {
      alert(`Error decomposing topic steps: ${err.message}`);
    } finally {
      setBreakingDownTopicId(null);
    }
  };

  // Trigger background auto-run for all steps of a question
  const handleAutoRunSteps = async (questionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch('/api/auto-run-steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId })
      });

      if (!res.ok) {
        const err = await safeJsonParse(res);
        throw new Error(err.error || 'Failed to start step auto-run.');
      }

      alert('Step simulation auto-run started in the background!');
      onRefreshDB();
    } catch (err: any) {
      alert(`Error starting step auto-run: ${err.message}`);
    }
  };

  // Trigger background auto-run for all topics of a unit
  const handleStartTopicAutoRun = async (subjectId: string, unitId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch('/api/auto-run-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId, unitId })
      });

      if (!res.ok) {
        const err = await safeJsonParse(res);
        throw new Error(err.error || 'Failed to start topic auto-run.');
      }

      alert('PPT Topic simulation auto-run started in the background!');
      onRefreshDB();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // Cancel background topic auto-run queue
  const handleCancelTopicAutoRun = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch('/api/auto-run-topics-cancel', { method: 'POST' });
      if (res.ok) {
        alert('Topic auto-run queue cancelled.');
        onRefreshDB();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add Subject helper
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
    } catch (error) {
      console.error(error);
    }
  };

  // Add Unit helper
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
          assignments: []
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
    } catch (error) {
      console.error(error);
    }
  };

  // Calculate stats
  const totalSubjects = db.subjects.length;
  const totalUnits = db.subjects.reduce((acc, s) => acc + s.units.length, 0);
  const totalAssignments = db.subjects.reduce(
    (acc, s) => acc + s.units.reduce((uAcc, u) => uAcc + u.assignments.length, 0),
    0
  );
  const totalQuestions = db.subjects.reduce(
    (acc, s) => acc + s.units.reduce(
      (uAcc, u) => uAcc + u.assignments.reduce((aAcc, a) => aAcc + a.questions.length, 0),
      0
    ),
    0
  );

  // Helper for Difficulty capsule coloring
  const getDifficultyStyles = (difficulty: number) => {
    const hue = ((10 - difficulty) / 9) * 120;
    return {
      background: `hsl(${hue}, 80%, 12%)`,
      border: `1px solid hsl(${hue}, 70%, 40%)`,
      color: `hsl(${hue}, 90%, 75%)`
    };
  };

  const currentUnits = [...(db.subjects.find(s => s.id === selectedSubId)?.units || [])].sort((a, b) => {
    const numA = typeof a.number === 'number' ? a.number : (parseInt(String(a.name).match(/\d+/)?.[0] || '99', 10));
    const numB = typeof b.number === 'number' ? b.number : (parseInt(String(b.name).match(/\d+/)?.[0] || '99', 10));
    return numA - numB;
  });
  const selectedPdfInfo = localPdfs.find(p => p.filePath === selectedLocalPdf);

  // Filter pending questions count in current assignment
  const pendingCount = selectedAssignment
    ? selectedAssignment.questions.filter(q => q.status === 'pending' || q.status === 'failed').length
    : 0;

  const isCurrentAssignmentAutoRunning = autoRunState.isAutoRunning && autoRunState.activeAssignmentId === selectedAssignment?.id;
  const isAnotherAssignmentAutoRunning = autoRunState.isAutoRunning && autoRunState.activeAssignmentId !== selectedAssignment?.id;

  return (
    <div className="dashboard-container">
      
      {/* Welcome & Stats Row */}
      {!selectedAssignment && (
        <div className="stats-grid">
          <div className="stats-header-card glass-card">
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em', color: 'white', marginBottom: '8px' }}>
                AetherSim Dashboard
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '300', maxWidth: '600px', lineHeight: '1.5' }}>
                Automate your university coursework into dynamic interactive learning simulations. Just select a scanned PDF assignment or paste your text to build canvas sandboxes.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowAddSubject(true)}
                className="btn-primary"
                style={{ padding: '10px 18px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                <Plus size={14} style={{ marginRight: '6px' }} /> Subject
              </button>
              <button
                onClick={() => {
                  if (db.subjects.length > 0) {
                    setSelectedSubId(db.subjects[0].id);
                    setShowAddUnit(true);
                  } else {
                    alert('Please create a subject first!');
                  }
                }}
                className="btn-secondary"
                style={{ padding: '10px 18px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                <Plus size={14} style={{ marginRight: '6px' }} /> Unit
              </button>
            </div>
          </div>

          {/* Stat Box 1 */}
          <div className="stat-box glass-panel">
            <div className="stat-icon" style={{ background: 'rgba(0, 242, 254, 0.1)', color: 'var(--accent-cyan)' }}>
              <BookOpen size={24} />
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>{totalSubjects}</div>
              <div style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subjects</div>
            </div>
          </div>

          {/* Stat Box 2 */}
          <div className="stat-box glass-panel">
            <div className="stat-icon" style={{ background: 'rgba(155, 81, 224, 0.1)', color: 'var(--accent-purple)' }}>
              <Layers size={24} />
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>{totalUnits}</div>
              <div style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Units</div>
            </div>
          </div>

          {/* Stat Box 3 */}
          <div className="stat-box glass-panel">
            <div className="stat-icon" style={{ background: 'rgba(248, 87, 166, 0.1)', color: 'var(--accent-pink)' }}>
              <FileText size={24} />
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>{totalAssignments}</div>
              <div style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assignments</div>
            </div>
          </div>

          {/* Stat Box 4 */}
          <div className="stat-box glass-panel">
            <div className="stat-icon" style={{ background: 'rgba(0, 255, 135, 0.1)', color: 'var(--accent-green)' }}>
              <BarChart2 size={24} />
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>{totalQuestions}</div>
              <div style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Simulations</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Upload & List */}
      <div className="main-grid">
        
        {/* Left Column: Import / Create Assignment */}
        <div className="form-container glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Upload size={16} /> Import Assignment
            </h3>
            {importMode === 'local' && (
              <button
                type="button"
                onClick={fetchLocalAssignments}
                className="btn-secondary"
                style={{ padding: '4px 8px', fontSize: '9px', borderRadius: '4px' }}
                title="Rescan folder"
              >
                <RefreshCw size={10} style={{ marginRight: '4px' }} /> Rescan
              </button>
            )}
          </div>

          {/* Mode Switcher */}
          <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px', marginBottom: '16px' }}>
            <button
              type="button"
              onClick={() => setImportMode('local')}
              className="btn"
              style={{
                flex: 1,
                fontSize: '10px',
                padding: '6px 8px',
                borderRadius: '6px',
                background: importMode === 'local' ? 'var(--accent-cyan)' : 'transparent',
                color: importMode === 'local' ? '#05060b' : 'var(--text-secondary)',
                fontWeight: importMode === 'local' ? 'bold' : 'normal'
              }}
            >
              Scan local folder ({localPdfs.length})
            </button>
            <button
              type="button"
              onClick={() => setImportMode('manual')}
              className="btn"
              style={{
                flex: 1,
                fontSize: '10px',
                padding: '6px 8px',
                borderRadius: '6px',
                background: importMode === 'manual' ? 'var(--accent-cyan)' : 'transparent',
                color: importMode === 'manual' ? '#05060b' : 'var(--text-secondary)',
                fontWeight: importMode === 'manual' ? 'bold' : 'normal'
              }}
            >
              Paste Raw Text
            </button>
          </div>

          {/* Scan Local Folder View */}
          {importMode === 'local' && (
            <form onSubmit={handleLocalPdfImport} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {localPdfs.length === 0 ? (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0', border: '1px dashed var(--border-glass)', borderRadius: '8px' }}>
                  No PDF assignments found in <br />
                  <code style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'block', marginTop: '6px', wordBreak: 'break-all' }}>
                    darshan-tracker/downloads/
                  </code>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Available PDF File</label>
                    <select
                      value={selectedLocalPdf}
                      onChange={(e) => setSelectedLocalPdf(e.target.value)}
                      required
                      style={{ width: '100%' }}
                    >
                      {localPdfs.map((pdf, idx) => (
                        <option key={idx} value={pdf.filePath}>
                          [{pdf.subjectName}] {pdf.fileName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedPdfInfo && (
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        <strong style={{ color: 'var(--accent-cyan)' }}>Detected Course:</strong> {selectedPdfInfo.subjectName}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        <strong style={{ color: 'var(--accent-purple)' }}>Detected Unit:</strong> Unit {selectedPdfInfo.detectedUnit}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        <strong style={{ color: 'var(--accent-blue)' }}>Detected Title:</strong> {selectedPdfInfo.detectedTitle}
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isUploading || !selectedLocalPdf}
                    className="form-submit-btn btn-primary"
                  >
                    {isUploading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin" style={{ marginRight: '8px' }}></div>
                        Importing & Parsing PDF...
                      </>
                    ) : (
                      <>
                        <Upload size={14} style={{ marginRight: '6px' }} /> Auto Import PDF
                      </>
                    )}
                  </button>
                </>
              )}
            </form>
          )}

          {/* Paste Raw Text View */}
          {importMode === 'manual' && (
            <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Subject Select */}
              <div className="form-group">
                <label className="form-label">Subject</label>
                <select
                  value={selectedSubId}
                  onChange={(e) => {
                    setSelectedSubId(e.target.value);
                    const sub = db.subjects.find(s => s.id === e.target.value);
                    if (sub && sub.units.length > 0) {
                      setSelectedUnitId(sub.units[0].id);
                    } else {
                      setSelectedUnitId('');
                    }
                  }}
                  required
                  style={{ width: '100%' }}
                >
                  <option value="">-- Select Subject --</option>
                  {db.subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Unit Select */}
              <div className="form-group">
                <label className="form-label">Unit</label>
                <select
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  required
                  disabled={!selectedSubId}
                  style={{ width: '100%' }}
                >
                  <option value="">-- Select Unit --</option>
                  {currentUnits.map(u => (
                    <option key={u.id} value={u.id}>Unit {u.number}: {u.name}</option>
                  ))}
                </select>
              </div>

              {/* Assignment Name */}
              <div className="form-group">
                <label className="form-label">Assignment Title</label>
                <input
                  type="text"
                  placeholder="E.g., Assignment 1, Lab Sheet A"
                  value={assignmentName}
                  onChange={(e) => setAssignmentName(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Pasted text */}
              <div className="form-group">
                <label className="form-label">Assignment Content</label>
                <textarea
                  placeholder="Paste the assignment text or questions list here. Gemini will parse it into individual question items automatically..."
                  value={assignmentText}
                  onChange={(e) => setAssignmentText(e.target.value)}
                  required
                  style={{ width: '100%', height: '180px', fontSize: '11px', resize: 'none' }}
                />
              </div>

              <button
                type="submit"
                disabled={isUploading || !selectedSubId || !selectedUnitId || !assignmentText.trim()}
                className="form-submit-btn btn-primary"
              >
                {isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin" style={{ marginRight: '8px' }}></div>
                    Parsing Questions...
                  </>
                ) : (
                  <>
                    <Upload size={14} style={{ marginRight: '6px' }} /> Parse & Import
                  </>
                )}
              </button>
            </form>
          )}

          {/* Token usage counter pill footer */}
          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Gemini Usage stats (Today)
            </span>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)' }}>
              <span>API Requests:</span>
              <strong style={{ color: 'var(--accent-cyan)' }}>{tokenStats.requestsToday} / {tokenStats.limitRequests}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)' }}>
              <span>Tokens Consumed:</span>
              <strong style={{ color: 'var(--accent-purple)' }}>{tokenStats.tokensToday.toLocaleString()}</strong>
            </div>
          </div>
        </div>

        {/* Right Column: Questions Grid */}
        <div className="questions-container">
          {selectedUnit && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '6px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setActiveRightTab('assignment')}
                  style={{
                    padding: '6px 14px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    borderRadius: '6px',
                    border: 'none',
                    background: activeRightTab === 'assignment' ? 'var(--accent-cyan)' : 'transparent',
                    color: activeRightTab === 'assignment' ? '#05060b' : 'var(--text-secondary)'
                  }}
                >
                  📚 Assignment Questions ({selectedAssignment?.questions.length || 0})
                </button>
                <button
                  onClick={() => setActiveRightTab('unit-topics')}
                  style={{
                    padding: '6px 14px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    borderRadius: '6px',
                    border: 'none',
                    background: activeRightTab === 'unit-topics' ? 'var(--accent-purple)' : 'transparent',
                    color: activeRightTab === 'unit-topics' ? '#ffffff' : 'var(--text-secondary)'
                  }}
                >
                  🎓 Unit PPT Topics ({selectedUnit.topics?.length || 0})
                </button>
              </div>

              {selectedSubject && (
                <button
                  onClick={(e) => handleScanUnitTopics(selectedSubject.id, selectedUnit.id, e)}
                  disabled={scanningUnitId === selectedUnit.id}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', color: '#c084fc', borderColor: 'rgba(168, 85, 247, 0.3)' }}
                >
                  {scanningUnitId === selectedUnit.id ? (
                    <>
                      <Loader size={12} className="animate-spin" /> Deduplicating & Parsing Unit PPTs...
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} /> Scan Unit PPT & E-Notes
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {activeRightTab === 'unit-topics' && selectedUnit ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Unit PPT Topics Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>Unit Presentation & E-Notes Knowledge Base</span>
                    {selectedUnit.wordCount && (
                      <span style={{ background: 'rgba(0, 242, 254, 0.1)', border: '1px solid rgba(0, 242, 254, 0.3)', color: 'var(--accent-cyan)', padding: '2px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold' }}>
                        📄 Word Count: {selectedUnit.wordCount.toLocaleString()} words
                      </span>
                    )}
                  </div>
                  <h2 style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'white' }}>
                    Unit {selectedUnit.number}: {selectedUnit.name} Topics
                  </h2>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {topicAutoRunState.isAutoRunning && topicAutoRunState.activeUnitId === selectedUnit.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '8px', padding: '6px 12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '9px', color: '#c084fc', fontWeight: 'bold' }}>
                          ⚡ Auto-Running Unit PPT Topics ({topicAutoRunState.progressCurrent} / {topicAutoRunState.progressTotal})
                        </span>
                        <div style={{ width: '120px', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${(topicAutoRunState.progressCurrent / topicAutoRunState.progressTotal) * 100}%`, height: '100%', background: 'var(--accent-purple)' }}></div>
                        </div>
                      </div>
                      <button 
                        onClick={handleCancelTopicAutoRun}
                        className="btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '9px', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)' }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    selectedSubject && selectedUnit.topics && selectedUnit.topics.some(t => t.status === 'pending' || t.status === 'failed') && (
                      <button
                        onClick={(e) => handleStartTopicAutoRun(selectedSubject.id, selectedUnit.id, e)}
                        className="btn-primary"
                        style={{ padding: '8px 16px', fontSize: '11px', fontWeight: 'bold', background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Play size={12} fill="#ffffff" /> Auto-Run Unit Topics
                      </button>
                    )
                  )}
                </div>
              </div>

              {(!selectedUnit.topics || selectedUnit.topics.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', border: '1px dashed var(--border-glass)', borderRadius: '12px', background: 'rgba(255,255,255,0.01)' }}>
                  <BookOpen size={32} style={{ color: '#a855f7', margin: '0 auto 12px' }} />
                  <h3 style={{ color: 'white', fontWeight: 'bold', fontSize: '14px', marginBottom: '6px' }}>
                    No Unit Topics Scanned Yet
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '11px', maxWidth: '400px', margin: '0 auto 16px' }}>
                    Click <strong>"Scan Unit PPT & E-Notes"</strong> above to extract core non-duplicate topics from your course presentation slides and PDF notes.
                  </p>
                  {selectedSubject && (
                    <button
                      onClick={(e) => handleScanUnitTopics(selectedSubject.id, selectedUnit.id, e)}
                      disabled={scanningUnitId === selectedUnit.id}
                      className="btn-accent"
                      style={{ padding: '8px 16px', fontSize: '11px', fontWeight: 'bold' }}
                    >
                      {scanningUnitId === selectedUnit.id ? 'Parsing PPTX & PDFs...' : 'Scan Unit PPT Topics'}
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {selectedUnit.topics.map((topic, idx) => {
                    const diffStyle = getDifficultyStyles(topic.difficulty);
                    const isGenerating = generatingTopicId === topic.id;
                    const isBreakingDown = breakingDownTopicId === topic.id;

                    return (
                      <div
                        key={topic.id}
                        onClick={() => {
                          onSelectQuestion({
                            id: topic.id,
                            text: `[Unit Topic] ${topic.title}: ${topic.description}`,
                            concept: topic.concept,
                            difficulty: topic.difficulty,
                            status: topic.status,
                            simulationFile: topic.simulationFile || '',
                            hasSteps: topic.hasSteps,
                            activeStepId: topic.activeStepId,
                            steps: topic.steps
                          });
                        }}
                        className="question-card glass-card"
                        style={{ cursor: 'pointer', borderLeft: '3px solid #a855f7' }}
                      >
                        <div className="question-details">
                          <div className="question-tags">
                            <span style={{ background: 'rgba(168, 85, 247, 0.2)', border: '1px solid rgba(168, 85, 247, 0.4)', color: '#e9d5ff', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                              TOPIC #{idx + 1}
                            </span>
                            <span className="tag-concept">
                              {topic.concept}
                            </span>
                            <span className="tag-difficulty" style={diffStyle}>
                              Difficulty: {topic.difficulty}/10
                            </span>
                          </div>

                          <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'white', marginTop: '6px', marginBottom: '4px' }}>
                            {topic.title}
                          </h3>

                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', fontWeight: '300' }}>
                            {topic.description}
                          </p>

                          {topic.comments && (
                            <div style={{ marginTop: '6px', background: 'rgba(0, 242, 254, 0.08)', border: '1px solid rgba(0, 242, 254, 0.25)', borderRadius: '6px', padding: '6px 10px', fontSize: '11px', color: 'var(--accent-cyan)' }}>
                              📝 <strong>Your Study Note:</strong> "{topic.comments}"
                            </div>
                          )}

                          {/* Importance Rating Slider */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', background: 'rgba(255,255,255,0.02)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-glass)' }}
                          >
                            <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#c084fc', whiteSpace: 'nowrap' }}>
                              ★ Importance Rating: <strong>{topic.importanceScore}/10</strong>
                            </span>
                            <input
                              type="range"
                              min="1"
                              max="10"
                              step="0.5"
                              value={topic.importanceScore}
                              onChange={(e) => handleUpdateTopicImportance(topic.id, parseFloat(e.target.value))}
                              style={{ flex: 1, accentColor: '#a855f7', cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                              (Weights Interactive Features)
                            </span>
                          </div>

                          {/* Flashcards / Info Cards Section per Topic Branch */}
                          {topic.flashcards && topic.flashcards.length > 0 && (
                            <div style={{ marginTop: '12px' }} onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => setExpandedFlashcardTopicId(expandedFlashcardTopicId === topic.id ? null : topic.id)}
                                style={{
                                  padding: '4px 10px',
                                  fontSize: '10px',
                                  fontWeight: 'bold',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(168, 85, 247, 0.3)',
                                  background: 'rgba(168, 85, 247, 0.1)',
                                  color: '#e9d5ff',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                🎴 {expandedFlashcardTopicId === topic.id ? 'Hide' : 'Review'} Flashcard Info Cards ({topic.flashcards.length})
                              </button>

                              {expandedFlashcardTopicId === topic.id && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginTop: '10px' }}>
                                  {topic.flashcards.map((fc) => (
                                    <div
                                      key={fc.id}
                                      style={{
                                        background: 'rgba(15, 23, 42, 0.8)',
                                        border: fc.type === 'formula' ? '1px solid rgba(0, 242, 254, 0.3)' : fc.type === 'exam_qna' ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid rgba(168, 85, 247, 0.3)',
                                        borderRadius: '8px',
                                        padding: '10px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '4px'
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', color: fc.type === 'formula' ? 'var(--accent-cyan)' : fc.type === 'exam_qna' ? '#fde047' : '#c084fc' }}>
                                          {fc.type === 'formula' ? '📐 Formula' : fc.type === 'exam_qna' ? '📝 Exam Q&A' : fc.type === 'flagged_rule' ? '🚩 Flagged Rule' : '💡 Core Definition'}
                                        </span>
                                        <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>★ {fc.importance}/10</span>
                                      </div>
                                      <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'white' }}>
                                        {fc.questionOrConcept}
                                      </div>
                                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                                        {fc.answerOrDetails}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Steps Pill */}
                          {topic.hasSteps && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                              <span style={{ background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)', color: '#c084fc', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <GitBranch size={10} /> {topic.steps?.length || 0} Dynamic Steps
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                          {selectedSubject && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (topic.status === 'ready') {
                                  onSelectQuestion({
                                    id: topic.id,
                                    text: `[Unit Topic] ${topic.title}: ${topic.description}`,
                                    concept: topic.concept,
                                    difficulty: topic.difficulty,
                                    status: topic.status,
                                    simulationFile: topic.simulationFile || '',
                                    hasSteps: topic.hasSteps,
                                    activeStepId: topic.activeStepId,
                                    steps: topic.steps
                                  });
                                } else {
                                  handleGenerateTopicSim(selectedSubject.id, selectedUnit.id, topic.id, e);
                                }
                              }}
                              disabled={isGenerating || topic.status === 'generating'}
                              className="btn-primary"
                              style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)' }}
                            >
                              {isGenerating || topic.status === 'generating' ? (
                                <>
                                  <Loader size={12} className="animate-spin" /> Coding Topic Sim...
                                </>
                              ) : topic.status === 'ready' ? (
                                <>
                                  <Play size={12} fill="#05060b" /> Open Topic Simulation
                                </>
                              ) : (
                                <>
                                  <Sparkles size={12} /> Generate Topic Simulation
                                </>
                              )}
                            </button>
                          )}

                          {selectedSubject && (
                            <button
                              onClick={(e) => handleBreakdownTopicSteps(selectedSubject.id, selectedUnit.id, topic.id, e)}
                              disabled={isBreakingDown}
                              className="btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '10px', color: '#c084fc', borderColor: 'rgba(168, 85, 247, 0.3)', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              {isBreakingDown ? (
                                <>
                                  <Loader size={10} className="animate-spin" /> Breaking Down...
                                </>
                              ) : (
                                <>
                                  <GitBranch size={10} /> {topic.hasSteps ? 'Re-Breakdown Steps' : 'Detailed Multi-Step Mode'}
                                </>
                              )}
                            </button>
                          )}

                          {(() => {
                            const words = promptWordCounts[topic.id] || (topic.generatedPrompt ? topic.generatedPrompt.trim().split(/\s+/).filter(Boolean).length : undefined);
                            return (
                              <button
                                onClick={(e) => handleCopyPrompt(topic.id, e)}
                                className="btn-secondary"
                                style={{ padding: '4px 10px', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)', background: 'rgba(56, 189, 248, 0.08)' }}
                                title="Copy Gemini Canvas instruction blueprint to clipboard"
                              >
                                <Copy size={11} /> {words ? `Copy Canvas Prompt (${words} words)` : 'Copy Canvas Prompt (-- words)'}
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : selectedAssignment ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Assignment Breadcrumb Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{selectedSubject?.name}</span>
                    <span>/</span>
                    <span>Unit {selectedUnit?.number}</span>
                  </div>
                  <h2 style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'white' }}>{selectedAssignment.name}</h2>
                </div>
                
                {/* Batch Auto Run actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {isCurrentAssignmentAutoRunning ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(0, 242, 254, 0.05)', border: '1px solid rgba(0, 242, 254, 0.2)', padding: '6px 12px', borderRadius: '8px' }}>
                      <Loader size={12} className="animate-spin text-cyan-400" />
                      <span style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                        Generating {autoRunState.progressCurrent} of {autoRunState.progressTotal}...
                      </span>
                      {autoRunState.estTimeRemaining > 0 && (
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', borderLeft: '1px solid var(--border-glass)', paddingLeft: '8px' }}>
                          Est: {autoRunState.estTimeRemaining}s
                        </span>
                      )}
                      <button
                        onClick={handleCancelAutoRun}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-pink)', display: 'flex', padding: '2px', marginLeft: '4px' }}
                        title="Cancel Auto Run"
                      >
                        <XCircle size={14} />
                      </button>
                    </div>
                  ) : isAnotherAssignmentAutoRunning ? (
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-glass)', padding: '6px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Loader size={10} className="animate-spin" />
                      <span>Background Auto-Run busy elsewhere</span>
                    </div>
                  ) : (
                    pendingCount > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: isPromptOnlyMode ? '#38bdf8' : 'var(--text-secondary)', cursor: 'pointer', background: isPromptOnlyMode ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.04)', padding: '4px 8px', borderRadius: '6px', border: isPromptOnlyMode ? '1px solid #38bdf8' : '1px solid var(--border-glass)', transition: 'all 0.2s', fontWeight: 'bold' }}>
                          <input
                            type="checkbox"
                            checked={isPromptOnlyMode}
                            onChange={(e) => setIsPromptOnlyMode(e.target.checked)}
                            style={{ accentColor: '#38bdf8', cursor: 'pointer' }}
                          />
                          ⚡ Prompt-Only (Canvas)
                        </label>
                        <button
                          onClick={handleAutoRun}
                          className="btn-accent"
                          style={{ padding: '6px 14px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Play size={10} fill="white" />
                          {isPromptOnlyMode ? `Generate Prompts (${pendingCount})` : `Auto Run (${pendingCount} pending)`}
                        </button>
                      </div>
                    )
                  )}
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {selectedAssignment.questions.length} Questions
                  </div>
                </div>
              </div>

              {/* Questions List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {selectedAssignment.questions.map((question, idx) => {
                  const diffStyle = getDifficultyStyles(question.difficulty);
                  const isCurrentBgGenerating = autoRunState.isAutoRunning && autoRunState.currentQuestionId === question.id;
                  
                  return (
                    <div
                      key={question.id}
                      onClick={() => !autoRunState.isAutoRunning && onSelectQuestion(question)}
                      className="question-card glass-card"
                      style={{
                        cursor: autoRunState.isAutoRunning ? 'not-allowed' : 'pointer',
                        opacity: autoRunState.isAutoRunning && !isCurrentBgGenerating ? 0.7 : 1,
                        border: isCurrentBgGenerating ? '1px solid var(--accent-cyan)' : undefined,
                        boxShadow: isCurrentBgGenerating ? '0 0 15px rgba(0, 242, 254, 0.15)' : undefined
                      }}
                    >
                      <div className="question-details">
                        <div className="question-tags">
                          <span className="tag-qnum">
                            Q{idx + 1}
                          </span>
                          <span className="tag-concept">
                            {question.concept}
                          </span>
                          <span
                            className="tag-difficulty"
                            style={diffStyle}
                          >
                            Difficulty: {question.difficulty}/10
                          </span>
                          {question.hasSteps && (
                            <span style={{ background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)', color: '#c084fc', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <GitBranch size={10} /> {question.steps?.length || 0} Detailed Exam Steps
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', fontWeight: '300' }}>
                          {question.text}
                        </p>

                        {question.comments && (
                          <div style={{ marginTop: '6px', background: 'rgba(0, 242, 254, 0.08)', border: '1px solid rgba(0, 242, 254, 0.25)', borderRadius: '6px', padding: '6px 10px', fontSize: '11px', color: 'var(--accent-cyan)' }}>
                            📝 <strong>Your Study Note:</strong> "{question.comments}"
                          </div>
                        )}

                        {/* Step-by-Step Pills and Actions */}
                        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                          {question.hasSteps && question.steps && question.steps.length > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              {question.steps.map(step => (
                                <span
                                  key={step.id}
                                  style={{
                                    fontSize: '9px',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: step.status === 'ready' ? 'rgba(34, 197, 94, 0.15)' : step.status === 'generating' ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                                    border: `1px solid ${step.status === 'ready' ? 'rgba(34, 197, 94, 0.3)' : step.status === 'generating' ? 'rgba(0, 242, 254, 0.3)' : 'var(--border-glass)'}`,
                                    color: step.status === 'ready' ? '#4ade80' : step.status === 'generating' ? 'var(--accent-cyan)' : 'var(--text-muted)',
                                    fontWeight: '500'
                                  }}
                                >
                                  Step {step.stepNumber}: {step.title}
                                </span>
                              ))}
                              {question.steps.some(st => st.status === 'pending' || st.status === 'failed') && (
                                <button
                                  onClick={(e) => handleAutoRunSteps(question.id, e)}
                                  className="btn-secondary"
                                  style={{ padding: '3px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--accent-cyan)', borderColor: 'rgba(0, 242, 254, 0.3)' }}
                                >
                                  <Play size={8} fill="var(--accent-cyan)" style={{ marginRight: '4px' }} /> Auto-Run Steps
                                </button>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={(e) => handleBreakdownSteps(question.id, e)}
                              disabled={breakingDownId === question.id}
                              className="btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', color: '#c084fc', borderColor: 'rgba(168, 85, 247, 0.3)', background: 'rgba(168, 85, 247, 0.08)' }}
                            >
                              {breakingDownId === question.id ? (
                                <>
                                  <Loader size={10} className="animate-spin" /> Decomposing Steps...
                                </>
                              ) : (
                                <>
                                  <ListOrdered size={12} /> Detailed Multi-Step Simulation Mode
                                </>
                              )}
                            </button>
                          )}
                          {(() => {
                            const words = promptWordCounts[question.id] || (question.generatedPrompt ? question.generatedPrompt.trim().split(/\s+/).filter(Boolean).length : undefined);
                            return (
                              <button
                                onClick={(e) => handleCopyPrompt(question.id, e)}
                                className="btn-secondary"
                                style={{ padding: '4px 10px', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)', background: 'rgba(56, 189, 248, 0.08)' }}
                                title="Copy Gemini Canvas instruction blueprint to clipboard"
                              >
                                <Copy size={11} /> {words ? `Copy Canvas Prompt (${words} words)` : 'Copy Canvas Prompt (-- words)'}
                              </button>
                            );
                          })()}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', minWidth: '160px', justifyContent: 'flex-end', gap: '12px' }}>
                        {isCurrentBgGenerating ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-cyan)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                            <Loader size={10} className="animate-spin" />
                            <span>building...</span>
                          </div>
                        ) : question.status === 'ready' && question.generationDuration && question.generationDuration > 0 ? (
                          <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            Generated in {question.generationDuration}s
                          </span>
                        ) : null}
                        <span className={`status-badge status-${isCurrentBgGenerating ? 'generating' : question.status}`}>
                          {isCurrentBgGenerating ? 'generating' : question.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: '350px' }}>
              <AlertCircle className="w-12 h-12 text-gray-600" style={{ marginBottom: '16px', color: 'var(--text-muted)' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>No Assignment Selected</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '320px', lineHeight: '1.6', marginBottom: '24px' }}>
                Select an assignment from the sidebar navigation tree or create a new one by importing an assignment list on the left.
              </p>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', border: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '12px', maxWidth: '400px', lineHeight: '1.4' }}>
                <strong>Tip:</strong> The <strong>Mind Map</strong> tab at the top displays a full-screen network of subjects, units, assignments, and simulations where you can click to run them instantly!
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Subject Modal */}
      {showAddSubject && (
        <div className="modal-overlay">
          <div className="modal-box glass-panel">
            <h3 style={{ fontSize: '15px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>Add New Subject</h3>
            <form onSubmit={handleAddSubject} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Subject Name</label>
                <input
                  type="text"
                  placeholder="E.g., Physics II, Computer Networks"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddSubject(false)}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '11px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '6px 12px', fontSize: '11px' }}
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Unit Modal */}
      {showAddUnit && (
        <div className="modal-overlay">
          <div className="modal-box glass-panel">
            <h3 style={{ fontSize: '15px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>Add New Unit</h3>
            <form onSubmit={handleAddUnit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Subject</label>
                <select
                  value={selectedSubId}
                  onChange={(e) => setSelectedSubId(e.target.value)}
                  required
                  style={{ width: '100%' }}
                >
                  {db.subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div className="form-group" style={{ width: '80px' }}>
                  <label className="form-label">Unit #</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={newUnitNumber}
                    onChange={(e) => setNewUnitNumber(Number(e.target.value))}
                    required
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Unit Title</label>
                  <input
                    type="text"
                    placeholder="E.g., Quantum Mechanics, IP Layer"
                    value={newUnitName}
                    onChange={(e) => setNewUnitName(e.target.value)}
                    required
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddUnit(false)}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '11px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '6px 12px', fontSize: '11px' }}
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
