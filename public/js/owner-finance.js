document.addEventListener('DOMContentLoaded', function () {
  const periodRadios = document.querySelectorAll('input[name="periodMode"]');
  const presetBox = document.querySelector('.of-period-preset');
  const customBox = document.querySelector('.of-period-custom');
  const hiddenPeriodInput = document.getElementById('ofHiddenPeriod');
  const presetSelect = document.getElementById('ofPeriodPreset');
  const filterForm = document.querySelector('.of-filter-form');

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

  // 초기 표시
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

  // 라디오 변경 시 표시 전환
  periodRadios.forEach(function (radio) {
    radio.addEventListener('change', function () {
      applyMode(radio.value);
    });
  });

  // submit 직전에 period 값 세팅
  if (filterForm) {
    filterForm.addEventListener('submit', function () {
      const selectedMode = Array.from(periodRadios).find(function (r) {
        return r.checked;
      })?.value;

      if (!hiddenPeriodInput) return;

      if (selectedMode === 'custom') {
        hiddenPeriodInput.value = 'custom';
      } else {
        // preset
        hiddenPeriodInput.value = presetSelect ? presetSelect.value : 'month';
      }
    });
  }
});
