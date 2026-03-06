/**
 * AI Agent Discovery Dashboard - Frontend Application
 */

// State
let agents = [];
let taxonomy = null;
let lastScan = null;

// DOM Elements
const elements = {
  statAgents: document.getElementById('stat-agents'),
  statEndpoints: document.getElementById('stat-endpoints'),
  statUsers: document.getElementById('stat-users'),
  statSpecies: document.getElementById('stat-species'),
  distributionChart: document.getElementById('distribution-chart'),
  agentsTbody: document.getElementById('agents-tbody'),
  searchInput: document.getElementById('search-input'),
  filterKingdom: document.getElementById('filter-kingdom'),
  taxonomyTree: document.getElementById('taxonomy-tree'),
  taxonomySearch: document.getElementById('taxonomy-search'),
  lastScan: document.getElementById('last-scan'),
  refreshBtn: document.getElementById('refresh-btn'),
  scanBtn: document.getElementById('scan-btn'),
  exportBtn: document.getElementById('export-btn'),
};

// API Functions
async function fetchApi(endpoint, options = {}) {
  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  return response.json();
}

async function loadSummary() {
  try {
    const data = await fetchApi('/agents/summary');
    elements.statAgents.textContent = data.totalAgents;
    elements.statEndpoints.textContent = data.uniqueEndpoints;
    elements.statUsers.textContent = data.uniqueUsers;
    elements.statSpecies.textContent = Object.keys(data.bySpecies).length;
    lastScan = data.lastScan;
    updateLastScan();
    renderDistributionChart(data.byKingdom, data.totalAgents);
  } catch (error) {
    console.error('Failed to load summary:', error);
  }
}

async function loadAgents() {
  try {
    const data = await fetchApi('/agents');
    agents = data.agents;
    renderAgentsTable();
  } catch (error) {
    console.error('Failed to load agents:', error);
    elements.agentsTbody.innerHTML = '<tr><td colspan="6" class="loading">Failed to load agents</td></tr>';
  }
}

async function loadTaxonomy() {
  try {
    const data = await fetchApi('/taxonomy');
    taxonomy = data.tree;
    renderTaxonomyTree();
  } catch (error) {
    console.error('Failed to load taxonomy:', error);
  }
}

async function runScan() {
  elements.scanBtn.disabled = true;
  elements.scanBtn.textContent = 'Scanning...';

  try {
    const result = await fetchApi('/scan', { method: 'POST' });
    alert(`Scan complete! Found ${result.resultCount} agents.`);
    await loadSummary();
    await loadAgents();
  } catch (error) {
    alert(`Scan failed: ${error.message}`);
  } finally {
    elements.scanBtn.disabled = false;
    elements.scanBtn.textContent = 'Run Scan';
  }
}

// Render Functions
function renderDistributionChart(byKingdom, total) {
  const kingdoms = ['autonomous', 'assistant', 'workflow'];
  const colors = {
    autonomous: 'autonomous',
    assistant: 'assistant',
    workflow: 'workflow',
  };

  elements.distributionChart.innerHTML = kingdoms
    .map((kingdom) => {
      const count = byKingdom[kingdom] || 0;
      const percentage = total > 0 ? (count / total) * 100 : 0;
      return `
        <div class="distribution-bar">
          <span class="distribution-label">${kingdom.charAt(0).toUpperCase() + kingdom.slice(1)}</span>
          <div class="distribution-track">
            <div class="distribution-fill ${colors[kingdom]}" style="width: ${percentage}%"></div>
          </div>
          <span class="distribution-count">${count}</span>
        </div>
      `;
    })
    .join('');
}

