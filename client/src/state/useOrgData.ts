// Loads and caches per-org reference data (statuses, departments, custom fields, members).
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.ts';
import { useApp } from './AppState.tsx';
import type { CustomField, Department, Member, Status } from '../api/types.ts';

export function useOrgData() {
  const { currentOrg } = useApp();
  const orgId = currentOrg?.id;
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [s, d, c] = await Promise.all([
        api.get<Status[]>(`/orgs/${orgId}/statuses`),
        api.get<Department[]>(`/orgs/${orgId}/departments`),
        api.get<CustomField[]>(`/orgs/${orgId}/custom-fields`),
      ]);
      setStatuses(s);
      setDepartments(d);
      setCustomFields(c);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { orgId, statuses, departments, customFields, loading, reload };
}

export function useMembers(includeArchived = false) {
  const { currentOrg } = useApp();
  const orgId = currentOrg?.id;
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const m = await api.get<Member[]>(
        `/orgs/${orgId}/members${includeArchived ? '?includeArchived=1' : ''}`,
      );
      setMembers(m);
    } finally {
      setLoading(false);
    }
  }, [orgId, includeArchived]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { members, loading, reload };
}
