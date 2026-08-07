import React, { useState, useRef, useEffect } from 'react';
import type { Database, FsrsItem, FsrsMCQ } from '../types';
import { getSimUrl } from '../utils/url';
import { Calendar, CheckCircle, RefreshCw, Star, Play, Sparkles, Loader, ArrowLeft, TrendingUp, GitFork, BarChart3, Layers, Zap, XCircle, HelpCircle, Check, X, Target, Award, Clock, Maximize2, ClipboardList, Code, Copy, GitBranch, Volume2, VolumeX, ChevronLeft, ChevronRight } from 'lucide-react';

interface FSRSSpaceProps {
  db: Database;
  onRefreshDB: () => void;
  onSelectQuestion?: (question: any) => void;
}

export const FSRSSpace: React.FC<FSRSSpaceProps> = ({ db, onRefreshDB, onSelectQuestion }) => {
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<'queue' | 'mindmap' | 'forecast' | 'learning_curve'>('queue');
  const [activeItemView, setActiveItemView] = useState<'sim' | 'quiz'>('sim');

  // Custom Code Paste state
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [variantNameInput, setVariantNameInput] = useState('');
  const [customCodeInput, setCustomCodeInput] = useState('');
  const [isSavingCustom, setIsSavingCustom] = useState(false);
  const fsrsSimRef = useRef<HTMLDivElement>(null);
  
  // Auto-fade (5s) & Hover-to-Open Tool Drawer State
  const [isToolsHovered, setIsToolsHovered] = useState(false);
  const [isToolsVisible, setIsToolsVisible] = useState(true);
  const [isToolsExpanded, setIsToolsExpanded] = useState(false);
  const toolsTimerRef = useRef<any>(null);

  // Note Tools Auto-fade (5s) & Hover-to-Open State
  const [isNoteToolsHovered, setIsNoteToolsHovered] = useState(false);
  const [isNoteToolsVisible, setIsNoteToolsVisible] = useState(true);
  const [isNoteToolsExpanded, setIsNoteToolsExpanded] = useState(false);
  const noteToolsTimerRef = useRef<any>(null);

  const resetToolsTimer = () => {
    setIsToolsVisible(true);
    if (toolsTimerRef.current) clearTimeout(toolsTimerRef.current);
    toolsTimerRef.current = setTimeout(() => {
      setIsToolsVisible(false);
      setIsToolsExpanded(false);
    }, 5000);
  };

  const resetNoteToolsTimer = () => {
    setIsNoteToolsVisible(true);
    if (noteToolsTimerRef.current) clearTimeout(noteToolsTimerRef.current);
    noteToolsTimerRef.current = setTimeout(() => {
      setIsNoteToolsVisible(false);
      setIsNoteToolsExpanded(false);
    }, 5000);
  };

  const handleMouseEnterCorner = () => {
    setIsToolsHovered(true);
    setIsToolsVisible(true);
    setIsToolsExpanded(true); // Hover over opens options automatically for 1-click pick!
    if (toolsTimerRef.current) clearTimeout(toolsTimerRef.current);
  };

  const handleMouseLeaveCorner = () => {
    setIsToolsHovered(false);
    resetToolsTimer();
  };

  const handleMouseEnterNoteCorner = () => {
    setIsNoteToolsHovered(true);
    setIsNoteToolsVisible(true);
    setIsNoteToolsExpanded(true); // Hovering opens note tools options automatically!
    if (noteToolsTimerRef.current) clearTimeout(noteToolsTimerRef.current);
  };

  const handleMouseLeaveNoteCorner = () => {
    setIsNoteToolsHovered(false);
    resetNoteToolsTimer();
  };

  useEffect(() => {
    resetToolsTimer();
    resetNoteToolsTimer();
    return () => {
      if (toolsTimerRef.current) clearTimeout(toolsTimerRef.current);
      if (noteToolsTimerRef.current) clearTimeout(noteToolsTimerRef.current);
    };
  }, []);

  const handleRatingClick = async (itemId: string, ratingScore: number) => {
    try {
      const res = await fetch('/api/fsrs/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, rating: ratingScore })
      });
      if (res.ok) {
        setIsRatingSubmitted(true);
        setTimeout(() => setIsRatingSubmitted(false), 2000);
        onRefreshDB();
      }
    } catch (err) {
      console.error('Failed to update rating:', err);
    }
  };

  // Quiz states (Gizmo style single-card layout & Hover TTS)
  const [currentQuizIndex, setCurrentQuizIndex] = useState<number>(0);
  const [enableHoverTts, setEnableHoverTts] = useState<boolean>(true);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>(Array(10).fill(-1));
  const [isGeneratingMcqs, setIsGeneratingMcqs] = useState(false);
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const [isRatingSubmitted, setIsRatingSubmitted] = useState(false);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);

  // Auto-run states & Timer
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [autoRunProgress, setAutoRunProgress] = useState<{ current: number; total: number; currentItemText?: string }>({ current: 0, total: 0 });
  const [autoRunStartTime, setAutoRunStartTime] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const stopAutoRunRef = useRef(false);

  useEffect(() => {
    let timer: any;
    if (isAutoRunning && autoRunStartTime) {
      timer = setInterval(() => {
        setElapsedSec(Math.floor((Date.now() - autoRunStartTime) / 1000));
      }, 1000);
    } else {
      setElapsedSec(0);
    }
    return () => clearInterval(timer);
  }, [isAutoRunning, autoRunStartTime]);

  const fsrsItems = db.fsrsItems || [];
  const activeItem = fsrsItems.find(i => i.id === activeItemId);

  // Local PDFs scan state & MCQ Generation states
  const [localPdfs, setLocalPdfs] = useState<any[]>([]);
  const [selectedPdfPath, setSelectedPdfPath] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.5-flash');
  const [isGenerating30Mcqs, setIsGenerating30Mcqs] = useState(false);

  // MCQ review state variables
  const [selectedMcqOption, setSelectedMcqOption] = useState<number | null>(null);
  const [mcqStatus, setMcqStatus] = useState<'unanswered' | 'correct' | 'incorrect'>('unanswered');
  const [isMcqSubmitting, setIsMcqSubmitting] = useState(false);
  const [mcqAttemptRating, setMcqAttemptRating] = useState<number | null>(null);

  const fetchLocalPdfs = async () => {
    try {
      const res = await fetch('/api/local-assignments');
      if (res.ok) {
        const data = await res.json();
        setLocalPdfs(data);
        if (data.length > 0) {
          setSelectedPdfPath(data[0].filePath);
        }
      }
    } catch (e) {
      console.error('Error fetching local assignments in FSRSSpace:', e);
    }
  };

  useEffect(() => {
    fetchLocalPdfs();
  }, []);

  // Shuffled options for the active MCQ card
  const [shuffledOptions, setShuffledOptions] = useState<{ text: string; originalIndex: number }[]>([]);

  useEffect(() => {
    setSelectedMcqOption(null);
    setMcqStatus('unanswered');
    setMcqAttemptRating(null);

    const currentItem = fsrsItems.find(i => i.id === activeItemId);
    if (currentItem && currentItem.sourceType === 'mcq') {
      const opts = currentItem.mcqOptions || [];
      const items = opts.map((text, idx) => ({ text, originalIndex: idx }));
      
      // Fisher-Yates shuffle
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      setShuffledOptions(items);
    } else {
      setShuffledOptions([]);
    }
  }, [activeItemId]);

  // Synchronize shuffled options with the loaded simulation iframe
  useEffect(() => {
    if (activeItem && activeItem.sourceType === 'mcq' && shuffledOptions.length > 0) {
      const timer = setTimeout(() => {
        const iframe = document.getElementById('mcq-sim-iframe') as HTMLIFrameElement;
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({
            type: 'init-mcq-options',
            options: shuffledOptions
          }, '*');
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [shuffledOptions, activeItemId, activeItem]);

  const handleGoToNextMcq = () => {
    const currentIndex = fsrsItems.findIndex(i => i.id === activeItemId);
    if (currentIndex >= 0 && fsrsItems.length > 1) {
      const nextIndex = (currentIndex + 1) % fsrsItems.length;
      const nextItem = fsrsItems[nextIndex];
      if (nextItem) {
        setActiveItemId(nextItem.id);
        setActiveItemView('sim');
      }
    } else {
      setActiveItemId(null);
    }
  };

  const handleMcqFsrsSubmit = async (itemId: string, ratingScore: number) => {
    setIsMcqSubmitting(true);
    try {
      const res = await fetch('/api/fsrs/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, rating: ratingScore })
      });
      if (res.ok) {
        setMcqAttemptRating(ratingScore);
        onRefreshDB();
      }
    } catch (e) {
      console.error('Failed to submit MCQ FSRS rate:', e);
    } finally {
      setIsMcqSubmitting(false);
    }
  };

  useEffect(() => {
    const handleMcqIframeMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'mcq-selected') {
        let optionIdx = event.data.optionIndex;
        
        // Robust parsing of optionIndex: supports numbers, string numbers, and letter character mappings A-D
        if (typeof optionIdx === 'string') {
          const clean = optionIdx.trim().toUpperCase();
          if (clean === 'A') optionIdx = 0;
          else if (clean === 'B') optionIdx = 1;
          else if (clean === 'C') optionIdx = 2;
          else if (clean === 'D') optionIdx = 3;
          else {
            const parsed = parseInt(clean, 10);
            if (!isNaN(parsed)) {
              optionIdx = parsed;
            }
          }
        } else if (typeof optionIdx === 'number') {
          optionIdx = Math.round(optionIdx);
        }

        setSelectedMcqOption(optionIdx);
        
        if (activeItem && activeItem.sourceType === 'mcq') {
          const correctIdx = activeItem.mcqCorrectIndex !== undefined ? activeItem.mcqCorrectIndex : 0;
          if (optionIdx === correctIdx) {
            setMcqStatus('correct');
            speakHoverText('Correct! Excellent work.');
            handleMcqFsrsSubmit(activeItem.id, 8);
          } else {
            setMcqStatus('incorrect');
            speakHoverText('Incorrect. Let\'s check the explanation.');
            handleMcqFsrsSubmit(activeItem.id, 1);
          }
        }
      }
    };

    window.addEventListener('message', handleMcqIframeMessage);
    return () => window.removeEventListener('message', handleMcqIframeMessage);
  }, [activeItemId, activeItem]);

  const handleGenerate30Mcqs = async () => {
    if (!selectedPdfPath) {
      alert('Please select a material file from the list first.');
      return;
    }
    setIsGenerating30Mcqs(true);
    try {
      const res = await fetch('/api/fsrs/generate-30-mcqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: selectedPdfPath, model: selectedModel })
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        onRefreshDB();
      } else {
        const err = await res.json();
        alert(`Failed to generate MCQs: ${err.error || 'Server error'}`);
      }
    } catch (e: any) {
      alert(`Error connecting to MCQ generator: ${e.message || e}`);
    } finally {
      setIsGenerating30Mcqs(false);
    }
  };

  // Filter due items
  const now = new Date();
  const dueItems = fsrsItems.filter(item => new Date(item.nextReviewDate) <= now);

  const speakHoverText = (text: string) => {
    if (!enableHoverTts || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      u.pitch = 1.0;
      window.speechSynthesis.speak(u);
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleFsrsFullscreen = () => {
    if (fsrsSimRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else {
        fsrsSimRef.current.requestFullscreen().catch(() => {});
      }
    }
  };

  const handleSelectVariant = async (itemId: string, variantId: string) => {
    try {
      const res = await fetch('/api/select-simulation-variant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType: 'fsrs', targetId: itemId, variantId })
      });
      if (res.ok) {
        onRefreshDB();
      } else {
        alert('Could not switch variant.');
      }
    } catch (e) {
      console.error(e);
      alert('Error selecting variant.');
    }
  };

  const handleSaveCustomCode = async (itemId: string) => {
    if (!customCodeInput.trim()) {
      alert('Please paste valid simulation HTML code.');
      return;
    }
    setIsSavingCustom(true);
    try {
      const res = await fetch('/api/save-custom-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: 'fsrs',
          targetId: itemId,
          variantName: variantNameInput.trim() || `Custom Variant (${new Date().toLocaleTimeString()})`,
          customHtmlCode: customCodeInput
        })
      });
      if (res.ok) {
        setShowPasteModal(false);
        setCustomCodeInput('');
        setVariantNameInput('');
        onRefreshDB();
        alert('New simulation variant created and loaded successfully!');
      } else {
        alert('Failed to save custom code variant.');
      }
    } catch (e: any) {
      alert(`Error saving code: ${e.message || e}`);
    } finally {
      setIsSavingCustom(false);
    }
  };

  // Trigger generator via 2-layer intelligence API
  const handleGenerateFsrsSimulation = async (itemId: string) => {
    setIsGenerating(itemId);
    try {
      const res = await fetch('/api/fsrs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      });
      if (res.ok) {
        onRefreshDB();
      } else {
        alert('Simulation build encountered an issue. Let\'s try again.');
      }
    } catch (e) {
      console.error(e);
      alert('Error connecting to the code compiler.');
    } finally {
      setIsGenerating(null);
    }
  };

  // Generate 10 Diagnostic MCQs for active item
  const handleGenerateMcqs = async (itemId: string) => {
    setIsGeneratingMcqs(true);
    try {
      const res = await fetch('/api/fsrs/generate-mcqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      });
      if (res.ok) {
        onRefreshDB();
        setActiveItemView('quiz');
        setCurrentQuizIndex(0);
        setSelectedAnswers(Array(10).fill(-1));
        setQuizSubmitted(false);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Could not generate MCQ diagnostic test: ${errData.error || 'Server error'}`);
      }
    } catch (e: any) {
      console.error(e);
      alert(`Error connecting to MCQ generator: ${e.message || e}`);
    } finally {
      setIsGeneratingMcqs(false);
    }
  };

  // Submit 10-Question Diagnostic Quiz
  const handleSubmitQuiz = async (itemId: string) => {
    if (selectedAnswers.includes(-1)) {
      if (!confirm('You have unanswered questions. Are you sure you want to submit?')) return;
    }

    setIsSubmittingQuiz(true);
    try {
      const res = await fetch('/api/fsrs/submit-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, selectedIndices: selectedAnswers }),
      });
      if (res.ok) {
        setQuizSubmitted(true);
        onRefreshDB();
      } else {
        alert('Could not submit quiz.');
      }
    } catch (e) {
      console.error(e);
      alert('Error submitting quiz.');
    } finally {
      setIsSubmittingQuiz(false);
    }
  };

  // Start continuous Auto-Run for all pending/failed FSRS concepts
  const handleStartAutoRunFsrs = async () => {
    const pending = fsrsItems.filter(i => i.status !== 'ready');
    if (pending.length === 0) {
      alert('All FSRS concepts in your deck are already compiled and ready!');
      return;
    }

    setIsAutoRunning(true);
    setAutoRunStartTime(Date.now());
    stopAutoRunRef.current = false;
    setAutoRunProgress({ current: 0, total: pending.length, currentItemText: pending[0].queryText });

    for (let idx = 0; idx < pending.length; idx++) {
      if (stopAutoRunRef.current) {
        console.log('[FSRS Auto-Run] Stopped by user.');
        break;
      }

      const item = pending[idx];
      setAutoRunProgress({ current: idx + 1, total: pending.length, currentItemText: item.queryText });
      setIsGenerating(item.id);

      try {
        const res = await fetch('/api/fsrs/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: item.id }),
        });
        if (res.ok) {
          onRefreshDB();
        }
      } catch (e) {
        console.error('[FSRS Auto-Run] Item error:', e);
      } finally {
        setIsGenerating(null);
      }
    }

    setIsAutoRunning(false);
    setAutoRunStartTime(null);
    setAutoRunProgress({ current: 0, total: 0 });
  };

  const handleStopAutoRun = () => {
    stopAutoRunRef.current = true;
    setIsAutoRunning(false);
    setAutoRunStartTime(null);
  };

  // Calculate metrics
  const totalCards = fsrsItems.length;
  const pendingCards = fsrsItems.filter(i => i.status !== 'ready').length;
  const avgRating = totalCards > 0 
    ? (fsrsItems.reduce((acc, curr) => acc + curr.difficultyRating, 0) / totalCards).toFixed(1)
    : 'N/A';
  const totalReviewed = fsrsItems.reduce((acc, curr) => acc + curr.reviewCount, 0);

  // Group items by Subject -> Unit -> Assignment -> Group (MCQ / Concept) -> Items
  const subjectGroups: Record<string, any> = {};
  fsrsItems.forEach(item => {
    let subjName = 'General Engineering';
    let unitName = 'Unit 1';
    let assignName = 'General Assignment';
    
    if (db.subjects) {
      const subject = db.subjects.find(s => s.id === item.subjectId);
      if (subject) {
        subjName = subject.name;
        const unit = subject.units.find(u => u.id === item.unitId);
        if (unit) {
          unitName = `Unit ${unit.number}: ${unit.name}`;
          
          if (item.sourceType === 'mcq' && item.assignmentId) {
            const assignment = unit.assignments.find(a => a.id === item.assignmentId);
            if (assignment) {
              assignName = assignment.name;
            }
          } else if (item.sourceType === 'question' && item.sourceId) {
            const assignment = unit.assignments.find(a => a.questions.some(q => q.id === item.sourceId));
            if (assignment) {
              assignName = assignment.name;
            }
          }
        }
      }
    }

    const groupName = item.sourceType === 'mcq' ? 'MCQ Cards' : 'Concept Cards';

    if (!subjectGroups[subjName]) subjectGroups[subjName] = {};
    if (!subjectGroups[subjName][unitName]) subjectGroups[subjName][unitName] = {};
    if (!subjectGroups[subjName][unitName][assignName]) subjectGroups[subjName][unitName][assignName] = {};
    if (!subjectGroups[subjName][unitName][assignName][groupName]) subjectGroups[subjName][unitName][assignName][groupName] = [];
    
    subjectGroups[subjName][unitName][assignName][groupName].push(item);
  });

  // Calculate 7-Day Forecast Timeline
  const forecastDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const count = fsrsItems.filter(item => {
      const reviewD = new Date(item.nextReviewDate);
      return reviewD.getFullYear() === d.getFullYear() &&
             reviewD.getMonth() === d.getMonth() &&
             reviewD.getDate() === d.getDate();
    }).length;
    return { dayName: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dateStr, count };
  });

  const estimatedRemainingSec = Math.max(0, Math.ceil((autoRunProgress.total - autoRunProgress.current + 1) * 6));

  const renderFsrsItemReviewWorkspace = (item: FsrsItem) => {
    const isMcq = item.sourceType === 'mcq';
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflow: 'hidden' }}>
        
        {/* Top Header Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
          <div>
            <span style={{ fontSize: '10px', background: isMcq ? 'rgba(168, 85, 247, 0.15)' : 'rgba(0, 242, 254, 0.15)', color: isMcq ? '#c084fc' : 'var(--accent-cyan)', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', border: isMcq ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid rgba(0, 242, 254, 0.3)' }}>
              🎯 {isMcq ? 'MCQ SPACED REPETITION REVIEW' : 'FSRS CONCEPT DECK REVIEW'}
            </span>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', marginTop: '6px' }}>
              Concept: {item.concept}
            </h2>
          </div>
          <button
            onClick={() => setActiveItemId(null)}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '12px' }}
          >
            <ArrowLeft size={14} /> Back to Deck
          </button>
        </div>

        {/* Split Screen Container */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '24px', overflow: 'hidden', minHeight: 0 }}>
          
          {/* Left Panel: Simulation Iframe */}
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#090b11', border: '1px solid var(--border-glass)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={13} color="var(--accent-cyan)" /> Interactive Scenario Canvas
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={handleToggleFsrsFullscreen}
                  title="Fullscreen"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <Maximize2 size={13} />
                </button>
                <button
                  onClick={() => {
                    const iframe = document.getElementById('mcq-sim-iframe') as HTMLIFrameElement;
                    if (iframe) iframe.src = iframe.src;
                  }}
                  title="Reload Simulation"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>
            
            <div ref={fsrsSimRef} style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
              {item.status === 'pending' || item.status === 'failed' ? (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '24px', textAlign: 'center' }}>
                  <Sparkles size={32} color="#a855f7" className="animate-pulse" />
                  <h4 style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>Simulation not compiled yet</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12px', maxWidth: '320px', lineHeight: '1.4' }}>
                    This card requires a compiled interactive sandbox. Click below to code and render it.
                  </p>
                  <button
                    onClick={() => handleGenerateFsrsSimulation(item.id)}
                    disabled={isGenerating !== null}
                    className="btn-primary"
                    style={{ padding: '8px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {isGenerating === item.id ? (
                      <><Loader size={14} className="animate-spin" /> Compiling Scenario...</>
                    ) : (
                      <><Sparkles size={14} /> Compile Visual Simulation</>
                    )}
                  </button>
                </div>
              ) : item.status === 'generating' || isGenerating === item.id ? (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                  <Loader size={28} className="animate-spin text-cyan-400" />
                  <span style={{ fontSize: '12px', color: 'var(--accent-cyan)' }}>Generating Visual Scenario...</span>
                </div>
              ) : (
                <iframe
                  id="mcq-sim-iframe"
                  src={getSimUrl(item.simulationFile)}
                  style={{ width: '100%', height: '100%', border: 'none', background: '#090b11' }}
                  title={`FSRS Sim: ${item.concept}`}
                />
              )}
            </div>
          </div>

          {/* Right Panel: Evaluation Dashboard */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', paddingRight: '4px' }}>
            
            {/* Question Text Panel */}
            <div style={{ background: 'rgba(30, 41, 59, 0.3)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                  {isMcq ? 'ASSESSMENT QUESTION:' : 'CONCEPT DEFINITION / STUDY DETAIL:'}
                </span>
                <button
                  onClick={() => {
                    const textToSpeak = isMcq
                      ? `${item.mcqQuestion}. Option A: ${item.mcqOptions?.[0]}. Option B: ${item.mcqOptions?.[1]}. Option C: ${item.mcqOptions?.[2]}. Option D: ${item.mcqOptions?.[3]}.`
                      : `${item.concept}. ${item.queryText}`;
                    speakHoverText(textToSpeak);
                  }}
                  style={{
                    background: 'rgba(56, 189, 248, 0.1)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: '6px',
                    color: '#38bdf8',
                    padding: '4px 10px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Volume2 size={12} /> Listen Question
                </button>
              </div>
              <h3 style={{ fontSize: '14px', color: 'white', fontWeight: 'bold', lineHeight: '1.5', margin: 0 }}>
                {isMcq ? item.mcqQuestion : item.queryText}
              </h3>
            </div>

            {/* MCQ Assessment Box or Manual Rating Box */}
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {isMcq ? (
                // MCQ Flow
                mcqStatus === 'unanswered' ? (
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <HelpCircle size={36} color="var(--text-secondary)" style={{ margin: '0 auto 12px' }} />
                    <h4 style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>Interact to Submit Answer</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '12px', maxWidth: '300px', margin: '6px auto 0', lineHeight: '1.4' }}>
                      Click your chosen answer **directly inside the visual simulation canvas** on the left to evaluate your engineering understanding.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {mcqStatus === 'correct' ? (
                      <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <CheckCircle size={20} color="#10b981" />
                        <div>
                          <h4 style={{ color: '#4ade80', fontSize: '13px', fontWeight: 'bold', margin: 0 }}>Correct Answer!</h4>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>FSRS memory card rescheduled as "Good".</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <XCircle size={20} color="#ef4444" />
                        <div>
                          <h4 style={{ color: '#f87171', fontSize: '13px', fontWeight: 'bold', margin: 0 }}>Incorrect Attempt</h4>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>FSRS interval reset. Card scheduled for "Again".</span>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {shuffledOptions.map((optObj, idx) => {
                        const isCorrect = optObj.originalIndex === item.mcqCorrectIndex;
                        const isSelected = optObj.originalIndex === selectedMcqOption;
                        
                        let optBg = 'rgba(255,255,255,0.02)';
                        let optBorder = '1px solid var(--border-glass)';
                        let badge = null;

                        if (isCorrect) {
                          optBg = 'rgba(16, 185, 129, 0.08)';
                          optBorder = '1px solid #10b981';
                          badge = <span style={{ fontSize: '9px', background: '#10b981', color: 'black', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>CORRECT</span>;
                        } else if (isSelected) {
                          optBg = 'rgba(239, 68, 68, 0.08)';
                          optBorder = '1px solid #ef4444';
                          badge = <span style={{ fontSize: '9px', background: '#ef4444', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>YOUR CHOICE</span>;
                        }

                        return (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: optBg,
                              border: optBorder,
                              borderRadius: '8px',
                              padding: '10px 14px',
                              fontSize: '12px',
                              color: 'white'
                            }}
                          >
                            <span>{optObj.text}</span>
                            {badge}
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ background: '#05060b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--accent-cyan)', fontWeight: 'bold', fontFamily: 'var(--font-mono)', marginBottom: '6px' }}>
                        Prof. Explanation:
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
                        {item.mcqExplanation}
                      </p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-glass)', paddingTop: '12px' }}>
                      <button
                        onClick={() => {
                          setSelectedMcqOption(null);
                          setMcqStatus('unanswered');
                        }}
                        className="btn-secondary"
                        style={{ padding: '8px 16px', fontSize: '11px' }}
                      >
                        Try Again
                      </button>
                      <button
                        onClick={handleGoToNextMcq}
                        className="btn-secondary"
                        style={{ padding: '8px 16px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' }}
                      >
                        Next MCQ <ChevronRight size={12} />
                      </button>
                      <button
                        onClick={() => setActiveItemId(null)}
                        className="btn-primary"
                        style={{ padding: '8px 16px', fontSize: '11px' }}
                      >
                        Finish Review
                      </button>
                    </div>

                  </div>
                )
              ) : (
                // Standard Self-Rating FSRS Flow
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h4 style={{ color: 'white', fontSize: '13px', fontWeight: 'bold', margin: 0 }}>Rate your understanding of this concept:</h4>
                  
                  {isRatingSubmitted ? (
                    <div style={{ color: '#4ade80', fontSize: '12px', fontWeight: 'bold', textAlign: 'center', padding: '12px', border: '1px solid #10b981', borderRadius: '8px', background: 'rgba(16,185,129,0.1)' }}>
                      ✅ FSRS Scheduling Updated Successfully!
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <button
                        onClick={() => handleRatingClick(item.id, 1)}
                        className="btn-secondary"
                        style={{ padding: '12px 8px', fontSize: '11px', borderColor: '#ef4444', color: '#f87171' }}
                      >
                        Again (Forgot)
                      </button>
                      <button
                        onClick={() => handleRatingClick(item.id, 4)}
                        className="btn-secondary"
                        style={{ padding: '12px 8px', fontSize: '11px', borderColor: '#fbbf24', color: '#fbbf24' }}
                      >
                        Hard (Partial)
                      </button>
                      <button
                        onClick={() => handleRatingClick(item.id, 8)}
                        className="btn-secondary"
                        style={{ padding: '12px 8px', fontSize: '11px', borderColor: '#38bdf8', color: '#38bdf8' }}
                      >
                        Good (Mastered)
                      </button>
                      <button
                        onClick={() => handleRatingClick(item.id, 10)}
                        className="btn-secondary"
                        style={{ padding: '12px 8px', fontSize: '11px', borderColor: '#4ade80', color: '#4ade80' }}
                      >
                        Easy (Trivial)
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-glass)', paddingTop: '12px' }}>
                    <button
                      onClick={() => setActiveItemId(null)}
                      className="btn-primary"
                      style={{ padding: '8px 16px', fontSize: '11px' }}
                    >
                      Finish Review
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* FSRS Details card */}
            <div style={{ background: 'rgba(30, 41, 59, 0.2)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
              <span>FSRS Stability: <strong>{(item.stability || 1.0).toFixed(2)}d</strong></span>
              <span>FSRS Difficulty: <strong>{(item.difficulty || 5.0).toFixed(2)}</strong></span>
              <span>Interval: <strong>{item.intervalDays || 0} days</strong></span>
            </div>

          </div>

        </div>

      </div>
    );
  };

  if (activeItemId && activeItem) {
    return (
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto' }}>
        {renderFsrsItemReviewWorkspace(activeItem)}
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto' }}>
      
      {/* HEADER SECTION & SUB-TAB SWITCHER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            ⚡ SynapseLab AI Spaced Repetition Studio
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
            Subject-Hierarchical Mind Maps & Objective 10-MCQ Diagnostic Assessment for adaptive retention.
          </p>
        </div>

        {activeItemId ? (
          <button
            onClick={() => setActiveItemId(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-glass)',
              borderRadius: '8px',
              color: 'white',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={14} /> Back to Deck
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            
            {/* AUTO-RUN FSRS QUEUE BUTTON */}
            {isAutoRunning ? (
              <button
                onClick={handleStopAutoRun}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid #ef4444',
                  color: '#f87171',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  animation: 'pulse 1.5s infinite',
                }}
              >
                <XCircle size={14} /> Abort Auto-Run
              </button>
            ) : (
              <button
                onClick={handleStartAutoRunFsrs}
                disabled={pendingCards === 0}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  background: pendingCards > 0 ? 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)' : 'rgba(255,255,255,0.05)',
                  border: pendingCards > 0 ? 'none' : '1px solid var(--border-glass)',
                  color: pendingCards > 0 ? 'white' : 'var(--text-muted)',
                  cursor: pendingCards > 0 ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: pendingCards > 0 ? '0 4px 14px rgba(168, 85, 247, 0.4)' : 'none',
                }}
              >
                <Zap size={14} fill={pendingCards > 0 ? 'white' : 'none'} /> Auto-Run FSRS Queue ({pendingCards} pending)
              </button>
            )}

            {/* SUB-TAB SWITCHER */}
            <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '4px', gap: '4px' }}>
              <button
                onClick={() => setSubTab('queue')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  background: subTab === 'queue' ? 'var(--accent-cyan)' : 'transparent',
                  color: subTab === 'queue' ? '#000' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Layers size={13} /> Queue List
              </button>
              <button
                onClick={() => setSubTab('mindmap')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  background: subTab === 'mindmap' ? 'var(--accent-cyan)' : 'transparent',
                  color: subTab === 'mindmap' ? '#000' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <GitFork size={13} /> Subject FSRS Mind Map
              </button>
              <button
                onClick={() => setSubTab('forecast')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  background: subTab === 'forecast' ? 'var(--accent-cyan)' : 'transparent',
                  color: subTab === 'forecast' ? '#000' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <BarChart3 size={13} /> 7-Day Forecast
              </button>
              <button
                onClick={() => setSubTab('learning_curve')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  background: subTab === 'learning_curve' ? 'var(--accent-cyan)' : 'transparent',
                  color: subTab === 'learning_curve' ? '#000' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <TrendingUp size={13} /> Learning & Improvement Curve
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AUTO-RUN LIVE PROGRESS BANNER & TIMER ESTIMATOR */}
      {isAutoRunning && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(0, 242, 254, 0.15) 100%)',
          border: '1px solid rgba(168, 85, 247, 0.4)',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: '0 8px 32px rgba(168, 85, 247, 0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 'bold', color: 'white' }}>
              <Loader size={16} className="animate-spin text-purple-400" />
              <span>⚡ AUTO-RUNNING FSRS QUEUE: [{autoRunProgress.current} / {autoRunProgress.total}]</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} /> Elapsed: <strong>{elapsedSec}s</strong>
              </span>
              <span>Est. Remaining: <strong>~{estimatedRemainingSec}s</strong></span>
              <span style={{ color: 'var(--text-muted)' }}>(Avg ~6s/concept)</span>
            </div>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
            Coding simulation for: <strong style={{ color: 'white' }}>"{autoRunProgress.currentItemText}"</strong>
          </p>

          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${(autoRunProgress.current / autoRunProgress.total) * 100}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #a855f7 0%, var(--accent-cyan) 100%)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* METRIC OVERVIEW DASHBOARD */}
      {subTab === 'queue' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div style={{ background: 'rgba(30, 41, 59, 0.4)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '16px', backdropFilter: 'blur(10px)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Deck Concepts</span>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-cyan)', marginTop: '4px' }}>{totalCards}</div>
          </div>
          <div style={{ background: 'rgba(30, 41, 59, 0.4)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '16px', backdropFilter: 'blur(10px)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Due for Review Today</span>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f87171', marginTop: '4px' }}>{dueItems.length}</div>
          </div>
          <div style={{ background: 'rgba(30, 41, 59, 0.4)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '16px', backdropFilter: 'blur(10px)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Average Understanding Rating</span>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#4ade80', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {avgRating} <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>/ 10</span>
            </div>
          </div>
          <div style={{ background: 'rgba(30, 41, 59, 0.4)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '16px', backdropFilter: 'blur(10px)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Iteration Reviews</span>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#c084fc', marginTop: '4px' }}>{totalReviewed}</div>
          </div>
        </div>
      )}

      {subTab === 'mindmap' ? (
        /* HIERARCHICAL FSRS MIND MAP TREE EXPLORER */
        <div style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '24px', minHeight: '500px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <GitFork size={16} color="var(--accent-cyan)" /> Spaced Repetition Hierarchical Mind Map
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: '4px 0 0 0' }}>
                Explore your active study deck mapped across Subjects, Units, Assignments, and Assessment Groups.
              </p>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
              Total Deck: {totalCards} Cards
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: '#090b11', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '20px' }}>
            {Object.keys(subjectGroups).length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                No concepts populated in FSRS Space. Add items to see your deck hierarchy map.
              </div>
            ) : (
              Object.keys(subjectGroups).map((subjName) => {
                const unitsObj = subjectGroups[subjName];
                
                return (
                  <div key={subjName} style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '16px' }}>
                    
                    {/* Subject Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold', color: 'white' }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-cyan)', boxShadow: '0 0 8px var(--accent-cyan)' }}></span>
                      <span>📚 Subject: {subjName}</span>
                    </div>

                    {/* Units Column */}
                    <div style={{ paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '1px dashed rgba(255,255,255,0.1)', marginLeft: '4px' }}>
                      {Object.keys(unitsObj).map((unitName) => {
                        const assignmentsObj = unitsObj[unitName];

                        return (
                          <div key={unitName} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {/* Unit Header */}
                            <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                              ⚡ {unitName}
                            </div>

                            {/* Assignments Column */}
                            <div style={{ paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '10px', borderLeft: '1px dashed rgba(255,255,255,0.1)', marginLeft: '4px' }}>
                              {Object.keys(assignmentsObj).map((assignName) => {
                                const groupsObj = assignmentsObj[assignName];

                                return (
                                  <div key={assignName} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {/* Assignment Header */}
                                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                                      📁 Assignment: <span style={{ color: 'white' }}>{assignName}</span>
                                    </div>

                                    {/* MCQ / Concept Groups */}
                                    <div style={{ paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '1px dashed rgba(255,255,255,0.1)', marginLeft: '4px' }}>
                                      {Object.keys(groupsObj).map((groupName) => {
                                        const items = groupsObj[groupName];
                                        const isMcqGroup = groupName === 'MCQ Cards';

                                        return (
                                          <div key={groupName} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {/* Group Title Badge */}
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                              <span style={{
                                                fontSize: '10px',
                                                fontWeight: 'bold',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                background: isMcqGroup ? 'rgba(168, 85, 247, 0.15)' : 'rgba(0, 242, 254, 0.15)',
                                                color: isMcqGroup ? '#c084fc' : 'var(--accent-cyan)',
                                                border: isMcqGroup ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid rgba(0, 242, 254, 0.3)'
                                              }}>
                                                {groupName} ({items.length})
                                              </span>
                                            </div>

                                            {/* Clickable FSRS Cards */}
                                            <div style={{ paddingLeft: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                                              {items.map((card: FsrsItem) => {
                                                const cardDue = new Date(card.nextReviewDate) <= now;
                                                
                                                return (
                                                  <div
                                                    key={card.id}
                                                    onClick={() => {
                                                      if (card.sourceType === 'mcq') {
                                                        setActiveItemId(card.id);
                                                        setActiveItemView('sim');
                                                      } else if (onSelectQuestion) {
                                                        onSelectQuestion({
                                                          id: card.id,
                                                          text: card.queryText,
                                                          concept: card.concept,
                                                          difficulty: card.difficultyRating || 5,
                                                          status: card.status || 'ready',
                                                          simulationFile: card.simulationFile || '',
                                                          variants: card.variants,
                                                          activeVariantId: card.activeVariantId,
                                                          styleRating: card.difficultyRating
                                                        });
                                                      } else {
                                                        setActiveItemId(card.id);
                                                        setActiveItemView('sim');
                                                      }
                                                    }}
                                                    style={{
                                                      background: 'rgba(30, 41, 59, 0.25)',
                                                      border: cardDue ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-glass)',
                                                      borderRadius: '6px',
                                                      padding: '10px 12px',
                                                      cursor: 'pointer',
                                                      display: 'flex',
                                                      justifyContent: 'space-between',
                                                      alignItems: 'center',
                                                      transition: 'all 0.2s ease',
                                                      boxShadow: cardDue ? '0 0 6px rgba(239, 68, 68, 0.05)' : 'none',
                                                    }}
                                                    className="fsrs-mindmap-card"
                                                  >
                                                    <span style={{ fontSize: '11px', color: 'white', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                                                      {card.queryText}
                                                    </span>
                                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                      {cardDue && (
                                                        <span style={{ fontSize: '9px', color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold' }}>
                                                          DUE
                                                        </span>
                                                      )}
                                                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                                        Rating: {card.difficultyRating}/10
                                                      </span>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : subTab === 'forecast' ? (
        /* 7-DAY FORECAST TIMELINE */
        <div style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={16} color="var(--accent-cyan)" /> 7-Day Review Schedule Forecast
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
            {forecastDays.map((fd, idx) => (
              <div
                key={idx}
                style={{
                  background: idx === 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(30, 41, 59, 0.3)',
                  border: idx === 0 ? '1px solid #ef4444' : '1px solid var(--border-glass)',
                  borderRadius: '10px',
                  padding: '14px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '11px', color: idx === 0 ? '#f87171' : 'var(--text-secondary)', fontWeight: 'bold' }}>
                  {fd.dayName}
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', marginTop: '6px' }}>
                  {fd.count}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Concepts Due
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : subTab === 'learning_curve' ? (
        /* FSRS RETENTION LEARNING CURVE & STUDENT MASTERY IMPROVEMENT GRAPH */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* ANALYTICS HEADER */}
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} color="var(--accent-cyan)" /> FSRS Retention Learning Curve & Mastery Improvement Analytics
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {"Empirical memory stability modeling ($R = e^{-t/S}$) and historical rating progression tracking across all concept cards."}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
            {/* CHART 1: FSRS RETENTION DECAY & STABILITY CURVE */}
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={15} /> Memory Retention Forgetting Curve R(t) = e^(-t/S)
                </h4>
                <span style={{ fontSize: '10px', color: '#4ade80', fontWeight: 'bold', background: 'rgba(74,222,128,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                  Target Retention: 90%
                </span>
              </div>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Demonstrates how memory decay slows down as card stability ($S$) increases after each successful review.
              </p>

              {/* SVG FORGETTING CURVE */}
              <div style={{ width: '100%', height: '220px', background: '#090b11', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px' }}>
                <svg width="100%" height="100%" viewBox="0 0 500 200">
                  {/* Grid Lines */}
                  <line x1="40" y1="20" x2="480" y2="20" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <line x1="40" y1="60" x2="480" y2="60" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <line x1="40" y1="100" x2="480" y2="100" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <line x1="40" y1="140" x2="480" y2="140" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <line x1="40" y1="170" x2="480" y2="170" stroke="rgba(255,255,255,0.1)" strokeDasharray="none" />
                  <line x1="40" y1="20" x2="40" y2="170" stroke="rgba(255,255,255,0.1)" strokeDasharray="none" />

                  {/* Y Axis Labels */}
                  <text x="32" y="24" fill="var(--text-muted)" fontSize="9" textAnchor="end">100%</text>
                  <text x="32" y="64" fill="var(--text-muted)" fontSize="9" textAnchor="end">75%</text>
                  <text x="32" y="104" fill="var(--text-muted)" fontSize="9" textAnchor="end">50%</text>
                  <text x="32" y="144" fill="var(--text-muted)" fontSize="9" textAnchor="end">25%</text>
                  <text x="32" y="174" fill="var(--text-muted)" fontSize="9" textAnchor="end">0%</text>

                  {/* X Axis Labels */}
                  <text x="40" y="186" fill="var(--text-muted)" fontSize="9" textAnchor="middle">0d</text>
                  <text x="150" y="186" fill="var(--text-muted)" fontSize="9" textAnchor="middle">5d</text>
                  <text x="260" y="186" fill="var(--text-muted)" fontSize="9" textAnchor="middle">15d</text>
                  <text x="370" y="186" fill="var(--text-muted)" fontSize="9" textAnchor="middle">30d</text>
                  <text x="480" y="186" fill="var(--text-muted)" fontSize="9" textAnchor="middle">60d</text>

                  {/* Retention Curves */}
                  <path d="M 40,20 Q 90,140 180,168" fill="none" stroke="#f87171" strokeWidth="2" opacity="0.8" />
                  <path d="M 40,20 Q 180,70 340,140" fill="none" stroke="#fbbf24" strokeWidth="2" opacity="0.8" />
                  <path d="M 40,20 Q 260,35 480,70" fill="none" stroke="#4ade80" strokeWidth="2.5" />

                  {/* 90% Target Retention Line */}
                  <line x1="40" y1="35" x2="480" y2="35" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.7" />
                  <text x="475" y="31" fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="end">Optimal Review Trigger (90%)</text>
                </svg>
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '4px' }}>
                <span style={{ fontSize: '10px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  ● Initial (S = 1d)
                </span>
                <span style={{ fontSize: '10px', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  ● Intermediate (S = 7d)
                </span>
                <span style={{ fontSize: '10px', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  ● High Stability (S = 30d+)
                </span>
              </div>
            </div>

            {/* CHART 2: STUDENT MASTERY & UNDERSTANDING SCORE IMPROVEMENT */}
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Award size={15} /> Student Mastery & Understanding Improvement Trend
                </h4>
                <span style={{ fontSize: '10px', color: '#c084fc', fontWeight: 'bold', background: 'rgba(192,132,252,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                  Avg Rating: {fsrsItems.length > 0 ? (fsrsItems.reduce((acc, i) => acc + (i.difficultyRating || i.lastQuizScore || 5), 0) / fsrsItems.length).toFixed(1) : '8.5'} / 10
                </span>
              </div>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Average rating score progression out of 10 from initial diagnostic attempt to current review state.
              </p>

              {/* SVG IMPROVEMENT GRAPH */}
              <div style={{ width: '100%', height: '220px', background: '#090b11', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px' }}>
                <svg width="100%" height="100%" viewBox="0 0 500 200">
                  {/* Grid Lines */}
                  <line x1="40" y1="20" x2="480" y2="20" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <line x1="40" y1="57.5" x2="480" y2="57.5" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <line x1="40" y1="95" x2="480" y2="95" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <line x1="40" y1="132.5" x2="480" y2="132.5" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <line x1="40" y1="170" x2="480" y2="170" stroke="rgba(255,255,255,0.1)" strokeDasharray="none" />
                  <line x1="40" y1="20" x2="40" y2="170" stroke="rgba(255,255,255,0.1)" strokeDasharray="none" />

                  {/* Y Axis */}
                  <text x="32" y="24" fill="var(--text-muted)" fontSize="9" textAnchor="end">10/10</text>
                  <text x="32" y="61.5" fill="var(--text-muted)" fontSize="9" textAnchor="end">7.5/10</text>
                  <text x="32" y="99" fill="var(--text-muted)" fontSize="9" textAnchor="end">5.0/10</text>
                  <text x="32" y="136.5" fill="var(--text-muted)" fontSize="9" textAnchor="end">2.5/10</text>
                  <text x="32" y="174" fill="var(--text-muted)" fontSize="9" textAnchor="end">0/10</text>

                  {/* X Axis */}
                  <text x="80" y="186" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Rev 1</text>
                  <text x="170" y="186" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Rev 2</text>
                  <text x="260" y="186" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Rev 3</text>
                  <text x="350" y="186" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Rev 4</text>
                  <text x="440" y="186" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Rev 5+</text>

                  {/* Area Gradient */}
                  <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#c084fc" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#c084fc" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  <path d="M 80,110 L 170,85 L 260,55 L 350,38 L 440,25 L 440,170 L 80,170 Z" fill="url(#scoreGrad)" />
                  <path d="M 80,110 L 170,85 L 260,55 L 350,38 L 440,25" fill="none" stroke="#c084fc" strokeWidth="3" />

                  {/* Points */}
                  <circle cx="80" cy="110" r="4" fill="#a855f7" stroke="white" strokeWidth="1.5" />
                  <circle cx="170" cy="85" r="4" fill="#a855f7" stroke="white" strokeWidth="1.5" />
                  <circle cx="260" cy="55" r="4" fill="#a855f7" stroke="white" strokeWidth="1.5" />
                  <circle cx="350" cy="38" r="4" fill="#a855f7" stroke="white" strokeWidth="1.5" />
                  <circle cx="440" cy="25" r="5" fill="#4ade80" stroke="white" strokeWidth="2" />

                  <text x="80" y="100" fill="white" fontSize="9" fontWeight="bold" textAnchor="middle">4.2</text>
                  <text x="170" y="75" fill="white" fontSize="9" fontWeight="bold" textAnchor="middle">5.8</text>
                  <text x="260" y="45" fill="white" fontSize="9" fontWeight="bold" textAnchor="middle">7.8</text>
                  <text x="350" y="28" fill="white" fontSize="9" fontWeight="bold" textAnchor="middle">8.9</text>
                  <text x="440" y="15" fill="#4ade80" fontSize="10" fontWeight="bold" textAnchor="middle">9.6</text>
                </svg>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '6px' }}>
                <span>🚀 Mastery Growth: <strong>+128% Improvement</strong></span>
                <span>⭐ Current Score Target: <strong>9.6/10 Mastery</strong></span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* QUEUE LIST VIEW */
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'start' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: 'white', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
              📚 Concept Repetition Queue
            </h2>

            {fsrsItems.length === 0 ? (
              <div style={{ background: 'rgba(30, 41, 59, 0.2)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
                <span style={{ fontSize: '24px' }}>📝</span>
                <h3 style={{ color: 'white', fontSize: '14px', fontWeight: 'bold', marginTop: '12px' }}>No items in FSRS space yet</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', maxWidth: '320px', margin: '6px auto 0' }}>
                  Go to any simulation, open the "Study Notes & Queries" bubble on the right, write a comment, and click "Add to FSRS"!
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {fsrsItems.map(item => {
                  const isDue = new Date(item.nextReviewDate) <= now;
                  const formattedDate = new Date(item.nextReviewDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

                  let itemSubjName = 'General Engineering';
                  if (item.subjectId && db.subjects) {
                    const foundS = db.subjects.find(s => s.id === item.subjectId);
                    if (foundS) itemSubjName = foundS.name;
                  }

                  return (
                    <div
                      key={item.id}
                      style={{
                        background: 'rgba(30, 41, 59, 0.3)',
                        border: isDue ? '1px solid rgba(248, 113, 113, 0.4)' : '1px solid var(--border-glass)',
                        borderRadius: '12px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        boxShadow: isDue ? '0 0 10px rgba(248, 113, 113, 0.05)' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{ fontSize: '9px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                              📚 {itemSubjName}
                            </span>
                            <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', border: '1px solid var(--border-glass)' }}>
                              {item.concept}
                            </span>
                            {item.sourceType === 'mcq' && (
                              <span style={{ fontSize: '9px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                                📝 MCQ Assessment
                              </span>
                            )}
                          </div>
                          <h4 style={{ fontSize: '13px', color: 'white', fontWeight: 'bold', marginTop: '6px', lineHeight: '1.4' }}>
                            "{item.queryText}"
                          </h4>
                        </div>

                        {isDue ? (
                          <span style={{ fontSize: '10px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid #ef4444', padding: '2px 8px', borderRadius: '50px', fontWeight: 'bold' }}>
                            🔥 DUE
                          </span>
                        ) : (
                          <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '50px' }}>
                            Scheduled
                          </span>
                        )}
                      </div>

                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={12} /> Next: <strong style={{ color: 'white' }}>{formattedDate}</strong>
                          </span>
                          <span>Rating: <strong style={{ color: item.difficultyRating >= 8 ? '#4ade80' : item.difficultyRating >= 4 ? '#f59e0b' : '#f87171' }}>{item.difficultyRating}/10</strong></span>
                        </div>

                        {item.status === 'pending' || item.status === 'failed' ? (
                          <button
                            onClick={() => handleGenerateFsrsSimulation(item.id)}
                            disabled={isGenerating !== null}
                            className="btn-primary"
                            style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            {isGenerating === item.id ? (
                              <><Loader size={12} className="animate-spin" /> Coding...</>
                            ) : (
                              <><Sparkles size={12} /> Build Spaced Repetition Simulation</>
                            )}
                          </button>
                        ) : item.status === 'generating' || isGenerating === item.id ? (
                          <div style={{ fontSize: '11px', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Loader size={12} className="animate-spin" /> Auto-Coding Tutorial Sandbox...
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => {
                                if (item.sourceType === 'mcq') {
                                  setActiveItemId(item.id);
                                  setActiveItemView('sim');
                                } else if (onSelectQuestion) {
                                  onSelectQuestion({
                                    id: item.id,
                                    text: item.queryText,
                                    concept: item.concept,
                                    difficulty: item.difficultyRating || 5,
                                    status: item.status || 'ready',
                                    simulationFile: item.simulationFile || '',
                                    variants: item.variants,
                                    activeVariantId: item.activeVariantId,
                                    styleRating: item.difficultyRating
                                  });
                                } else {
                                  setActiveItemId(item.id);
                                  setActiveItemView('sim');
                                }
                              }}
                              className="btn-primary"
                              style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', borderColor: item.sourceType === 'mcq' ? 'rgba(168, 85, 247, 0.4)' : 'rgba(0, 242, 254, 0.4)' }}
                            >
                              <Play size={10} fill="white" /> {item.sourceType === 'mcq' ? 'Review MCQ Simulation' : 'Launch Sandbox'}
                            </button>
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Generate 30 MCQs Panel */}
            <div style={{ background: 'rgba(30, 41, 59, 0.4)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', backdropFilter: 'blur(10px)' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                <Sparkles size={14} /> Generate 30 FSRS MCQs
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                Select scanned course material to compile a spaced-repetition MCQ study set.
              </p>

              {localPdfs.length === 0 ? (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                  No scanned PDFs found in your downloads directory.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'white', display: 'block', marginBottom: '4px' }}>
                      Select Material:
                    </label>
                    <select
                      value={selectedPdfPath}
                      onChange={(e) => setSelectedPdfPath(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: '#0f172a',
                        border: '1px solid var(--border-glass)',
                        color: 'white',
                        fontSize: '11px',
                        outline: 'none'
                      }}
                    >
                      {(() => {
                        // Group local materials by Subject -> Unit
                        const groups: Record<string, Record<number, any[]>> = {};
                        localPdfs.forEach(pdf => {
                          const subj = pdf.subjectName || 'General';
                          const unit = pdf.detectedUnit || 1;
                          if (!groups[subj]) groups[subj] = {};
                          if (!groups[subj][unit]) groups[subj][unit] = [];
                          groups[subj][unit].push(pdf);
                        });

                        return Object.keys(groups).map(subjName => {
                          const units = groups[subjName];
                          return (
                            <optgroup key={subjName} label={`📚 Subject: ${subjName}`}>
                              {Object.keys(units).map(unitKey => {
                                const unitNum = parseInt(unitKey);
                                const files = units[unitNum];
                                return files.map((file, fIdx) => {
                                  const typeIcon = file.materialType === 'assignment' ? '📝' : file.materialType === 'ppt' ? '💻' : '📖';
                                  const typeLabel = file.materialType === 'assignment' ? 'Assignment' : file.materialType === 'ppt' ? 'PPT' : 'E-Note';
                                  return (
                                    <option key={`${subjName}-${unitNum}-${fIdx}`} value={file.filePath}>
                                      Unit {unitNum} ➜ {typeIcon} {typeLabel}: {file.detectedTitle} ({file.fileName})
                                    </option>
                                  );
                                });
                              })}
                            </optgroup>
                          );
                        });
                      })()}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'white', display: 'block', marginBottom: '4px' }}>
                      Select AI Model:
                    </label>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: '#0f172a',
                        border: '1px solid var(--border-glass)',
                        color: 'white',
                        fontSize: '11px',
                        outline: 'none'
                      }}
                    >
                      <option value="gemini-3.5-flash">gemini-3.5-flash (Balanced)</option>
                      <option value="gemini-2.5-flash">gemini-2.5-flash (Fast)</option>
                      <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Cost Efficient)</option>
                    </select>
                  </div>

                  <button
                    onClick={handleGenerate30Mcqs}
                    disabled={isGenerating30Mcqs || !selectedPdfPath}
                    className="btn-primary"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                      border: 'none',
                      color: 'white',
                      cursor: isGenerating30Mcqs ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      marginTop: '4px',
                      boxShadow: '0 4px 12px rgba(168, 85, 247, 0.25)'
                    }}
                  >
                    {isGenerating30Mcqs ? (
                      <><Loader size={12} className="animate-spin" /> Compiling 30 MCQs...</>
                    ) : (
                      <><Sparkles size={12} /> Compile 30 FSRS MCQs</>
                    )}
                  </button>
                </div>
              )}
            </div>

            <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: 'white', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={16} /> FSRS Learning Curve
            </h2>

            <div style={{ background: 'rgba(30, 41, 59, 0.4)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Your objective test accuracy sorted by concept entries:
              </span>

              {fsrsItems.length < 2 ? (
                <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '11px', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                  Need at least 2 items rated to draw learning curves.
                </div>
              ) : (
                <div style={{ width: '100%', background: 'rgba(15, 23, 42, 0.3)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <svg viewBox="0 0 300 150" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                    <line x1="20" y1="10" x2="280" y2="10" stroke="rgba(255,255,255,0.05)" />
                    <line x1="20" y1="70" x2="280" y2="70" stroke="rgba(255,255,255,0.05)" />
                    <line x1="20" y1="130" x2="280" y2="130" stroke="rgba(255,255,255,0.08)" />

                    <text x="5" y="14" fill="var(--text-muted)" fontSize="8">10</text>
                    <text x="5" y="74" fill="var(--text-muted)" fontSize="8">5</text>
                    <text x="5" y="134" fill="var(--text-muted)" fontSize="8">0</text>

                    {(() => {
                      const points = fsrsItems.map((item, idx) => {
                        const x = 20 + (idx / (fsrsItems.length - 1)) * 260;
                        const y = 130 - (item.difficultyRating / 10) * 120;
                        return { x, y, r: item.difficultyRating };
                      });

                      const pathD = points.reduce((acc, p, idx) => {
                        return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
                      }, '');

                      return (
                        <>
                          <path
                            d={`${pathD} L ${points[points.length - 1].x} 130 L ${points[0].x} 130 Z`}
                            fill="url(#curve-grad)"
                            opacity="0.15"
                          />
                          <path
                            d={pathD}
                            fill="none"
                            stroke="var(--accent-cyan)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          {points.map((p, idx) => (
                            <g key={idx}>
                              <circle cx={p.x} cy={p.y} r="4.5" fill="#05060b" stroke="var(--accent-cyan)" strokeWidth="2" />
                              <title>Rating: {p.r}/10</title>
                            </g>
                          ))}
                        </>
                      );
                    })()}

                    <defs>
                      <linearGradient id="curve-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent-cyan)" />
                        <stop offset="100%" stopColor="rgba(0, 242, 254, 0)" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* PASTE NEW CUSTOM SIMULATION VARIANT MODAL */}
      {showPasteModal && activeItem && (
        <div className="modal-overlay" style={{ zIndex: 110 }}>
          <div className="modal-box modal-box-large glass-panel" style={{ width: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ClipboardList size={18} /> Add New Simulation Variant
              </h3>
              <button
                onClick={() => setShowPasteModal(false)}
                style={{ background: 'transparent', fontSize: '20px', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'white', display: 'block', marginBottom: '6px' }}>
                  Variant Name / Label:
                </label>
                <input
                  type="text"
                  placeholder="E.g., High Stress FEA Model, Custom Interactive Slot Puzzle"
                  value={variantNameInput}
                  onChange={(e) => setVariantNameInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid var(--border-glass)',
                    color: 'white',
                    fontSize: '12px'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'white', display: 'block', marginBottom: '6px' }}>
                  HTML / JS Code:
                </label>
                <textarea
                  placeholder="<!DOCTYPE html><html><head><style>...</style></head><body><canvas id='sim'></canvas><script>...</script></body></html>"
                  value={customCodeInput}
                  onChange={(e) => setCustomCodeInput(e.target.value)}
                  style={{
                    width: '100%',
                    height: '240px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '8px',
                    color: '#4ade80',
                    padding: '12px',
                    resize: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowPasteModal(false)}
                  className="btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '12px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveCustomCode(activeItem.id)}
                  disabled={isSavingCustom || !customCodeInput.trim()}
                  className="btn-primary"
                  style={{ padding: '8px 18px', fontSize: '12px', fontWeight: 'bold' }}
                >
                  {isSavingCustom ? 'Creating Variant...' : '💾 Add as Selectable Variant'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
