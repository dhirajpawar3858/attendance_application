// All org-scoped resources, mounted under /api/orgs/:orgId/*
import { Router } from 'express';
import { wrap } from '../middleware/error.ts';
import { requireAuth } from '../middleware/auth.ts';
import * as member from '../services/member.ts';
import * as department from '../services/department.ts';
import * as customField from '../services/customField.ts';
import * as status from '../services/status.ts';
import * as attendance from '../services/attendance.ts';
import * as holiday from '../services/holiday.ts';
import * as preset from '../services/filterPreset.ts';
import * as report from '../services/report.ts';
import { listAudit } from '../services/audit.ts';
import { resolvePreset, type FilterConfig } from '../domain/filters.ts';

const router = Router({ mergeParams: true });
router.use(requireAuth);

// helper to read orgId + user
const ctx = (req: any) => ({ uid: req.user.id as number, orgId: Number(req.params.orgId) });

// build a FilterConfig from query params
function filterFromQuery(req: any): FilterConfig {
  const q = req.query;
  const orgId = Number(req.params.orgId);
  const arr = (v: any): any[] | undefined => {
    if (v == null || v === '') return undefined;
    return String(v).split(',').filter(Boolean);
  };
  const numArr = (v: any) => arr(v)?.map(Number);

  let dateFrom = q.dateFrom as string | undefined;
  let dateTo = q.dateTo as string | undefined;
  if (q.preset && q.today) {
    const r = resolvePreset(String(q.preset), String(q.today));
    if (r) {
      dateFrom = r.from;
      dateTo = r.to;
    }
  }

  let customFields: Array<{ fieldId: number; value: string }> | undefined;
  if (q.cf) {
    try {
      customFields = JSON.parse(String(q.cf));
    } catch {
      customFields = undefined;
    }
  }

  return {
    orgId,
    dateFrom,
    dateTo,
    statusIds: numArr(q.statusIds),
    memberIds: numArr(q.memberIds),
    departmentIds: numArr(q.departmentIds),
    roles: arr(q.roles) as string[] | undefined,
    search: q.search ? String(q.search) : undefined,
    customFields,
    sortBy: q.sortBy as any,
    sortDir: q.sortDir as any,
  };
}

// -------------------------- members --------------------------
router.get('/members', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  res.json(
    member.listMembers(uid, orgId, {
      includeArchived: req.query.includeArchived === '1',
      search: req.query.search as string,
      departmentId: req.query.departmentId ? Number(req.query.departmentId) : undefined,
    }),
  );
}));
router.get('/members/roles', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  res.json(member.listRoles(uid, orgId));
}));
router.get('/members/export', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  const csv = member.exportMembersCSV(uid, orgId);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="members.csv"');
  res.send(csv);
}));
router.post('/members/import', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  res.json(member.importMembersCSV(uid, orgId, req.body.csv));
}));
router.get('/members/:id', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  res.json(member.getMember(uid, orgId, Number(req.params.id)));
}));
router.post('/members', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  res.json(member.createMember(uid, orgId, req.body));
}));
router.put('/members/:id', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  res.json(member.updateMember(uid, orgId, Number(req.params.id), req.body));
}));
router.post('/members/:id/archive', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  res.json(member.setArchived(uid, orgId, Number(req.params.id), req.body.archived !== false));
}));
router.post('/members/:id/active', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  res.json(member.setActive(uid, orgId, Number(req.params.id), req.body.active !== false));
}));

// -------------------------- departments --------------------------
router.get('/departments', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  res.json(department.listDepartments(uid, orgId));
}));
router.post('/departments', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  res.json(department.createDepartment(uid, orgId, req.body.name));
}));
router.put('/departments/:id', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  res.json(department.updateDepartment(uid, orgId, Number(req.params.id), req.body.name));
}));
router.delete('/departments/:id', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  department.deleteDepartment(uid, orgId, Number(req.params.id));
  res.json({ ok: true });
}));

