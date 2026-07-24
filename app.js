// Global Application State
let appData = [];        // Baseline complete dataset
let filteredData = [];   // Filtered dataset active for dashboard
let activeTab = 'panel-overview';
let charts = {};         // Holds Chart.js instances

// Pagination & Explorer State
let explorerState = {
  searchQuery: '',
  currentPage: 1,
  pageSize: 25,
  sortColumn: 'Date',
  sortDirection: 'asc' // or 'desc'
};

// Formatter Helpers
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

const numberFormatter = new Intl.NumberFormat('en-US');

// Initialize Dashboard
document.addEventListener("DOMContentLoaded", async () => {
  setupTheme();
  setupNavigation();
  setupEventListeners();
  
  // Load data
  await loadDataset();
});

// Theme Management
function setupTheme() {
  const themeToggle = document.getElementById("theme-toggle");
  
  // Check local storage or system preference
  let currentTheme = localStorage.getItem("theme");
  if (!currentTheme) {
    currentTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  
  document.documentElement.setAttribute("data-theme", currentTheme);
  
  themeToggle.addEventListener("click", () => {
    const newTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    
    // Redraw charts with theme-specific styling
    updateChartThemeStyles();
  });
}

// Navigation Tabs
function setupNavigation() {
  const navLinks = document.querySelectorAll(".nav-link");
  const panels = document.querySelectorAll(".content-panel");
  const pageTitle = document.getElementById("page-title");
  const pageSubtitle = document.getElementById("page-subtitle");
  
  navLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const targetPanelId = link.getAttribute("data-target");
      
      // Update sidebar nav active state
      navLinks.forEach(l => l.classList.remove("active"));
      link.classList.add("active");
      
      // Update panels active state
      panels.forEach(p => p.classList.remove("active"));
      document.getElementById(targetPanelId).classList.add("active");
      
      activeTab = targetPanelId;
      
      // Update page titles
      switch(targetPanelId) {
        case 'panel-overview':
          pageTitle.innerText = "Executive Dashboard";
          pageSubtitle.innerText = "Real-time sales performance and business health analytics";
          break;
        case 'panel-charts':
          pageTitle.innerText = "Performance Analytics";
          pageSubtitle.innerText = "Deep-dive into demographic, product, and geographic trends";
          break;
        case 'panel-simulator':
          pageTitle.innerText = "What-If Business Simulator";
          pageSubtitle.innerText = "Model changes in pricing, volume, and material costs to project outcomes";
          // Trigger initial simulator render
          runSimulation();
          break;
        case 'panel-explorer':
          pageTitle.innerText = "Data Explorer";
          pageSubtitle.innerText = "Inspect, filter, and export the transaction ledger";
          updateExplorerTable();
          break;
      }
    });
  });
}

