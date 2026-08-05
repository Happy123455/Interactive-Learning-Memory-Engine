import React, { useState, useEffect } from 'react';
import type { Database, FsrsItem } from '../types';
import { Calendar as CalendarIcon, Clock, Compass, BookOpen, Volume2, HelpCircle, Loader, CheckCircle, TrendingUp, Sparkles, Smile, RefreshCw } from 'lucide-react';

interface PrepPlannerProps {
  db: Database;
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
  // Inputs
  const [examDate, setExamDate] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(5);
  const [studyHours, setStudyHours] = useState<number>(3);
  const [userState, setUserState] = useState<string>('');

  // Plans & Suggestion States
  const [activePlan, setActivePlan] = useState<StudyPlan | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<string>('');
  const [activeFormat, setActiveFormat] = useState<string>('podcast');
  const [suggestionText, setSuggestionText] = useState<string>('');
  
  // Loading flags
  const [isLoadingPlan, setIsLoadingPlan] = useState<boolean>(false);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState<boolean>(false);

  // Initialize and load saved plan
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
        body: JSON.stringify({ examDate, confidence, studyHours, userState })
      });
      if (res.ok) {
        const data = await res.json();
        setActivePlan(data);
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

  // Compile difficulty assessment for concepts
  const getConceptDifficultyDetails = () => {
    const fsrsItems = db.fsrsItems || [];
    const conceptsMap: Record<string, { totalRating: number; count: number; stability: number }> = {};
    
    fsrsItems.forEach(item => {
      if (!item.concept) return;
      if (!conceptsMap[item.concept]) {
        conceptsMap[item.concept] = { totalRating: 0, count: 0, stability: 999 };
      }
      conceptsMap[item.concept].totalRating += item.difficultyRating || 5;
      conceptsMap[item.concept].count += 1;
      if (item.stability && item.stability < conceptsMap[item.concept].stability) {
        conceptsMap[item.concept].stability = item.stability;
      }
    });

    return Object.keys(conceptsMap).map(name => {
      const details = conceptsMap[name];
      const avgRating = details.totalRating / details.count;
      // Define difficulty: rating < 5 is hard, rating >= 7 is easy
      let difficulty: 'Hard' | 'Medium' | 'Easy' = 'Medium';
      let color = 'var(--accent-yellow)';
      if (avgRating < 4.5 || details.stability < 2.0) {
        difficulty = 'Hard';
        color = '#ef4444';
      } else if (avgRating >= 7.0) {
        difficulty = 'Easy';
        color = '#10b981';
      }
      return {
        name,
        avgRating,
        count: details.count,
        stability: details.stability === 999 ? 1.0 : details.stability,
        difficulty,
        color
      };
    });
  };

  const conceptDetails = getConceptDifficultyDetails();

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto' }}>
      
      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
          🧠 SynapseLab AI Prep Planner & Suggestion Engine
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
          Intelligent study routines and creative formats suggestions based on your syllabus, feelings, and FSRS history logs.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px' }}>
        
        {/* Left Column: Input Panel & FSRS Difficulty Assessment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Prep Plan Input Form */}
          <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
              <Compass size={16} color="var(--accent-cyan)" /> Study Parameters
            </h3>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Target Exam Date / Horizon:</label>
              <input 
                type="text" 
                placeholder="e.g. Midsem August 12" 
                value={examDate} 
                onChange={(e) => setExamDate(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '8px 10px', fontSize: '12px', color: 'white' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Current Confidence Level ({confidence}/10):</label>
              <input 
                type="range" 
                min="1" 
                max="10" 
                value={confidence} 
                onChange={(e) => setConfidence(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
                <span>Struggling (1)</span>
                <span>Mastered (10)</span>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Daily Allocation ({studyHours} hours):</label>
              <input 
                type="range" 
                min="1" 
                max="8" 
                value={studyHours} 
                onChange={(e) => setStudyHours(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Current Preparation Status & Feelings:</label>
              <textarea 
                placeholder="Share details (e.g. Stressed about bolted connection calculations, finished Unit 1, 5 days left...)" 
                value={userState} 
                onChange={(e) => setUserState(e.target.value)}
                rows={3}
                style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '8px 10px', fontSize: '12px', color: 'white', resize: 'vertical' }}
              />
            </div>

            <button
              onClick={handleGenerateRoutine}
              disabled={isLoadingPlan}
              className="btn-primary"
              style={{ padding: '10px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '6px' }}
            >
              {isLoadingPlan ? (
                <><Loader size={14} className="animate-spin" /> Aligning Study Plan...</>
              ) : (
                <><Sparkles size={14} /> Build Adaptive Routine</>
              )}
            </button>
          </div>

          {/* FSRS Subject/Concept Difficulty Analyzer */}
          <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
              <TrendingUp size={16} color="var(--accent-yellow)" /> FSRS Concept Assessment
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
              {conceptDetails.map((c, i) => (
                <div key={i} style={{ padding: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'white', fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '180px' }} title={c.name}>
                      {c.name}
                    </span>
                    <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.05)', color: c.color, border: `1px solid ${c.color}`, padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                      {c.difficulty}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)' }}>
                    <span>Stability: {c.stability.toFixed(1)}d</span>
                    <span>Reviews: {c.count}</span>
                  </div>
                </div>
              ))}

              {conceptDetails.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                  No FSRS logs recorded. Review flashcards to populate concept data!
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Routine Calendar & Creative Suggestion Board */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Calendar Routine Plan View */}
          {activePlan ? (
            <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '14px' }}>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: 'white', margin: 0 }}>
                    📅 Your Personalized Day-by-Day Prep Plan
                  </h2>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Recommended study focus: <strong>{activePlan.recommendedHoursPerDay} hrs/day</strong>.
                  </p>
                </div>
                <button 
                  onClick={() => speakText(`Routine summary: ${activePlan.routineSummary}. Advice for anxiety: ${activePlan.anxietyAdvice}`)}
                  style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '6px', color: '#38bdf8', padding: '6px 12px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Volume2 size={12} /> Read Summary
                </button>
              </div>

              {/* Stress / Anxiety Advice Block */}
              <div style={{ padding: '12px 16px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10px', color: 'var(--accent-cyan)', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>COGNITIVE NUDGE:</span>
                <p style={{ fontSize: '12px', color: 'white', margin: 0, lineHeight: '1.4' }}>{activePlan.anxietyAdvice}</p>
              </div>

              {/* Day-by-day roadmap */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
                {activePlan.schedule.map((day, index) => (
                  <div key={index} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>Day {day.dayNumber} ({day.dateString})</span>
                      <span style={{
                        fontSize: '9px',
                        background: day.priority === 'High' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                        color: day.priority === 'High' ? '#ef4444' : '#38bdf8',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        fontWeight: 'bold'
                      }}>{day.priority}</span>
                    </div>

                    <div style={{ fontSize: '12px', color: 'white', fontWeight: 'bold' }}>
                      {day.topics.join(', ')}
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4', flexGrow: 1 }}>
                      {day.focus}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-muted)', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                      <Clock size={10} /> {day.durationMinutes} mins allocated
                    </div>
                  </div>
                ))}
              </div>

            </div>
          ) : (
            <div style={{ background: 'rgba(15, 23, 42, 0.2)', border: '1px dashed var(--border-glass)', borderRadius: '12px', padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <HelpCircle size={48} color="var(--text-secondary)" />
              <h3 style={{ color: 'white', fontSize: '15px', fontWeight: 'bold', margin: 0 }}>No Routine Active</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', maxWidth: '380px', margin: 0, lineHeight: '1.4' }}>
                Fill out the study parameters on the left and click **Build Adaptive Routine** to generate a customized exam preparation roadmap.
              </p>
            </div>
          )}

          {/* Creative Study Formats Suggestions Board */}
          <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: 'white', margin: 0 }}>
                💡 Creative Learning Suggestion Engine
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Select a concept and generate creative materials (podcasts, simulation blueprints, or NotebookLM guides) to boost active recall.
              </p>
            </div>

            {/* Selector Grid for registered concepts */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {conceptDetails.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedConcept(c.name)}
                  style={{
                    background: selectedConcept === c.name ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.02)',
                    border: selectedConcept === c.name ? '1px solid #38bdf8' : '1px solid var(--border-glass)',
                    borderRadius: '6px',
                    color: selectedConcept === c.name ? 'white' : 'var(--text-secondary)',
                    padding: '6px 12px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    transition: 'all 0.2s'
                  }}
                >
                  {c.name}
                </button>
              ))}

              {conceptDetails.length === 0 && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No concepts identified in FSRS deck yet. Flashcards must be created first.
                </div>
              )}
            </div>

            {selectedConcept && (
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Generate media blueprint for: <strong style={{ color: 'white' }}>{selectedConcept}</strong>
                </span>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    onClick={() => handleCompileSuggestion(selectedConcept, 'podcast')}
                    className="btn-secondary" 
                    style={{ flex: 1, fontSize: '11px', padding: '8px' }}
                  >
                    🎙️ Audio Podcast
                  </button>
                  <button 
                    onClick={() => handleCompileSuggestion(selectedConcept, 'simulation')}
                    className="btn-secondary" 
                    style={{ flex: 1, fontSize: '11px', padding: '8px' }}
                  >
                    🎬 Cinematic Sim
                  </button>
                  <button 
                    onClick={() => handleCompileSuggestion(selectedConcept, 'explainer')}
                    className="btn-secondary" 
                    style={{ flex: 1, fontSize: '11px', padding: '8px' }}
                  >
                    🧠 Explainer Video
                  </button>
                  <button 
                    onClick={() => handleCompileSuggestion(selectedConcept, 'infographic')}
                    className="btn-secondary" 
                    style={{ flex: 1, fontSize: '11px', padding: '8px' }}
                  >
                    📊 Infographic
                  </button>
                  <button 
                    onClick={() => handleCompileSuggestion(selectedConcept, 'notebooklm')}
                    className="btn-secondary" 
                    style={{ flex: 1, fontSize: '11px', padding: '8px' }}
                  >
                    📓 NotebookLM Source
                  </button>
                </div>
              </div>
            )}

            {/* Generated Suggestion Modal/Panel */}
            {isLoadingSuggestion && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '10px', color: 'var(--accent-cyan)' }}>
                <Loader className="animate-spin" size={20} />
                <span style={{ fontSize: '12px' }}>Compiling creative pedagogical assets script...</span>
              </div>
            )}

            {suggestionText && !isLoadingSuggestion && (
              <div style={{ background: '#05060b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: 'bold', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                    ✨ Generated {activeFormat} blueprint
                  </span>
                  <button 
                    onClick={() => speakText(suggestionText)}
                    style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '6px', color: '#38bdf8', padding: '4px 8px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Volume2 size={10} /> Listen Script
                  </button>
                </div>

                <div style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.01)',
                  borderRadius: '6px',
                  fontFamily: 'var(--font-mono)',
                  border: '1px solid rgba(255,255,255,0.03)'
                }}>
                  {suggestionText}
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
};
