const STORAGE_KEY_HIDDEN_SUBJECTS = 'planHiddenSubjects';
const STORAGE_KEY_VIEW_MODE = 'planViewMode';

let currentFilterDateFrom = '';
let currentFilterDateTo = '';

const OPTIONAL_SUBJECTS = [
  "AI w zarządzaniu organizacjami",
  "Kontrola w organizacjach",
  "Kreatywność w zarządzaniu zorientowanym na człowieka-od 4.0",
  "Strategia marek luksusowych: Dziedzictwo, unikalność i transf. cyfrowa",
  "Zielona Gospodarka"
];

const DAY_NAMES = {
  'Pn': 'Poniedziałek',
  'Wt': 'Wtorek',
  'Śr': 'Środa',
  'Cz': 'Czwartek',
  'Pt': 'Piątek',
  'Sb': 'Sobota',
  'Nd': 'Niedziela'
};

function getHiddenSubjects() {
  const saved = localStorage.getItem(STORAGE_KEY_HIDDEN_SUBJECTS);
  return saved ? JSON.parse(saved) : [];
}

function saveHiddenSubjects(hiddenArray) {
  localStorage.setItem(STORAGE_KEY_HIDDEN_SUBJECTS, JSON.stringify(hiddenArray));
}

function formatDateISO(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isEntryVisible(entry, hiddenSubjects) {
  const isSubjectHidden = OPTIONAL_SUBJECTS.includes(entry.subject) && hiddenSubjects.includes(entry.subject);
  if (isSubjectHidden) return false;
  if (currentFilterDateFrom && entry.date < currentFilterDateFrom) return false;
  if (currentFilterDateTo && entry.date > currentFilterDateTo) return false;
  return true;
}

function removeAccessibilityWidget() {
  const allElements = document.querySelectorAll('div, ul, table, section, aside');
  allElements.forEach(el => {
    if (
      el.id === 'plan-enhancer-toolbar' ||
      el.id === 'plan-subject-filter-panel' ||
      el.id === 'plan-date-filter-bar' ||
      el.id === 'plan-calendar-view'
    ) return;
    if (el.tagName === 'BODY' || el.tagName === 'HTML') return;

    const text = el.innerText || '';
    if (text.includes('A+') && text.includes('A+++') && el.clientHeight < 150) {
      el.style.setProperty('display', 'none', 'important');
    }
  });
}

function parseTableEntries() {
  const rows = Array.from(document.querySelectorAll('table tbody tr'));
  const entries = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const terminCell = row.querySelector('td.termin');

    if (terminCell) {
      const cells = row.querySelectorAll('td');
      const dateStr = terminCell.innerText.trim();
      const dayTimeRaw = cells[1] ? cells[1].innerText.trim() : '';
      const subjectName = cells[2] ? cells[2].innerText.trim() : 'Nieznany przedmiot';
      const typeName = cells[3] ? cells[3].innerText.trim() : '';
      const teacherHTML = cells[4] ? cells[4].innerHTML.trim() : '';
      const roomHTML = cells[5] ? cells[5].innerHTML.trim() : '';
      const isCancelled = row.classList.contains('czerwony');

      const dayParts = dayTimeRaw.split(' ');
      const dayAbbr = dayParts[0] || '';
      const fullDayName = DAY_NAMES[dayAbbr] || dayAbbr;
      const timeOnly = dayParts.slice(1).join(' ');

      let remarksRow = null;
      let remarksText = '';

      if (terminCell.getAttribute('rowspan') === '2' && i + 1 < rows.length) {
        const nextRow = rows[i + 1];
        const uwagiCell = nextRow.querySelector('td.uwagi');
        if (uwagiCell) {
          remarksRow = nextRow;
          remarksText = uwagiCell.innerText.trim();
          i++;
        }
      }

      entries.push({
        date: dateStr,
        dayName: fullDayName,
        time: timeOnly,
        subject: subjectName,
        type: typeName,
        teacherHTML: teacherHTML,
        roomHTML: roomHTML,
        remarks: remarksText,
        isCancelled: isCancelled,
        mainRow: row,
        remarksRow: remarksRow
      });
    }
  }
  return entries;
}

