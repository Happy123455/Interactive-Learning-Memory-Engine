import React, { useState, useEffect } from 'react';
import type { Database } from '../types';
import { 
  Calendar as CalendarIcon, Clock, Compass, BookOpen, Volume2, HelpCircle, 
  CheckCircle, TrendingUp, Sparkles, Smile, RefreshCw, Layers, CalendarDays, 
  Utensils, Moon, Sun, ShieldAlert, ChevronRight, Zap
} from 'lucide-react';

interface PrepPlannerProps {
  db: Database;
}

interface ClassSlot {
  time: string;
  code: string;
  name: string;
  teacher: string;
  room: string;
  type: 'lecture' | 'lab' | 'break' | 'free';
  color: string;
}

interface TimetableDay {
  dayName: string;
  fullDate: string;
  slots: ClassSlot[];
}

interface RoutineDay {
  dayNumber: number;
  dateString: string;
  topics: string[];
  focus: string;
  durationMinutes: number;
  priority: 'High' | 'Medium' | 'Low';
}

interface StudyPlan {
  routineSummary: string;
  recommendedHoursPerDay: number;
  anxietyAdvice: string;
  schedule: RoutineDay[];
}

export const PrepPlanner: React.FC<PrepPlannerProps> = ({ db }) => {
  // Navigation View Mode: Day -> Week -> Month -> AI Suggestions
  const [plannerView, setPlannerView] = useState<'day' | 'week' | 'month' | 'ai_suggest'>('day');
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0); // 0: Mon, 1: Tue, 2: Wed, 3: Thu, 4: Fri, 5: Sat, 6: Sun

  // User Routine & Occupancy Settings
  const [wakeTime, setWakeTime] = useState<string>('06:00');
  const [sleepTime, setSleepTime] = useState<string>('21:30');
  
  // Draggable / Adjustable Meal Slots
  const [lunchStart, setLunchStart] = useState<string>('11:30');
  const [lunchDuration, setLunchDuration] = useState<number>(40); // 40 minutes (11:30 to 12:10)
  const [dinnerStart, setDinnerStart] = useState<string>('20:00');
  const [dinnerDuration, setDinnerDuration] = useState<number>(45); // 45 minutes (20:00 to 20:45)

  // AI Prep Generator Inputs
  const [examDate, setExamDate] = useState<string>('2026-09-15');
  const [confidence, setConfidence] = useState<number>(6);
  const [targetStudyHours, setTargetStudyHours] = useState<number>(3.5);
  const [userState, setUserState] = useState<string>('Focused & Ready');

  // AI Suggestion State
  const [activePlan, setActivePlan] = useState<StudyPlan | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<string>('');
  const [activeFormat, setActiveFormat] = useState<string>('podcast');
  const [suggestionText, setSuggestionText] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');

  // Loading Flags
  const [isLoadingPlan, setIsLoadingPlan] = useState<boolean>(false);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState<boolean>(false);

  // Exact 5th Semester Civil College Timetable
  const collegeTimetable: TimetableDay[] = [
    {
      dayName: 'Monday',
      fullDate: '17-08-2026',
      slots: [
        { time: '07:45 AM - 08:40 AM', code: '2301CV514', name: 'Theory of Architecture (ToA)', teacher: 'SGG', room: 'G-304', type: 'lecture', color: '#f59e0b' },
        { time: '08:40 AM - 09:35 AM', code: '2301CV514', name: 'Theory of Architecture (ToA)', teacher: 'SGG', room: 'G-304', type: 'lecture', color: '#f59e0b' },
        { time: '09:35 AM - 09:50 AM', code: 'BREAK', name: 'Morning Break', teacher: '-', room: '-', type: 'break', color: '#64748b' },
        { time: '09:50 AM - 10:40 AM', code: '2301CV502', name: 'Engineering Hydrology', teacher: 'MAJ', room: 'G-203', type: 'lecture', color: '#3b82f6' },
        { time: '10:40 AM - 11:30 AM', code: '2301CV503', name: 'Transportation Engineering (TE)', teacher: 'DAJ', room: 'G-203', type: 'lecture', color: '#8b5cf6' },
        { time: '11:30 AM - 12:10 PM', code: 'LUNCH', name: 'Lunch Recess', teacher: '-', room: '-', type: 'break', color: '#eab308' },
        { time: '12:10 PM - 01:50 PM', code: '2301CV501', name: 'Batch-2 ESD Lab', teacher: 'DDH', room: 'G-203', type: 'lab', color: '#06b6d4' }
      ]
    },
    {
      dayName: 'Tuesday',
      fullDate: '18-08-2026',
      slots: [
        { time: '07:45 AM - 08:40 AM', code: '2301CV503', name: 'Transportation Engineering (TE)', teacher: 'DAJ', room: 'G-203', type: 'lecture', color: '#8b5cf6' },
        { time: '08:40 AM - 09:35 AM', code: '2301CV503', name: 'Transportation Engineering (TE)', teacher: 'DAJ', room: 'G-203', type: 'lecture', color: '#8b5cf6' },
        { time: '09:35 AM - 09:50 AM', code: 'BREAK', name: 'Morning Break', teacher: '-', room: '-', type: 'break', color: '#64748b' },
        { time: '09:50 AM - 11:30 AM', code: '2301ME591', name: 'Batch-2 CADD Lab', teacher: 'DKP', room: 'G-204 Computer Centre', type: 'lab', color: '#10b981' },
        { time: '11:30 AM - 12:10 PM', code: 'LUNCH', name: 'Lunch Recess', teacher: '-', room: '-', type: 'break', color: '#eab308' },
        { time: '12:10 PM - 01:50 PM', code: '2301CV502', name: 'Batch-2 Eng. Hydrology Lab', teacher: 'MAJ', room: 'G-203', type: 'lab', color: '#3b82f6' }
      ]
    },
    {
      dayName: 'Wednesday',
      fullDate: '19-08-2026',
      slots: [
        { time: '07:45 AM - 08:40 AM', code: '2301CV501', name: 'Elementary Structural Design (ESD)', teacher: 'DDH', room: 'G-203', type: 'lecture', color: '#06b6d4' },
        { time: '08:40 AM - 09:35 AM', code: '2301CV501', name: 'Elementary Structural Design (ESD)', teacher: 'DDH', room: 'G-203', type: 'lecture', color: '#06b6d4' },
        { time: '09:35 AM - 09:50 AM', code: 'BREAK', name: 'Morning Break', teacher: '-', room: '-', type: 'break', color: '#64748b' },
        { time: '09:50 AM - 10:40 AM', code: '2301CV514', name: 'Theory of Architecture (ToA)', teacher: 'SGG', room: 'G-203', type: 'lecture', color: '#f59e0b' },
        { time: '10:40 AM - 11:30 AM', code: 'FREE', name: 'Library Self Study', teacher: '-', room: 'Library', type: 'free', color: '#10b981' },
        { time: '11:30 AM - 12:10 PM', code: 'LUNCH', name: 'Lunch Recess', teacher: '-', room: '-', type: 'break', color: '#eab308' },
        { time: '12:10 PM - 01:00 PM', code: '2301CV502', name: 'Engineering Hydrology', teacher: 'MAJ', room: 'G-203', type: 'lecture', color: '#3b82f6' }
      ]
    },
    {
      dayName: 'Thursday',
      fullDate: '20-08-2026',
      slots: [
        { time: '07:45 AM - 08:40 AM', code: '2301CV501', name: 'Elementary Structural Design (ESD)', teacher: 'DKJ', room: 'G-203', type: 'lecture', color: '#06b6d4' },
        { time: '08:40 AM - 09:35 AM', code: '2301CV501', name: 'Elementary Structural Design (ESD)', teacher: 'DKJ', room: 'G-203', type: 'lecture', color: '#06b6d4' },
        { time: '09:35 AM - 09:50 AM', code: 'BREAK', name: 'Morning Break', teacher: '-', room: '-', type: 'break', color: '#64748b' },
        { time: '09:50 AM - 11:30 AM', code: '2301CV503', name: 'Batch-2 TE Lab', teacher: 'DAJ', room: 'C-104 Lab', type: 'lab', color: '#8b5cf6' },
        { time: '11:30 AM - 12:10 PM', code: 'LUNCH', name: 'Lunch Recess', teacher: '-', room: '-', type: 'break', color: '#eab308' },
        { time: '12:10 PM - 01:50 PM', code: '2301ME591', name: 'Batch-2 CADD Lab', teacher: 'DKP', room: 'G-204 Computer Centre', type: 'lab', color: '#10b981' }
      ]
    },
    {
      dayName: 'Friday',
      fullDate: '21-08-2026',
      slots: [
        { time: '07:45 AM - 08:40 AM', code: '2301CV502', name: 'Engineering Hydrology', teacher: 'MAJ', room: 'G-203', type: 'lecture', color: '#3b82f6' },
        { time: '08:40 AM - 09:35 AM', code: '2301CV514', name: 'Theory of Architecture (ToA)', teacher: 'SGG', room: 'G-304', type: 'lecture', color: '#f59e0b' },
        { time: '09:35 AM - 09:50 AM', code: 'BREAK', name: 'Morning Break', teacher: '-', room: '-', type: 'break', color: '#64748b' },
        { time: '09:50 AM - 11:30 AM', code: '2301CV501', name: 'Batch-2 ESD Lab', teacher: 'DDH', room: 'G-203', type: 'lab', color: '#06b6d4' },
        { time: '11:30 AM - 12:10 PM', code: 'LUNCH', name: 'Lunch Recess', teacher: '-', room: '-', type: 'break', color: '#eab308' },
        { time: '12:10 PM - 01:50 PM', code: 'FREE', name: 'Weekend Study Prep', teacher: '-', room: 'Self', type: 'free', color: '#10b981' }
      ]
    },
    {
      dayName: 'Saturday',
      fullDate: '22-08-2026',
      slots: [
        { time: '09:00 AM - 11:30 AM', code: 'SELF', name: 'Deep Work: Structural Design Simulations', teacher: 'Self', room: 'Home', type: 'free', color: '#06b6d4' },
        { time: '11:30 AM - 12:10 PM', code: 'LUNCH', name: 'Lunch Recess', teacher: '-', room: '-', type: 'break', color: '#eab308' },
        { time: '02:00 PM - 05:00 PM', code: 'REVISION', name: 'FSRS Card Review & Prep Test', teacher: 'AI', room: 'Home', type: 'free', color: '#a855f7' }
      ]
    },
    {
      dayName: 'Sunday',
      fullDate: '23-08-2026',
      slots: [
        { time: '10:00 AM - 11:30 AM', code: 'RECAP', name: 'Weekly Concept Consolidation', teacher: 'Self', room: 'Home', type: 'free', color: '#10b981' },
        { time: '11:30 AM - 12:10 PM', code: 'LUNCH', name: 'Lunch Recess', teacher: '-', room: '-', type: 'break', color: '#eab308' },
        { time: '03:00 PM - 06:00 PM', code: 'SIMULATION', name: 'Hydrology & TE Interactive Labs', teacher: 'AI', room: 'Home', type: 'free', color: '#3b82f6' }
      ]
    }
  ];

  // Initialize UMS Subject/Unit defaults
  useEffect(() => {
    if (db.subjects && db.subjects.length > 0) {
      setSelectedSubjectId(db.subjects[0].id);
      if (db.subjects[0].units && db.subjects[0].units.length > 0) {
        setSelectedUnitId(db.subjects[0].units[0].id);
      }
    }
  }, [db]);

  // Load Saved Plan
  useEffect(() => {
    const loadSavedPlan = async () => {
      try {
        const res = await fetch('/api/prepplanner/load-plan');
        if (res.ok) {
          const data = await res.json();
          if (data && !data.error) {
            setActivePlan(data);
          }
        }
      } catch (e) {
        console.error('Failed to load study plan:', e);
      }
    };
    loadSavedPlan();
  }, []);

  const handleGenerateRoutine = async () => {
    setIsLoadingPlan(true);
    try {
      const res = await fetch('/api/prepplanner/generate-routine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examDate, confidence, studyHours: targetStudyHours, userState })
      });
      if (res.ok) {
        const data = await res.json();
        setActivePlan(data);
        alert('✨ AI Prep Routine Generated Successfully!');
      } else {
        alert('Failed to generate prep routine.');
      }
    } catch (e) {
      console.error(e);
      alert('Error communicating with server.');
    } finally {
      setIsLoadingPlan(false);
    }
  };

  const handleCompileSuggestion = async (concept: string, format: string) => {
    setSelectedConcept(concept);
    setActiveFormat(format);
    setIsLoadingSuggestion(true);
    setSuggestionText('');
    try {
      const res = await fetch('/api/prepplanner/generate-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concept, format })
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestionText(data.result);
      } else {
        alert('Failed to compile suggestion.');
      }
    } catch (e) {
      console.error(e);
      alert('Error fetching suggestion blueprint.');
    } finally {
      setIsLoadingSuggestion(false);
    }
  };

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Text-to-speech not supported on this browser.');
    }
  };

  const currentDayTimetable = collegeTimetable[selectedDayIndex] || collegeTimetable[0];

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflowY: 'auto' }}>
      
      {/* Top Header & View Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            🧠 AI Prep Planner & Routine Engine
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
            College occupancy timeline visualizer, customizable meal slots, and intelligent AI study routine.
          </p>
        </div>

        {/* View Mode Tabs: Day -> Week -> Month -> AI Suggestion */}
        <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '4px', gap: '4px' }}>
          <button
            onClick={() => setPlannerView('day')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: plannerView === 'day' ? 'var(--accent-gradient)' : 'transparent',
              color: plannerView === 'day' ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            <Clock size={14} /> Day Timeline
          </button>
          <button
            onClick={() => setPlannerView('week')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: plannerView === 'week' ? 'var(--accent-gradient)' : 'transparent',
              color: plannerView === 'week' ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            <CalendarDays size={14} /> 7-Day Week Grid
          </button>
          <button
            onClick={() => setPlannerView('month')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: plannerView === 'month' ? 'var(--accent-gradient)' : 'transparent',
              color: plannerView === 'month' ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            <CalendarIcon size={14} /> 30-Day Month Planner
          </button>
          <button
            onClick={() => setPlannerView('ai_suggest')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: plannerView === 'ai_suggest' ? 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)' : 'transparent',
              color: plannerView === 'ai_suggest' ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            <Sparkles size={14} /> AI Suggestions
          </button>
        </div>
      </div>

      {/* Routine Controls: Wake up, Sleep, Draggable Lunch & Dinner */}
      <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          {/* Wake & Sleep */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sun size={16} color="#f59e0b" />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Wake Up:</span>
            <input 
              type="time" 
              value={wakeTime} 
              onChange={(e) => setWakeTime(e.target.value)} 
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: '#f59e0b', padding: '4px 8px', fontSize: '12px', fontWeight: 'bold' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Moon size={16} color="#8b5cf6" />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Sleep:</span>
            <input 
              type="time" 
              value={sleepTime} 
              onChange={(e) => setSleepTime(e.target.value)} 
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: '#c084fc', padding: '4px 8px', fontSize: '12px', fontWeight: 'bold' }}
            />
          </div>

          {/* Adjustable Lunch Slot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(234, 179, 8, 0.1)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
            <Utensils size={14} color="#eab308" />
            <span style={{ fontSize: '11px', color: '#fde047', fontWeight: 'bold' }}>Lunch Slot:</span>
            <input 
              type="time" 
              value={lunchStart} 
              onChange={(e) => setLunchStart(e.target.value)} 
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(234, 179, 8, 0.4)', borderRadius: '4px', color: '#fde047', padding: '2px 6px', fontSize: '11px' }}
            />
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Duration: {lunchDuration}m</span>
            <input 
              type="range" 
              min={20} 
              max={60} 
              step={5}
              value={lunchDuration} 
              onChange={(e) => setLunchDuration(parseInt(e.target.value, 10))} 
              style={{ width: '60px', accentColor: '#eab308' }}
            />
          </div>

          {/* Adjustable Dinner Slot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(236, 72, 153, 0.1)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(236, 72, 153, 0.3)' }}>
            <Utensils size={14} color="#ec4899" />
            <span style={{ fontSize: '11px', color: '#f472b6', fontWeight: 'bold' }}>Dinner Slot:</span>
            <input 
              type="time" 
              value={dinnerStart} 
              onChange={(e) => setDinnerStart(e.target.value)} 
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(236, 72, 153, 0.4)', borderRadius: '4px', color: '#f472b6', padding: '2px 6px', fontSize: '11px' }}
            />
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Duration: {dinnerDuration}m</span>
            <input 
              type="range" 
              min={20} 
              max={60} 
              step={5}
              value={dinnerDuration} 
              onChange={(e) => setDinnerDuration(parseInt(e.target.value, 10))} 
              style={{ width: '60px', accentColor: '#ec4899' }}
            />
          </div>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '6px' }}>
          ⏳ Total Awake Capacity: <strong style={{ color: '#4ade80' }}>15.5 Hours / Day</strong>
        </div>
      </div>

      {/* VIEW MODE 1: DAY TIMELINE VISUALIZER */}
      {plannerView === 'day' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Day Selector Pills */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {collegeTimetable.map((tDay, idx) => (
              <button
                key={tDay.dayName}
                onClick={() => setSelectedDayIndex(idx)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: selectedDayIndex === idx ? '1px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
                  background: selectedDayIndex === idx ? 'rgba(6, 182, 212, 0.15)' : 'rgba(15, 23, 42, 0.4)',
                  color: selectedDayIndex === idx ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {tDay.dayName} ({tDay.fullDate})
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
            
            {/* Timeline Breakdown */}
            <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={18} color="var(--accent-cyan)" /> {currentDayTimetable.dayName} Hourly Schedule (06:00 to 21:30)
                </h3>
                <span style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: '6px' }}>
                  College Lectures + AI Self-Study Slots
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                
                {/* Morning Wake Routine */}
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '12px 16px', borderRadius: '10px' }}>
                  <div style={{ minWidth: '120px', fontSize: '12px', fontWeight: 'bold', color: '#f59e0b' }}>06:00 AM - 07:30 AM</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'white' }}>🌅 Morning Routine & FSRS Quick Review</div>
                    <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>Wake up at {wakeTime}, hydration, and 30-min FSRS spaced repetition card flashcard review.</div>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', padding: '2px 8px', borderRadius: '4px' }}>Routine</span>
                </div>

                {/* College Classes & Lab Slots */}
                {currentDayTimetable.slots.map((slot, sIdx) => (
                  <div key={sIdx} style={{ display: 'flex', gap: '14px', alignItems: 'center', background: `${slot.color}15`, border: `1px solid ${slot.color}40`, padding: '12px 16px', borderRadius: '10px' }}>
                    <div style={{ minWidth: '120px', fontSize: '12px', fontWeight: 'bold', color: slot.color }}>{slot.time}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {slot.name}
                        {slot.room !== '-' && <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.1)', padding: '1px 6px', borderRadius: '4px', color: '#cbd5e1' }}>📍 {slot.room}</span>}
                      </div>
                      {slot.teacher !== '-' && <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>Faculty: {slot.teacher} ({slot.code})</div>}
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', background: `${slot.color}30`, color: slot.color, padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                      {slot.type}
                    </span>
                  </div>
                ))}

                {/* Draggable Lunch Slot Visualizer */}
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', background: 'rgba(234, 179, 8, 0.12)', border: '1px dashed #eab308', padding: '12px 16px', borderRadius: '10px' }}>
                  <div style={{ minWidth: '120px', fontSize: '12px', fontWeight: 'bold', color: '#eab308' }}>{lunchStart} - Recess</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#fde047', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      🍱 Lunch Break & Rest ({lunchDuration} mins)
                    </div>
                    <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>Adjustable meal window for campus lunch and mental refresh.</div>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', background: 'rgba(234, 179, 8, 0.2)', color: '#fde047', padding: '2px 8px', borderRadius: '4px' }}>Meal Slot</span>
                </div>

                {/* Afternoon Self-Study & Practice Slot */}
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '12px 16px', borderRadius: '10px' }}>
                  <div style={{ minWidth: '120px', fontSize: '12px', fontWeight: 'bold', color: '#60a5fa' }}>02:00 PM - 05:00 PM</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'white' }}>📖 AI Simulation & Problem Solving</div>
                    <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>Deep study session focusing on Elementary Structural Design (ESD) & Hydrology simulations.</div>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '2px 8px', borderRadius: '4px' }}>Deep Work</span>
                </div>

                {/* Draggable Dinner Slot Visualizer */}
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', background: 'rgba(236, 72, 153, 0.12)', border: '1px dashed #ec4899', padding: '12px 16px', borderRadius: '10px' }}>
                  <div style={{ minWidth: '120px', fontSize: '12px', fontWeight: 'bold', color: '#ec4899' }}>{dinnerStart} - Dinner</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#f472b6', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      🍲 Dinner & Relaxation ({dinnerDuration} mins)
                    </div>
                    <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>Adjustable evening meal slot with family and friends.</div>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', background: 'rgba(236, 72, 153, 0.2)', color: '#f472b6', padding: '2px 8px', borderRadius: '4px' }}>Meal Slot</span>
                </div>

                {/* Evening Sleep Wind-down */}
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.2)', padding: '12px 16px', borderRadius: '10px' }}>
                  <div style={{ minWidth: '120px', fontSize: '12px', fontWeight: 'bold', color: '#a78bfa' }}>08:45 PM - {sleepTime} PM</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'white' }}>🌙 Evening Synthesis & Sleep Routine ({sleepTime})</div>
                    <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>Final daily recap, journal entry, screen-free wind-down, and sleep at {sleepTime}.</div>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', padding: '2px 8px', borderRadius: '4px' }}>Rest</span>
                </div>

              </div>
            </div>

            {/* Right Side: Day Occupancy Breakdown Card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                  <TrendingUp size={16} color="var(--accent-cyan)" /> {currentDayTimetable.dayName} Occupancy Stats
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>🏫 College Lectures & Labs:</span>
                    <strong style={{ color: '#06b6d4' }}>5.5 Hours</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>🍱 Meals & Breaks:</span>
                    <strong style={{ color: '#eab308' }}>1.5 Hours</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '8px 12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                    <span style={{ color: '#93c5fd' }}>⚡ Available Free Study Window:</span>
                    <strong style={{ color: '#60a5fa' }}>4.5 Hours</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '8px 12px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '6px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                    <span style={{ color: '#c084fc' }}>😴 Rest & Sleep (21:30 - 06:00):</span>
                    <strong style={{ color: '#c084fc' }}>8.5 Hours</strong>
                  </div>
                </div>

                <button
                  onClick={() => setPlannerView('ai_suggest')}
                  className="btn-primary"
                  style={{ width: '100%', marginTop: '10px', fontSize: '12px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <Sparkles size={14} /> Generate AI Study Plan For This Capacity
                </button>
              </div>

              {/* Course Units Summary */}
              <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: 'white', margin: 0 }}>📚 Active Semester Subjects</h4>
                {db.subjects.map(sub => (
                  <div key={sub.id} style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                    <span style={{ color: 'white', fontWeight: 'bold' }}>{sub.name}</span>
                    <span style={{ color: 'var(--accent-cyan)' }}>{sub.units.length} Units</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* VIEW MODE 2: 7-DAY WEEK GRID VISUALIZER */}
      {plannerView === 'week' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarDays size={18} color="var(--accent-cyan)" /> 5th Semester Weekly College & Study Matrix
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Click any day to view detailed timeline</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            {collegeTimetable.map((tDay, dIdx) => (
              <div 
                key={tDay.dayName}
                onClick={() => { setSelectedDayIndex(dIdx); setPlannerView('day'); }}
                style={{ 
                  background: selectedDayIndex === dIdx ? 'rgba(6, 182, 212, 0.08)' : 'rgba(15, 23, 42, 0.4)', 
                  border: selectedDayIndex === dIdx ? '1px solid var(--accent-cyan)' : '1px solid var(--border-glass)', 
                  borderRadius: '12px', 
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px', marginBottom: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: 'white', margin: 0 }}>{tDay.dayName}</h4>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{tDay.fullDate}</span>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', background: 'rgba(255,255,255,0.08)', color: 'var(--accent-cyan)', padding: '2px 8px', borderRadius: '4px' }}>
                    {tDay.slots.filter(s => s.type !== 'break').length} Sessions
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {tDay.slots.map((s, sIdx) => (
                    <div key={sIdx} style={{ fontSize: '10px', padding: '6px 8px', borderRadius: '6px', background: `${s.color}15`, border: `1px solid ${s.color}30`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'white', fontWeight: 'bold' }}>{s.code}</span>
                      <span style={{ color: s.color }}>{s.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW MODE 3: 30-DAY MONTH PLANNER */}
      {plannerView === 'month' && (
        <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px' }}>
          
          {/* AI Routine Generator Form */}
          <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
              <Compass size={16} color="var(--accent-cyan)" /> AI Prep Routine Generator
            </h3>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Target Exam Date:</label>
              <input 
                type="date" 
                value={examDate} 
                onChange={(e) => setExamDate(e.target.value)} 
                style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'white', fontSize: '12px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Confidence Level ({confidence}/10):
              </label>
              <input 
                type="range" 
                min={1} 
                max={10} 
                value={confidence} 
                onChange={(e) => setConfidence(parseInt(e.target.value, 10))} 
                style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Daily Target Study Hours: {targetStudyHours} hrs
              </label>
              <input 
                type="range" 
                min={1} 
                max={8} 
                step={0.5}
                value={targetStudyHours} 
                onChange={(e) => setTargetStudyHours(parseFloat(e.target.value))} 
                style={{ width: '100%', accentColor: '#a855f7' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Current Mindset / Feeling:</label>
              <select 
                value={userState} 
                onChange={(e) => setUserState(e.target.value)} 
                style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'white', fontSize: '12px' }}
              >
                <option value="Focused & Ready">Focused & Ready</option>
                <option value="Slightly Overwhelmed by ESD">Slightly Overwhelmed by ESD</option>
                <option value="Confused by Hydrology Formulas">Confused by Hydrology Formulas</option>
                <option value="Exam Anxiety / Stress">Exam Anxiety / Stress</option>
              </select>
            </div>

            <button
              onClick={handleGenerateRoutine}
              disabled={isLoadingPlan}
              className="btn-primary"
              style={{ width: '100%', marginTop: '6px', padding: '10px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {isLoadingPlan ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {isLoadingPlan ? 'Generating Routine...' : 'Generate AI Month Routine'}
            </button>
          </div>

          {/* AI Plan Output Display */}
          <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <CalendarIcon size={18} color="var(--accent-purple)" /> Monthly Study Horizon & Routine Roadmap
            </h3>

            {activePlan ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '8px', padding: '12px', fontSize: '12px', color: '#d8b4fe' }}>
                  <strong>AI Strategy Summary:</strong> {activePlan.routineSummary}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                  {activePlan.schedule.map((day) => (
                    <div key={day.dayNumber} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'white' }}>Day {day.dayNumber} - {day.dateString}</span>
                        <span style={{ fontSize: '10px', fontWeight: 'bold', color: day.priority === 'High' ? '#ef4444' : '#10b981', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>
                          {day.priority} Priority
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>{day.focus}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Duration: {day.durationMinutes} mins</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                Click "Generate AI Month Routine" on the left to synthesize a customized 30-day prep roadmap.
              </div>
            )}
          </div>

        </div>
      )}

      {/* VIEW MODE 4: CREATIVE FORMAT SUGGESTIONS */}
      {plannerView === 'ai_suggest' && (
        <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px' }}>
          
          {/* Format Compiler Inputs */}
          <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
              <Sparkles size={16} color="var(--accent-purple)" /> Creative Format Compiler
            </h3>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Target Subject:</label>
              <select 
                value={selectedSubjectId} 
                onChange={(e) => setSelectedSubjectId(e.target.value)} 
                style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'white', fontSize: '12px' }}
              >
                {db.subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Format Type:</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { id: 'podcast', label: '🎧 Audio Podcast' },
                  { id: 'socratic', label: '🏛️ Socratic Debate' },
                  { id: 'storyboard', label: '🖼️ Storyboard' },
                  { id: 'fea_challenge', label: '🏗️ FEA Lab Challenge' }
                ].map(fmt => (
                  <button
                    key={fmt.id}
                    onClick={() => setActiveFormat(fmt.id)}
                    style={{
                      padding: '8px',
                      borderRadius: '6px',
                      border: activeFormat === fmt.id ? '1px solid var(--accent-purple)' : '1px solid var(--border-glass)',
                      background: activeFormat === fmt.id ? 'rgba(168, 85, 247, 0.15)' : 'rgba(0,0,0,0.3)',
                      color: activeFormat === fmt.id ? '#c084fc' : 'var(--text-secondary)',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => handleCompileSuggestion(db.subjects.find(s => s.id === selectedSubjectId)?.name || 'Elementary Structural Design', activeFormat)}
              disabled={isLoadingSuggestion}
              className="btn-primary"
              style={{ width: '100%', marginTop: '6px', padding: '10px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {isLoadingSuggestion ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {isLoadingSuggestion ? 'Compiling Blueprint...' : 'Synthesize Format Script'}
            </button>
          </div>

          {/* Format Script Preview */}
          <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <BookOpen size={18} color="var(--accent-cyan)" /> Synthesized Learning Script Blueprint
              </h3>
              {suggestionText && (
                <button 
                  onClick={() => speakText(suggestionText)}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Volume2 size={14} color="#60a5fa" /> Read Aloud
                </button>
              )}
            </div>

            {suggestionText ? (
              <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '16px', fontSize: '12px', lineHeight: '1.6', color: '#e2e8f0', whiteSpace: 'pre-wrap', maxHeight: '500px', overflowY: 'auto' }}>
                {suggestionText}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                Select a target subject and format on the left to synthesize a podcast script or interactive challenge.
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};
