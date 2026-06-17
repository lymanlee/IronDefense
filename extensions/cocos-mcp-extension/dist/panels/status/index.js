"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.$ = exports.style = exports.template = void 0;
exports.ready = ready;
exports.template = `
  <section class="wrap">
    <div class="topbar">
      <h2>Cocos MCP Status</h2>
      <div class="actions">
        <ui-button id="refresh">Refresh</ui-button>
        <ui-button id="start">Start</ui-button>
        <ui-button id="stop">Stop</ui-button>
      </div>
    </div>
    <div class="tabs">
      <ui-button id="statusTab" class="tab active">Status</ui-button>
      <ui-button id="toolsTab" class="tab">Tools</ui-button>
    </div>
    <div class="content">
      <div id="statusPane" class="pane active">
        <div class="grid">
          <div><strong>Running</strong><div id="running">-</div></div>
          <div><strong>Endpoint</strong><div id="endpoint">-</div></div>
          <div><strong>Revision</strong><div id="revision">-</div></div>
          <div><strong>Dirty</strong><div id="dirty">-</div></div>
          <div><strong>Plan</strong><div id="plan">-</div></div>
          <div><strong>Features</strong><div id="features">-</div></div>
        </div>
        <div class="tools">
          <strong>Last Error</strong>
          <pre id="error">none</pre>
        </div>
      </div>
      <div id="toolsPane" class="pane">
        <div class="tool-summary">
          <strong>Enabled Tools</strong>
          <span id="toolCount">0 tools</span>
        </div>
        <div id="toolList" class="tool-list">-</div>
      </div>
    </div>
    <footer class="footer" id="updated">Last updated: -</footer>
  </section>
`;
exports.style = `
  :host {
    display: block;
    height: 100%;
    overflow: hidden;
  }
  .wrap {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    height: 100%;
    max-height: 100%;
    overflow: hidden;
    padding: 14px 16px 10px;
    color: #d6d7db;
    background: linear-gradient(180deg, #18202b 0%, #11161d 100%);
    font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  }
  .topbar {
    flex: 0 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
  }
  h2 {
    margin: 0;
    font-size: 18px;
    line-height: 1.2;
  }
  .actions {
    flex: 0 0 auto;
    display: flex;
    gap: 8px;
  }
  .tabs {
    flex: 0 0 auto;
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
  }
  .tab {
    min-width: 72px;
  }
  .tab.active {
    border-color: #8fd3ff;
    color: #8fd3ff;
  }
  .content {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding-right: 8px;
  }
  .pane {
    display: none;
  }
  .pane.active {
    display: block;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }
  .grid strong, .tools strong, .tool-summary strong {
    color: #8fd3ff;
    display: block;
    margin-bottom: 4px;
  }
  .tools {
    margin-bottom: 16px;
  }
  pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .tool-summary {
    align-items: baseline;
    border-bottom: 1px solid rgba(143, 211, 255, 0.16);
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
    padding-bottom: 8px;
  }
  .tool-summary span {
    color: #b8c2cc;
    font-size: 12px;
  }
  .tool-list {
    display: grid;
    gap: 14px;
  }
  .tool-group {
    display: grid;
    gap: 8px;
  }
  .tool-group-header {
    align-items: baseline;
    display: flex;
    justify-content: space-between;
    gap: 12px;
    color: #8fd3ff;
    font-weight: 700;
    padding: 2px 0;
  }
  .tool-group-count {
    color: #8b949e;
    font-size: 12px;
    font-weight: 400;
  }
  .tool-item {
    border: 1px solid rgba(143, 211, 255, 0.14);
    border-radius: 6px;
    padding: 10px;
    background: rgba(7, 12, 18, 0.22);
  }
  .tool-title {
    color: #8fd3ff;
    font-size: 13px;
    font-weight: 700;
    margin-bottom: 6px;
  }
  .tool-description {
    color: #b8c2cc;
    font-size: 12px;
    line-height: 1.45;
    white-space: normal;
    word-break: break-word;
  }
  .footer {
    flex: 0 0 auto;
    border-top: 1px solid rgba(143, 211, 255, 0.16);
    margin-top: 8px;
    min-height: 18px;
    padding-top: 6px;
    color: #8b949e;
    font-size: 12px;
    line-height: 16px;
  }
  @media (max-width: 420px) {
    .topbar {
      align-items: flex-start;
      flex-direction: column;
    }
    .grid {
      grid-template-columns: 1fr;
    }
  }
`;
exports.$ = {
    refresh: "#refresh",
    start: "#start",
    stop: "#stop",
    statusTab: "#statusTab",
    toolsTab: "#toolsTab",
    statusPane: "#statusPane",
    toolsPane: "#toolsPane",
    running: "#running",
    endpoint: "#endpoint",
    revision: "#revision",
    dirty: "#dirty",
    plan: "#plan",
    features: "#features",
    toolCount: "#toolCount",
    toolList: "#toolList",
    error: "#error",
    updated: "#updated",
};
let activeTab = "status";
function setActiveTab(panel, tab) {
    activeTab = tab;
    panel.$.statusTab.classList.toggle("active", tab === "status");
    panel.$.toolsTab.classList.toggle("active", tab === "tools");
    panel.$.statusPane.classList.toggle("active", tab === "status");
    panel.$.toolsPane.classList.toggle("active", tab === "tools");
}
function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
function groupTools(tools) {
    const groups = [
        { label: "Editor & Scene", tools: [] },
        { label: "Asset", tools: [] },
        { label: "Node", tools: [] },
        { label: "Component", tools: [] },
        { label: "Script", tools: [] },
        { label: "Prefab", tools: [] },
        { label: "UI Events", tools: [] },
        { label: "Debug", tools: [] },
        { label: "Other", tools: [] },
    ];
    const byLabel = new Map(groups.map((group) => [group.label, group]));
    for (const tool of tools) {
        byLabel.get(resolveToolGroup(tool.name))?.tools.push(tool);
    }
    return groups.filter((group) => group.tools.length > 0);
}
function resolveToolGroup(name) {
    if (name === "editor_status" ||
        name === "scene_status" ||
        name === "selection_get" ||
        name === "scene_save" ||
        name === "scene_open" ||
        name === "scene_set_entry" ||
        name === "scene_tree" ||
        name === "scene_snapshot" ||
        name === "scene_validate") {
        return "Editor & Scene";
    }
    if (name.startsWith("asset_")) {
        return "Asset";
    }
    if (name.startsWith("prefab_")) {
        return "Prefab";
    }
    if (name.startsWith("script_") || name === "component_attach_script") {
        return "Script";
    }
    if (name.startsWith("node_")) {
        return "Node";
    }
    if (name.startsWith("debug_")) {
        return "Debug";
    }
    if (name.startsWith("component_event_")) {
        return "UI Events";
    }
    if (name.startsWith("component_")) {
        return "Component";
    }
    return "Other";
}
function renderToolDetails(panel, status) {
    const tools = Array.isArray(status.toolDetails)
        ? status.toolDetails
        : Array.isArray(status.tools)
            ? status.tools.map((name) => ({
                name,
                title: name,
                description: "",
            }))
            : [];
    const groups = groupTools(tools);
    panel.$.toolCount.innerText = `${tools.length} tool${tools.length === 1 ? "" : "s"}`;
    panel.$.toolList.innerHTML = groups.length
        ? groups
            .map((group) => `
            <div class="tool-group">
              <div class="tool-group-header">
                <span>${escapeHtml(group.label)}</span>
                <span class="tool-group-count">${group.tools.length}</span>
              </div>
              ${group.tools
            .map((tool) => `
                    <div class="tool-item">
                      <div class="tool-title">${escapeHtml(tool.title || tool.name)}</div>
                      <div class="tool-description">${escapeHtml(tool.description || "No description.")}</div>
                    </div>
                  `)
            .join("")}
            </div>
          `)
            .join("")
        : "-";
}
async function render(panel) {
    try {
        const status = await Editor.Message.request("cocos-mcp-extension", "get-server-status");
        panel.$.running.innerText = status.transport.running ? "yes" : "no";
        panel.$.endpoint.innerText = `${status.transport.host}:${status.transport.port}`;
        panel.$.revision.innerText = String(status.scene.revision);
        panel.$.dirty.innerText = status.scene.dirty ? "yes" : "no";
        panel.$.plan.innerText = status.entitlement.plan;
        panel.$.features.innerText = status.entitlement.features.join(", ");
        renderToolDetails(panel, status);
        panel.$.error.innerText = "none";
        panel.$.updated.innerText = `Last updated: ${new Date().toLocaleTimeString()}`;
    }
    catch (error) {
        panel.$.error.innerText =
            error instanceof Error ? error.message : String(error);
        panel.$.updated.innerText = `Refresh failed: ${new Date().toLocaleTimeString()}`;
    }
}
function ready() {
    setActiveTab(this, activeTab);
    this.$.statusTab.addEventListener("confirm", () => {
        setActiveTab(this, "status");
    });
    this.$.toolsTab.addEventListener("confirm", () => {
        setActiveTab(this, "tools");
    });
    this.$.refresh.addEventListener("confirm", async () => {
        this.$.updated.innerText = "Refreshing...";
        await render(this);
    });
    this.$.start.addEventListener("confirm", async () => {
        await Editor.Message.request("cocos-mcp-extension", "start-server");
        await render(this);
    });
    this.$.stop.addEventListener("confirm", async () => {
        await Editor.Message.request("cocos-mcp-extension", "stop-server");
        await render(this);
    });
    render(this);
}
//# sourceMappingURL=index.js.map