const PHONE_PREFIX = '+972 ';

const dateInput = document.getElementById('date');
const slotsContainer = document.getElementById('slots');
const form = document.getElementById('booking-form');
const message = document.getElementById('message');
const submitBtn = document.getElementById('submit-btn');
const phoneInput = document.getElementById('phone');
const clientId = document.getElementById('client-id').value;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

let schedule = {};
let timeSlots = [];
let selectedSlot = null;
let scheduleLoaded = false;

function dayNameForDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return DAY_NAMES[new Date(y, m - 1, d).getDay()];
}

function slotsForDate(dateStr) {
  const dayName = dayNameForDate(dateStr);
  if (Object.prototype.hasOwnProperty.call(schedule, dayName)) {
    return schedule[dayName];
  }
  if (Array.isArray(schedule.default)) {
    return schedule.default;
  }
  return [];
}

const today = new Date();
const todayStr = today.toISOString().split('T')[0];
dateInput.min = todayStr;
dateInput.value = todayStr;

function showMessage(text, type) {
  message.textContent = text;
  message.className = type || '';
}

function renderSlots() {
  slotsContainer.innerHTML = '';
  if (timeSlots.length === 0) {
    const msg = scheduleLoaded
      ? `No appointments available on ${dayNameForDate(dateInput.value)}.`
      : 'No time slots configured.';
    slotsContainer.innerHTML = `<p class="slots-status">${msg}</p>`;
    return;
  }
  timeSlots.forEach((slot) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot' + (slot === selectedSlot ? ' selected' : '');
    btn.textContent = slot;
    btn.addEventListener('click', () => {
      selectedSlot = slot;
      renderSlots();
    });
    slotsContainer.appendChild(btn);
  });
}

function refreshSlotsForCurrentDate() {
  if (!dateInput.value) {
    timeSlots = [];
    selectedSlot = null;
    renderSlots();
    return;
  }
  timeSlots = slotsForDate(dateInput.value) || [];
  selectedSlot = null;
  renderSlots();
}

async function loadSchedule() {
  slotsContainer.innerHTML = '<p class="slots-status">Loading available times...</p>';
  try {
    const res = await fetch(`/api/slots/${encodeURIComponent(clientId)}`);
    if (!res.ok) throw new Error('Failed to load slots');
    const data = await res.json();
    schedule = (data && typeof data.schedule === 'object' && data.schedule !== null) ? data.schedule : {};
    scheduleLoaded = true;
    refreshSlotsForCurrentDate();
  } catch (err) {
    slotsContainer.innerHTML = '<p class="slots-status slots-error">Could not load time slots. Please refresh the page.</p>';
  }
}

function caretAfterPrefix() {
  phoneInput.setSelectionRange(PHONE_PREFIX.length, PHONE_PREFIX.length);
}

phoneInput.addEventListener('input', () => {
  if (!phoneInput.value.startsWith(PHONE_PREFIX)) {
    const rest = phoneInput.value.replace(/^\+?9?7?2?\s*/, '');
    phoneInput.value = PHONE_PREFIX + rest;
    caretAfterPrefix();
  }
});

phoneInput.addEventListener('keydown', (e) => {
  const start = phoneInput.selectionStart;
  const end = phoneInput.selectionEnd;

  if (e.key === 'Backspace' && start <= PHONE_PREFIX.length && start === end) {
    e.preventDefault();
    return;
  }
  if (e.key === 'Delete' && start < PHONE_PREFIX.length && start === end) {
    e.preventDefault();
    return;
  }
  if ((e.key === 'Backspace' || e.key === 'Delete') && start < PHONE_PREFIX.length) {
    e.preventDefault();
    phoneInput.setSelectionRange(PHONE_PREFIX.length, end < PHONE_PREFIX.length ? PHONE_PREFIX.length : end);
    return;
  }
  if (e.key === 'ArrowLeft' && start <= PHONE_PREFIX.length && start === end) {
    e.preventDefault();
  }
  if (e.key === 'Home') {
    e.preventDefault();
    caretAfterPrefix();
  }
});

phoneInput.addEventListener('focus', () => {
  if (phoneInput.selectionStart < PHONE_PREFIX.length) caretAfterPrefix();
});

phoneInput.addEventListener('click', () => {
  if (phoneInput.selectionStart < PHONE_PREFIX.length) caretAfterPrefix();
});

dateInput.addEventListener('change', refreshSlotsForCurrentDate);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  showMessage('', '');

  if (!dateInput.value) {
    showMessage('Please choose a date.', 'error');
    return;
  }
  if (!selectedSlot) {
    showMessage('Please choose a time slot.', 'error');
    return;
  }

  const leadName = document.getElementById('name').value.trim();
  const leadPhone = phoneInput.value.trim();

  if (!leadName) {
    showMessage('Please enter your name.', 'error');
    return;
  }
  const phoneDigits = leadPhone.slice(PHONE_PREFIX.length).replace(/\D/g, '');
  if (phoneDigits.length < 8) {
    showMessage('Please enter a valid Israeli phone number after the +972 prefix.', 'error');
    return;
  }

  const appointmentDateTime = `${dateInput.value}T${selectedSlot}:00`;
  const payload = { clientId, leadName, leadPhone, appointmentDateTime };

  submitBtn.disabled = true;
  showMessage('Submitting your booking...', '');

  try {
    const res = await fetch('/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Submission failed');
    }

    const friendlyDate = new Date(appointmentDateTime).toLocaleString();
    showMessage(`Booked for ${friendlyDate}. We'll be in touch shortly!`, 'success');
    form.reset();
    dateInput.value = todayStr;
    phoneInput.value = PHONE_PREFIX;
    refreshSlotsForCurrentDate();
  } catch (err) {
    showMessage(err.message || 'Sorry, something went wrong. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

loadSchedule();
