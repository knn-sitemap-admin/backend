async function fetchPinStats() {
  const city = document.getElementById('filterCity').value;
  const period = document.getElementById('filterPeriod').value;
  const from = document.getElementById('filterFrom').value;
  const to = document.getElementById('filterTo').value;

  const params = new URLSearchParams({ city, period });

  if (period === 'custom') {
    if (from) params.set('from', from);
    if (to) params.set('to', to);
  }

  const res = await fetch(`/owner/pin-stats?${params.toString()}`, {
    credentials: 'include',
  });
  const data = await res.json();

  renderStats(data.data);
}

document.getElementById('applyFilterBtn').addEventListener('click', () => {
  fetchPinStats();
});

document.getElementById('filterPeriod').addEventListener('change', () => {
  const period = document.getElementById('filterPeriod').value;
  const disable = period !== 'custom';

  document.getElementById('filterFrom').disabled = disable;
  document.getElementById('filterTo').disabled = disable;
});

function renderStats(res) {
  // 요약
  document.getElementById('statTotalPins').textContent = res.summary.totalPins;
  document.getElementById('statTopCity').textContent = res.summary.topCityLabel;
  document.getElementById('statDraftBefore').textContent =
    res.summary.totalDraftBefore;
  document.getElementById('statScheduled').textContent =
    res.summary.totalScheduled;

  fillTable(
    'cityStatsBody',
    res.cityStats,
    (row) => `
    <tr><td>${row.cityLabel}</td><td>${row.count}</td></tr>
  `,
  );

  fillTable(
    'districtStatsBody',
    res.districtStats,
    (row) => `
    <tr><td>${row.district}</td><td>${row.count}</td></tr>
  `,
  );

  fillTable(
    'draftBeforeStatsBody',
    res.draftBeforeStats,
    (row) => `
    <tr><td>${row.district}</td><td>${row.count}</td></tr>
  `,
  );

  fillTable(
    'scheduledStatsBody',
    res.scheduledStats,
    (row) => `
    <tr><td>${row.district}</td><td>${row.count}</td></tr>
  `,
  );
}

function fillTable(tbodyId, list, template) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = list.map(template).join('');
}

// 초기 로딩
fetchPinStats();
