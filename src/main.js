const MINIMUM_SUPPORTED_VERSION = 9;

const versionSelect = document.querySelector('#version-select');

// --- Color utilities ---

function componentToHex(c) {
  const hex = c.toString(16);
  return hex.length === 1 ? '0' + hex : hex;
}

function rgbToHex({ r, g, b }) {
  return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  };
}

// --- Custom color editor ---

class EditorColorCustom extends Jedison.Editor {
  static resolves(schema) {
    const schemaType = Jedison.Schema.getSchemaType(schema);
    const custom = Jedison.Schema.getSchemaXOption(schema, 'format');
    return schemaType === 'object' && custom === 'custom-color';
  }

  build() {
    this.control = this.theme.getInputControl({
      type: 'color',
      id: this.getIdFromPath(this.instance.path)
    });

    const setColor = () => {
      const val = this.instance.getValue();
      this.control.input.value = val?.r !== undefined ? rgbToHex(val) : '#000000';
    };

    setColor();

    // We need to set a listener here in case of nested references, in which case the defaults might not be ready yet.
    this.instance.on("set-value", setColor);
  }

  addEventListeners() {
    this.control.input.addEventListener('change', () => {
      this.instance.setValue(hexToRgb(this.control.input.value));
    });
  }
}

// --- Data loading ---

function isEligible(tagName) {
  const match = tagName.match(/^v?(\d+)\./);
  return match && parseInt(match[1], 10) >= MINIMUM_SUPPORTED_VERSION;
}

// --- Editor initialization ---

async function createEditor(schema, containerId, outputId) {
  const container = document.querySelector(`#${containerId}`);
  const output = document.querySelector(`#${outputId}`);

  container.innerHTML = '';

  const refParser = new Jedison.RefParser();
  await refParser.dereference(schema);
  refParser.expandRecursive(schema);

  const jedison = new Jedison.Create({
    container,
    theme: new Jedison.ThemeBootstrap5(),
    iconLib: 'bootstrap-icons',
    btnContents: false,
    enableCollapseToggle: true,
    enablePropertiesToggle: true,
    deactivateNonRequired: false,
    customEditors: [EditorColorCustom],
    refParser,
    schema
  });

  function updateOutput() {
    if (!jedison.getErrors().length) {
      output.value = JSON.stringify(jedison.getValue(), null, 2);
      output.dataset.valid = 'true';
    } else {
      output.value = 'Invalid config! Fix errors to see JSON output.';
      output.dataset.valid = 'false';
    }
  }

  jedison.on('change', updateOutput);

  updateOutput();
}

function initEditor({ schemaUrl, containerId, outputId }) {
  const container = document.querySelector(`#${containerId}`);
  container.innerHTML = '<div class="loader"></div>';

  fetch(schemaUrl)
    .then((res) => res.json())
    .then((schema) => createEditor(schema, containerId, outputId))
    .catch(err => {
      container.textContent = `Failed to load schema: ${err.message}`;
    });
}

function initCoordinatesEditor(repoBase, size) {
  const container = document.querySelector('#jedison-wxhy');
  container.innerHTML = '<div class="loader"></div>';

  initEditor({
    schemaUrl:   `${repoBase}/coordinates/${size}.schema.json`,
    containerId: 'jedison-wxhy',
    outputId:    'output-wxhy'
  });
}

let editorsController = null;

