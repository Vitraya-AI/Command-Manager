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
      add: () => {},
      remove: () => {},
      contains: () => false,
    };
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  querySelectorAll() {
    return [];
  }

  closest() {
    return null;
  }

  get outerHTML() {
    const attrs = [
      this.className ? `class="${escapeHtml(this.className)}"` : "",
      ...Object.entries(this.dataset).map(
        ([key, value]) => `data-${dashCase(key)}="${escapeHtml(String(value))}"`
      ),
      ...Object.entries(this.attributes).map(
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

const elements = {
  "command-list": new FakeElement("div"),
  "command-count": new FakeElement("div"),
};

const document = {
  addEventListener: () => {},
  createElement: (tagName) => new FakeElement(tagName),
  getElementById: (id) => elements[id] || null,
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
