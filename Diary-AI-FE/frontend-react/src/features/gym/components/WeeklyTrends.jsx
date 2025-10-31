import React from 'react';
import WeeklyTrends from 'shared/widgets/WeeklyTrends';
import { strengthAPI } from 'features/strength/api';

export default function WeeklyTrendsGym(){
  const [rows, setRows] = React.useState([]);
  React.useEffect(() => {
    (async () => {
      try{
        const res = await strengthAPI.workoutsOverview?.({ weeks: 12 });
        const weekly = res?.weekly || [];
        setRows(weekly.map(w => ({ week: w.week, total_tonnage: w.total_tonnage ?? null, workouts: w.workouts ?? w.count ?? 0 })));
      }catch(e){ setRows([]); }
    })();
  },[]);

  const columns = [
    { key: 'total_tonnage', label: 'Tonnage' },
    { key: 'workouts', label: 'Workouts' },
  ];
  return <WeeklyTrends title="Gym Weekly" rows={rows} columns={columns} />;
}