function renderCalendarView(entries, container) {
  container.innerHTML = '';
  const hiddenSubjects = getHiddenSubjects();

  const visibleEntries = entries.filter(entry => isEntryVisible(entry, hiddenSubjects));

  if (visibleEntries.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'empty-state-message';
    emptyMsg.innerText = 'Brak zaplanowanych zajęć w wybranym przedziale czasowym.';
    container.appendChild(emptyMsg);
    return;
  }

  const groupedByDate = {};
  visibleEntries.forEach(entry => {
    if (!groupedByDate[entry.date]) {
      groupedByDate[entry.date] = {
        date: entry.date,
        dayName: entry.dayName,
        classes: []
      };
    }
    groupedByDate[entry.date].classes.push(entry);
  });

  Object.values(groupedByDate).forEach(dayGroup => {
    const dayCard = document.createElement('div');
    dayCard.className = 'day-card';

    const header = document.createElement('div');
    header.className = 'day-header';

    const titleSpan = document.createElement('span');
    titleSpan.innerText = `${dayGroup.dayName}, ${dayGroup.date}`;

    const countSpan = document.createElement('span');
    countSpan.className = 'day-header-count';
    countSpan.innerText = `Zajęcia: ${dayGroup.classes.length}`;

    header.appendChild(titleSpan);
    header.appendChild(countSpan);
    dayCard.appendChild(header);

    const classesList = document.createElement('div');
    classesList.className = 'day-classes';

    dayGroup.classes.forEach(cls => {
      const item = document.createElement('div');
      item.className = 'class-item' + (cls.isCancelled ? ' cancelled' : '');

      const timeCol = document.createElement('div');
      timeCol.className = 'class-time';
      timeCol.innerText = cls.time;

      const mainCol = document.createElement('div');
      mainCol.className = 'class-main';

      const subjectTitle = document.createElement('div');
      subjectTitle.className = 'class-subject';
      subjectTitle.innerText = cls.subject;

      const badges = document.createElement('div');
      badges.className = 'class-badges';

      if (cls.type) {
        const typeBadge = document.createElement('span');
        let badgeClass = 'badge-wyklad';
        if (cls.isCancelled) badgeClass = 'badge-cancelled';
        else if (cls.type.toLowerCase().includes('ćwicz')) badgeClass = 'badge-cwiczenia';

        typeBadge.className = `badge ${badgeClass}`;
        typeBadge.innerText = cls.type;
        badges.appendChild(typeBadge);
      }

      if (cls.remarks) {
        const remarksBadge = document.createElement('span');
        remarksBadge.className = 'badge badge-remarks';
        remarksBadge.innerText = cls.remarks;
        badges.appendChild(remarksBadge);
      }

      mainCol.appendChild(subjectTitle);
      mainCol.appendChild(badges);

      const teacherCol = document.createElement('div');
      teacherCol.className = 'class-teacher';
      teacherCol.innerHTML = cls.teacherHTML;

      const roomCol = document.createElement('div');
      roomCol.className = 'class-room';
      roomCol.innerHTML = cls.roomHTML || '—';

      item.appendChild(timeCol);
      item.appendChild(mainCol);
      item.appendChild(teacherCol);
      item.appendChild(roomCol);

      classesList.appendChild(item);
    });

    dayCard.appendChild(classesList);
    container.appendChild(dayCard);
  });
}

function applyFiltersAndRender(entries, calendarContainer) {
  const hiddenSubjects = getHiddenSubjects();

  entries.forEach(entry => {
    const visible = isEntryVisible(entry, hiddenSubjects);
    const displayStyle = visible ? '' : 'none';
    entry.mainRow.style.display = displayStyle;
    if (entry.remarksRow) {
      entry.remarksRow.style.display = displayStyle;
    }
  });

  renderCalendarView(entries, calendarContainer);
}

