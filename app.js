const fmtNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const fmtMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtPercent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });

const el = (id) => document.getElementById(id);

function employeeTotal(employee) {
  return employee.regularHours + employee.ot15Hours + employee.dt2Hours;
}

function filterWeek(week, warehouse) {
  if (warehouse === "ALL") return week;
  return {
    ...week,
    employees: week.employees.filter((employee) => employee.warehouse === warehouse)
  };
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
  el("daysPresent").textContent = `${current.daysPresent} presence days`;
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
  el("generatedAt").textContent = `Updated ${new Date(data.generatedAt).toLocaleString()}`;
  renderKpis(week, previous);
  renderTrend(data.weeks, warehouse);
  renderSplit("warehouseSplit", "warehouseTotal", week.employees, "warehouse");
  renderSplit("ruleSplit", "ruleTotal", week.employees, "ruleState");
  renderEmployees(week);
}

async function main() {
  const response = await fetch("./data/attendance.json");
  const data = await response.json();
  const weekSelect = el("weekSelect");
  const warehouseSelect = el("warehouseSelect");

  data.weeks.forEach((week, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = `${week.weekStart} to ${week.weekEnd}`;
    weekSelect.appendChild(option);
  });

  [{ id: "ALL", name: "All Warehouses" }, ...data.warehouses].forEach((warehouse) => {
    const option = document.createElement("option");
    option.value = warehouse.id;
    option.textContent = `${warehouse.id === "ALL" ? "" : `${warehouse.id} · `}${warehouse.name}`;
    warehouseSelect.appendChild(option);
  });

  weekSelect.value = String(data.weeks.length - 1);
  warehouseSelect.value = "ALL";
  weekSelect.addEventListener("change", () => render(data));
  warehouseSelect.addEventListener("change", () => render(data));
  render(data);
}

main().catch((error) => {
  document.body.innerHTML = `<main class="shell"><h1>Dashboard data failed to load</h1><p>${error.message}</p></main>`;
});
