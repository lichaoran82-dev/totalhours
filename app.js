const fmtNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const fmtMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtPercent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });

const el = (id) => document.getElementById(id);

function employeeTotal(employee) {
  return typeof employee.totalHours === "number"
    ? employee.totalHours
    : employee.regularHours + employee.ot15Hours + employee.dt2Hours;
}

function employeeKey(employee) {
  return employee.name
    .replace(/\s*[\(（].*?[\)）]/g, "")
    .replace(/\bmerrissa\b/i, "merissa")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function filterWeek(week, warehouse) {
  if (warehouse === "ALL") return week;
  return {
    ...week,
    employees: week.employees.filter((employee) => employee.warehouse === warehouse)
  };
}

function filterDataByEmployeeType(data, type, sourceName) {
  return {
    ...data,
    sourceName,
    weeks: data.weeks.map((week) => ({
      ...week,
      employees: week.employees.filter((employee) => (employee.employeeType || "W2") === type)
    }))
  };
}

function buildSources(w2Data, trackmytimeData) {
  const sources = [];
  if (trackmytimeData) {
    sources.push({
      id: "trackmytimeAll",
      name: "All TrackMyTime",
      data: trackmytimeData
    });
    sources.push({
      id: "trackmytimeStaffing",
      name: "Staffing/Temp Only",
      data: filterDataByEmployeeType(trackmytimeData, "Staffing/Temp", "Staffing/Temp Only")
    });
  }
  sources.push({
    id: "w2Payroll",
    name: "W2 Payroll Sheet",
    data: { ...w2Data, sourceName: "W2 Payroll Sheet" }
  });
  return sources;
}

function weekTotals(week) {
  const employees = week.employees;
  const totalHours = employees.reduce((sum, e) => sum + employeeTotal(e), 0);
  const otHours = employees.reduce((sum, e) => sum + e.ot15Hours + e.dt2Hours, 0);
  const alerts = employees.reduce((sum, e) => sum + e.alerts, 0);
  const grossPay = employees.reduce((sum, e) => sum + e.grossPay, 0);
  const daysPresent = employees.reduce((sum, e) => sum + e.daysPresent, 0);
  const activeEmployees = employees.filter((e) => employeeTotal(e) > 0).length;
  return {
    totalHours,
    otHours,
    otShare: totalHours ? otHours / totalHours : 0,
    alerts,
    grossPay,
    daysPresent,
    activeEmployees
  };
}

function monthLabel(key) {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1).toLocaleString("en-US", {
    month: "short",
    year: "numeric"
  });
}

function monthlyTotals(weeks, warehouse) {
  const months = new Map();
  weeks.map((week) => filterWeek(week, warehouse)).forEach((week) => {
    const month = week.weekEnd.slice(0, 7);
    if (!months.has(month)) {
      months.set(month, {
        month,
        totalHours: 0,
        otHours: 0,
        daysPresent: 0,
        employeeIds: new Set()
      });
    }
    const row = months.get(month);
    week.employees.forEach((employee) => {
      const total = employeeTotal(employee);
      row.totalHours += total;
      row.otHours += employee.ot15Hours + employee.dt2Hours;
      row.daysPresent += employee.daysPresent;
      if (total > 0) row.employeeIds.add(employeeKey(employee));
    });
  });
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month)).map((month) => ({
    ...month,
    activeEmployees: month.employeeIds.size,
    otShare: month.totalHours ? month.otHours / month.totalHours : 0
  }));
}

function groupHours(employees, key) {
  return employees.reduce((acc, employee) => {
    const name = employee[key] || "Unknown";
    acc[name] = (acc[name] || 0) + employeeTotal(employee);
    return acc;
  }, {});
}

function delta(current, previous) {
  if (!previous) return 0;
  return previous === 0 ? 0 : (current - previous) / previous;
}