// Set up UI Event Listeners
function setupEventListeners() {
  // Reset filters button
  document.getElementById("btn-reset-filters").addEventListener("click", () => {
    document.getElementById("filter-country").value = "all";
    document.getElementById("filter-category").value = "all";
    document.getElementById("filter-gender").value = "all";
    document.getElementById("filter-age").value = "all";
    
    applyFilters();
  });

  // Filters inputs
  document.querySelectorAll(".filter-select").forEach(select => {
    select.addEventListener("change", () => {
      // If we are changing filters, reset pagination to page 1
      explorerState.currentPage = 1;
      applyFilters();
    });
  });
  
  // Explorer Table Search
  document.getElementById("explorer-search-input").addEventListener("input", (e) => {
    explorerState.searchQuery = e.target.value;
    explorerState.currentPage = 1;
    updateExplorerTable();
  });

  // Table Page Size
  document.getElementById("select-page-size").addEventListener("change", (e) => {
    explorerState.pageSize = parseInt(e.target.value);
    explorerState.currentPage = 1;
    updateExplorerTable();
  });

  // Table headers click for sorting
  document.querySelectorAll("#raw-data-table th.sortable").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.getAttribute("data-column");
      if (explorerState.sortColumn === col) {
        explorerState.sortDirection = explorerState.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        explorerState.sortColumn = col;
        explorerState.sortDirection = 'asc';
      }
      
      // Update visual indicators
      document.querySelectorAll("#raw-data-table th i").forEach(icon => {
        icon.className = "fa-solid fa-sort";
      });
      const icon = th.querySelector("i");
      icon.className = explorerState.sortDirection === 'asc' ? "fa-solid fa-sort-up" : "fa-solid fa-sort-down";
      
      updateExplorerTable();
    });
  });

  // Pagination buttons
  document.getElementById("btn-page-prev").addEventListener("click", () => {
    if (explorerState.currentPage > 1) {
      explorerState.currentPage--;
      updateExplorerTable();
    }
  });

  document.getElementById("btn-page-next").addEventListener("click", () => {
    const totalPages = Math.ceil(getExplorerFilteredData().length / explorerState.pageSize);
    if (explorerState.currentPage < totalPages) {
      explorerState.currentPage++;
      updateExplorerTable();
    }
  });

  // Export CSV
  document.getElementById("btn-export-csv").addEventListener("click", exportToCSV);

  // Simulator Inputs
  const simulatorSliders = ["slider-price", "slider-cost", "slider-volume"];
  simulatorSliders.forEach(id => {
    const slider = document.getElementById(id);
    const valueDisplay = document.getElementById(`val-${id}`);
    
    slider.addEventListener("input", (e) => {
      const val = e.target.value;
      valueDisplay.innerText = (val > 0 ? "+" : "") + val + "%";
      runSimulation();
    });
  });

  document.getElementById("select-sim-country").addEventListener("change", (e) => {
    const country = e.target.value;
    document.getElementById("val-select-sim-country").innerText = country === 'none' ? 'None' : country;
    runSimulation();
  });

  document.getElementById("btn-reset-simulator").addEventListener("click", () => {
    document.getElementById("slider-price").value = 0;
    document.getElementById("val-slider-price").innerText = "0%";
    
    document.getElementById("slider-cost").value = 0;
    document.getElementById("val-slider-cost").innerText = "0%";
    
    document.getElementById("slider-volume").value = 0;
    document.getElementById("val-slider-volume").innerText = "0%";
    
    document.getElementById("select-sim-country").value = "none";
    document.getElementById("val-select-sim-country").innerText = "None";
    
    runSimulation();
  });
}

// Load dataset and perform setup
async function loadDataset() {
  const loadingScreen = document.getElementById("loading-screen");
  const progressBar = document.getElementById("loading-progress-bar");
  
  try {
    progressBar.style.width = "20%";
    // Simulating progress states for a professional feel
    setTimeout(() => progressBar.style.width = "50%", 150);
    
    const response = await fetch("data/sales_data.json");
    if (!response.ok) {
      throw new Error(`Failed to load sales data: ${response.statusText}`);
    }
    
    setTimeout(() => progressBar.style.width = "85%", 300);
    
    appData = await response.json();
    filteredData = [...appData];
    
    progressBar.style.width = "100%";
    
    // Set up filter dropdowns with unique options
    populateFilterDropdowns();
    
    // Initial KPIs rendering
    calculateDashboardKPIs();
    
    // Initial charts rendering
    renderCharts();
    
    // Fade out loading screen
    setTimeout(() => {
      loadingScreen.classList.add("fade-out");
    }, 500);

  } catch (error) {
    console.error(error);
    document.querySelector(".loading-text").innerHTML = `<span style="color: var(--color-danger)">Error loading data. Please run preprocess.py or ensure data/sales_data.json exists.</span>`;
    progressBar.style.backgroundColor = "var(--color-danger)";
  }
}

// Dynamically populate select dropdown inputs
function populateFilterDropdowns() {
  const countries = new Set();
  const categories = new Set();
  const ageGroups = new Set();
  
  appData.forEach(row => {
    if (row.Country) countries.add(row.Country);
    if (row.Product_Category) categories.add(row.Product_Category);
    if (row.Age_Group) ageGroups.add(row.Age_Group);
  });
  
  // Sort and populate
  const countrySelect = document.getElementById("filter-country");
  const simCountrySelect = document.getElementById("select-sim-country");
  Array.from(countries).sort().forEach(c => {
    countrySelect.add(new Option(c, c));
    simCountrySelect.add(new Option(c, c));
  });
  
  const categorySelect = document.getElementById("filter-category");
  Array.from(categories).sort().forEach(c => {
    categorySelect.add(new Option(c, c));
  });
  
  const ageSelect = document.getElementById("filter-age");
  Array.from(ageGroups).sort().forEach(a => {
    ageSelect.add(new Option(a, a));
  });
}