// -------------------------- custom fields --------------------------
router.get('/custom-fields', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  res.json(customField.listCustomFields(uid, orgId, (req.query.entity as string) || 'member'));
}));
router.post('/custom-fields', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  res.json(customField.createCustomField(uid, orgId, req.body));
}));
router.put('/custom-fields/:id', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  res.json(customField.updateCustomField(uid, orgId, Number(req.params.id), req.body));
}));
router.delete('/custom-fields/:id', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  customField.deleteCustomField(uid, orgId, Number(req.params.id));
  res.json({ ok: true });
}));

// -------------------------- statuses --------------------------
router.get('/statuses', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  res.json(status.listStatuses(uid, orgId));
}));
router.post('/statuses', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  res.json(status.createStatus(uid, orgId, req.body));
}));
router.put('/statuses/:id', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  res.json(status.updateStatus(uid, orgId, Number(req.params.id), req.body));
}));
router.delete('/statuses/:id', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  status.deleteStatus(uid, orgId, Number(req.params.id));
  res.json({ ok: true });
}));

// -------------------------- attendance --------------------------
router.get('/attendance', wrap((req, res) => {
  const { uid } = ctx(req);
  res.json(attendance.queryAttendance(uid, filterFromQuery(req)));
}));
router.get('/attendance/roster', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  res.json(
    attendance.roster(uid, orgId, String(req.query.from), String(req.query.to), {
      departmentId: req.query.departmentId ? Number(req.query.departmentId) : undefined,
      search: req.query.search as string,
    }),
  );
}));
router.get('/attendance/member/:memberId', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  res.json(
    attendance.memberHistory(
      uid,
      orgId,
      Number(req.params.memberId),
      req.query.from as string,
      req.query.to as string,
    ),
  );
}));
router.post('/attendance', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  res.json(attendance.markAttendance(uid, orgId, req.body));
}));
router.post('/attendance/bulk', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  res.json(attendance.markBulk(uid, orgId, req.body.entries || []));
}));
router.post('/attendance/copy-day', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  res.json(attendance.copyPreviousDay(uid, orgId, req.body.targetDate, req.body.sourceDate));
}));
router.delete('/attendance/:id', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  attendance.deleteAttendance(uid, orgId, Number(req.params.id));
  res.json({ ok: true });
}));

// -------------------------- holidays --------------------------
router.get('/holidays', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  res.json(holiday.listHolidays(uid, orgId, req.query.year ? Number(req.query.year) : undefined));
}));
router.post('/holidays', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  res.json(holiday.createHoliday(uid, orgId, req.body));
}));
router.delete('/holidays/:id', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  holiday.deleteHoliday(uid, orgId, Number(req.params.id));
  res.json({ ok: true });
}));

// -------------------------- filter presets --------------------------
router.get('/presets', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  res.json(preset.listPresets(uid, orgId));
}));
router.post('/presets', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  res.json(preset.createPreset(uid, orgId, req.body.name, req.body.config));
}));
router.delete('/presets/:id', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  preset.deletePreset(uid, orgId, Number(req.params.id));
  res.json({ ok: true });
}));

// -------------------------- reports / dashboard --------------------------
router.get('/dashboard', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  const today = String(req.query.today);
  const from = String(req.query.from || today);
  const to = String(req.query.to || today);
  res.json(report.dashboard(uid, orgId, today, from, to));
}));
router.get('/reports/members', wrap((req, res) => {
  const { uid } = ctx(req);
  res.json(report.memberReport(uid, filterFromQuery(req)));
}));
router.get('/reports/members/export', wrap((req, res) => {
  const { uid } = ctx(req);
  const csv = report.memberReportCSV(uid, filterFromQuery(req));
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="member-report.csv"');
  res.send(csv);
}));
router.get('/reports/detail/export', wrap((req, res) => {
  const { uid } = ctx(req);
  const csv = report.detailCSV(uid, filterFromQuery(req));
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="attendance-detail.csv"');
  res.send(csv);
}));

// -------------------------- audit log --------------------------
router.get('/audit', wrap((req, res) => {
  const { uid, orgId } = ctx(req);
  // require membership via any service call; listAudit is org-scoped
  department.listDepartments(uid, orgId); // throws if not a member
  res.json(
    listAudit(
      orgId,
      req.query.entity as string,
      req.query.entityId ? Number(req.query.entityId) : undefined,
    ),
  );
}));

export default router;
