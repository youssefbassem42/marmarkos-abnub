/**
 * Bible module types
 *
 * Manages weekly Bible verses: creation, scheduling, publishing,
 * and the member-facing reading experience.
 */

export type VerseStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";

export type ScheduleStatus = "SCHEDULED" | "PUBLISHED" | "CANCELLED" | "FAILED";

export interface CreatorBrief {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface VerseScheduleBrief {
  id: string;
  verse_id: string;
  status: ScheduleStatus;
  scheduled_at: string;
}

export interface QuizSummary {
  quiz_id: string;
  status: string;
  question_count: number;
  total_points: number;
  duration_seconds: number;
}

export interface VerseAdminItem {
  id: string;
  title: string;
  subtitle: string | null;
  verse_reference: string;
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number | null;
  status: VerseStatus;
  published_at: string | null;
  week_start_date: string | null;
  created_by_user: CreatorBrief | null;
  created_at: string;
}

export interface VerseCard {
  id: string;
  title: string;
  subtitle: string | null;
  verse_reference: string;
  book: string;
  chapter: number;
  verse_start: number;
  reflection: string;
  image: string | null;
  published_at: string;
  week_start_date: string | null;
  opens: number;
  read: boolean;
  has_quiz: boolean;
}

export interface VerseDetailResponse extends VerseAdminItem {
  text: string;
  reflection: string;
  image: string | null;
  translation: string;
  opens: number;
  read: boolean;
  has_quiz: boolean;
  quiz_summary: QuizSummary | null;
  schedule: VerseScheduleBrief | null;
}

export interface VerseStatsResponse {
  total: number;
  drafts: number;
  scheduled: number;
  published: number;
  archived: number;
}

export interface VerseQuickStats {
  this_week: number;
  this_month: number;
  avg_reads: number;
  top_verse_reference: string | null;
  top_verse_opens: number | null;
}

export interface VerseAnalyticsOverview {
  total_posts: number;
  published: number;
  total_opens: number;
  total_reads: number;
  read_rate: number;
}

export interface EngagementSeriesPoint {
  bucket: string;
  opens: number;
  reads: number;
}

export interface RelatedQuizSummary {
  quiz_id: string;
  participants: number;
  average_score_out_of_10: number;
}

export interface VerseAnalyticsDetail {
  verse_id: string;
  title: string;
  verse_reference: string;
  total_opens: number;
  unique_opens: number;
  total_reads: number;
  unique_readers: number;
  read_rate: number;
  series: EngagementSeriesPoint[];
  quiz: RelatedQuizSummary | null;
}

export interface VerseUserEngagementItem {
  user_id: string;
  full_name: string;
  avatar: string | null;
  opened_count: number;
  has_read: boolean;
  last_opened_at: string | null;
}

export interface BibleVersesListParams {
  status?: VerseStatus;
  q?: string;
  created_by?: string;
  date_from?: string;
  date_to?: string;
  has_quiz?: boolean;
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
  size?: number;
}

export interface PublishedVersesParams {
  q?: string;
  read?: string;
  has_quiz?: boolean;
  page?: number;
  size?: number;
}

export interface CreateVersePayload {
  title: string;
  subtitle?: string;
  verse_reference: string;
  book: string;
  chapter: number;
  verse_start: number;
  verse_end?: number;
  text: string;
  reflection: string;
  image?: string;
  translation: string;
}

export interface UpdateVersePayload {
  title?: string;
  subtitle?: string;
  verse_reference?: string;
  book?: string;
  chapter?: number;
  verse_start?: number;
  verse_end?: number;
  text?: string;
  reflection?: string;
  image?: string;
  translation?: string;
}

export interface SchedulePayload {
  scheduled_at: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}
