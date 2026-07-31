// Store all course mapping entries
let mappings = [];
let currentFiltered = [];
let selectedCourses = [];

// Load JSON dataset, populate dropdowns, restore filters
fetch("overall_mappings.json")
  .then(res => res.json())
  .then(data => {
    mappings = data;
    populateDropdowns();
    restoreState();
    setupAutocomplete();
    renderRecentlyViewed();
    renderBookmarks();
  })
  .catch(err => console.error("Error loading JSON file:", err));

// Populate all filter dropdowns
function populateDropdowns() {
  populateUniversityDropdown();
  populateDepartmentDropdown();
  populateCountryDropdown();
}

// Populate Foreign University dropdown (filtered by country)
function populateUniversityDropdown(countryFilter) {
  const uniSelect = document.getElementById("university");
  if (!uniSelect) return;
  const prev = uniSelect.value;
  let filtered = mappings;
  if (countryFilter) {
    filtered = mappings.filter(item => (item["Country"] || "").trim() === countryFilter);
  }
  const universities = [
    ...new Set(
      filtered.map(item => (item["Foreign University Name"] || "").trim()).filter(u => u !== "")
    ),
  ].sort((a, b) => a.localeCompare(b));
  uniSelect.innerHTML = `<option value="">All</option>`;
  universities.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u;
    opt.textContent = u;
    uniSelect.appendChild(opt);
  });
  if (universities.includes(prev)) uniSelect.value = prev;
}

// Populate Department dropdown
function populateDepartmentDropdown() {
  const deptSelect = document.getElementById("department");
  if (!deptSelect) return;
  const departments = [
    ...new Set(
      mappings.map(item => (item["Department of Student"] || "").trim()).filter(d => d !== "")
    ),
  ].sort((a, b) => a.localeCompare(b));
  deptSelect.innerHTML = `<option value="">All</option>`;
  departments.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    deptSelect.appendChild(opt);
  });
}

// Populate Country dropdown
function populateCountryDropdown() {
  const countrySelect = document.getElementById("country");
  if (!countrySelect) return;
  const countries = [
    ...new Set(
      mappings.map(item => (item["Country"] || "").trim()).filter(c => c !== "")
    ),
  ].sort((a, b) => a.localeCompare(b));
  countrySelect.innerHTML = `<option value="">All</option>`;
  countries.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    countrySelect.appendChild(opt);
  });
  countrySelect.addEventListener("change", function () {
    populateUniversityDropdown(this.value);
  });
}

// Setup autocomplete for course code input
function setupAutocomplete() {
  const input = document.getElementById("course");
  const list = document.getElementById("autocomplete-list");
  if (!input || !list) return;

  const courseCodes = [
    ...new Set(
      mappings.map(item => (item["IITB Course (code-name)"] || "").trim()).filter(c => c !== "")
    ),
  ].sort((a, b) => a.localeCompare(b));

  function getPrefix(code) {
    const match = code.match(/^([A-Za-z]+)/);
    return match ? match[1].toLowerCase() : code.toLowerCase();
  }

  input.addEventListener("input", function () {
    const val = this.value.trim().toLowerCase();
    list.innerHTML = "";
    if (val.length === 0) {
      list.style.display = "none";
      return;
    }
    const matches = courseCodes.filter(code => getPrefix(code).startsWith(val)).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    if (matches.length === 0) {
      list.style.display = "none";
      return;
    }
    matches.forEach(code => {
      const item = document.createElement("div");
      item.className = "autocomplete-item";
      item.textContent = code;
      item.addEventListener("click", function () {
        input.value = code;
        list.innerHTML = "";
        list.style.display = "none";
      });
      list.appendChild(item);
    });
    list.style.display = "block";
  });

  document.addEventListener("click", function (e) {
    if (!input.contains(e.target) && !list.contains(e.target)) {
      list.style.display = "none";
    }
  });
}

