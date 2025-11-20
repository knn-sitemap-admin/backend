// public/static/js/owner-contracts.js

document.addEventListener('DOMContentLoaded', function () {
  var form = document.querySelector('.oc-filter-form');
  if (!form) return;

  var periodPresetWrap = form.querySelector('.oc-period-preset');
  var periodCustomWrap = form.querySelector('.oc-period-custom');
  var periodPresetSelect = form.querySelector('select[name="periodPreset"]');
  var fromInput = form.querySelector('input[name="from"]');
  var toInput = form.querySelector('input[name="to"]');
  var periodHidden = form.querySelector('input[name="period"]');
  var modeRadios = form.querySelectorAll('input[name="periodMode"]');

  var currentMode = 'preset';

  function applyMode(mode) {
    currentMode = mode === 'custom' ? 'custom' : 'preset';

    if (currentMode === 'preset') {
      if (periodPresetWrap) periodPresetWrap.style.display = 'block';
      if (periodCustomWrap) periodCustomWrap.style.display = 'none';

      if (fromInput) fromInput.disabled = true;
      if (toInput) toInput.disabled = true;
      if (periodPresetSelect) periodPresetSelect.disabled = false;
    } else {
      if (periodPresetWrap) periodPresetWrap.style.display = 'none';
      if (periodCustomWrap) periodCustomWrap.style.display = 'block';

      if (fromInput) fromInput.disabled = false;
      if (toInput) toInput.disabled = false;
      if (periodPresetSelect) periodPresetSelect.disabled = true;
    }
  }

  // 초기 모드 : hidden period 값 보고 판단
  var initialPeriod = (periodHidden && periodHidden.value) || 'month';
  if (initialPeriod === 'custom') {
    applyMode('custom');
  } else {
    applyMode('preset');
  }

  modeRadios.forEach(function (r) {
    r.addEventListener('change', function () {
      applyMode(r.value);
    });
  });

  form.addEventListener('submit', function () {
    if (!periodHidden) return;

    if (currentMode === 'preset') {
      var v = (periodPresetSelect && periodPresetSelect.value) || 'month';
      periodHidden.value = v;
    } else {
      periodHidden.value = 'custom';
    }
  });
});