// Core filter computation
function applyFilters() {
  const countryVal = document.getElementById("filter-country").value;
  const categoryVal = document.getElementById("filter-category").value;
  const genderVal = document.getElementById("filter-gender").value;
  const ageVal = document.getElementById("filter-age").value;
  
  filteredData = appData.filter(row => {
    const matchCountry = countryVal === "all" || row.Country === countryVal;
    const matchCategory = categoryVal === "all" || row.Product_Category === categoryVal;
    const matchGender = genderVal === "all" || row.Customer_Gender === genderVal;
    const matchAge = ageVal === "all" || row.Age_Group === ageVal;
    
    return matchCountry && matchCategory && matchGender && matchAge;
  });
  
  // Update stats
  calculateDashboardKPIs();
  
  // Update charts
  updateDashboardCharts();
  
  // If Simulator is active, run it too
  if (activeTab === 'panel-simulator') {
    runSimulation();
  }
  
  // If Data Explorer is active
  if (activeTab === 'panel-explorer') {
    updateExplorerTable();
  }
}

// Calculate Metrics
function calculateDashboardKPIs() {
  let revenue = 0;
  let cost = 0;
  let profit = 0;
  let orders = filteredData.length;
  
  filteredData.forEach(row => {
    revenue += row.Revenue || 0;
    cost += row.Cost || 0;
    profit += row.Profit || 0;
  });
  
  const margin = revenue > 0 ? (profit / revenue) : 0;
  const aov = orders > 0 ? (revenue / orders) : 0;
  
  // Populate UI
  document.getElementById("val-revenue").innerText = currencyFormatter.format(revenue);
  document.getElementById("val-profit").innerText = currencyFormatter.format(profit);
  document.getElementById("val-margin").innerText = percentFormatter.format(margin);
  document.getElementById("val-orders").innerText = numberFormatter.format(orders);
  document.getElementById("val-aov").innerText = currencyFormatter.format(aov);
}

// Fetch Chart Theme Colors dynamically from DOM Custom Properties
function getChartColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    text: style.getPropertyValue('--text-secondary').trim() || '#9ca3af',
    textPrimary: style.getPropertyValue('--text-primary').trim() || '#f3f4f6',
    grid: style.getPropertyValue('--border-color').trim() || 'rgba(255,255,255,0.08)',
    primary: style.getPropertyValue('--color-primary').trim() || '#6366f1',
    secondary: style.getPropertyValue('--color-secondary').trim() || '#06b6d4',
    success: style.getPropertyValue('--color-success').trim() || '#10b981',
    danger: style.getPropertyValue('--color-danger').trim() || '#f43f5e',
    warning: style.getPropertyValue('--color-warning').trim() || '#fbbf24',
    info: style.getPropertyValue('--color-info').trim() || '#3b82f6',
    accentGlow: style.getPropertyValue('--color-primary-glow').trim() || 'rgba(99, 102, 241, 0.15)',
    successGlow: style.getPropertyValue('--color-success-glow').trim() || 'rgba(16, 115, 81, 0.2)'
  };
}

// Chart options template helper
function getCommonChartOptions(colors) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: colors.text,
          font: { family: 'Inter', size: 11, weight: '500' }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#ffffff',
        bodyColor: '#e2e8f0',
        borderColor: colors.grid,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 6,
        bodyFont: { family: 'Inter' },
        titleFont: { family: 'Outfit', weight: 'bold' }
      }
    },
    scales: {
      x: {
        grid: { color: colors.grid, drawOnChartArea: true },
        ticks: { color: colors.text, font: { family: 'Inter', size: 10 } }
      },
      y: {
        grid: { color: colors.grid },
        ticks: { color: colors.text, font: { family: 'Inter', size: 10 } }
      }
    }
  };
}