// Export filtered results to Excel
function exportToExcel() {
  const dataToExport = currentFiltered.length > 0 ? currentFiltered : mappings;
  if (dataToExport.length === 0) {
    alert("No data to export");
    return;
  }
  const rows = dataToExport.map((item, index) => ({
    "S.No.": index + 1,
    "IITB Course Code": item["IITB Course (code-name)"] || "NA",
    "Department": item["Department of Student"] || "NA",
    "Foreign University": item["Foreign University Name"] || "NA",
    "Country": item["Country"] || "NA",
    "Foreign Course Code": item["Foreign Course (code-name)"] || "NA"
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Course Mappings");
  XLSX.writeFile(wb, "course_mappings.xlsx");
}

// Recently viewed functions
function addToRecentlyViewed(item) {
  let recent = JSON.parse(localStorage.getItem("recentlyViewed") || "[]");
  recent = recent.filter(r => r["IITB Course (code-name)"] !== item["IITB Course (code-name)"]);
  recent.unshift(item);
  if (recent.length > 5) recent = recent.slice(0, 5);
  localStorage.setItem("recentlyViewed", JSON.stringify(recent));
  renderRecentlyViewed();
}

function renderRecentlyViewed() {
  const list = document.getElementById("recent-list");
  const section = document.getElementById("recent-section");
  if (!list || !section) return;
  const recent = JSON.parse(localStorage.getItem("recentlyViewed") || "[]");
  if (recent.length === 0) {
    section.style.display = "none";
    return;
  }
  section.style.display = "block";
  list.innerHTML = recent.map(item => `
    <div class="recent-item" onclick="viewCourse('${(item["IITB Course (code-name)"] || "").replace(/'/g, "\\'")}')">
      <span>${item["IITB Course (code-name)"] || "NA"}</span>
      <span style="color:#888; font-size:12px;">${item["Foreign University Name"] || "NA"}</span>
    </div>
  `).join("");
}

function viewCourse(courseCode) {
  const item = mappings.find(m => m["IITB Course (code-name)"] === courseCode);
  if (item) {
    localStorage.setItem("selectedMapping", JSON.stringify(item));
    window.location.href = "detail.html";
  }
}

// Bookmark functions
function toggleBookmark(item, event) {
  if (event) event.stopPropagation();
  let bookmarks = JSON.parse(localStorage.getItem("bookmarks") || "[]");
  const code = item["IITB Course (code-name)"];
  const exists = bookmarks.findIndex(b => b["IITB Course (code-name)"] === code);
  if (exists >= 0) {
    bookmarks.splice(exists, 1);
  } else {
    bookmarks.push(item);
  }
  localStorage.setItem("bookmarks", JSON.stringify(bookmarks));
  renderBookmarks();
  renderTable(currentFiltered.length > 0 ? currentFiltered : mappings);
}

function isBookmarked(courseCode) {
  const bookmarks = JSON.parse(localStorage.getItem("bookmarks") || "[]");
  return bookmarks.some(b => b["IITB Course (code-name)"] === courseCode);
}

function renderBookmarks() {
  const list = document.getElementById("bookmarks-list");
  const section = document.getElementById("bookmarks-section");
  if (!list || !section) return;
  const bookmarks = JSON.parse(localStorage.getItem("bookmarks") || "[]");
  if (bookmarks.length === 0) {
    section.style.display = "none";
    return;
  }
  section.style.display = "block";
  list.innerHTML = bookmarks.map(item => `
    <div class="bookmark-item" onclick="viewCourse('${(item["IITB Course (code-name)"] || "").replace(/'/g, "\\'")}')">
      <span>${item["IITB Course (code-name)"] || "NA"}</span>
      <span style="color:#888; font-size:12px;">${item["Foreign University Name"] || "NA"}</span>
      <button class="remove-bookmark" onclick="toggleBookmark(mappings.find(m=>m['IITB Course (code-name)']==='${(item["IITB Course (code-name)"] || "").replace(/'/g, "\\'")}')  || ${JSON.stringify(item).replace(/"/g, '&quot;')}, event)">Remove</button>
    </div>
  `).join("");
}

// Credit calculator functions
function updateCreditCalculator() {
  const iitbTotal = selectedCourses.reduce((sum, item) => sum + (parseFloat(item["IITB Course Credits"]) || 0), 0);
  document.getElementById("selected-count").textContent = selectedCourses.length;
  document.getElementById("total-iitb-credits").textContent = iitbTotal;
  document.getElementById("credit-calculator").style.display = selectedCourses.length > 0 ? "block" : "none";
}

function toggleCourseSelection(item, checkbox) {
  if (checkbox.checked) {
    if (!selectedCourses.find(c => c["IITB Course (code-name)"] === item["IITB Course (code-name)"])) {
      selectedCourses.push(item);
    }
  } else {
    selectedCourses = selectedCourses.filter(c => c["IITB Course (code-name)"] !== item["IITB Course (code-name)"]);
  }
  updateCreditCalculator();
}

// Render the main table with results (Serial Number included)
function renderTable(filtered) {
  const tbody = document.querySelector("#results-table tbody");
  const thead = document.querySelector("#results-table thead");
  tbody.innerHTML = "";
  currentFiltered = filtered || [];
  selectedCourses = [];
  updateCreditCalculator();
  if (!filtered || filtered.length === 0) {
    if (thead) thead.style.display = "none";
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="6" style="text-align:center; padding:40px 20px; font-size:15px; color:#64748b;">No such mappings have been done by students from previous batches</td>`;
    tbody.appendChild(row);
    return;
  }
  if (thead) thead.style.display = "";
  filtered.forEach((item, index) => {
    const bookmarked = isBookmarked(item["IITB Course (code-name)"]);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input type="checkbox" class="course-checkbox" onchange="toggleCourseSelection(mappings.find(m=>m['IITB Course (code-name)']==='${(item["IITB Course (code-name)"] || "").replace(/'/g, "\\'")}') || this.closest('tr').dataset, this)" /></td>
      <td>${item["IITB Course (code-name)"] || "NA"}</td>
      <td>${item["Department of Student"] || "NA"}</td>
      <td>${item["Foreign University Name"] || "NA"}</td>
      <td>${item["Country"] || "NA"}</td>
      <td>${item["Foreign Course (code-name)"] || "NA"}</td>
    `;
    row.style.cursor = "pointer";
    row.addEventListener("click", (e) => {
      if (e.target.type === "checkbox" || e.target.classList.contains("bookmark-btn")) return;
      addToRecentlyViewed(item);
      localStorage.setItem("selectedMapping", JSON.stringify(item));
      window.location.href = "detail.html";
    });
    tbody.appendChild(row);
  });
}

// Submit button handler (filter and search)
if (document.getElementById("submitBtn")) {
  document.getElementById("submitBtn").addEventListener("click", () => {
    const courseInput = document.getElementById("course").value.trim().toLowerCase().replace(/\s+/g, "");
    const dept = document.getElementById("department").value;
    const uniInput = document.getElementById("university").value;
    const countryInput = document.getElementById("country").value;
    const filtered = mappings.filter(item => {
      const courseCode = (item["IITB Course (code-name)"] || "").toLowerCase().replace(/\s+/g, "");
      const deptMatch = !dept || item["Department of Student"] === dept;
      const uniMatch = !uniInput || item["Foreign University Name"] === uniInput;
      const countryMatch = !countryInput || item["Country"] === countryInput;
      const codeMatch = !courseInput || courseCode.includes(courseInput);
      return codeMatch && deptMatch && uniMatch && countryMatch;
    });
    localStorage.setItem("filters", JSON.stringify({ courseInput, dept, uniInput, countryInput }));
    localStorage.setItem("filteredResults", JSON.stringify(filtered));
    renderTable(filtered);
  });
}

// Reset Filters button handler
if (document.getElementById("resetBtn")) {
  document.getElementById('resetBtn').addEventListener('click', () => {
    document.getElementById('course').value = '';
    document.getElementById('department').selectedIndex = 0;
    document.getElementById('university').selectedIndex = 0;
    document.getElementById('country').selectedIndex = 0;
    localStorage.removeItem('filters');
    localStorage.removeItem('filteredResults');
    currentFiltered = [];
    renderTable(mappings);
  });
}

// Export to Excel button handler
if (document.getElementById("exportBtn")) {
  document.getElementById("exportBtn").addEventListener("click", exportToExcel);
}

// Restore previous filters & results on page load
function restoreState() {
  const filters = JSON.parse(localStorage.getItem("filters") || "null");
  const results = JSON.parse(localStorage.getItem("filteredResults") || "null");
  if (filters) {
    document.getElementById("course").value = filters.courseInput || "";
    document.getElementById("department").value = filters.dept || "";
    document.getElementById("university").value = filters.uniInput || "";
    document.getElementById("country").value = filters.countryInput || "";
  }
  if (results) {
    renderTable(results);
  }
}

// Format description strings with line breaks
function formatDescription(desc) {
  if (!desc) return "NA";
  return desc
    .replace(/(\d+\s*[).])/g, '<br>$1') // add <br> before numbered points like 1) 2)
    .replace(/<br>1[).]/, '1)'); // remove first extra <br>
}

