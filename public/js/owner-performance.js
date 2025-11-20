document.addEventListener('DOMContentLoaded', function () {
  const periodRadios = document.querySelectorAll('input[name="periodMode"]');
  const presetBox = document.querySelector('.op-period-preset');
  const customBox = document.querySelector('.op-period-custom');
  const hiddenPeriodInput = document.getElementById('opHiddenPeriod');
  const presetSelect = document.getElementById('opPeriodPreset');
  const filterForm = document.querySelector('.op-filter-form');

  function applyMode(mode) {
    if (!presetBox || !customBox) return;
    if (mode === 'custom') {
      presetBox.style.display = 'none';
      customBox.style.display = 'flex';
    } else {
      presetBox.style.display = 'block';
      customBox.style.display = 'none';
    }
  }

  (function initMode() {
    let currentMode = 'preset';
    if (hiddenPeriodInput && hiddenPeriodInput.value === 'custom') {
      currentMode = 'custom';
    }
    applyMode(currentMode);

    periodRadios.forEach(function (r) {
      if (r.value === currentMode) {
        r.checked = true;
      }
    });
  })();

  periodRadios.forEach(function (radio) {
    radio.addEventListener('change', function () {
      applyMode(radio.value);
    });
  });

  if (filterForm) {
    filterForm.addEventListener('submit', function () {
      const selectedMode = Array.from(periodRadios).find(function (r) {
        return r.checked;
      })?.value;

      if (!hiddenPeriodInput) return;

      if (selectedMode === 'custom') {
        hiddenPeriodInput.value = 'custom';
      } else {
        hiddenPeriodInput.value = presetSelect ? presetSelect.value : 'month';
      }
    });
  }
});