// Render all Chart.js instances
function renderCharts() {
  const colors = getChartColors();
  
  // 1. Line Chart: Revenue & Profit Trend
  const trendCtx = document.getElementById("chart-revenue-trend").getContext("2d");
  const trendData = aggregateTrendData();
  
  // Create gradient fills
  const revGradient = trendCtx.createLinearGradient(0, 0, 0, 300);
  revGradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
  revGradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');
  
  const profGradient = trendCtx.createLinearGradient(0, 0, 0, 300);
  profGradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
  profGradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

  charts.trend = new Chart(trendCtx, {
    type: 'line',
    data: {
      labels: trendData.labels,
      datasets: [
        {
          label: 'Revenue',
          data: trendData.revenue,
          borderColor: colors.primary,
          backgroundColor: revGradient,
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 6
        },
        {
          label: 'Profit',
          data: trendData.profit,
          borderColor: colors.success,
          backgroundColor: profGradient,
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      ...getCommonChartOptions(colors),
      scales: {
        x: {
          grid: { color: colors.grid },
          ticks: { color: colors.text }
        },
        y: {
          grid: { color: colors.grid },
          ticks: {
            color: colors.text,
            callback: (value) => '$' + numberFormatter.format(value)
          }
        }
      }
    }
  });

  // 2. Donut Chart: Sales by Category
  const catCtx = document.getElementById("chart-category-donut").getContext("2d");
  const catData = aggregateCategoryData();
  
  charts.category = new Chart(catCtx, {
    type: 'doughnut',
    data: {
      labels: catData.labels,
      datasets: [{
        data: catData.values,
        backgroundColor: [colors.primary, colors.secondary, colors.warning, colors.info],
        borderWidth: 2,
        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary')
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: colors.text, font: { family: 'Inter', size: 10 } }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = percentFormatter.format(value / total);
              return ` ${label}: ${currencyFormatter.format(value)} (${percentage})`;
            }
          }
        }
      }
    }
  });

  // 3. Country Bar Chart (Performance Panel)
  const countryCtx = document.getElementById("chart-country-bar").getContext("2d");
  const countryData = aggregateCountryData();
  charts.country = new Chart(countryCtx, {
    type: 'bar',
    data: {
      labels: countryData.labels,
      datasets: [{
        label: 'Revenue',
        data: countryData.values,
        backgroundColor: colors.info,
        borderRadius: 6
      }]
    },
    options: {
      ...getCommonChartOptions(colors),
      indexAxis: 'y',
      scales: {
        x: {
          grid: { color: colors.grid },
          ticks: {
            color: colors.text,
            callback: (value) => '$' + numberFormatter.format(value)
          }
        },
        y: {
          grid: { display: false },
          ticks: { color: colors.text }
        }
      }
    }
  });

  // 4. Sub-category Bar Chart (Performance Panel)
  const subCtx = document.getElementById("chart-subcategory-bar").getContext("2d");
  const subData = aggregateSubCategoryData();
  charts.subcategory = new Chart(subCtx, {
    type: 'bar',
    data: {
      labels: subData.labels,
      datasets: [{
        label: 'Revenue',
        data: subData.values,
        backgroundColor: colors.primary,
        borderRadius: 4
      }]
    },
    options: {
      ...getCommonChartOptions(colors),
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: colors.text, maxRotation: 45, minRotation: 45 }
        },
        y: {
          grid: { color: colors.grid },
          ticks: {
            color: colors.text,
            callback: (value) => '$' + numberFormatter.format(value)
          }
        }
      }
    }
  });

  // 5. Age Group Bar Chart (Performance Panel)
  const ageCtx = document.getElementById("chart-demographics-age").getContext("2d");
  const ageData = aggregateAgeData();
  charts.age = new Chart(ageCtx, {
    type: 'bar',
    data: {
      labels: ageData.labels,
      datasets: [{
        label: 'Revenue',
        data: ageData.values,
        backgroundColor: colors.secondary,
        borderRadius: 6
      }]
    },
    options: {
      ...getCommonChartOptions(colors),
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: colors.text }
        },
        y: {
          grid: { color: colors.grid },
          ticks: {
            color: colors.text,
            callback: (value) => '$' + numberFormatter.format(value)
          }
        }
      }
    }
  });

  // 6. Gender Pie Chart (Performance Panel)
  const genderCtx = document.getElementById("chart-demographics-gender").getContext("2d");
  const genderData = aggregateGenderData();
  charts.gender = new Chart(genderCtx, {
    type: 'pie',
    data: {
      labels: genderData.labels,
      datasets: [{
        data: genderData.values,
        backgroundColor: [colors.primary, colors.danger],
        borderWidth: 2,
        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary')
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: colors.text, font: { family: 'Inter', size: 10 } }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = percentFormatter.format(value / total);
              return ` ${label}: ${currencyFormatter.format(value)} (${percentage})`;
            }
          }
        }
      }
    }
  });

  // 7. What-If Comparison Chart (Simulator Panel)
  const simCtx = document.getElementById("chart-sim-comparison").getContext("2d");
  charts.simulator = new Chart(simCtx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Baseline Revenue',
          data: [],
          backgroundColor: 'rgba(148, 163, 184, 0.5)',
          borderRadius: 4
        },
        {
          label: 'Simulated Revenue',
          data: [],
          backgroundColor: colors.primary,
          borderRadius: 4
        }
      ]
    },
    options: {
      ...getCommonChartOptions(colors),
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: colors.text }
        },
        y: {
          grid: { color: colors.grid },
          ticks: {
            color: colors.text,
            callback: (value) => '$' + numberFormatter.format(value)
          }
        }
      }
    }
  });
}