// Detail page data injection
if (window.location.pathname.includes("detail.html")) {
  const mapping = JSON.parse(localStorage.getItem("selectedMapping") || "null");
  if (mapping) {
    addToRecentlyViewed(mapping);
    document.getElementById("iitb-heading").textContent = mapping["IITB Course (code-name)"] || "IITB Course";
    document.getElementById("foreign-heading").textContent = mapping["Foreign Course (code-name)"] || "Foreign Course";
    const tbody = document.querySelector("#detail-table tbody");
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td>University</td>
          <td>IIT Bombay</td>
          <td>${mapping["Foreign University Name"] || "NA"}</td>
        </tr>
        <tr>
          <td>Country</td>
          <td>India</td>
          <td>${mapping["Country"] || "NA"}</td>
        </tr>
        <tr>
          <td>Description</td>
          <td>${formatDescription(mapping["IITB Course Descriptions"])}</td>
          <td>${formatDescription(mapping["Foreign Course Description"])}</td>
        </tr>
        <tr>
          <td>Credits</td>
          <td>${mapping["IITB Course Credits"] || "NA"}</td>
          <td>${mapping["Credits(Foreign Course)"] || "NA"}</td>
        </tr>
      `;
    }
    const bookmarkBtn = document.getElementById("bookmarkBtn");
    if (bookmarkBtn) {
      const updateBtn = () => {
        const bookmarked = isBookmarked(mapping["IITB Course (code-name)"]);
        bookmarkBtn.textContent = bookmarked ? "Added to Bookmark" : "Bookmark";
        bookmarkBtn.style.background = bookmarked ? "#27ae60" : "#2c3e50";
      };
      updateBtn();
      bookmarkBtn.addEventListener("click", () => {
        let bookmarks = JSON.parse(localStorage.getItem("bookmarks") || "[]");
        const code = mapping["IITB Course (code-name)"];
        const exists = bookmarks.findIndex(b => b["IITB Course (code-name)"] === code);
        if (exists >= 0) {
          bookmarks.splice(exists, 1);
        } else {
          bookmarks.push(mapping);
        }
        localStorage.setItem("bookmarks", JSON.stringify(bookmarks));
        updateBtn();
      });
    }
  }
}

// Return to Main Page button handler with relative path
if (document.getElementById("backBtn")) {
  document.getElementById("backBtn").addEventListener("click", () => {
    window.location.href = "../index.html"; // updated path here
  });
}