function createDateFilterBar(entries, calendarContainer) {
  const bar = document.createElement('div');
  bar.id = 'plan-date-filter-bar';

  const inputsGroup = document.createElement('div');
  inputsGroup.className = 'date-inputs-group';

  const labelFrom = document.createElement('label');
  labelFrom.innerText = 'Zakres od:';
  const inputFrom = document.createElement('input');
  inputFrom.type = 'date';

  const labelTo = document.createElement('label');
  labelTo.innerText = 'do:';
  const inputTo = document.createElement('input');
  inputTo.type = 'date';

  function onDateInputChange() {
    currentFilterDateFrom = inputFrom.value;
    currentFilterDateTo = inputTo.value;
    applyFiltersAndRender(entries, calendarContainer);
  }

  inputFrom.addEventListener('change', onDateInputChange);
  inputTo.addEventListener('change', onDateInputChange);

  inputsGroup.appendChild(labelFrom);
  inputsGroup.appendChild(inputFrom);
  inputsGroup.appendChild(labelTo);
  inputsGroup.appendChild(inputTo);

  const quickButtons = document.createElement('div');
  quickButtons.className = 'date-quick-buttons';

  const btnNextWeekend = document.createElement('button');
  btnNextWeekend.innerText = 'Najbliższy zjazd';
  btnNextWeekend.addEventListener('click', () => {
    const todayStr = formatDateISO(new Date());
    const hiddenSubjects = getHiddenSubjects();

    const upcomingEntry = entries.find(
      e => e.date >= todayStr && !(OPTIONAL_SUBJECTS.includes(e.subject) && hiddenSubjects.includes(e.subject))
    );

    if (upcomingEntry) {
      const startDate = new Date(upcomingEntry.date + 'T12:00:00');
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 3);

      inputFrom.value = formatDateISO(startDate);
      inputTo.value = formatDateISO(endDate);
      onDateInputChange();
    } else {
      alert('Brak nadchodzących zajęć w aktualnie załadowanym okresie.');
    }
  });

  const btnThisWeek = document.createElement('button');
  btnThisWeek.innerText = 'Bieżący tydzień';
  btnThisWeek.addEventListener('click', () => {
    const now = new Date();
    const dayOfWeek = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    inputFrom.value = formatDateISO(monday);
    inputTo.value = formatDateISO(sunday);
    onDateInputChange();
  });

  const btnThisMonth = document.createElement('button');
  btnThisMonth.innerText = 'Bieżący miesiąc';
  btnThisMonth.addEventListener('click', () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    inputFrom.value = formatDateISO(firstDay);
    inputTo.value = formatDateISO(lastDay);
    onDateInputChange();
  });

  const btnReset = document.createElement('button');
  btnReset.innerText = 'Pełny zakres';
  btnReset.addEventListener('click', () => {
    inputFrom.value = '';
    inputTo.value = '';
    onDateInputChange();
  });

  quickButtons.appendChild(btnNextWeekend);
  quickButtons.appendChild(btnThisWeek);
  quickButtons.appendChild(btnThisMonth);
  quickButtons.appendChild(btnReset);

  if (window.location.search.includes('okres=1')) {
    const btnFullSemester = document.createElement('button');
    btnFullSemester.className = 'btn-load-semester';
    btnFullSemester.innerText = 'Wczytaj cały semestr';
    btnFullSemester.addEventListener('click', () => {
      window.location.href = window.location.href.replace('okres=1', 'okres=2');
    });
    quickButtons.appendChild(btnFullSemester);
  }

  bar.appendChild(inputsGroup);
  bar.appendChild(quickButtons);
  return bar;
}

function createFilterPanel(entries, calendarContainer) {
  const panel = document.createElement('div');
  panel.id = 'plan-subject-filter-panel';

  const heading = document.createElement('h3');
  heading.innerText = 'Przedmioty do wyboru (odznacz przedmioty, na które nie uczęszczasz):';
  panel.appendChild(heading);

  const listContainer = document.createElement('div');
  listContainer.className = 'subject-list';

  const hiddenSubjects = getHiddenSubjects();

  OPTIONAL_SUBJECTS.forEach(subject => {
    const label = document.createElement('label');
    label.className = 'subject-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !hiddenSubjects.includes(subject);

    checkbox.addEventListener('change', () => {
      let currentHidden = getHiddenSubjects();
      if (checkbox.checked) {
        currentHidden = currentHidden.filter(item => item !== subject);
      } else {
        if (!currentHidden.includes(subject)) {
          currentHidden.push(subject);
        }
      }
      saveHiddenSubjects(currentHidden);
      applyFiltersAndRender(entries, calendarContainer);
    });

    const text = document.createElement('span');
    text.innerText = subject;

    label.appendChild(checkbox);
    label.appendChild(text);
    listContainer.appendChild(label);
  });

  panel.appendChild(listContainer);
  return panel;
}