function renderAgentsTable() {
  const searchTerm = elements.searchInput.value.toLowerCase();
  const kingdomFilter = elements.filterKingdom.value;

  const filtered = agents.filter((agent) => {
    const matchesSearch =
      !searchTerm ||
      agent.endpoint.hostname.toLowerCase().includes(searchTerm) ||
      agent.user.username.toLowerCase().includes(searchTerm) ||
      agent.agent.species.toLowerCase().includes(searchTerm);

    const matchesKingdom = !kingdomFilter || agent.agent.kingdom === kingdomFilter;

    return matchesSearch && matchesKingdom;
  });

  if (filtered.length === 0) {
    elements.agentsTbody.innerHTML = '<tr><td colspan="6" class="loading">No agents found</td></tr>';
    return;
  }

  elements.agentsTbody.innerHTML = filtered
    .map((agent) => {
      const confidenceClass =
        agent.agent.confidence >= 0.8
          ? 'confidence-high'
          : agent.agent.confidence >= 0.6
            ? 'confidence-medium'
            : 'confidence-low';

      const lastSeen = new Date(agent.timestamps.lastSeen);
      const timeAgo = formatTimeAgo(lastSeen);

      return `
        <tr>
          <td>${escapeHtml(agent.endpoint.hostname)}</td>
          <td>${escapeHtml(agent.user.username)}</td>
          <td><strong>${escapeHtml(agent.agent.species)}</strong><br><small>${escapeHtml(agent.agent.family)}</small></td>
          <td><span class="kingdom-badge ${agent.agent.kingdom}">${agent.agent.kingdom}</span></td>
          <td><span class="confidence-badge ${confidenceClass}">${Math.round(agent.agent.confidence * 100)}%</span></td>
          <td>${timeAgo}</td>
        </tr>
      `;
    })
    .join('');
}

function renderTaxonomyTree() {
  if (!taxonomy) {
    elements.taxonomyTree.innerHTML = '<p>Loading taxonomy...</p>';
    return;
  }

  const searchTerm = elements.taxonomySearch.value.toLowerCase();

  let html = '';
  for (const [kingdom, families] of Object.entries(taxonomy)) {
    const familyHtml = Object.entries(families)
      .map(([family, species]) => {
        const speciesHtml = species
          .filter((s) => !searchTerm || s.toLowerCase().includes(searchTerm))
          .map((s) => `<div class="tree-node"><span class="tree-toggle"></span> ${escapeHtml(s)}</div>`)
          .join('');

        if (searchTerm && !speciesHtml && !family.toLowerCase().includes(searchTerm)) {
          return '';
        }

        return `
          <div class="tree-node">
            <div class="tree-node-header" onclick="toggleTreeNode(this)">
              <span class="tree-toggle">&#9654;</span>
              <strong>${escapeHtml(family)}</strong>
            </div>
            <div class="tree-children collapsed">${speciesHtml}</div>
          </div>
        `;
      })
      .filter(Boolean)
      .join('');

    if (searchTerm && !familyHtml && !kingdom.toLowerCase().includes(searchTerm)) {
      continue;
    }

    html += `
      <div class="tree-node">
        <div class="tree-node-header" onclick="toggleTreeNode(this)">
          <span class="tree-toggle">&#9654;</span>
          <strong>${kingdom.toUpperCase()}</strong>
        </div>
        <div class="tree-children collapsed">${familyHtml}</div>
      </div>
    `;
  }

  elements.taxonomyTree.innerHTML = html || '<p>No matching items found</p>';
}

// Utility Functions
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatTimeAgo(date) {
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

function updateLastScan() {
  if (lastScan) {
    const date = new Date(lastScan);
    elements.lastScan.textContent = `Last scan: ${date.toLocaleString()}`;
  } else {
    elements.lastScan.textContent = 'Last scan: Never';
  }
}

function toggleTreeNode(header) {
  const children = header.nextElementSibling;
  const toggle = header.querySelector('.tree-toggle');
  if (children && children.classList.contains('tree-children')) {
    children.classList.toggle('collapsed');
    toggle.innerHTML = children.classList.contains('collapsed') ? '&#9654;' : '&#9660;';
  }
}

function exportCsv() {
  window.location.href = '/api/export?format=csv';
}

// Event Listeners
elements.refreshBtn.addEventListener('click', async () => {
  await loadSummary();
  await loadAgents();
});

elements.scanBtn.addEventListener('click', runScan);
elements.exportBtn.addEventListener('click', exportCsv);

elements.searchInput.addEventListener('input', renderAgentsTable);
elements.filterKingdom.addEventListener('change', renderAgentsTable);
elements.taxonomySearch.addEventListener('input', renderTaxonomyTree);

// Make toggleTreeNode available globally
window.toggleTreeNode = toggleTreeNode;

// Initialize
async function init() {
  await Promise.all([loadSummary(), loadAgents(), loadTaxonomy()]);
}

init();
