# USAGE PATTERNS

Actionable workflows & daily routines leveraging the platform.

## Daily Routine (5 min)
```bash
# 1. Refresh raw recent data (optional)
python -m garmindb.garmindb_cli --all --download --import --analyze --latest
# 2. Add journal entry
python archive/journal_cli.py --date today --mood good --meditated true --ashwagandha true
# 3. Check recovery trend
curl "http://localhost:5002/api/analytics/enhanced/recovery?days=30"
```

## Weekly Insight Pass
1. Run correlations for last 90 days → identify new strong links
2. Review cluster shifts (has a new pattern emerged?)
3. Compare last 30 days vs previous 30 days:
```bash
curl "http://localhost:5002/api/analytics/compare/periods?period1_days=30&period2_days=30&offset_days=30" | jq
```
4. Adjust habits (sleep mask, supplements) based on deltas

## Experiment: Supplement Effectiveness
1. Tag days with supplement flag in journal for 4–6 weeks
2. Compare mood / energy / sleep_score distributions (custom SQL or correlations endpoint)
3. Remove confounding variables gradually (e.g., big training spikes)

## Sleep Environment Optimization
Track: `sleep_mask`, `ear_plugs`, `bedroom_temp`.
Look for improvements in:
- `sleep_score`
- `time_in_bed_minutes`
- Next-day `energy_level`

## Stress Load Monitoring
Call stress comprehensive endpoint weekly:
```bash
curl "http://localhost:5002/api/analytics/stress/comprehensive?days=30"
```
Inspect hourly vs daily pattern changes if available.

## Activity Consistency
Use activity comprehensive for sustained progression patterns:
```bash
curl "http://localhost:5002/api/analytics/activity/comprehensive?days=45"
```
Identify overtraining (elevated RHR + reduced sleep_score).

## Prediction Check
Run energy prediction in the morning:
```bash
curl "http://localhost:5002/api/predictions/energy?days_ahead=7"
```
Cross-validate with subjective feel → refine journal metrics.

## SQL Snippets (Examples)
```sql
-- High-quality days (customizable threshold)
SELECT ds.day, ds.steps, s.sleep_score, j.mood
FROM garmin_daily_summaries ds
JOIN garmin_sleep_sessions s ON ds.day = s.day
JOIN daily_journal j ON ds.day = j.day
WHERE s.sleep_score > 80 AND ds.steps > 8000 AND j.mood IN ('good','great')
ORDER BY ds.day DESC;
```

```sql
-- Supplement vs sleep quality
SELECT j.supplement_ashwagandha, AVG(s.sleep_score) avg_sleep_score
FROM daily_journal j
JOIN garmin_sleep_sessions s ON j.day = s.day
GROUP BY 1;
```

## Backup & Safety
```bash
# Weekly database dump
pg_dump -h localhost -U diary_user diary > backups/`date +%F`.sql
```
Prune old dumps to save space.

## When to Full Reset
| Scenario | Use Full Reset? |
|----------|-----------------|
| Schema overhaul | Yes |
| Minor column addition | No (add incremental migration) |
| Corrupted volume | Yes |
| Testing new ingestion pipeline | Often |

## Common Pitfalls
| Pitfall | Solution |
|---------|----------|
| Sparse data → weak clusters | Increase window to 120 days |
| Mood missing often | Add journal reminder / script alias |
| Overfitting predictions | Keep features limited; prefer simpler models |
| Large rebuild time | Use incremental migrations & avoid full reset |

---
Have a novel workflow? Contribute it back to extend this guide.
