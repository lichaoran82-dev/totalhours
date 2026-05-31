import csv
import json
import re
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "source"
OUT = ROOT / "data" / "trackmytime_attendance.json"

W2_NAMES = {
    "dalia posada",
    "jialong li",
    "lin gao",
    "merissa ortegon",
}


def clean_name(value):
    return re.sub(r"\s+", " ", value or "").strip()


def employee_key(value):
    name = clean_name(value).lower()
    name = re.sub(r"\s*[\(（].*?[\)）]", "", name)
    name = re.sub(r"\bmerrissa\b", "merissa", name)
    return clean_name(name)


def to_number(value):
    text = str(value or "").strip()
    if not text:
        return 0.0
    return float(text)


def parse_period(value):
    start_text, end_text = value.strip().split("-")
    start = datetime.strptime(start_text, "%m/%d/%Y").date()
    end = datetime.strptime(end_text, "%m/%d/%Y").date()
    return start.isoformat(), end.isoformat()


def parse_file(path):
    lines = path.read_text(encoding="utf-8-sig").splitlines()
    period = parse_period(lines[1])
    header_index = next(i for i, line in enumerate(lines) if line.startswith('"EMPLOYEE NAME"'))
    rows = csv.DictReader(lines[header_index:])
    employees = []
    for row in rows:
        name = clean_name(row.get("EMPLOYEE NAME"))
        if not name or name.upper() == "TOTAL":
            continue
        key = employee_key(name)
        if key == "chaoran li":
            continue
        department = clean_name(row.get("DEPARTMENT NAME")) or "SCM-TX001"
        warehouse = department.replace("SCM-", "") if department.startswith("SCM-") else department
        rule_state = "CA" if key == "jialong li" else "TX"
        employee_type = "W2" if key in W2_NAMES else "Staffing/Temp"
        regular = to_number(row.get("REG"))
        ot15 = to_number(row.get("OT1"))
        dt2 = to_number(row.get("OT2"))
        total = to_number(row.get("TOTAL")) or regular + ot15 + dt2
        employees.append(
            {
                "id": re.sub(r"[^A-Za-z0-9]+", "_", key).strip("_").upper(),
                "name": name,
                "warehouse": warehouse,
                "ruleState": rule_state,
                "employeeType": employee_type,
                "regularHours": round(regular, 2),
                "ot15Hours": round(ot15, 2),
                "dt2Hours": round(dt2, 2),
                "totalHours": round(total, 2),
                "grossPay": 0,
                "alerts": 0,
                "daysPresent": 0,
            }
        )
    return {"weekStart": period[0], "weekEnd": period[1], "employees": employees}


def main():
    weeks = []
    for path in sorted(SOURCE_DIR.rglob("trackmytime_*.csv")):
        weeks.append(parse_file(path))
    weeks.sort(key=lambda week: week["weekStart"])
    data = {
        "company": "Discovery SCM",
        "sourceName": "All TrackMyTime",
        "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "workweekStartsOn": "Monday",
        "warehouses": [{"id": "TX001", "name": "Texas Warehouse"}],
        "weeks": weeks,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    for week in weeks:
        total = sum(employee["totalHours"] for employee in week["employees"])
        ot = sum(employee["ot15Hours"] + employee["dt2Hours"] for employee in week["employees"])
        staffing = sum(1 for employee in week["employees"] if employee["employeeType"] != "W2")
        print(
            f"{week['weekStart']} to {week['weekEnd']}: "
            f"{len(week['employees'])} employees, {staffing} staffing/temp, "
            f"{total:.2f} total hours, {ot:.2f} OT hours"
        )


if __name__ == "__main__":
    main()
