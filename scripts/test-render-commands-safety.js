#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const vm = require("vm");

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.className = "";
    this.id = "";
    this._textContent = "";
    this._innerHTML = "";
  }

  set innerHTML(value) {
    if (value && /<img|onerror=|javascript:/i.test(value)) {
      throw new Error(`unsafe innerHTML assignment: ${value}`);
    }
    this._innerHTML = value;
    this.children = [];
  }

  get innerHTML() {
    if (this.children.length) {
      return this.children.map((child) => child.outerHTML).join("");
    }
    return this._innerHTML;
  }

  set textContent(value) {
    this._textContent = String(value);
    this.children = [];
  }

  get textContent() {
    return this._textContent + this.children.map((child) => child.textContent).join("");
  }

  get classList() {
    return {
      add: (...classes) => {
        const current = new Set(this.className.split(/\s+/).filter(Boolean));
        classes.forEach((className) => current.add(className));
        this.className = [...current].join(" ");
      },
      remove: (...classes) => {
        const removeSet = new Set(classes);
        this.className = this.className
          .split(/\s+/)
          .filter((className) => className && !removeSet.has(className))
          .join(" ");
      },
      contains: (className) => this.className.split(/\s+/).includes(className),
    };
  }

  setAttribute(name, value) {
    if (name === "id") this.id = String(value);
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    if (name === "id") return this.id;
    return this.attributes[name] || null;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  addEventListener() {}

  querySelectorAll(selector) {
    return findAll(this, selector);
  }

  closest() {
    return null;
  }

  get outerHTML() {
    const attrs = [
      this.className ? `class="${escapeHtml(this.className)}"` : "",
      this.id ? `id="${escapeHtml(this.id)}"` : "",
      ...Object.entries(this.dataset).map(
        ([key, value]) => `data-${dashCase(key)}="${escapeHtml(String(value))}"`
      ),
      ...Object.entries(this.attributes).filter(([key]) => key !== "id").map(
        ([key, value]) => `${key}="${escapeHtml(String(value))}"`
      ),
    ].filter(Boolean).join(" ");
    const body = escapeHtml(this._textContent) +
      this.children.map((child) => child.outerHTML).join("");
    return `<${this.tagName.toLowerCase()}${attrs ? ` ${attrs}` : ""}>${body}</${this.tagName.toLowerCase()}>`;
  }
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dashCase(value) {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function findAll(root, selector) {
  const results = [];
  const matches = (el) => {
    if (selector.startsWith(".")) {
      return el.className.split(/\s+/).includes(selector.slice(1));
    }
    if (selector.startsWith("#")) {
      return el.id === selector.slice(1);
    }
    return el.tagName.toLowerCase() === selector.toLowerCase();
  };
  const visit = (el) => {
    if (matches(el)) results.push(el);
    el.children.forEach(visit);
  };
  root.children.forEach(visit);
  return results;
}

function findById(root, id) {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}

const elements = {
  "command-list": new FakeElement("div"),
  "command-count": new FakeElement("div"),
  "builder-content": new FakeElement("div"),
};

const document = {
  addEventListener: () => {},
  createElement: (tagName) => new FakeElement(tagName),
  getElementById: (id) => {
    if (elements[id]) return elements[id];
    for (const root of Object.values(elements)) {
      const found = findById(root, id);
      if (found) return found;
    }
    return null;
  },
  querySelectorAll: (selector) =>
    Object.values(elements).flatMap((root) => findAll(root, selector)),
};

const appPath = path.join(__dirname, "..", "js", "app.js");
const source = `${fs.readFileSync(appPath, "utf8")}\nglobalThis.CommandManager = CommandManager;`;
const context = {
  console,
  document,
  window: { addEventListener: () => {} },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  location: { hash: "" },
  history: { replaceState: () => {} },
  COMMAND_DATA: { categories: {}, commands: [] },
  COMMAND_LINKS: {},
  URL,
  setTimeout,
  clearTimeout,
};

vm.runInNewContext(source, context, { filename: appPath });

const manager = Object.create(context.CommandManager.prototype);
manager.filteredCommands = [
  {
    id: "hostile-command",
    name: "<img src=x onerror=alert(1)>",
    command: "nxc smb <img src=x onerror=alert(2)>",
    tags: ["<img src=x onerror=alert(3)>"],
    requires: ["password"],
    protocols: ["smb"],
    variations: [{ requires: "hash" }],
  },
];
manager.favorites = new Set();

manager.renderCommands();

const rendered = elements["command-list"].innerHTML;
if (/<img|javascript:/i.test(rendered)) {
  throw new Error(`rendered command list contains executable markup: ${rendered}`);
}

if (!rendered.includes("&lt;img")) {
  throw new Error(`hostile text was not preserved as escaped text: ${rendered}`);
}

console.log("OK - renderCommands treats catalog fields as text.");

elements["builder-content"].children = [];
elements["builder-content"].innerHTML = "";

context.COMMAND_DATA.commands = [
  {
    id: "linked-command",
    name: "<img src=x onerror=alert(8)>",
    description: "<img src=x onerror=alert(9)>",
  },
];

manager.selectedCommand = {
  id: "hostile-builder-command",
  name: "<img src=x onerror=alert(4)>",
  command: "nxc smb <target>",
  description: "<img src=x onerror=alert(5)>",
  platform: "linux",
  requires: ["password"],
  protocols: ["smb"],
  references: [
    {
      title: "<img src=x onerror=alert(6)>",
      url: "javascript:alert(7)",
    },
  ],
  variations: [
    {
      label: "<img src=x onerror=alert(10)>",
      requires: "hash",
      command: "nxc smb <target> -H <hash>",
    },
  ],
};
manager.activeVariation = 0;
manager.commandLinks = { "hostile-builder-command": ["linked-command"] };
manager.targetContext = {};
manager.customAssetTypes = [];
manager.lists = {};

manager.renderCommandBuilder();

const builderRendered = elements["builder-content"].innerHTML;
if (/<img|javascript:/i.test(builderRendered)) {
  throw new Error(`rendered command builder contains executable markup: ${builderRendered}`);
}

if (!builderRendered.includes("&lt;img")) {
  throw new Error(`hostile builder text was not preserved as escaped text: ${builderRendered}`);
}

console.log("OK - renderCommandBuilder treats catalog fields as text.");
