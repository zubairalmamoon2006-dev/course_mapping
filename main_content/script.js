// Store all course mapping entries
let mappings = [];

// Dynamically update table headers to add Serial Number column
function updateTableHeaders() {
  const thead = document.querySelector("#results-table thead");
  if (!thead) return;
  const headerRow = thead.querySelector("tr");
  if (!headerRow) return;

  if (!headerRow.querySelector("th.sn-col")) {
    const snTh = document.createElement("th");
    snTh.className = "sn-col";
    snTh.textContent = "S.No.";
    headerRow.insertBefore(snTh, headerRow.firstChild);
  }
}

// Load JSON dataset, populate dropdowns, update headers, restore filters
fetch("overall_mappings.json")
  .then(res => res.json())
  .then(data => {
    mappings = data;
    populateDropdowns();
    updateTableHeaders();
    restoreState();
  })
  .catch(err => console.error("Error loading JSON file:", err));

// Populate all filter dropdowns
function populateDropdowns() {
  populateUniversityDropdown();
  populateDepartmentDropdown();
  populateCountryDropdown();
}

// Populate Foreign University dropdown
function populateUniversityDropdown() {
  const uniSelect = document.getElementById("university");
  if (!uniSelect) return;
  const universities = [
    ...new Set(
      mappings.map(item => (item["Foreign University Name"] || "").trim()).filter(u => u !== "")
    ),
  ].sort((a, b) => a.localeCompare(b));
  uniSelect.innerHTML = `<option value="">--Select--</option>`;
  universities.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u;
    opt.textContent = u;
    uniSelect.appendChild(opt);
  });
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
  deptSelect.innerHTML = `<option value="">--Select--</option>`;
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
  countrySelect.innerHTML = `<option value="">--Select--</option>`;
  countries.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    countrySelect.appendChild(opt);
  });
}

// Render the main table with results (Serial Number included)
function renderTable(filtered) {
  const tbody = document.querySelector("#results-table tbody");
  const thead = document.querySelector("#results-table thead");
  tbody.innerHTML = "";
  if (!filtered || filtered.length === 0) {
    if (thead) thead.style.display = "none";
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="6" style="text-align:center; padding:20px; font-size:16px; color:#555;">No such mappings have been done by students from previous batches</td>`;
    tbody.appendChild(row);
    return;
  }
  if (thead) thead.style.display = "";
  filtered.forEach((item, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${item["IITB Course (code-name)"] || "NA"}</td>
      <td>${item["Department of Student"] || "NA"}</td>
      <td>${item["Foreign University Name"] || "NA"}</td>
      <td>${item["Country"] || "NA"}</td>
      <td>${item["Foreign Course (code-name)"] || "NA"}</td>
    `;
    row.addEventListener("click", () => {
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
    renderTable(mappings);
  });
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
  }
}

// Return to Main Page button handler with relative path
if (document.getElementById("backBtn")) {
  document.getElementById("backBtn").addEventListener("click", () => {
    window.location.href = "../index.html"; // updated path here
  });
}