function insertDateBarInCenter(dateFilterBar, fallbackElement) {
  const selectEl = document.querySelector('select');
  if (selectEl) {
    const formContainer = selectEl.closest('form') || selectEl.parentElement;
    if (formContainer && formContainer.parentNode) {
      formContainer.parentNode.insertBefore(dateFilterBar, formContainer.nextSibling);
      return;
    }
  }
  fallbackElement.parentNode.insertBefore(dateFilterBar, fallbackElement);
}

function initExtension() {
  removeAccessibilityWidget();

  const originalTable = document.querySelector('table[border="1"]') || document.querySelector('table');
  if (!originalTable) return;

  const entries = parseTableEntries();

  const calendarContainer = document.createElement('div');
  calendarContainer.id = 'plan-calendar-view';
  originalTable.parentNode.insertBefore(calendarContainer, originalTable);

  const toolbar = document.createElement('div');
  toolbar.id = 'plan-enhancer-toolbar';

  const title = document.createElement('span');
  title.className = 'toolbar-title';
  title.innerText = 'Harmonogram Zajęć UEK';

  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'toolbar-buttons';

  const viewToggleBtn = document.createElement('button');
  const filterBtn = document.createElement('button');
  filterBtn.innerText = 'Przedmioty do wyboru (5)';
  const themeBtn = document.createElement('button');

  const filterPanel = createFilterPanel(entries, calendarContainer);
  const dateFilterBar = createDateFilterBar(entries, calendarContainer);

  function updateViewMode(mode) {
    if (mode === 'table') {
      calendarContainer.style.display = 'none';
      originalTable.style.display = '';
      viewToggleBtn.innerText = 'Widok: Dzienny';
    } else {
      calendarContainer.style.display = 'flex';
      originalTable.style.display = 'none';
      viewToggleBtn.innerText = 'Widok: Tabela';
    }
    localStorage.setItem(STORAGE_KEY_VIEW_MODE, mode);
  }

  function updateThemeButtonLabel() {
    const isDark = document.body.classList.contains('dark-mode');
    themeBtn.innerText = isDark ? 'Motyw: Jasny' : 'Motyw: Ciemny';
  }

  const savedMode = localStorage.getItem(STORAGE_KEY_VIEW_MODE) || 'calendar';
  updateViewMode(savedMode);

  viewToggleBtn.addEventListener('click', () => {
    const currentMode = localStorage.getItem(STORAGE_KEY_VIEW_MODE) || 'calendar';
    const nextMode = currentMode === 'calendar' ? 'table' : 'calendar';
    updateViewMode(nextMode);
  });

  filterBtn.addEventListener('click', () => {
    const isHidden = filterPanel.style.display === 'none' || filterPanel.style.display === '';
    filterPanel.style.display = isHidden ? 'block' : 'none';
  });

  if (localStorage.getItem('planDarkMode') === 'true') {
    document.body.classList.add('dark-mode');
  }
  updateThemeButtonLabel();

  themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('planDarkMode', isDark);
    updateThemeButtonLabel();
  });

  buttonsContainer.appendChild(viewToggleBtn);
  buttonsContainer.appendChild(filterBtn);
  buttonsContainer.appendChild(themeBtn);
  toolbar.appendChild(title);
  toolbar.appendChild(buttonsContainer);

  document.body.prepend(filterPanel);
  document.body.prepend(toolbar);

  insertDateBarInCenter(dateFilterBar, calendarContainer);

  applyFiltersAndRender(entries, calendarContainer);
}

initExtension();