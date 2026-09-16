export interface User {
  id: number;
  name: string;
  username: string;
  role: string;
  avatar?: string | null;
  contact?: string | null;
  settings: UserSettings;
}

export interface UserSettings {
  theme?: string;
  mode?: 'light' | 'dark';
  dateFormat?: string;
  firstDayOfWeek?: number;
  lastFilters?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface Org {
  id: number;
  name: string;
  logo?: string | null;
  address?: string | null;
  contact?: string | null;
  timezone: string;
  working_days: string;
  work_hours_start: string;
  work_hours_end: string;
  archived: number;
  my_role?: string;
}

export interface Department {
  id: number;
  org_id: number;
  name: string;
  member_count?: number;
}

export interface CustomField {
  id: number;
  org_id: number;
  entity: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select';
  options: string[];
  options_json?: string | null;
  sort: number;
}

export interface Member {
  id: number;
  org_id: number;
  name: string;
  member_code?: string | null;
  avatar?: string | null;
  role?: string | null;
  department_id?: number | null;
  department_name?: string | null;
  phone?: string | null;
  email?: string | null;
  join_date?: string | null;
  active: number;
  archived: number;
  notes?: string | null;
  customValues?: Record<string, string>;
}

export interface Status {
  id: number;
  org_id: number;
  name: string;
  code: string;
  color: string;
  is_default: number;
  counts_present: number;
  sort: number;
}

export interface Attendance {
  id: number;
  org_id: number;
  member_id: number;
  date: string;
  status_id: number;
  check_in?: string | null;
  check_out?: string | null;
  hours?: number | null;
  location?: string | null;
  note?: string | null;
  member_name?: string;
  status_name?: string;
  status_code?: string;
  status_color?: string;
  department_name?: string;
}

export interface RosterCell {
  member_id: number;
  date: string;
  status_id: number;
  status_code?: string;
  status_color?: string;
  status_name?: string;
  check_in?: string | null;
  check_out?: string | null;
  hours?: number | null;
  note?: string | null;
  location?: string | null;
}

export interface Roster {
  dates: string[];
  members: Array<{ id: number; name: string; member_code?: string; department_id?: number }>;
  grid: Array<{ member: any; cells: Record<string, RosterCell | null> }>;
}

export interface Holiday {
  id: number;
  org_id: number;
  date: string;
  name: string;
  recurring: number;
}

export interface FilterPreset {
  id: number;
  name: string;
  config: FilterState;
}

export interface FilterState {
  preset?: string;
  dateFrom?: string;
  dateTo?: string;
  statusIds?: number[];
  memberIds?: number[];
  departmentIds?: number[];
  roles?: string[];
  search?: string;
  customFields?: Array<{ fieldId: number; value: string }>;
  sortBy?: 'date' | 'name' | 'status' | 'hours' | 'department';
  sortDir?: 'asc' | 'desc';
}

export interface DashboardData {
  cards: {
    totalMembers: number;
    presentToday: number;
    absentToday: number;
    lateToday: number;
    onLeaveToday: number;
    marketToday: number;
    rangeRatePct: number;
    todayRatePct: number;
  };
  spark: Record<string, number[]>; // keys: present, absent, late, onLeave, marked, rate
  delta: Record<string, number>; // week-over-week change per metric
  byStatusToday: Record<string, number>;
  statusDist: Array<{ name: string; color: string; count: number }>;
  byDepartment: Array<{ name: string; total: number; present: number; ratePct: number }>;
  trend: Array<{ date: string; present: number; total: number; ratePct: number }>;
}

export interface MemberReportRow {
  member_id: number;
  name: string;
  member_code: string;
  department_name: string;
  total: number;
  present: number;
  ratePct: number;
  hours: number;
  byStatus: Record<number, number>;
}

export interface AuditEntry {
  id: number;
  user_name?: string;
  entity: string;
  entity_id: number;
  action: string;
  before_json?: string;
  after_json?: string;
  created_at: string;
}
