// Redirect button functionality
document.getElementById("searchBtn").addEventListener("click", () => {
  window.location.href = "main_content/index.html";
});

// Load mapping data and display keywords
fetch("main_content/overall_mappings.json")
  .then(res => res.json())
  .then(data => {
    renderKeywordTags("country-tags", data, "Country");
    renderKeywordTags("dept-tags", data, "Department of Student");
    renderKeywordTags("uni-tags", data, "Foreign University Name");
  })
  .catch(err => console.error("Error loading mapping data:", err));

function renderKeywordTags(elementId, data, field) {
  const container = document.getElementById(elementId);
  if (!container) return;
  const counts = {};
  data.forEach(item => {
    const val = (item[field] || "").trim();
    if (val !== "") {
      counts[val] = (counts[val] || 0) + 1;
    }
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  container.innerHTML = sorted.map(([name, count]) =>
    `<span class="keyword-tag">${name} <span class="count">${count}</span></span>`
  ).join("");
}
