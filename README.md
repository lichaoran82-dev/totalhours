# Weekly Labor Dashboard

GitHub Pages-ready static dashboard for weekly warehouse attendance and overtime review.

## Publish on GitHub Pages

1. Create a GitHub repository.
2. Upload these files to the repository root:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `data/attendance.json`
3. In GitHub, open `Settings > Pages`.
4. Set `Build and deployment` to `Deploy from a branch`.
5. Select the branch and `/root`, then save.

The dashboard opens on the first-page executive view and loads data from `data/attendance.json`. Use the Warehouse selector to view all warehouses, `TX001`, or `GA006`.

## Data Contract

Each weekly record should use this shape:

```json
{
  "weekStart": "2026-05-25",
  "weekEnd": "2026-05-31",
  "employees": [
    {
      "id": "CA001",
      "name": "California Rule Employee",
      "warehouse": "TX001",
      "ruleState": "CA",
      "regularHours": 39,
      "ot15Hours": 5,
      "dt2Hours": 1,
      "grossPay": 1225,
      "alerts": 1,
      "daysPresent": 5
    }
  ]
}
```

The weekly TrackMyTime import can update only `data/attendance.json`; the page itself does not need to change.

Keep `warehouse` separate from `ruleState`. For example, the CA-rule employee in warehouse `TX001` should use `"warehouse": "TX001"` and `"ruleState": "CA"`.
