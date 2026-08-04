export interface StyleRatingRecord {
  id: string;
  styleKey: string;
  rating: number;
  targetId: string;
  timestamp: string;
}

export interface QuestionVariant {
  id: string;
  name: string;
  file: string;
}

export interface QuestionStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  concept: string;
  status: 'pending' | 'generating' | 'ready' | 'failed';
  simulationFile?: string;
  generationDuration?: number;
  variants?: QuestionVariant[];
  activeVariantId?: string;
}

export interface Question {
  id: string;
  text: string;
  difficulty: number; // 1.0 to 10.0
  concept: string;
  status: 'pending' | 'generating' | 'ready' | 'failed';
  simulationFile: string;
  variants?: QuestionVariant[];
  activeVariantId?: string;
  generationDuration?: number;
  comments?: string; // Query comments field
  styleProfileUsed?: string;
  styleRating?: number;

  // Detailed Step-by-Step Exam Calculation Mode
  hasSteps?: boolean;
  activeStepId?: string; // ID of active step, or 'overview'
  steps?: QuestionStep[];
  fsrs?: FsrsItem;
  geminiLink?: string;
  guidedLog?: any[];
  isGuidedStarted?: boolean;
}

export interface Assignment {
  id: string;
  name: string;
  questions: Question[];
}

export interface TopicFlashcard {
  id: string;
  type: 'formula' | 'definition' | 'exam_qna' | 'flagged_rule';
  questionOrConcept: string;
  answerOrDetails: string;
  importance: number; // 1 to 10
}

export interface UnitTopic {
  id: string;
  title: string;
  concept: string;
  description: string;
  importanceScore: number; // 1.0 to 10.0 scale (user editable)
  difficulty: number; // 1.0 to 10.0 scale
  status: 'pending' | 'generating' | 'ready' | 'failed';
  simulationFile?: string;
  variants?: QuestionVariant[];
  activeVariantId?: string;
  generationDuration?: number;

  // Flashcards / Info Cards per Topic Branch
  flashcards?: TopicFlashcard[];

  // Detailed Multi-Step Breakdown for Unit Topics
  hasSteps?: boolean;
  activeStepId?: string;
  steps?: QuestionStep[];
  comments?: string; // Query comments field
  styleProfileUsed?: string;
  styleRating?: number;
}

export interface Unit {
  id: string;
  number: number;
  name: string;
  assignments: Assignment[];
  topics?: UnitTopic[];
  wordCount?: number;
  sourceFiles?: string[];
}

export interface Subject {
  id: string;
  name: string;
  units: Unit[];
}

export interface FsrsMCQ {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  targetedConcept: string;
}

export interface FsrsItem {
  id: string;
  queryText: string;
  concept: string;
  sourceType: 'question' | 'topic' | 'custom' | 'mcq';
  sourceId: string;
  subjectId: string;
  unitId: string;
  assignmentId?: string;
  createdAt: string;
  reviewCount: number;
  difficultyRating: number; // 1 to 10 rating given by user or quiz
  nextReviewDate: string;   // ISO String
  intervalDays: number;
  simulationFile?: string;
  status: 'pending' | 'generating' | 'ready' | 'failed';
  variants?: QuestionVariant[];
  activeVariantId?: string;
  stability?: number;
  difficulty?: number;
  styleProfileUsed?: string;
  styleRating?: number;
  mcqs?: FsrsMCQ[];
  lastQuizScore?: number;
  weakConcepts?: string[];
  mcqQuestion?: string;
  mcqOptions?: string[];
  mcqCorrectIndex?: number;
  mcqExplanation?: string;
}

export interface FeaturePreference {
  id: string;
  name: string;
  description: string;
  promptDirective: string;
  category: 'interaction' | 'visualization' | 'audio' | 'pedagogy';
  defaultChecked?: boolean;
}

export interface FeatureRatingRecord {
  id: string;
  featureId: string;
  featureName: string;
  rating: number; // 1 to 10 stars
  timestamp: string;
  comment?: string;
}

export interface CustomStyleProfile {
  id: string;
  name: string;
  description: string;
  enabledFeatureIds: string[];
  customPrompts: string[];
}

export interface Database {
  subjects: Subject[];
  fsrsItems?: FsrsItem[];
  styleRatings?: StyleRatingRecord[];
  featureRatings?: FeatureRatingRecord[];
  customStyles?: CustomStyleProfile[];
}

export interface Settings {
  apiKey: string;
  apiKeyConfigured: boolean;
  optimizerModel: string;
  generatorModel: string;
  promptBlueprintSystem?: string;
  promptCodeSystem?: string;
  styleProfile?: string;
  selectedFeatureIds?: string[];
  customFeaturePrompts?: string[];
}

export type ActiveTab = 'dashboard' | 'mindmap' | 'structural' | 'fsrs';