// Redraw / update charts when filters change
function updateDashboardCharts() {
  if (!charts.trend) return;
  
  const colors = getChartColors();
  
  // 1. Update Trend Chart
  const trendData = aggregateTrendData();
  charts.trend.data.labels = trendData.labels;
  charts.trend.data.datasets[0].data = trendData.revenue;
  charts.trend.data.datasets[1].data = trendData.profit;
  charts.trend.update();
  
  // 2. Update Category Chart
  const catData = aggregateCategoryData();
  charts.category.data.labels = catData.labels;
  charts.category.data.datasets[0].data = catData.values;
  charts.category.update();

  // 3. Update Country Chart
  const countryData = aggregateCountryData();
  charts.country.data.labels = countryData.labels;
  charts.country.data.datasets[0].data = countryData.values;
  charts.country.update();

  // 4. Update Sub-category Chart
  const subData = aggregateSubCategoryData();
  charts.subcategory.data.labels = subData.labels;
  charts.subcategory.data.datasets[0].data = subData.values;
  charts.subcategory.update();

  // 5. Update Age Chart
  const ageData = aggregateAgeData();
  charts.age.data.labels = ageData.labels;
  charts.age.data.datasets[0].data = ageData.values;
  charts.age.update();

  // 6. Update Gender Chart
  const genderData = aggregateGenderData();
  charts.gender.data.labels = genderData.labels;
  charts.gender.data.datasets[0].data = genderData.values;
  charts.gender.update();
}

// Handles theme change repaint on Chart.js
function updateChartThemeStyles() {
  const colors = getChartColors();
  
  Object.values(charts).forEach(chart => {
    // Update legend color
    if (chart.options.plugins && chart.options.plugins.legend) {
      chart.options.plugins.legend.labels.color = colors.text;
    }
    
    // Update scales
    if (chart.options.scales) {
      if (chart.options.scales.x) {
        chart.options.scales.x.grid.color = colors.grid;
        chart.options.scales.x.ticks.color = colors.text;
      }
      if (chart.options.scales.y) {
        chart.options.scales.y.grid.color = colors.grid;
        chart.options.scales.y.ticks.color = colors.text;
      }
    }
    
    // Specific doughnut/pie border colors
    if (chart.config.type === 'doughnut' || chart.config.type === 'pie') {
      chart.data.datasets[0].borderColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary');
    }
    
    chart.update('none'); // Silent update
  });
}

/* ==========================================================================
   Data Aggregation & Wrangling Functions
   ========================================================================== */