function formatDelta(value) {
  if (value === null || value === undefined) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${fmtPercent.format(value)}`;
}

function setDelta(node, value) {
  const sign = value > 0 ? "+" : "";
  node.textContent = `${sign}${fmtPercent.format(value)}`;
  node.className = value >= 0 ? "up" : "down";
}

function renderKpis(week, previous) {
  const current = weekTotals(week);
  const prior = previous ? weekTotals(previous) : null;
  el("totalHours").textContent = fmtNumber.format(current.totalHours);
  el("otHours").textContent = fmtNumber.format(current.otHours);
  el("otShare").textContent = fmtPercent.format(current.otShare);
  el("activeEmployees").textContent = current.activeEmployees;
  el("daysPresent").textContent = current.daysPresent
    ? `${current.daysPresent} presence days`
    : "period summary";
  el("alerts").textContent = current.alerts;
  el("weekRange").textContent = `${week.weekStart} to ${week.weekEnd}`;
  setDelta(el("totalHoursDelta"), delta(current.totalHours, prior?.totalHours || 0));
  setDelta(el("otHoursDelta"), delta(current.otHours, prior?.otHours || 0));
  const pointDelta = current.otShare - (prior?.otShare || 0);
  el("otShareDelta").textContent = `${pointDelta >= 0 ? "+" : ""}${(pointDelta * 100).toFixed(1)} pts`;
  el("otShareDelta").className = pointDelta >= 0 ? "up" : "down";
}

function renderTrend(weeks, warehouse) {
  const filteredWeeks = weeks.map((week) => filterWeek(week, warehouse));
  const totals = filteredWeeks.map(weekTotals);
  const maxHours = Math.max(...totals.map((w) => w.totalHours), 1);
  el("trendChart").innerHTML = filteredWeeks.map((week, index) => {
    const total = totals[index].totalHours;
    const ot = totals[index].otHours;
    const totalHeight = Math.max(2, (total / maxHours) * 210);
    const otHeight = Math.max(2, (ot / maxHours) * 210);
    return `
      <div class="bar-group">
        <div class="bars" title="${total.toFixed(1)} total hours, ${ot.toFixed(1)} overtime hours">
          <span class="bar total" style="height:${totalHeight}px"></span>
          <span class="bar ot" style="height:${otHeight}px"></span>
        </div>
        <div class="bar-label">${week.weekStart.slice(5)}</div>
      </div>
    `;
  }).join("");
}

function renderMonthly(weeks, warehouse) {
  const months = monthlyTotals(weeks, warehouse);
  const maxHours = Math.max(...months.map((month) => month.totalHours), 1);
  const grandTotal = months.reduce((sum, month) => sum + month.totalHours, 0);
  el("monthlyTotal").textContent = `${fmtNumber.format(grandTotal)} hours`;
  el("monthlyChart").innerHTML = months.map((month) => {
    const totalHeight = Math.max(2, (month.totalHours / maxHours) * 190);
    const otHeight = Math.max(2, (month.otHours / maxHours) * 190);
    return `
      <div class="bar-group">
        <div class="bars" title="${fmtNumber.format(month.totalHours)} total hours, ${fmtNumber.format(month.otHours)} overtime hours">
          <span class="bar total" style="height:${totalHeight}px"></span>
          <span class="bar ot" style="height:${otHeight}px"></span>
        </div>
        <div class="bar-label">${month.month.slice(5)}</div>
      </div>
    `;
  }).join("");
  el("monthlyRows").innerHTML = months.map((month, index) => {
    const previous = months[index - 1];
    const lastYear = months.find((candidate) => candidate.month === `${Number(month.month.slice(0, 4)) - 1}${month.month.slice(4)}`);
    const mom = previous ? delta(month.totalHours, previous.totalHours) : null;
    const yoy = lastYear ? delta(month.totalHours, lastYear.totalHours) : null;
    return `
      <tr>
        <td>${monthLabel(month.month)}</td>
        <td>${fmtNumber.format(month.totalHours)}</td>
        <td>${fmtNumber.format(month.otHours)}</td>
        <td>${fmtPercent.format(month.otShare)}</td>
        <td>${month.activeEmployees}</td>
        <td class="${mom === null ? "" : mom >= 0 ? "up" : "down"}">${formatDelta(mom)}</td>
        <td class="${yoy === null ? "" : yoy >= 0 ? "up" : "down"}">${formatDelta(yoy)}</td>
      </tr>
    `;
  }).join("");
}

function renderSplit(containerId, totalId, employees, key) {
  const byKey = groupHours(employees, key);
  const total = Object.values(byKey).reduce((sum, value) => sum + value, 0) || 1;
  el(totalId).textContent = `${fmtNumber.format(total)} hours`;
  el(containerId).innerHTML = Object.entries(byKey).sort().map(([name, hours]) => {
    const share = hours / total;
    const meterClass = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    return `
      <div class="split-row">
        <div class="split-meta">
          <strong>${name}</strong>
          <span>${fmtNumber.format(hours)} hrs · ${fmtPercent.format(share)}</span>
        </div>
        <div class="meter ${meterClass}"><span style="width:${share * 100}%"></span></div>
      </div>
    `;
  }).join("");
}

function renderEmployees(week) {
  el("employeeRows").innerHTML = week.employees
    .slice()
    .sort((a, b) => employeeTotal(b) - employeeTotal(a))
    .map((employee) => {
      const total = employeeTotal(employee);
      const ot = employee.ot15Hours + employee.dt2Hours;
      return `
        <tr>
          <td>${employee.name}</td>
          <td>${employee.warehouse}</td>
          <td><span class="pill ${employee.ruleState.toLowerCase()}">${employee.ruleState}</span></td>
          <td>${employee.employeeType || "W2"}</td>
          <td>${fmtNumber.format(total)}</td>
          <td>${fmtNumber.format(employee.regularHours)}</td>
          <td>${fmtNumber.format(employee.ot15Hours)}</td>
          <td>${fmtNumber.format(employee.dt2Hours)}</td>
          <td>${fmtPercent.format(total ? ot / total : 0)}</td>
          <td>${employee.daysPresent}</td>
          <td class="${employee.alerts ? "alert" : ""}">${employee.alerts}</td>
          <td>${fmtMoney.format(employee.grossPay)}</td>
        </tr>
      `;
    }).join("");
}

function render(data) {
  const weekIndex = Number(el("weekSelect").value);
  const warehouse = el("warehouseSelect").value;
  const week = filterWeek(data.weeks[weekIndex], warehouse);
  const previous = weekIndex > 0 ? filterWeek(data.weeks[weekIndex - 1], warehouse) : null;

  el("company").textContent = data.company;
  el("generatedAt").textContent = `${data.sourceName || "Dashboard"} · Updated ${new Date(data.generatedAt).toLocaleString()}`;
  renderKpis(week, previous);
  renderTrend(data.weeks, warehouse);
  renderMonthly(data.weeks, warehouse);
  renderSplit("warehouseSplit", "warehouseTotal", week.employees, "warehouse");
  renderSplit("ruleSplit", "ruleTotal", week.employees, "ruleState");
  renderEmployees(week);
}

function populateWeeks(data) {
  const weekSelect = el("weekSelect");
  weekSelect.innerHTML = "";
  data.weeks.forEach((week, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = `${week.weekStart} to ${week.weekEnd}`;
    weekSelect.appendChild(option);
  });
  weekSelect.value = String(data.weeks.length - 1);
}

async function main() {
  const [w2Response, trackmytimeResponse] = await Promise.all([
    fetch("./data/attendance.json"),
    fetch("./data/trackmytime_attendance.json").catch(() => null)
  ]);
  const w2Data = await w2Response.json();
  const trackmytimeData = trackmytimeResponse?.ok ? await trackmytimeResponse.json() : null;
  const sources = buildSources(w2Data, trackmytimeData);
  let data = sources[0].data;
  const sourceSelect = el("sourceSelect");
  const weekSelect = el("weekSelect");
  const warehouseSelect = el("warehouseSelect");

  sources.forEach((source) => {
    const option = document.createElement("option");
    option.value = source.id;
    option.textContent = source.name;
    sourceSelect.appendChild(option);
  });
  sourceSelect.value = sources[0].id;
  populateWeeks(data);

  [{ id: "ALL", name: "All Warehouses" }, ...data.warehouses].forEach((warehouse) => {
    const option = document.createElement("option");
    option.value = warehouse.id;
    option.textContent = `${warehouse.id === "ALL" ? "" : `${warehouse.id} · `}${warehouse.name}`;
    warehouseSelect.appendChild(option);
  });

  warehouseSelect.value = "ALL";
  weekSelect.addEventListener("change", () => render(data));
  warehouseSelect.addEventListener("change", () => render(data));
  sourceSelect.addEventListener("change", () => {
    data = sources.find((source) => source.id === sourceSelect.value).data;
    populateWeeks(data);
    render(data);
  });
  render(data);
}

main().catch((error) => {
  document.body.innerHTML = `<main class="shell"><h1>Dashboard data failed to load</h1><p>${error.message}</p></main>`;
});
