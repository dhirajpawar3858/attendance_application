import { useState } from 'react';
import { useOrgData } from '../state/useOrgData.ts';
import { Loading } from '../components/ui.tsx';
import { Icon } from '../components/Icon.tsx';
import RosterView from './attendance/RosterView.tsx';
import DailyView from './attendance/DailyView.tsx';
import MemberView from './attendance/MemberView.tsx';

type Tab = 'roster' | 'daily' | 'member';

export default function Attendance() {
  const { statuses, departments, loading } = useOrgData();
  const [tab, setTab] = useState<Tab>('roster');

  if (loading) return <Loading />;

  return (
    <div>
      <div className="row between mb-16 wrap gap-12">
        <h1 className="page-title">Attendance</h1>
      </div>

      <div className="tabs">
        <div className={`tab row gap-6 ${tab === 'roster' ? 'active' : ''}`} onClick={() => setTab('roster')}>
          <Icon name="grid" size={15} /> Roster grid
        </div>
        <div className={`tab row gap-6 ${tab === 'daily' ? 'active' : ''}`} onClick={() => setTab('daily')}>
          <Icon name="sun" size={15} /> Daily
        </div>
        <div className={`tab row gap-6 ${tab === 'member' ? 'active' : ''}`} onClick={() => setTab('member')}>
          <Icon name="user" size={15} /> Per-member
        </div>
      </div>

      {tab === 'roster' && <RosterView statuses={statuses} departments={departments} />}
      {tab === 'daily' && <DailyView statuses={statuses} />}
      {tab === 'member' && <MemberView statuses={statuses} />}
    </div>
  );
}