function initEditors(version) {
  if (editorsController) editorsController.abort();
  editorsController = new AbortController();
  const { signal } = editorsController;

  const REPO_BASE = `https://raw.githubusercontent.com/MLB-LED-Scoreboard/mlb-led-scoreboard/${version}/schemas`;

  const lazyEditors = {
    'tab-config': {
      schemaUrl:   `${REPO_BASE}/config.schema.json`,
      containerId: 'jedison-config',
      outputId:    'output-config'
    },
    'tab-teams': {
      schemaUrl:   `${REPO_BASE}/colors/teams.schema.json`,
      containerId: 'jedison-teams',
      outputId:    'output-teams'
    },
    'tab-scoreboard': {
      schemaUrl:   `${REPO_BASE}/colors/scoreboard.schema.json`,
      containerId: 'jedison-scoreboard',
      outputId:    'output-scoreboard'
    }
  };

  const initialized = new Set();

  function maybeInit(tabId) {
    if (initialized.has(tabId)) return;
    initialized.add(tabId);

    if (tabId === 'tab-wxhy') {
      const sizeSelect = document.querySelector('#size-select');
      initCoordinatesEditor(REPO_BASE, sizeSelect.value);
    } else if (lazyEditors[tabId]) {
      const { containerId } = lazyEditors[tabId];
      document.querySelector(`#${containerId}`).innerHTML = '<div class="loader"></div>';
      initEditor(lazyEditors[tabId]);
    }
  }

  const activeTab = document.querySelector('.nav-link.active');
  if (activeTab) maybeInit(activeTab.dataset.bsTarget?.slice(1));

  document.querySelectorAll('[data-bs-toggle="tab"]').forEach(btn => {
    btn.addEventListener('shown.bs.tab', () => maybeInit(btn.dataset.bsTarget.slice(1)), { signal });
  });

  const sizeSelect = document.querySelector('#size-select');
  const sizeLabel  = document.querySelector('#wxhy-size-label');
  const wxhyDownload = document.querySelector('.download-btn[data-target="output-wxhy"]');

  sizeSelect.addEventListener('change', () => {
    sizeLabel.textContent = sizeSelect.value;
    wxhyDownload.dataset.filename = `${sizeSelect.value}.json`;
    initCoordinatesEditor(REPO_BASE, sizeSelect.value);
  }, { signal });
}

// --- Bootstrap version selector ---

async function init() {
  const params = new URLSearchParams(window.location.search);
  const tags = await fetch('https://api.github.com/repos/MLB-LED-Scoreboard/mlb-led-scoreboard/tags?per_page=100')
    .then(res => res.json());

  const eligible = tags.filter(t => isEligible(t.name));

  eligible.forEach(tag => {
    const opt = document.createElement('option');
    opt.value = tag.name;
    opt.textContent = tag.name;
    versionSelect.appendChild(opt);
  });

  const version = params.get('version') ?? eligible[0]?.name ?? 'dev';
  versionSelect.value = version;

  versionSelect.addEventListener('change', () => {
    const p = new URLSearchParams(window.location.search);
    p.set('version', versionSelect.value);
    history.replaceState(null, '', '?' + p.toString());
    initEditors(versionSelect.value);
  });

  initEditors(version);
}

init();

// --- Local schema tab ---

const localSchemaInput = document.querySelector('#local-schema-input');
const localSchemaBtn   = document.querySelector('#local-schema-btn');
const localSchemaName  = document.querySelector('#local-schema-name');
const localOutputLabel = document.querySelector('#local-output-label');
const localDownloadBtn = document.querySelector('.download-btn[data-target="output-local"]');

localSchemaBtn.addEventListener('click', () => localSchemaInput.click());

localSchemaInput.addEventListener('change', async () => {
  const file = localSchemaInput.files[0];
  if (!file) return;

  localSchemaName.textContent = file.name;
  localOutputLabel.textContent = file.name.replace(/\.schema\.json$/, '.json');
  localDownloadBtn.dataset.filename = file.name.replace(/\.schema\.json$/, '.json');

  const container = document.querySelector('#jedison-local');
  container.innerHTML = '<div class="loader"></div>';

  try {
    const text = await file.text();
    const schema = JSON.parse(text);

    const refParser = new Jedison.RefParser();
    await refParser.dereference(schema);
    refParser.expandRecursive(schema);

    createEditor(schema, 'jedison-local', 'output-local');
  } catch (err) {
    container.textContent = `Failed to load local schema: ${err.message}`;
  }

  localSchemaInput.value = '';
});

// --- Copy buttons ---

document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const output = document.querySelector(`#${btn.dataset.target}`);
    navigator.clipboard.writeText(output.value).then(() => {
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    });
  });
});

// --- Download buttons ---

document.querySelectorAll('.download-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const output = document.querySelector(`#${btn.dataset.target}`);
    if (output.dataset.valid !== 'true') {
      alert('Invalid config! Fix errors before downloading.');
      return;
    }
    const blob = new Blob([output.value], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = btn.dataset.filename;
    a.click();
    URL.revokeObjectURL(a.href);
  });
});