// Helper to parse dates and return chronologically sorted key
function getYearMonthKey(dateStr) {
  // input format: YYYY-MM-DD
  if (!dateStr || dateStr.length < 7) return "Unknown";
  const parts = dateStr.split('-');
  // return: YY-MMM e.g. "13-Dec"
  const year = parts[0].substring(2);
  const monthInt = parseInt(parts[1]);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${year}-${months[monthInt-1]}`;
}

function aggregateTrendData() {
  const monthMap = {};
  
  filteredData.forEach(row => {
    const key = getYearMonthKey(row.Date);
    if (!monthMap[key]) {
      monthMap[key] = { revenue: 0, profit: 0, rawDate: row.Date };
    }
    monthMap[key].revenue += row.Revenue || 0;
    monthMap[key].profit += row.Profit || 0;
  });
  
  // Sort chronologically
  const sortedKeys = Object.keys(monthMap).sort((a, b) => {
    return monthMap[a].rawDate.localeCompare(monthMap[b].rawDate);
  });
  
  return {
    labels: sortedKeys,
    revenue: sortedKeys.map(k => monthMap[k].revenue),
    profit: sortedKeys.map(k => monthMap[k].profit)
  };
}

function aggregateCategoryData() {
  const catMap = {};
  filteredData.forEach(row => {
    const key = row.Product_Category || "Other";
    catMap[key] = (catMap[key] || 0) + (row.Revenue || 0);
  });
  
  const sortedKeys = Object.keys(catMap).sort((a, b) => catMap[b] - catMap[a]);
  return {
    labels: sortedKeys,
    values: sortedKeys.map(k => catMap[k])
  };
}

function aggregateCountryData() {
  const countryMap = {};
  filteredData.forEach(row => {
    const key = row.Country || "Other";
    countryMap[key] = (countryMap[key] || 0) + (row.Revenue || 0);
  });
  
  // Sort descending
  const sortedKeys = Object.keys(countryMap).sort((a, b) => countryMap[b] - countryMap[a]);
  return {
    labels: sortedKeys,
    values: sortedKeys.map(k => countryMap[k])
  };
}

function aggregateSubCategoryData() {
  const subMap = {};
  filteredData.forEach(row => {
    const key = row.Sub_Category || "Other";
    subMap[key] = (subMap[key] || 0) + (row.Revenue || 0);
  });
  
  // Take top 8 sub-categories, group rest as "Others"
  const sortedKeys = Object.keys(subMap).sort((a, b) => subMap[b] - subMap[a]);
  const topKeys = sortedKeys.slice(0, 10);
  
  return {
    labels: topKeys,
    values: topKeys.map(k => subMap[k])
  };
}

function aggregateAgeData() {
  const ageMap = {};
  filteredData.forEach(row => {
    const key = row.Age_Group || "Unknown";
    ageMap[key] = (ageMap[key] || 0) + (row.Revenue || 0);
  });
  
  // Maintain standard order if possible
  const standardOrder = ["Youth (<25)", "Young Adults (25-34)", "Adults (35-64)", "Seniors (64+)"];
  const labels = standardOrder.filter(l => ageMap[l] !== undefined);
  
  // Append any others
  Object.keys(ageMap).forEach(k => {
    if (!labels.includes(k)) labels.push(k);
  });
  
  return {
    labels: labels,
    values: labels.map(k => ageMap[k])
  };
}

function aggregateGenderData() {
  const genderMap = {"Male": 0, "Female": 0};
  filteredData.forEach(row => {
    const genderKey = row.Customer_Gender === 'M' ? 'Male' : (row.Customer_Gender === 'F' ? 'Female' : 'Other');
    genderMap[genderKey] = (genderMap[genderKey] || 0) + (row.Revenue || 0);
  });
  
  const labels = Object.keys(genderMap).filter(k => genderMap[k] > 0);
  return {
    labels: labels,
    values: labels.map(k => genderMap[k])
  };
}


/* ==========================================================================
   What-If Simulator Engine
   ========================================================================== */

function runSimulation() {
  if (!charts.simulator) return;

  // Retrieve values from sliders
  const pricePct = parseFloat(document.getElementById("slider-price").value);
  const costPct = parseFloat(document.getElementById("slider-cost").value);
  const volPct = parseFloat(document.getElementById("slider-volume").value);
  const simCountry = document.getElementById("select-sim-country").value;
  
  // Base calculations
  let baseRevenue = 0;
  let baseCost = 0;
  let baseProfit = 0;
  
  // Simulated calculations
  let simRevenue = 0;
  let simCost = 0;
  let simProfit = 0;
  
  // Category breakdowns for chart comparison
  const catBaseline = {};
  const catSimulated = {};

  filteredData.forEach(row => {
    const category = row.Product_Category || "Other";
    const isTargetCountry = simCountry !== "none" && row.Country === simCountry;
    
    // Baseline numbers
    const rQty = row.Order_Quantity || 0;
    const rCost = row.Cost || 0;
    const rRev = row.Revenue || 0;
    const rProfit = row.Profit || 0;
    
    baseRevenue += rRev;
    baseCost += rCost;
    baseProfit += rProfit;
    
    catBaseline[category] = (catBaseline[category] || 0) + rRev;
    
    // Simulated variables
    // 1. Price adjustment
    const simUnitPrice = row.Unit_Price * (1 + pricePct / 100);
    // 2. Cost adjustment
    const simUnitCost = row.Unit_Cost * (1 + costPct / 100);
    // 3. Volume adjustment
    let volumeMultiplier = (1 + volPct / 100);
    if (isTargetCountry) {
      volumeMultiplier *= 1.15; // Extra 15% geographic booster
    }
    const simQty = Math.round(rQty * volumeMultiplier);
    
    // Final simulated results for transaction
    const rowSimRev = simUnitPrice * simQty;
    const rowSimCost = simUnitCost * simQty;
    const rowSimProfit = rowSimRev - rowSimCost;
    
    simRevenue += rowSimRev;
    simCost += rowSimCost;
    simProfit += rowSimProfit;
    
    catSimulated[category] = (catSimulated[category] || 0) + rowSimRev;
  });
  
  const baseMargin = baseRevenue > 0 ? (baseProfit / baseRevenue) : 0;
  const simMargin = simRevenue > 0 ? (simProfit / simRevenue) : 0;
  
  // Update Results Dashboard
  document.getElementById("sim-revenue").innerText = currencyFormatter.format(simRevenue);
  document.getElementById("sim-profit").innerText = currencyFormatter.format(simProfit);
  document.getElementById("sim-margin").innerText = percentFormatter.format(simMargin);
  
  // Format and colorize delta text
  updateDeltaUI("sim-revenue-delta", simRevenue, baseRevenue, false);
  updateDeltaUI("sim-profit-delta", simProfit, baseProfit, false);
  updateDeltaUI("sim-margin-delta", simMargin, baseMargin, true); // Margin is percentage points difference
  
  // Update simulator comparison chart
  const categories = Object.keys(catBaseline);
  charts.simulator.data.labels = categories;
  charts.simulator.data.datasets[0].data = categories.map(c => catBaseline[c]);
  charts.simulator.data.datasets[1].data = categories.map(c => catSimulated[c] || 0);
  
  // Visual tweaks for simulated bar color (red if lower than base, green if higher)
  const colors = getChartColors();
  charts.simulator.data.datasets[1].backgroundColor = simRevenue >= baseRevenue ? colors.primary : colors.danger;
  charts.simulator.update();
}

function updateDeltaUI(elementId, newVal, oldVal, isMarginDelta) {
  const el = document.getElementById(elementId);
  let deltaText = "";
  let isPositive = false;
  
  if (isMarginDelta) {
    const deltaPoints = (newVal - oldVal) * 100;
    isPositive = deltaPoints >= 0;
    deltaText = (isPositive ? "+" : "") + deltaPoints.toFixed(1) + " pp";
  } else {
    const pctChange = oldVal > 0 ? ((newVal - oldVal) / oldVal) : 0;
    isPositive = pctChange >= 0;
    deltaText = (isPositive ? "+" : "") + percentFormatter.format(pctChange);
  }
  
  el.innerText = `${deltaText} vs Baseline`;
  
  // Style class assignment
  el.className = "box-delta " + (isPositive ? "positive" : (isMarginDelta && Math.abs(newVal - oldVal) < 0.0001 ? "neutral" : "negative"));
}


/* ==========================================================================
   Data Explorer Component
   ========================================================================== */

// Helper to filter data matching current search query
function getExplorerFilteredData() {
  const query = explorerState.searchQuery.toLowerCase().trim();
  if (!query) return filteredData;
  
  return filteredData.filter(row => {
    return (
      (row.Product && row.Product.toLowerCase().includes(query)) ||
      (row.Product_Category && row.Product_Category.toLowerCase().includes(query)) ||
      (row.Sub_Category && row.Sub_Category.toLowerCase().includes(query)) ||
      (row.Country && row.Country.toLowerCase().includes(query)) ||
      (row.State && row.State.toLowerCase().includes(query))
    );
  });
}

function updateExplorerTable() {
  const tbody = document.getElementById("table-body");
  tbody.innerHTML = "";
  
  // Get active dataset matching filters + global search
  let displayData = getExplorerFilteredData();
  
  // Sort dataset
  const col = explorerState.sortColumn;
  const dir = explorerState.sortDirection === 'asc' ? 1 : -1;
  
  displayData.sort((a, b) => {
    let valA = a[col];
    let valB = b[col];
    
    // Sort logic for numbers vs strings
    if (typeof valA === 'number' && typeof valB === 'number') {
      return (valA - valB) * dir;
    }
    
    // Strings/Dates
    valA = (valA || '').toString().toLowerCase();
    valB = (valB || '').toString().toLowerCase();
    return valA.localeCompare(valB) * dir;
  });
  
  // Paginate
  const totalItems = displayData.length;
  const startIdx = (explorerState.currentPage - 1) * explorerState.pageSize;
  const endIdx = Math.min(startIdx + explorerState.pageSize, totalItems);
  const pageData = displayData.slice(startIdx, endIdx);
  
  if (pageData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted)">No matching records found. Try adjusting filters or search string.</td></tr>`;
    document.getElementById("pagination-info-text").innerText = `Showing 0 to 0 of 0 entries`;
    document.getElementById("btn-page-prev").disabled = true;
    document.getElementById("btn-page-next").disabled = true;
    document.getElementById("page-numbers-container").innerHTML = "";
    return;
  }
  
  // Insert rows
  pageData.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.Date}</td>
      <td><span class="badge badge-country">${row.Country}</span></td>
      <td><span class="badge badge-category">${row.Product_Category}</span></td>
      <td>${row.Sub_Category}</td>
      <td style="font-weight: 500; color: var(--text-primary)">${row.Product}</td>
      <td class="numeric">${numberFormatter.format(row.Order_Quantity)}</td>
      <td class="numeric">${currencyFormatter.format(row.Unit_Price)}</td>
      <td class="numeric" style="font-weight: 500; color: var(--color-info)">${currencyFormatter.format(row.Revenue)}</td>
      <td class="numeric" style="font-weight: 500; color: ${row.Profit >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}">${currencyFormatter.format(row.Profit)}</td>
    `;
    tbody.appendChild(tr);
  });
  
  // Update footer pagination text
  document.getElementById("pagination-info-text").innerText = `Showing ${startIdx + 1} to ${endIdx} of ${numberFormatter.format(totalItems)} entries`;
  
  // Enable/disable buttons
  const totalPages = Math.ceil(totalItems / explorerState.pageSize);
  document.getElementById("btn-page-prev").disabled = explorerState.currentPage === 1;
  document.getElementById("btn-page-next").disabled = explorerState.currentPage === totalPages;
  
  // Render page number pagination buttons
  renderPageButtons(totalPages);
}

// Draw page buttons dynamically
function renderPageButtons(totalPages) {
  const container = document.getElementById("page-numbers-container");
  container.innerHTML = "";
  
  const maxButtons = 5;
  let startPage = Math.max(1, explorerState.currentPage - 2);
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  
  if (endPage - startPage < maxButtons - 1) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }
  
  for (let i = startPage; i <= endPage; i++) {
    const btn = document.createElement("button");
    btn.className = `page-btn ${i === explorerState.currentPage ? 'active' : ''}`;
    btn.innerText = i;
    btn.addEventListener("click", () => {
      explorerState.currentPage = i;
      updateExplorerTable();
    });
    container.appendChild(btn);
  }
}

// Export Filtered Table data to CSV
function exportToCSV() {
  const dataToExport = getExplorerFilteredData();
  if (dataToExport.length === 0) return;
  
  // Define columns
  const headers = ["Date", "Day", "Month", "Year", "Customer_Age", "Age_Group", "Customer_Gender", "Country", "State", "Product_Category", "Sub_Category", "Product", "Order_Quantity", "Unit_Cost", "Unit_Price", "Profit", "Cost", "Revenue"];
  
  let csvContent = headers.join(",") + "\n";
  
  dataToExport.forEach(row => {
    const line = headers.map(header => {
      let val = row[header];
      if (val === undefined || val === null) return "";
      
      // Escape commas & quotes
      let strVal = val.toString();
      if (strVal.includes(",") || strVal.includes('"') || strVal.includes("\n")) {
        strVal = '"' + strVal.replace(/"/g, '""') + '"';
      }
      return strVal;
    });
    csvContent += line.join(",") + "\n";
  });
  
  // Download file in browser
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `veloce_sales_data_export_${new Date().toISOString().slice(0,10)}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
