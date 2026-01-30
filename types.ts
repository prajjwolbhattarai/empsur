
export type Language = 'de' | 'en';

export enum QuestionType {
  SATISFACTION_SCALE = 'SATISFACTION_SCALE', // 1-5
  PERFORMANCE_RATING = 'PERFORMANCE_RATING', // 1-10
  TEXT_FEEDBACK = 'TEXT_FEEDBACK'
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  hidden?: boolean;
  isRecurring: boolean;
  activeYears: string[];
  activeMonths: string[];
}

export interface Answer {
  questionId: string;
  value: string | number;
}

export interface SurveyResponse {
  id: string;
  employeeEmail: string;
  department: string;
  month: string;
  year: string;
  timestamp: string;
  answers: Answer[];
}
