import React, { useState, useEffect, useRef } from 'react';
import type { Question } from '../types';
import { getSimUrl } from '../utils/url';
import { X, Send, RefreshCw, Volume2, Sparkles, Sliders, CheckSquare, Square, ChevronLeft, ChevronRight, ClipboardList, FileText, ListOrdered, Check, Play, Loader, Layers, Maximize2, Copy, GitBranch } from 'lucide-react';

interface SimViewerProps {
  question: Question;
  onClose: () => void;
  onRefreshDB: () => void;
  featuresList?: Array<{ id: string; label: string; checked: boolean }>;
  setFeaturesList?: React.Dispatch<React.SetStateAction<Array<{ id: string; label: string; checked: boolean }>>>;
  styleProfile?: string;
  setStyleProfile?: (style: string) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'system' | 'ai';
  text: string;
  timestamp: Date;
}

export const SimViewer: React.FC<SimViewerProps> = ({
  question,
  onClose,
  onRefreshDB,
  featuresList = [],
  setFeaturesList,
  styleProfile = 'universal_pedagogy',
  setStyleProfile
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'checklist' | 'guided'>('chat');
  const [editPrompt, setEditPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [iframeSrc, setIframeSrc] = useState('');

  // Guided Learning States
  const [useStepSimulation, setUseStepSimulation] = useState(false);
  const [guidedLog, setGuidedLog] = useState<Array<{ id: string; sender: 'user' | 'ai' | 'system'; text: string; timestamp: Date; simulationFile?: string; isCompilingSim?: boolean }>>([]);
  const [guidedInput, setGuidedInput] = useState('');
  const [isGuidedProcessing, setIsGuidedProcessing] = useState(false);
  const [isGuidedStarted, setIsGuidedStarted] = useState(false);
  const guidedEndRef = useRef<HTMLDivElement>(null);

  const updateIframeSrc = (path: string) => {
    let clean = path ? path.trim() : '';
    if (!clean || clean === '/') {
      setIframeSrc('');
      return;
    }

    const queryIdx = clean.indexOf('?');
    let base = queryIdx !== -1 ? clean.substring(0, queryIdx) : clean;
    const query = queryIdx !== -1 ? clean.substring(queryIdx) : '';

    const resolved = getSimUrl(base);
    setIframeSrc(resolved + query);
  };

  const [panelOpen, setPanelOpen] = useState(true);
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Custom Code Paste state
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [variantName, setVariantName] = useState('');
  const [pastedCode, setPastedCode] = useState('');
  const [isPasting, setIsPasting] = useState(false);
  const simContainerRef = useRef<HTMLDivElement>(null);

  const handleToggleFullscreen = () => {
    if (simContainerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else {
        simContainerRef.current.requestFullscreen().catch(() => {});
      }
    }
  };

  const [selectedText, setSelectedText] = useState('');
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);
  const [showSuggestionInput, setShowSuggestionInput] = useState(false);
  const [userSuggestion, setUserSuggestion] = useState('');
  const [highlights, setHighlights] = useState<Array<{ text: string; color: string; svg?: string }>>([]);
  const [activeSvg, setActiveSvg] = useState<string | null>(null);
  const [isGeneratingSvg, setIsGeneratingSvg] = useState(false);
  const [promptBlueprintSystem, setPromptBlueprintSystem] = useState('');
  const [promptCodeSystem, setPromptCodeSystem] = useState('');
  const [isSavingPrompts, setIsSavingPrompts] = useState(false);
  
  // Auto-fade (5s) & Hover-to-Open Tool Drawer State
  const [isToolsHovered, setIsToolsHovered] = useState(false);
  const [isToolsVisible, setIsToolsVisible] = useState(true);
  const [isToolsExpanded, setIsToolsExpanded] = useState(false);
  const toolsTimerRef = useRef<any>(null);

  const resetToolsTimer = () => {
    setIsToolsVisible(true);
    if (toolsTimerRef.current) clearTimeout(toolsTimerRef.current);
    toolsTimerRef.current = setTimeout(() => {
      setIsToolsVisible(false);
      setIsToolsExpanded(false);
    }, 5000);
  };

  const handleMouseEnterCorner = () => {
    setIsToolsHovered(true);
    setIsToolsVisible(true);
    if (toolsTimerRef.current) clearTimeout(toolsTimerRef.current);
  };

  const handleMouseLeaveCorner = () => {
    setIsToolsHovered(false);
    resetToolsTimer();
  };

  // Draggable Canvas Tools States
  const [toolsPos, setToolsPos] = useState({ x: 16, y: 16 });
  const [isDraggingTools, setIsDraggingTools] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });
  const lastLoadedQuestionIdRef = useRef<string | null>(null);

  const handleToolsMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDraggingTools(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: toolsPos.x,
      posY: toolsPos.y
    };
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingTools) return;
      
      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaY = e.clientY - dragStartRef.current.mouseY;
      
      let newRight = dragStartRef.current.posX - deltaX;
      let newTop = dragStartRef.current.posY + deltaY;

      const containerWidth = simContainerRef.current?.clientWidth || 800;
      const containerHeight = simContainerRef.current?.clientHeight || 600;

      newRight = Math.max(8, Math.min(containerWidth - 60, newRight));
      newTop = Math.max(8, Math.min(containerHeight - 40, newTop));

      setToolsPos({ x: newRight, y: newTop });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (isDraggingTools) {
        setIsDraggingTools(false);
        const deltaX = Math.abs(e.clientX - dragStartRef.current.mouseX);
        const deltaY = Math.abs(e.clientY - dragStartRef.current.mouseY);
        if (deltaX < 5 && deltaY < 5) {
          setIsToolsExpanded(prev => !prev);
        }
      }
    };

    if (isDraggingTools) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingTools]);

  // Note Tools Proximity Handlers
  const [isNoteToolsHovered, setIsNoteToolsHovered] = useState(false);
  const [isNoteToolsVisible, setIsNoteToolsVisible] = useState(true);
  const [isNoteToolsExpanded, setIsNoteToolsExpanded] = useState(false);
  const noteToolsTimerRef = useRef<any>(null);

  const resetNoteToolsTimer = () => {
    setIsNoteToolsVisible(true);
    if (noteToolsTimerRef.current) clearTimeout(noteToolsTimerRef.current);
    noteToolsTimerRef.current = setTimeout(() => {
      setIsNoteToolsVisible(false);
      setIsNoteToolsExpanded(false);
    }, 5000);
  };

  const handleMouseEnterNoteCorner = () => {
    setIsNoteToolsHovered(true);
    setIsNoteToolsVisible(true);
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

  // Study Queries & FSRS Integration States
  const [commentsText, setCommentsText] = useState(question.comments || '');
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [isAddingFsrs, setIsAddingFsrs] = useState(false);
  const [commentSavedStatus, setCommentSavedStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [fsrsAddedStatus, setFsrsAddedStatus] = useState<'idle' | 'added' | 'error'>('idle');
  const [isCommentsExpanded, setIsCommentsExpanded] = useState(true);

  const [styleRatingVal, setStyleRatingVal] = useState<number>(question.styleRating || 0);

  useEffect(() => {
    setCommentsText(question.comments || '');
    setCommentSavedStatus('idle');
    setFsrsAddedStatus('idle');
    setStyleRatingVal(question.styleRating || 0);
  }, [question.id, question.comments, question.styleRating]);

  const getStyleDisplayName = (key?: string) => {
    switch (key) {
      case 'micro_inspector': return '🔬 Micro-Inspector & X-Ray Mechanics';
      case 'gamified_sandbox': return '🎮 Gamified Failure-Boundary Sandbox';
      case 'intermediate_streams': return '🌊 Intermediate Value Streams & Flow';
      case 'formula_puzzle': return '🧩 Interactive Formula Slot Puzzle';
      case 'voice_cockpit': return '🎙️ Voice Control Cockpit & Lab Assistant';
      case 'fea_heatmap': return '🔥 Dynamic FEA Heatmap & Multi-Physics';
      default: return '🎯 Universal Master Pedagogy Profile';
    }
  };

  const handleRatePedagogyStyle = async (rating: number) => {
    setStyleRatingVal(rating);
    try {
      const res = await fetch('/api/rate-style-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: 'question',
          targetId: question.id,
          styleKey: question.styleProfileUsed || 'universal_pedagogy',
          rating
        })
      });
      if (res.ok) {
        onRefreshDB();
      }
    } catch (e) {
      console.error('Error rating style profile:', e);
    }
  };

  const handleSaveComment = async () => {
    setIsSavingComment(true);
    setCommentSavedStatus('idle');
    try {
      const res = await fetch('/api/save-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: question.id,
          sourceType: 'question',
          comments: commentsText
        })
      });
      if (res.ok) {
        setCommentSavedStatus('saved');
        onRefreshDB();
      } else {
        setCommentSavedStatus('error');
      }
    } catch (e) {
      console.error(e);
      setCommentSavedStatus('error');
    } finally {
      setIsSavingComment(false);
    }
  };

  const handleAddToFsrs = async () => {
    if (!commentsText.trim()) {
      alert('Please enter a comment or study query first so FSRS knows what to schedule!');
      return;
    }
    setIsAddingFsrs(true);
    setFsrsAddedStatus('idle');
    try {
      const res = await fetch('/api/fsrs/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queryText: commentsText,
          concept: question.concept,
          sourceType: 'question',
          sourceId: question.id,
        })
      });
      if (res.ok) {
        setFsrsAddedStatus('added');
        onRefreshDB();
      } else {
        setFsrsAddedStatus('error');
      }
    } catch (e) {
      console.error(e);
      setFsrsAddedStatus('error');
    } finally {
      setIsAddingFsrs(false);
    }
  };

  const fetchSystemPrompts = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setPromptBlueprintSystem(data.promptBlueprintSystem || '');
        setPromptCodeSystem(data.promptCodeSystem || '');
        if (setStyleProfile) {
          setStyleProfile(data.styleProfile || 'universal_pedagogy');
        }
      }
    } catch (e) {
      console.error('Error fetching system prompts:', e);
    }
  };

  useEffect(() => {
    fetchSystemPrompts();
  }, []);

  // Synchronize Guided Learning state with db.json & localStorage for persistence
  useEffect(() => {
    if (question?.id) {
      let initialLog: any[] = [];
      let initialStarted = false;

      // 1. Try reading from database object passed as prop
      if (question.guidedLog && Array.isArray(question.guidedLog) && question.guidedLog.length > 0) {
        initialLog = question.guidedLog;
        initialStarted = !!question.isGuidedStarted;
      } else {
        // 2. Fallback to localStorage
        const savedLog = localStorage.getItem(`guided_log_${question.id}`);
        const savedStarted = localStorage.getItem(`guided_started_${question.id}`);
        if (savedLog) {
          try {
            initialLog = JSON.parse(savedLog);
          } catch (e) {}
        }
        if (savedStarted) {
          initialStarted = savedStarted === 'true';
        }
      }

      setGuidedLog(initialLog);
      setIsGuidedStarted(initialStarted);
      setUseStepSimulation(false);
      
      lastLoadedQuestionIdRef.current = question.id;
    }
  }, [question?.id, question?.guidedLog, question?.isGuidedStarted]);

  // Save Guided Learning state to db.json and localStorage
  useEffect(() => {
    if (question?.id && lastLoadedQuestionIdRef.current === question.id) {
      // 1. Write locally
      localStorage.setItem(`guided_log_${question.id}`, JSON.stringify(guidedLog));
      localStorage.setItem(`guided_started_${question.id}`, String(isGuidedStarted));

      // 2. Write to backend database
      const saveToDatabase = async () => {
        try {
          await fetch('/api/guided-learning/save-conversation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              questionId: question.id,
              guidedLog: guidedLog,
              isGuidedStarted: isGuidedStarted
            })
          });
        } catch (e) {
          console.error('Failed to auto-save Guided Learning conversation to database:', e);
        }
      };

      // Debounce database saving slightly to minimize request volume
      const timer = setTimeout(saveToDatabase, 500);
      return () => clearTimeout(timer);
    }
  }, [guidedLog, isGuidedStarted, question?.id]);

  // Guided Learning Welcome Prompt
  const startGuidedLearningSession = async () => {
    setIsGuidedStarted(true);
    setIsGuidedProcessing(true);
    
    // Add initial user kickoff message representing the opened question
    const kickoffId = `guided-kickoff-${Date.now()}`;
    const initialUserMessage = `Hi! I want to solve this engineering problem step-by-step. Here is the problem statement: "${question.text}". Can you explain the context first and then guide me through the first step?`;
    
    setGuidedLog([
      {
        id: kickoffId,
        sender: 'user' as const,
        text: `🚀 [Tutor session start request] "${question.concept}":\n\n${question.text}`,
        timestamp: new Date()
      }
    ]);

    try {
      const res = await fetch('/api/guided-learning/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept: question.concept,
          questionContext: question.text,
          chatHistory: [],
          userMessage: initialUserMessage
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to reach tutor.');
      }

      const data = await res.json();
      const aiResponseText = data.assistantResponse;
      const aiMessageId = `guided-ai-${Date.now()}`;

      setGuidedLog(prev => [
        ...prev,
        {
          id: aiMessageId,
          sender: 'ai' as const,
          text: aiResponseText,
          timestamp: new Date(),
          isCompilingSim: true
        }
      ]);
      setTimeout(() => guidedEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

      // Trigger background compilation process for this step
      compileStepSimulationInBackground(aiMessageId, aiResponseText, 1);
      
    } catch (err: any) {
      setGuidedLog(prev => [
        ...prev,
        {
          id: `guided-err-${Date.now()}`,
          sender: 'system' as const,
          text: `Connection error: ${err.message}`,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsGuidedProcessing(false);
    }
  };

  const handleSaveGeminiLink = async () => {
    const defaultVal = question.geminiLink || '';
    const link = prompt('Enter your Gemini shareable conversation link:', defaultVal);
    if (link === null) return;

    try {
      const res = await fetch('/api/guided-learning/save-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          geminiLink: link.trim()
        })
      });

      if (!res.ok) {
        throw new Error('Failed to save link.');
      }

      alert('Gemini conversation link saved successfully!');
      onRefreshDB();
    } catch (err: any) {
      alert(`Error saving link: ${err.message}`);
    }
  };

  const copyTextToClipboard = (text: string, successMessage = '📋 Copied to clipboard successfully!') => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => alert(successMessage))
        .catch(() => runLegacyCopy(text, successMessage));
    } else {
      runLegacyCopy(text, successMessage);
    }
  };

  const runLegacyCopy = (text: string, successMessage: string) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      document.body.appendChild(textarea);

      const isiOS = navigator.userAgent.match(/ipad|iphone|ipod/i);
      if (isiOS) {
        const range = document.createRange();
        range.selectNodeContents(textarea);
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
          textarea.setSelectionRange(0, 999999);
        }
      } else {
        textarea.select();
      }

      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (successful) {
        alert(successMessage);
      } else {
        throw new Error('Fallback execution returned false');
      }
    } catch (e) {
      prompt('Could not automatically copy text. Please select and copy it below manually:', text);
    }
  };

  const handleCopyTutorPrompt = () => {
    const promptText = `You are a World-Class Engineering Tutor and Pedagogy Expert. I want to learn the following concept step-by-step: "${question.concept}".

Here is the problem statement/context:
"${question.text}"

Please guide me through this calculation/concept step-by-step. Break it down into clear milestones. Ask me interactive questions, check my calculations, and give me visual intuition for each step before proceeding.`;

    copyTextToClipboard(promptText, '📋 Gemini prompt copied to clipboard! You can paste it directly into Gemini.');
  };

  // Typeset math equations whenever guidedLog or tab changes
  useEffect(() => {
    if (activeTab === 'guided') {
      setTimeout(() => {
        // @ts-ignore
        window.MathJax?.typesetPromise?.().catch(err => console.warn('MathJax typeset failed:', err));
      }, 100);
    }
  }, [activeTab, guidedLog.length]);

  const compileStepSimulationInBackground = async (messageId: string, tutorExplanation: string, stepNumber?: number) => {
    try {
      const res = await fetch('/api/guided-learning/compile-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept: question.concept,
          tutorExplanation: tutorExplanation,
          questionId: question.id,
          stepNumber: stepNumber
        })
      });

      if (!res.ok) {
        throw new Error('Failed compilation');
      }

      const data = await res.json();
      const compiledPath = data.filePath;

      // Update message log item
      setGuidedLog(prev => prev.map(m => {
        if (m.id === messageId) {
          return {
            ...m,
            isCompilingSim: false,
            simulationFile: compiledPath
          };
        }
        return m;
      }));

      // Refresh database to make the new step variant available in the dropdown
      onRefreshDB();

      // Automatically show the newly compiled step simulation
      updateIframeSrc(compiledPath);
    } catch (e) {
      console.error('Background step compilation failed:', e);
      setGuidedLog(prev => prev.map(m => {
        if (m.id === messageId) {
          return {
            ...m,
            isCompilingSim: false
          };
        }
        return m;
      }));
    }
  };

  const handleGuidedSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guidedInput.trim() || isGuidedProcessing) return;

    const userText = guidedInput.trim();
    setGuidedInput('');
    setIsGuidedProcessing(true);

    const userMessageId = `guided-${Date.now()}`;
    const newLog = [
      ...guidedLog,
      {
        id: userMessageId,
        sender: 'user' as const,
        text: userText,
        timestamp: new Date()
      }
    ];
    setGuidedLog(newLog);
    setTimeout(() => guidedEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    try {
      const res = await fetch('/api/guided-learning/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept: question.concept,
          questionContext: question.text,
          chatHistory: newLog.map(h => ({
            role: h.sender === 'user' ? 'user' : 'model',
            content: h.text
          })),
          userMessage: userText
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to reach tutor.');
      }

      const data = await res.json();
      const aiResponseText = data.assistantResponse;
      const aiMessageId = `guided-ai-${Date.now()}`;

      setGuidedLog(prev => [
        ...prev,
        {
          id: aiMessageId,
          sender: 'ai' as const,
          text: aiResponseText,
          timestamp: new Date(),
          isCompilingSim: true
        }
      ]);
      setTimeout(() => guidedEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

      // Compile simulation in background for this explanation step
      const nextStepNum = newLog.filter(m => m.sender === 'ai').length + 1;
      compileStepSimulationInBackground(aiMessageId, aiResponseText, nextStepNum);
      
    } catch (err: any) {
      setGuidedLog(prev => [
        ...prev,
        {
          id: `guided-err-${Date.now()}`,
          sender: 'system' as const,
          text: `Connection error: ${err.message}`,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsGuidedProcessing(false);
    }
  };

  const [addons, setAddons] = useState({
    dragAndDrop: true,
    vectorDiagrams: true,
    equationGraphs: true,
    physicsEngine: false,
    tutorialOverlay: false,
    speechNarration: true,
    audioSynth: true,
  });

  const toggleAddon = (key: keyof typeof addons) => {
    setAddons(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  useEffect(() => {
    if (question) {
      let targetFile = question.simulationFile;
      if (question.hasSteps && question.steps && question.activeStepId && question.activeStepId !== 'overview') {
        const activeStep = question.steps.find(st => st.id === question.activeStepId);
        if (activeStep && activeStep.status === 'ready' && activeStep.simulationFile) {
          targetFile = activeStep.simulationFile;
        } else {
          targetFile = '';
        }
      }

      let cleanPath = targetFile ? getSimUrl(targetFile) : '';
      if (cleanPath === '/' || cleanPath === '') {
        cleanPath = '';
      }

      updateIframeSrc(cleanPath);
      setChatLog(prev => prev.length === 0 ? [
        {
          id: 'welcome',
          sender: 'system',
          text: `Welcome to the Canvas editor for "${question.concept}". You can interact with the simulation on the left. Type instructions below to refine, fix, or add features.`,
          timestamp: new Date()
        }
      ] : prev);
    }
  }, [question.id, question.activeVariantId, question.activeStepId, question.simulationFile, JSON.stringify(question.steps?.map(s => `${s.id}-${s.status}-${s.simulationFile}`))]);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection) return;
    const text = selection.toString().trim();
    if (text.length > 4) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectedText(text);
      setPopoverPos({
        x: rect.left,
        y: rect.top - 45
      });
    }
  };

  const handleGenerateFromSelection = async (suggestionText?: string) => {
    if (!selectedText.trim()) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/generate-from-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id, selectedText, suggestion: suggestionText || userSuggestion.trim() })
      });
      if (res.ok) {
        const newHighlight = { text: selectedText, color: 'rgba(0, 242, 254, 0.25)' };
        setHighlights(prev => [...prev, newHighlight]);
        alert('Custom simulation variant built from your highlighted text successfully!');
        onRefreshDB();
      } else {
        const err = await res.json();
        alert(`Failed: ${err.error || 'Generation failed'}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setSelectedText('');
      setPopoverPos(null);
      setShowSuggestionInput(false);
      setUserSuggestion('');
    }
  };

  const handleGenerateSVG = async () => {
    if (!selectedText.trim()) return;
    setIsGeneratingSvg(true);
    try {
      const res = await fetch('/api/generate-svg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedText })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveSvg(data.svg);
        const newHighlight = { text: selectedText, color: 'rgba(168, 85, 247, 0.25)', svg: data.svg };
        setHighlights(prev => [...prev, newHighlight]);
      } else {
        alert('Failed to compile vector SVG.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingSvg(false);
      setSelectedText('');
      setPopoverPos(null);
    }
  };

  const handleSaveSystemPrompts = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPrompts(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptBlueprintSystem,
          promptCodeSystem,
          styleProfile
        })
      });
      if (res.ok) {
        alert('System prompt templates updated and saved permanently!');
      } else {
        alert('Failed to save system prompts.');
      }
    } catch (err: any) {
      alert(`Error saving prompts: ${err.message}`);
    } finally {
      setIsSavingPrompts(false);
    }
  };

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (popoverPos && !target.closest('.notebook-popover') && !target.closest('.notebook-highlight-span')) {
        setSelectedText('');
        setPopoverPos(null);
        setShowSuggestionInput(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [popoverPos]);

  const handleSelectStep = async (stepId: string) => {
    try {
      const res = await fetch('/api/select-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id, stepId })
      });
      if (res.ok) {
        onRefreshDB();
      }
    } catch (err) {
      console.error('Error selecting step:', err);
    }
  };

  const handleGenerateStep = async (stepId: string) => {
    setIsProcessing(true);
    try {
      const selectedAddons: string[] = [];
      if (addons.dragAndDrop) selectedAddons.push("Interactive calculation controls & inputs");
      if (addons.vectorDiagrams) selectedAddons.push("Step-by-step exam writing format display");
      if (addons.equationGraphs) selectedAddons.push("Real-time Equation Graphing/Plotting");
      if (addons.speechNarration) selectedAddons.push("Speech Synthesis Concept Narration voiceovers");
      if (addons.audioSynth) selectedAddons.push("Web Audio Synth Sound Effects");

      const res = await fetch('/api/generate-step-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id, stepId, addons: selectedAddons })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate step simulation.');
      }

      onRefreshDB();
    } catch (err: any) {
      alert(`Step generation error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBreakdownStepsInViewer = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/breakdown-steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to break down question steps.');
      }

      onRefreshDB();
    } catch (err: any) {
      alert(`Breakdown error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAutoRunStepsInViewer = async () => {
    try {
      const res = await fetch('/api/auto-run-steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start step auto-run.');
      }

      alert('Step auto-run started in background!');
      onRefreshDB();
    } catch (err: any) {
      alert(`Auto-run error: ${err.message}`);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog]);

  const handleGenerate = async () => {
    setIsProcessing(true);
    setChatLog(prev => [
      ...prev,
      {
        id: `gen-req-${Date.now()}`,
        sender: 'user',
        text: 'Generating simulation from scratch...',
        timestamp: new Date()
      }
    ]);

    const selectedAddons: string[] = featuresList
      .filter(f => f.checked)
      .map(f => f.label);

    try {
      const res = await fetch('/api/generate-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          addons: selectedAddons
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate simulation.');
      }

      const data = await res.json();
      onRefreshDB();
      updateIframeSrc(`${data.filePath}?t=${Date.now()}`);

      setChatLog(prev => [
        ...prev,
        {
          id: `gen-res-${Date.now()}`,
          sender: 'ai',
          text: `Simulation generated successfully! You can play with it on the left iframe sandbox.`,
          timestamp: new Date()
        }
      ]);
    } catch (error: any) {
      setChatLog(prev => [
        ...prev,
        {
          id: `gen-err-${Date.now()}`,
          sender: 'system',
          text: `Generation failed: ${error.message}`,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRefine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPrompt.trim() || isProcessing) return;

    const userPrompt = editPrompt;
    setEditPrompt('');
    setIsProcessing(true);

    setChatLog(prev => [
      ...prev,
      {
        id: `refine-req-${Date.now()}`,
        sender: 'user',
        text: userPrompt,
        timestamp: new Date()
      }
    ]);

    try {
      const res = await fetch('/api/refine-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          editPrompt: userPrompt
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to refine simulation.');
      }

      const data = await res.json();
      onRefreshDB();
      updateIframeSrc(`${data.filePath}?t=${Date.now()}`);

      setChatLog(prev => [
        ...prev,
        {
          id: `refine-res-${Date.now()}`,
          sender: 'ai',
          text: `Simulation code refined! The live preview has hot-reloaded with the modifications.`,
          timestamp: new Date()
        }
      ]);
    } catch (error: any) {
      setChatLog(prev => [
        ...prev,
        {
          id: `refine-err-${Date.now()}`,
          sender: 'system',
          text: `Failed to apply changes: ${error.message}`,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveCustomCodeVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedCode.trim() || !variantName.trim() || isPasting) return;
    
    setIsPasting(true);
    try {
      const res = await fetch('/api/save-custom-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: 'question',
          targetId: question.id,
          variantName: variantName.trim(),
          customHtmlCode: pastedCode
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add variant.');
      }

      const data = await res.json();
      alert('Custom code variant created successfully!');
      setPastedCode('');
      setVariantName('');
      setShowPasteModal(false);
      onRefreshDB();
      if (data.filePath) {
        updateIframeSrc(`${data.filePath}?t=${Date.now()}`);
      }
    } catch (err: any) {
      alert(`Failed to add variant: ${err.message}`);
    } finally {
      setIsPasting(false);
    }
  };

  const [promptModalText, setPromptModalText] = useState<string | null>(null);
  const [copiedPromptStatus, setCopiedPromptStatus] = useState(false);

  const handleCopyPromptBlueprint = async () => {
    try {
      const activeVarId = question.activeVariantId || 'original';
      const activeStepId = question.activeStepId || 'overview';
      const url = `/api/simulation-prompt?questionId=${question.id}&variantId=${activeVarId}&stepId=${activeStepId}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPromptModalText(data.prompt || 'No prompt blueprint available for this simulation.');
        setCopiedPromptStatus(false);
      } else {
        alert('Could not retrieve prompt blueprint.');
      }
    } catch (err: any) {
      alert(`Error reading prompt: ${err.message}`);
    }
  };

  const getDifficultyColor = (diff: number) => {
    const hue = ((10 - diff) / 9) * 120;
    return `hsl(${hue}, 100%, 50%)`;
  };

  return (
    <div className="viewer-overlay">
      
      {/* Simulation Iframe Panel */}
      <div className="viewer-left">
        {/* Topbar inside Viewer */}
        <div className="viewer-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: getDifficultyColor(question.difficulty),
                boxShadow: `0 0 10px ${getDifficultyColor(question.difficulty)}`
              }}
            ></span>
            <h2 style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '350px' }}>
              {question.concept}
            </h2>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Diff: {question.difficulty}/10
            </span>

            {/* Simulation Variant Switcher Selector */}
            {question.variants && question.variants.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '24px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '2px 8px' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Variant:</span>
                <select
                  value={question.activeVariantId || 'original'}
                  onChange={async (e) => {
                    const vId = e.target.value;
                    try {
                      const res = await fetch('/api/select-variant', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ questionId: question.id, variantId: vId })
                      });
                      if (res.ok) {
                        onRefreshDB();
                      }
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  style={{
                    padding: '2px 4px',
                    fontSize: '10px',
                    height: 'auto',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent-cyan)',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  {question.variants.map((v) => (
                    <option key={v.id} value={v.id} style={{ background: '#090b11', color: 'white' }}>{v.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* MANUAL FSRS / UNDERSTANDING RATING BAR (1-10) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '3px 8px' }}>
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#c084fc', whiteSpace: 'nowrap' }}>⭐ Rate (1-10):</span>
              <div style={{ display: 'flex', gap: '2px' }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                  <button
                    key={star}
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/fsrs/rate', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ itemId: question.id, rating: star })
                        });
                        if (res.ok) {
                          onRefreshDB();
                        }
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '3px',
                      fontSize: '9px',
                      fontWeight: 'bold',
                      border: (question.styleRating === star || question.difficulty === star) ? '1px solid #4ade80' : '1px solid transparent',
                      background: (question.styleRating || question.difficulty || 0) >= star ? 'rgba(74, 222, 128, 0.25)' : 'rgba(255,255,255,0.05)',
                      color: (question.styleRating || question.difficulty || 0) >= star ? '#4ade80' : 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    title={`Rate understanding as ${star}/10`}
                  >
                    {star}
                  </button>
                ))}
              </div>
            </div>

            {question.simulationFile && (
              <button
                onClick={() => updateIframeSrc(`${question.simulationFile}?t=${Date.now()}`)}
                className="btn-secondary"
                style={{ padding: '6px' }}
                title="Reload Preview"
              >
                <RefreshCw size={16} />
              </button>
            )}
            <button
              onClick={() => setPanelOpen(!panelOpen)}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {panelOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              {panelOpen ? 'Hide Editor' : 'Show Editor'}
            </button>
            <button
              onClick={onClose}
              className="btn-secondary"
              style={{ padding: '6px', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
              title="Close Viewer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Step Navigation Bar for Multi-Step Exam Breakdown */}
        {question.hasSteps && question.steps && question.steps.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: 'rgba(15, 23, 42, 0.95)',
            borderBottom: '1px solid var(--border-glass)',
            overflowX: 'auto',
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
            flexShrink: 0,
            scrollbarWidth: 'thin'
          }}>
            <button
              onClick={() => handleSelectStep('overview')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
                border: (!question.activeStepId || question.activeStepId === 'overview') ? '1px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
                background: (!question.activeStepId || question.activeStepId === 'overview') ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255,255,255,0.03)',
                color: (!question.activeStepId || question.activeStepId === 'overview') ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap'
              }}
            >
              📊 Full Overview
            </button>

            {question.steps.map((st) => {
              const isActive = question.activeStepId === st.id;
              const isReady = st.status === 'ready';
              const isGenerating = st.status === 'generating';

              return (
                <button
                  key={st.id}
                  onClick={() => handleSelectStep(st.id)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    border: isActive ? '1px solid #c084fc' : isReady ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--border-glass)',
                    background: isActive ? 'rgba(168, 85, 247, 0.2)' : isReady ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255,255,255,0.03)',
                    color: isActive ? '#e9d5ff' : isReady ? '#4ade80' : isGenerating ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {isGenerating ? (
                    <Loader size={10} className="animate-spin text-cyan-400" />
                  ) : isReady ? (
                    <Check size={10} style={{ color: '#4ade80' }} />
                  ) : (
                    <span style={{ fontSize: '9px', opacity: 0.7 }}>Step {st.stepNumber}</span>
                  )}
                  <span>{st.title}</span>
                </button>
              );
            })}

            {question.steps.some(st => st.status === 'pending' || st.status === 'failed') && (
              <button
                onClick={handleAutoRunStepsInViewer}
                className="btn-secondary"
                style={{
                  padding: '4px 10px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  color: 'var(--accent-cyan)',
                  borderColor: 'rgba(0, 242, 254, 0.3)',
                  marginLeft: 'auto',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Play size={10} fill="var(--accent-cyan)" /> Auto-Run All Steps
              </button>
            )}
          </div>
        )}

        {/* The Simulation Iframe sandbox */}
        <div className="viewer-iframe-container">
          {(() => {
            const activeStep = question.hasSteps && question.steps && question.activeStepId && question.activeStepId !== 'overview'
              ? question.steps.find(st => st.id === question.activeStepId)
              : null;

            if (activeStep && activeStep.status !== 'ready') {
              return (
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '40px',
                  background: 'radial-gradient(circle at center, rgba(168, 85, 247, 0.08) 0%, rgba(9, 11, 17, 0.98) 100%)',
                  textAlign: 'center'
                }}>
                  <div style={{ background: 'rgba(168, 85, 247, 0.15)', padding: '6px 16px', borderRadius: '50px', border: '1px solid rgba(168, 85, 247, 0.3)', color: '#c084fc', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
                    Step {activeStep.stepNumber} Exam Calculation
                  </div>
                  <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: 'white', marginBottom: '12px', maxWidth: '600px' }}>
                    {activeStep.title}
                  </h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '540px', lineHeight: '1.7', marginBottom: '28px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', padding: '16px', borderRadius: '12px' }}>
                    {activeStep.description}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button
                      onClick={() => handleGenerateStep(activeStep.id)}
                      disabled={isProcessing || activeStep.status === 'generating'}
                      className="btn-primary"
                      style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      {activeStep.status === 'generating' || isProcessing ? (
                        <>
                          <Loader size={16} className="animate-spin" /> Coding Step {activeStep.stepNumber} Simulation...
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} /> Generate Interactive Step {activeStep.stepNumber} Simulation
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            }

            if (iframeSrc) {
              return (
                <div ref={simContainerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
                  <iframe
                    src={iframeSrc}
                    style={{ width: '100%', height: '100%', border: 'none', background: '#000' }}
                    sandbox="allow-scripts allow-modals allow-same-origin"
                    allow="autoplay; speech-synthesis"
                    title="simulation-preview"
                  />
                  {/* DRAGGABLE CANVAS QUICK TOOLS */}
                  <div
                    style={{
                      position: 'absolute',
                      top: `${toolsPos.y}px`,
                      right: `${toolsPos.x}px`,
                      zIndex: 60,
                      pointerEvents: 'auto',
                      opacity: isDraggingTools ? 0.9 : isToolsHovered ? 1 : isToolsVisible ? 0.35 : 0.15,
                      transition: isDraggingTools ? 'none' : 'opacity 0.35s ease, transform 0.25s ease',
                      userSelect: 'none',
                    }}
                    onMouseEnter={handleMouseEnterCorner}
                    onMouseLeave={handleMouseLeaveCorner}
                  >
                    {!isToolsExpanded ? (
                      <button
                        type="button"
                        onMouseDown={handleToolsMouseDown}
                        onMouseEnter={() => setIsToolsExpanded(true)}
                        title="Drag to reposition, Hover to expand Quick Tools"
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: isDraggingTools ? 'var(--accent-cyan)' : 'rgba(15, 23, 42, 0.9)',
                          border: '1px solid var(--border-glass)',
                          color: 'var(--accent-cyan)',
                          cursor: isDraggingTools ? 'grabbing' : 'grab',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backdropFilter: 'blur(12px)',
                          boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
                          fontSize: '18px',
                          padding: 0,
                        }}
                      >
                        ⚙️
                      </button>
                    ) : (
                      <div
                        style={{
                          background: 'rgba(15, 23, 42, 0.94)',
                          backdropFilter: 'blur(16px)',
                          border: '1px solid var(--border-glass)',
                          borderRadius: '12px',
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
                          minWidth: '200px',
                        }}
                      >
                        <div 
                          onMouseDown={handleToolsMouseDown}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between', 
                            borderBottom: '1px solid rgba(255,255,255,0.1)', 
                            paddingBottom: '8px',
                            cursor: isDraggingTools ? 'grabbing' : 'grab',
                          }}
                          title="Drag here to reposition panel"
                        >
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            🛠️ Canvas Tools
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsToolsExpanded(false)}
                            title="Collapse Tools Panel"
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>

                        {/* 🔀 VARIANT SELECTOR */}
                        {question.variants && question.variants.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                              🔀 Select Variant:
                            </label>
                            <select
                              value={question.activeVariantId || (question.variants[0] ? question.variants[0].id : '')}
                              onChange={async (e) => {
                                const vId = e.target.value;
                                await fetch('/api/select-simulation-variant', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ targetType: 'question', targetId: question.id, variantId: vId })
                                });
                                onRefreshDB();
                              }}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '6px',
                                background: 'rgba(30, 41, 59, 0.8)',
                                border: '1px solid var(--border-glass)',
                                color: '#c084fc',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                outline: 'none',
                              }}
                            >
                              {question.variants.map(v => (
                                <option key={v.id} value={v.id} style={{ background: '#0f172a', color: 'white' }}>
                                  {v.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* 📋 COPY PROMPT BUTTON */}
                        <button
                          onClick={() => {
                            const text = `You are an Expert Interactive Simulation Architect.
Build a high-fidelity 2D/3D interactive canvas simulation for:
TARGET CONCEPT: "${question.concept}"
QUERY: "${question.text || question.concept}"

REQUIREMENTS:
- Responsive dark cyber-themed HTML5 canvas simulation.
- Real-time parameter sliders, live math calculations, stress heatmaps, and speech synthesis narrations.`;
                            copyTextToClipboard(text, '📋 Simulation Prompt copied to clipboard!');
                          }}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            background: 'rgba(30, 41, 59, 0.6)',
                            border: '1px solid var(--border-glass)',
                            color: 'white',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            textAlign: 'left',
                          }}
                        >
                          <Copy size={14} color="var(--accent-cyan)" /> Copy Prompt
                        </button>

                        {/* 📝 PASTE HTML BUTTON */}
                        <button
                          onClick={() => setShowPasteModal(true)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            background: 'rgba(30, 41, 59, 0.6)',
                            border: '1px solid var(--border-glass)',
                            color: 'white',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            textAlign: 'left',
                          }}
                        >
                          <ClipboardList size={14} color="#38bdf8" /> Paste Custom HTML
                        </button>

                        {/* ⛶ FULLSCREEN BUTTON */}
                        <button
                          onClick={handleToggleFullscreen}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            background: 'rgba(30, 41, 59, 0.6)',
                            border: '1px solid var(--border-glass)',
                            color: 'white',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            textAlign: 'left',
                          }}
                        >
                          <Maximize2 size={14} color="#4ade80" /> Fullscreen Mode
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            if (question.status === 'generating' || isProcessing) {
              return (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(9, 11, 17, 0.95)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 30, padding: '24px' }}>
                  <div style={{ width: '56px', height: '56px', border: '4px solid rgba(0, 242, 254, 0.1)', borderTopColor: 'var(--accent-cyan)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '20px' }}></div>
                  <h3 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold', fontFamily: 'var(--font-mono)', fontSize: '15px', letterSpacing: '0.05em', marginBottom: '8px', animation: 'pulse 1.5s infinite' }}>
                    GENERATING SIMULATION SANDBOX
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '300', maxWidth: '360px', textAlign: 'center', lineHeight: '1.5', marginBottom: '20px' }}>
                    Executing 3-Layer AI Architecture: Prompting $\rightarrow$ Detailing $\rightarrow$ Live Code...
                  </p>

                  {/* 3-Layer Architecture Live Visual Info Card */}
                  <div style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: '12px', padding: '16px 20px', width: '420px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                      <Layers size={14} /> 3-Layer AI Execution Pipeline Status
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '11px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#e2e8f0', background: 'rgba(168, 85, 247, 0.1)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a855f7' }}></span>
                        <div>
                          <strong style={{ color: '#c084fc' }}>Layer 1 (gemini-3.5-flash):</strong> Initial Prompting & Dynamic Steps Breakdown
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#e2e8f0', background: 'rgba(0, 242, 254, 0.1)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(0, 242, 254, 0.2)' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-cyan)' }}></span>
                        <div>
                          <strong style={{ color: 'var(--accent-cyan)' }}>Layer 2 (gemini-3.1-flash-lite):</strong> Expanding Interactive Detailing & Prompt Blueprint
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#e2e8f0', background: 'rgba(34, 197, 94, 0.1)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }}></span>
                        <div>
                          <strong style={{ color: '#4ade80' }}>Layer 3 (gemini-3.5-flash):</strong> Compiling Single-File HTML/Canvas Code
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div style={{ position: 'absolute', inset: 0, background: '#090a10', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                <Sparkles className="text-cyan-400 w-12 h-12" style={{ marginBottom: '16px', color: 'var(--accent-cyan)' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: 'white', marginBottom: '8px' }}>No Simulation Built</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '320px', textAlign: 'center', lineHeight: '1.6', marginBottom: '20px' }}>
                  Build the main simulation or break down into step-by-step exam calculations using the buttons in the right panel!
                </p>
                {!question.hasSteps && (
                  <button
                    onClick={handleBreakdownStepsInViewer}
                    disabled={isProcessing}
                    className="btn-primary"
                    style={{ padding: '8px 16px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', color: 'white', background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)' }}
                  >
                    <ListOrdered size={14} /> Decompose into Detailed Exam Steps
                  </button>
                )}
              </div>
            );
          })()}

          {/* Quick loading indicator for edits */}
          {isProcessing && question.status === 'ready' && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
              <div style={{ width: '48px', height: '48px', border: '4px solid rgba(0, 242, 254, 0.2)', borderTopColor: 'var(--accent-cyan)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }}></div>
              <p style={{ color: 'var(--accent-cyan)', fontWeight: 'bold', fontFamily: 'var(--font-mono)', fontSize: '13px', animation: 'pulse 1.5s infinite' }}>
                Gemini is coding the simulation...
              </p>
            </div>
          )}
          {/* Always-On Floating Comments / FSRS Study Notes HUD */}
          <div style={{
            position: 'absolute',
            right: '16px',
            bottom: '16px',
            width: isCommentsExpanded ? '320px' : '48px',
            height: isCommentsExpanded ? '280px' : '48px',
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(0, 242, 254, 0.25)',
            borderRadius: '12px',
            zIndex: 100,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(0, 242, 254, 0.1)',
          }}>
            {/* Header */}
            <div style={{
              padding: '12px 16px',
              borderBottom: isCommentsExpanded ? '1px solid rgba(0, 242, 254, 0.15)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              userSelect: 'none',
            }} onClick={() => setIsCommentsExpanded(!isCommentsExpanded)}>
              {isCommentsExpanded ? (
                <>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)' }}>
                    📝 Study Notes & Queries
                  </span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>[Hide]</span>
                </>
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)', fontSize: '16px' }} title="Open Notes & Comments">
                  📝
                </div>
              )}
            </div>

            {/* Content */}
            {isCommentsExpanded && (
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', flex: 1, gap: '10px' }}>
                <p style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: '1.4', margin: 0 }}>
                  Note down queries here. Add to the **FSRS spaced repetitions** deck to auto-code a customized tutorial sandbox!
                </p>
                
                <textarea
                  value={commentsText}
                  onChange={(e) => setCommentsText(e.target.value)}
                  placeholder="What did you find hard to understand?"
                  style={{
                    flex: 1,
                    background: 'rgba(9, 11, 17, 0.7)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '11px',
                    padding: '8px',
                    resize: 'none',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleSaveComment}
                    disabled={isSavingComment}
                    style={{
                      flex: 1,
                      padding: '8px',
                      background: commentSavedStatus === 'saved' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      border: commentSavedStatus === 'saved' ? '1px solid #22c55e' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      color: commentSavedStatus === 'saved' ? '#4ade80' : '#fff',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {isSavingComment ? 'Saving...' : commentSavedStatus === 'saved' ? '✓ Saved!' : '💾 Save Note'}
                  </button>

                  <button
                    onClick={handleAddToFsrs}
                    disabled={isAddingFsrs}
                    style={{
                      flex: 1,
                      padding: '8px',
                      background: fsrsAddedStatus === 'added' ? 'rgba(0, 242, 254, 0.2)' : 'rgba(0, 242, 254, 0.1)',
                      border: '1px solid var(--accent-cyan)',
                      borderRadius: '6px',
                      color: 'var(--accent-cyan)',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {isAddingFsrs ? 'Adding...' : fsrsAddedStatus === 'added' ? '✓ In FSRS' : '📥 Add to FSRS'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sliding Canvas Editor Side Panel */}
      <div
        className="viewer-right-panel"
        style={{
          display: panelOpen ? 'flex' : 'none',
          maxHeight: '100vh',
          overflow: 'hidden'
        }}
      >
        {/* Panel tabs */}
        <div className="panel-tabs">
          <button
            onClick={() => setActiveTab('chat')}
            className={`panel-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
          >
            <Sparkles size={12} />
            Canvas Chat
          </button>
          <button
            onClick={() => setActiveTab('checklist')}
            className={`panel-tab-btn ${activeTab === 'checklist' ? 'active' : ''}`}
          >
            <Sliders size={12} />
            Options
          </button>
          <button
            onClick={() => setActiveTab('guided')}
            className={`panel-tab-btn ${activeTab === 'guided' ? 'active' : ''}`}
          >
            <ListOrdered size={12} />
            Guided Learning
          </button>
        </div>

        {/* Tab contents */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', minHeight: 0 }}>
          {activeTab === 'chat' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
              
              {/* Question overview styled as a realistic lined notebook page */}
              <div 
                style={{ 
                  background: '#fefdfa', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '12px', 
                  padding: '20px 20px 20px 48px', // extra padding on left for spiral binding
                  marginBottom: '16px', 
                  position: 'relative',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.35), inset 0 0 40px rgba(0,0,0,0.03)',
                  backgroundImage: 'repeating-linear-gradient(rgba(0,0,0,0) 0px, rgba(0,0,0,0) 27px, #e2eaf4 28px)',
                  backgroundSize: '100% 28px',
                  minHeight: '120px'
                }}
                onMouseUp={handleTextSelection}
              >
                {/* Spiral notebook binders on the left edge */}
                <div style={{ position: 'absolute', left: '12px', top: '15px', bottom: '15px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '12px', pointerEvents: 'none', zIndex: 10 }}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div 
                      key={i} 
                      style={{ 
                        width: '16px', 
                        height: '8px', 
                        background: 'linear-gradient(90deg, #94a3b8 0%, #cbd5e1 50%, #64748b 100%)', 
                        borderRadius: '4px', 
                        border: '1px solid #475569', 
                        marginLeft: '-4px', 
                        boxShadow: '1px 2px 3px rgba(0,0,0,0.15)' 
                      }}
                    />
                  ))}
                </div>

                {/* Left red margin line */}
                <div style={{ position: 'absolute', left: '38px', top: 0, bottom: 0, width: '1px', backgroundColor: '#f87171', pointerEvents: 'none', opacity: 0.8 }}></div>
                <div style={{ position: 'absolute', left: '40px', top: 0, bottom: 0, width: '1px', backgroundColor: 'rgba(248, 113, 113, 0.25)', pointerEvents: 'none' }}></div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '4px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                    📖 Interactive Notebook Study Guide
                  </span>
                  <span style={{ fontSize: '8px', color: '#94a3b8' }}>
                    Highlight text to trigger actions
                  </span>
                </div>
                
                <p style={{ fontSize: '12px', color: '#0f172a', lineHeight: '28px', fontWeight: '400', userSelect: 'text', margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  {(() => {
                    let text = question.text;
                    if (highlights.length === 0) return text;
                    let parts: any[] = [text];
                    highlights.forEach(hl => {
                      const nextParts: any[] = [];
                      parts.forEach(p => {
                        if (typeof p === 'string' && p.includes(hl.text)) {
                          const splitParts = p.split(hl.text);
                          for (let i = 0; i < splitParts.length; i++) {
                            nextParts.push(splitParts[i]);
                            if (i < splitParts.length - 1) {
                              nextParts.push(
                                <span 
                                  key={`${hl.text}-${i}`} 
                                  className="notebook-highlight-span"
                                  style={{ backgroundColor: hl.color, borderRadius: '4px', padding: '1px 3px', borderBottom: '2px solid rgba(0,0,0,0.15)', cursor: 'pointer', fontWeight: '500', color: '#0f172a' }} 
                                  onClick={() => hl.svg && setActiveSvg(hl.svg)}
                                >
                                  {hl.text}
                                </span>
                              );
                            }
                          }
                        } else {
                          nextParts.push(p);
                        }
                      });
                      parts = nextParts;
                    });
                    return parts;
                  })()}
                </p>

                {/* Floating Popover Options Menu */}
                {popoverPos && selectedText && (
                  <div 
                    className="notebook-popover glass-panel"
                    style={{
                      position: 'fixed',
                      top: `${popoverPos.y}px`,
                      left: `${popoverPos.x}px`,
                      transform: 'translate(-50%, -100%)',
                      background: 'rgba(9, 11, 17, 0.95)',
                      border: '1px solid rgba(0, 242, 254, 0.3)',
                      borderRadius: '8px',
                      padding: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      zIndex: 150,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                      width: '260px'
                    }}
                    onMouseUp={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                        Analyze Highlighted Text:
                      </span>
                      <button 
                        onClick={() => { setSelectedText(''); setPopoverPos(null); }}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', padding: '0 4px' }}
                      >
                        ✕
                      </button>
                    </div>
                    
                    {/* Option 1 */}
                    <button 
                      onClick={() => setShowSuggestionInput(true)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '6px 8px', borderRadius: '4px', textAlign: 'left' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 242, 254, 0.08)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      🚀 Option 1: Build Custom Sim Variant
                    </button>

                    {/* Option 2 */}
                    <button 
                      onClick={handleGenerateSVG}
                      disabled={isGeneratingSvg}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '6px 8px', borderRadius: '4px', textAlign: 'left' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.08)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      🎨 Option 2: Generate Vector SVG Diagram
                    </button>

                    {/* Option 3 */}
                    <button 
                      onClick={() => {
                        handleBreakdownStepsInViewer();
                        setSelectedText('');
                        setPopoverPos(null);
                      }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '6px 8px', borderRadius: '4px', textAlign: 'left' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(34, 197, 94, 0.08)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      📐 Option 3: Divide sum into steps
                    </button>

                    {showSuggestionInput && (
                      <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <input
                          type="text"
                          placeholder="Focus instructions (e.g. RCC design codes)"
                          value={userSuggestion}
                          onChange={(e) => setUserSuggestion(e.target.value)}
                          style={{ width: '100%', fontSize: '9px', padding: '4px', background: '#05060b', border: '1px solid var(--border-glass)', borderRadius: '4px', color: 'white' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                          <button onClick={() => setShowSuggestionInput(false)} style={{ fontSize: '8px', padding: '2px 6px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
                          <button onClick={() => handleGenerateFromSelection()} style={{ fontSize: '8px', padding: '2px 6px', background: 'var(--accent-cyan)', border: 'none', color: '#05060b', borderRadius: '3px', fontWeight: 'bold', cursor: 'pointer' }}>Build Sim</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Inline SVG Diagram Renderer Window */}
              {activeSvg && (
                <div style={{ background: 'rgba(13, 17, 28, 0.8)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '8px', padding: '12px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '4px' }}>
                    <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      🎨 Selected Highlight Vector Diagram
                    </span>
                    <button onClick={() => setActiveSvg(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '9px' }}>
                      Close Diagram
                    </button>
                  </div>
                  <div 
                    style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '8px', background: '#05060b', borderRadius: '6px' }}
                    dangerouslySetInnerHTML={{ __html: activeSvg }}
                  />
                </div>
              )}

              {/* Chat messages */}
              <div className="chat-message-container">
                {chatLog.map((msg) => (
                  <div
                    key={msg.id}
                    className={`chat-message ${msg.sender === 'user' ? 'self' : 'other'}`}
                  >
                    <span style={{ fontSize: '8px', color: 'var(--text-muted)', marginBottom: '2px', fontFamily: 'var(--font-mono)' }}>
                      {msg.sender === 'user' ? 'You' : msg.sender === 'system' ? 'System' : 'Gemini'}
                    </span>
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        lineHeight: '1.5',
                        background: msg.sender === 'user' 
                          ? 'rgba(0, 242, 254, 0.08)' 
                          : msg.sender === 'system' 
                            ? 'rgba(255, 255, 255, 0.02)' 
                            : 'rgba(168, 85, 247, 0.08)',
                        border: msg.sender === 'user'
                          ? '1px solid rgba(0, 242, 254, 0.15)'
                          : msg.sender === 'system'
                            ? '1px solid var(--border-glass)'
                            : '1px solid rgba(168, 85, 247, 0.15)',
                        color: msg.sender === 'user'
                          ? 'var(--text-primary)'
                          : msg.sender === 'system'
                            ? 'var(--text-muted)'
                            : 'var(--text-secondary)'
                      }}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Chat input form */}
              <form onSubmit={handleRefine} style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '16px' }}>
                <div style={{ position: 'relative' }}>
                  <textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder={
                      question.simulationFile
                        ? "E.g., Make gravity higher, change colors, add restart button..."
                        : "Please build the simulation first under Options tab."
                    }
                    disabled={isProcessing || !question.simulationFile}
                    style={{ width: '100%', height: '60px', paddingRight: '40px', fontSize: '11px', resize: 'none' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleRefine(e);
                      }
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isProcessing || !editPrompt.trim() || !question.simulationFile}
                    className="btn-primary"
                    style={{ position: 'absolute', right: '8px', bottom: '8px', padding: '6px', minWidth: 'auto', width: '28px', height: '28px', borderRadius: '50%' }}
                  >
                    <Send size={12} />
                  </button>
                </div>
                {question.simulationFile && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setEditPrompt("Fit the layout completely inside the 100vh viewport, hiding any outer body scrollbars. Ensure canvas, side control panels, and graphs are sized cleanly without collision or clipping.")}
                      disabled={isProcessing}
                      style={{ fontSize: '8px', padding: '3px 6px', background: 'rgba(0, 242, 254, 0.05)', border: '1px solid rgba(0, 242, 254, 0.2)', borderRadius: '4px', color: 'var(--accent-cyan)', cursor: 'pointer' }}
                    >
                      🧹 Fix Layout Overflow
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditPrompt("Implement high-DPI scaling (devicePixelRatio resizing helper function) on the canvas to fix drawing blur or disappearing figure parts on Retina/high-res screens.")}
                      disabled={isProcessing}
                      style={{ fontSize: '8px', padding: '3px 6px', background: 'rgba(168, 85, 247, 0.05)', border: '1px solid rgba(168, 85, 247, 0.2)', borderRadius: '4px', color: 'var(--accent-purple)', cursor: 'pointer' }}
                    >
                      📐 Fix Canvas Blur (DPI)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditPrompt("Increase overall interactivity: add more interactive parameter cards, value drag-and-drop slots, active equations, and custom user controls.")}
                      disabled={isProcessing}
                      style={{ fontSize: '8px', padding: '3px 6px', background: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: '4px', color: '#22c55e', cursor: 'pointer' }}
                    >
                      🕹️ Add Interactivity
                    </button>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Press Enter to send
                  </span>
                  {question.simulationFile && (
                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={isProcessing}
                      style={{ background: 'transparent', color: 'var(--accent-purple)', fontSize: '9px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <RefreshCw size={10} />
                      Regenerate Scratch
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          {activeTab === 'checklist' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Pedagogy Style Rating & Performance Card */}
              <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(0, 242, 254, 0.3)', borderRadius: '10px', padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    🎨 Pedagogy Style Profile
                  </span>
                  {styleRatingVal > 0 && (
                    <span style={{ fontSize: '10px', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid #22c55e', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                      ★ {styleRatingVal}/10 Rated
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'white', marginBottom: '6px' }}>
                  {getStyleDisplayName(question.styleProfileUsed || 'universal_pedagogy')}
                </div>

                <p style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '12px' }}>
                  Rate this simulation style (1: Low, 10: High). Your star ratings train the system to prioritize your favorite styles!
                </p>

                {/* 1 to 10 Star / Point Rating Scale */}
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {Array.from({ length: 10 }).map((_, i) => {
                    const val = i + 1;
                    let starColor = '#ef4444';
                    if (val >= 4 && val <= 7) starColor = '#f59e0b';
                    if (val >= 8) starColor = '#10b981';

                    return (
                      <button
                        key={val}
                        onClick={() => handleRatePedagogyStyle(val)}
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '6px',
                          background: styleRatingVal === val ? starColor : 'rgba(15, 23, 42, 0.6)',
                          border: `1px solid ${starColor}`,
                          color: styleRatingVal === val ? '#000' : 'white',
                          fontWeight: 'bold',
                          fontSize: '10px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '11px', fontWeight: 'bold', color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  Interaction Modules
                </h4>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.4' }}>
                  Toggle which elements Gemini should compile in the simulation code.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {featuresList.map(feat => (
                    <div
                      key={feat.id}
                      onClick={() => {
                        if (setFeaturesList) {
                          setFeaturesList(prev => prev.map(f => f.id === feat.id ? { ...f, checked: !f.checked } : f));
                        }
                      }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{feat.label}</span>
                      </div>
                      {feat.checked ? (
                        <CheckSquare className="text-cyan-400" size={16} />
                      ) : (
                        <Square className="text-gray-600" size={16} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {!question.hasSteps && (
                  <button
                    onClick={handleBreakdownStepsInViewer}
                    disabled={isProcessing}
                    className="btn-secondary"
                    style={{ width: '100%', padding: '10px 12px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#c084fc', borderColor: 'rgba(168, 85, 247, 0.3)', background: 'rgba(168, 85, 247, 0.08)' }}
                  >
                    <ListOrdered size={14} /> Decompose into Detailed Exam Steps
                  </button>
                )}
                {question.status !== 'pending' && (
                  <button
                    onClick={handleCopyPromptBlueprint}
                    className="btn-secondary"
                    style={{ width: '100%', padding: '10px 12px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <FileText size={14} /> Copy Prompt Blueprint
                  </button>
                )}
                <button
                  onClick={() => setShowPasteModal(true)}
                  className="btn-secondary"
                  style={{ width: '100%', padding: '10px 12px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <ClipboardList size={14} /> Paste Custom Code Variant
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={isProcessing}
                  className="btn-primary"
                  style={{ width: '100%', padding: '12px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  <Sparkles size={14} style={{ marginRight: '6px' }} />
                  {question.simulationFile ? 'Re-build Simulation' : 'Build Simulation'}
                </button>
              </div>

              {/* Prompt Engine System instructions (Tempering) Settings */}
              <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-glass)' }}>
                <h4 style={{ fontSize: '11px', fontWeight: 'bold', color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⚙️ Prompt Tuning Engine (System Prompt)
                </h4>
                <p style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: '1.4' }}>
                  Customize the base templates that direct how the AI plans and generates simulation code.
                </p>

                <form onSubmit={handleSaveSystemPrompts} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                      Pedagogy Style Profile
                    </label>
                    <select
                      value={styleProfile}
                      onChange={async (e) => {
                        const newStyle = e.target.value;
                        if (setStyleProfile) {
                          setStyleProfile(newStyle);
                        }
                        await fetch('/api/settings', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ styleProfile: newStyle })
                        });
                      }}
                      style={{ width: '100%', fontSize: '10px', padding: '6px', background: '#05060b', border: '1px solid var(--border-glass)', borderRadius: '6px', color: '#e2e8f0' }}
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

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                      Layer 1: Blueprint Generator System Instructions
                    </label>
                    <textarea
                      value={promptBlueprintSystem}
                      onChange={(e) => setPromptBlueprintSystem(e.target.value)}
                      rows={6}
                      style={{ width: '100%', fontSize: '10px', padding: '6px', background: '#05060b', border: '1px solid var(--border-glass)', borderRadius: '6px', color: '#e2e8f0', fontFamily: 'var(--font-mono)' }}
                      placeholder="Enter system prompt for blueprint generation..."
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                      Layer 2: HTML/JS Code Compiler System Instructions
                    </label>
                    <textarea
                      value={promptCodeSystem}
                      onChange={(e) => setPromptCodeSystem(e.target.value)}
                      rows={6}
                      style={{ width: '100%', fontSize: '10px', padding: '6px', background: '#05060b', border: '1px solid var(--border-glass)', borderRadius: '6px', color: '#e2e8f0', fontFamily: 'var(--font-mono)' }}
                      placeholder="Enter system prompt for code generation..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingPrompts}
                    className="btn-secondary"
                    style={{ width: '100%', padding: '8px', fontSize: '10px', fontWeight: 'bold', color: 'var(--accent-cyan)', borderColor: 'rgba(0, 242, 254, 0.3)', background: 'rgba(0, 242, 254, 0.04)' }}
                  >
                    {isSavingPrompts ? 'Saving Prompt Templates...' : '💾 Save Custom Prompt Templates'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'guided' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
              
              {!isGuidedStarted ? (
                /* LANDING PAGE (TUTOR NOT STARTED YET) */
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', justifyContent: 'center', alignItems: 'center', padding: '24px', textAlign: 'center', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '16px', border: '1px solid var(--border-glass)' }}>
                  
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(0, 242, 254, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0, 242, 254, 0.3)', fontSize: '32px' }}>
                    🤖
                  </div>

                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', marginBottom: '8px' }}>
                      Guided Learning Assistant
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6', maxWidth: '320px', margin: '0 auto' }}>
                      Study this concept step-by-step with an interactive tutor. As you solve each step, the twin-engine compiler builds a dedicated visual simulation dynamically.
                    </p>
                  </div>

                  {/* SAVED GEMINI CONVERSATION LINK */}
                  <div style={{ width: '100%', padding: '12px', background: 'rgba(30, 41, 59, 0.3)', border: '1px solid var(--border-glass)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                      🔗 Original Gemini Workspace Link
                    </div>
                    {question.geminiLink ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                        <a
                          href={question.geminiLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={handleCopyTutorPrompt}
                          style={{ fontSize: '11px', color: 'var(--accent-cyan)', textDecoration: 'none', fontWeight: 'bold', wordBreak: 'break-all' }}
                        >
                          Open Saved Gemini Chat ↗
                        </a>
                        <button
                          type="button"
                          onClick={handleSaveGeminiLink}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '10px', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          Update Link
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSaveGeminiLink}
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid var(--border-glass)',
                          color: '#e2e8f0',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          margin: '0 auto'
                        }}
                      >
                        Add Gemini Conversation Link
                      </button>
                    )}
                  </div>

                  {/* ACTIVE QUESTION CONTEXT */}
                  <div style={{ width: '100%', padding: '12px', background: 'rgba(5, 6, 11, 0.5)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', textAlign: 'left' }}>
                    <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--accent-cyan)', marginBottom: '4px', textTransform: 'uppercase' }}>
                      Opened Question Context:
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', maxHeight: '100px', overflowY: 'auto', lineHeight: '1.4' }}>
                      {question.text}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={startGuidedLearningSession}
                    disabled={isGuidedProcessing}
                    style={{
                      width: '100%',
                      background: 'var(--accent-cyan)',
                      color: '#000',
                      border: 'none',
                      padding: '12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 20px rgba(0, 242, 254, 0.3)'
                    }}
                  >
                    {isGuidedProcessing ? (
                      <>
                        <Loader size={16} className="animate-spin" /> Starting session...
                      </>
                    ) : (
                      <>
                        🚀 Start Guided Learning
                      </>
                    )}
                  </button>

                </div>
              ) : (
                /* ACTIVE CHAT DIALOGUE */
                <>
                  {/* TOP ACTIONS: GEMINI LINK & TOGGLE CANVAS */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(30, 41, 59, 0.4)', border: '1px solid var(--border-glass)', borderRadius: '10px', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                       <a
                        href={question.geminiLink || `https://gemini.google.com/app?q=Help+me+understand+${encodeURIComponent(question.concept)}+step-by-step`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleCopyTutorPrompt}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          color: 'var(--accent-cyan)',
                          textDecoration: 'none',
                          background: 'rgba(0, 242, 254, 0.1)',
                          border: '1px solid rgba(0, 242, 254, 0.3)',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          transition: 'all 0.2s ease',
                        }}
                        title="Open Gemini Web App"
                      >
                        <Send size={12} /> Gemini Link ↗
                      </a>
                      <button
                        type="button"
                        onClick={handleSaveGeminiLink}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          fontSize: '10px',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        Save Link
                      </button>
                    </div>

                    {/* RESET TO ORIGINAL CANVAS */}
                    <button
                      type="button"
                      onClick={() => updateIframeSrc(question.simulationFile || '')}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--border-glass)',
                        color: 'var(--text-muted)',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      🏠 Original Canvas
                    </button>
                  </div>

                  {/* MESSAGES LIST */}
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px', minHeight: '280px' }}>
                    {guidedLog.map(msg => (
                      <div
                        key={msg.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                          maxWidth: '85%',
                        }}
                      >
                        <div
                          style={{
                            padding: '12px 14px',
                            borderRadius: '12px',
                            background: msg.sender === 'user' ? 'rgba(0, 242, 254, 0.15)' : 'rgba(30, 41, 59, 0.5)',
                            border: msg.sender === 'user' ? '1px solid rgba(0, 242, 254, 0.3)' : '1px solid var(--border-glass)',
                            color: 'white',
                            fontSize: '12.5px',
                            lineHeight: '1.5',
                            whiteSpace: 'pre-wrap',
                          }}
                          className="math-content"
                        >
                          {msg.text}

                          {/* Compilation status / live toggle button */}
                          {msg.sender === 'ai' && (
                            <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {msg.isCompilingSim ? (
                                  <>
                                    <Loader size={10} className="animate-spin text-cyan-400" /> Compiling step simulation...
                                  </>
                                ) : msg.simulationFile ? (
                                  <span style={{ color: '#4ade80' }}>✓ Simulation Compiled</span>
                                ) : (
                                  'Ready to visualize'
                                )}
                              </span>

                              {msg.simulationFile && (() => {
                                const isActive = iframeSrc === msg.simulationFile;
                                return (
                                  <button
                                    type="button"
                                    onClick={() => updateIframeSrc(msg.simulationFile!)}
                                    style={{
                                      background: isActive ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                      border: isActive ? '1px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
                                      color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
                                      padding: '4px 10px',
                                      borderRadius: '6px',
                                      fontSize: '10px',
                                      fontWeight: 'bold',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      transition: 'all 0.2s ease',
                                    }}
                                  >
                                    {isActive ? '📺 Active Step Canvas' : '📺 Load Step Canvas'}
                                  </button>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={guidedEndRef} />
                  </div>

                  {/* INPUT FORM */}
                  <form
                    onSubmit={handleGuidedSend}
                    style={{
                      display: 'flex',
                      gap: '8px',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: '12px',
                      padding: '6px',
                      marginTop: 'auto',
                    }}
                  >
                    <input
                      type="text"
                      value={guidedInput}
                      onChange={(e) => setGuidedInput(e.target.value)}
                      disabled={isGuidedProcessing}
                      placeholder="Ask a question or enter response..."
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        color: 'white',
                        padding: '8px 12px',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="submit"
                      disabled={isGuidedProcessing || !guidedInput.trim()}
                      style={{
                        background: 'var(--accent-cyan)',
                        color: '#000',
                        border: 'none',
                        borderRadius: '8px',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'opacity 0.2s',
                        opacity: isGuidedProcessing || !guidedInput.trim() ? 0.5 : 1,
                      }}
                    >
                      {isGuidedProcessing ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
                    </button>
                  </form>
                </>
              )}

            </div>
          )}
        </div>
      </div>

      {/* Paste Custom Code Variant Modal */}
      {showPasteModal && (
        <div className="modal-overlay" style={{ zIndex: 110 }}>
          <div className="modal-box modal-box-large glass-panel" style={{ width: '550px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ClipboardList size={16} /> Paste Custom Code Variant
              </h3>
              <button
                onClick={() => setShowPasteModal(false)}
                style={{ background: 'transparent', fontSize: '18px', color: 'var(--text-secondary)' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveCustomCodeVariant} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Variant Name</label>
                <input
                  type="text"
                  placeholder="E.g., Alternate Version, Physics Fix"
                  value={variantName}
                  onChange={(e) => setVariantName(e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">HTML / JS Code</label>
                <textarea
                  placeholder="Paste your self-contained HTML/JS simulation code here. Ensure it includes standard styles, canvas tags, and scripts..."
                  value={pastedCode}
                  onChange={(e) => setPastedCode(e.target.value)}
                  required
                  style={{ width: '100%', height: '240px', fontSize: '11px', fontFamily: 'var(--font-mono)', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--border-glass)' }}>
                <button
                  type="button"
                  onClick={() => setShowPasteModal(false)}
                  className="btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '11px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPasting || !variantName.trim() || !pastedCode.trim()}
                  className="btn-primary"
                  style={{ padding: '8px 16px', fontSize: '11px' }}
                >
                  {isPasting ? 'Saving Variant...' : 'Add Variant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Prompt Blueprint Preview Modal */}
      {promptModalText !== null && (
        <div className="modal-overlay" style={{ zIndex: 120 }}>
          <div className="modal-box modal-box-large glass-panel" style={{ width: '650px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={16} /> Prompt Blueprint Code Preview (3-Layer Pipeline)
              </h3>
              <button onClick={() => setPromptModalText(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: '1.4' }}>
              Below is the expanded instruction prompt blueprint generated by Layer 2 (<code style={{ color: 'var(--accent-cyan)' }}>gemini-3.1-flash-lite</code>) and fed into Layer 3 (<code style={{ color: '#4ade80' }}>gemini-3.5-flash</code>) to compile the simulation code:
            </p>

            <div style={{ flex: 1, overflowY: 'auto', background: '#05060b', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
              <pre style={{ margin: 0, fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#e2e8f0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.6' }}>
                {promptModalText}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-glass)', paddingTop: '12px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {copiedPromptStatus ? '✅ Copied to Clipboard!' : 'Click button to copy prompt code.'}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setPromptModalText(null)}
                  className="btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '11px' }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    copyTextToClipboard(promptModalText, '📋 Prompt blueprint code copied!');
                    setCopiedPromptStatus(true);
                    setTimeout(() => setCopiedPromptStatus(false), 2500);
                  }}
                  className="btn-primary"
                  style={{ padding: '8px 16px', fontSize: '11px', background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)' }}
                >
                  <ClipboardList size={14} style={{ marginRight: '6px' }} />
                  {copiedPromptStatus ? 'Copied!' : 'Copy Prompt Code'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
