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

    const val = this.instance.getValue();
    this.control.input.value = val?.r !== undefined ? rgbToHex(val) : '#000000';
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

async function loadEditorData(schemaUrl, exampleUrl) {
  const [schema, data] = await Promise.all([
    fetch(schemaUrl).then(r => r.json()),
    exampleUrl ? fetch(exampleUrl).then(r => r.json()).catch(() => null) : Promise.resolve(null)
  ]);

  const refParser = new Jedison.RefParser();
  await refParser.dereference(schema);
  refParser.expandRecursive(schema);

  return { schema, data };
}

// --- Editor initialization ---

function initEditor({ schemaUrl, exampleUrl, containerId, outputId }) {
  const container = document.querySelector(`#${containerId}`);
  const output = document.querySelector(`#${outputId}`);

  loadEditorData(schemaUrl, exampleUrl)
    .then(({ schema, data }) => requestAnimationFrame(() => {
      container.innerHTML = '';
      const jedison = new Jedison.Create({
        container,
        theme: new Jedison.ThemeBootstrap5(),
        iconLib: 'bootstrap-icons',
        btnContents: false,
        enableCollapseToggle: true,
        enablePropertiesToggle: true,
        deactivateNonRequired: false,
        customEditors: [EditorColorCustom],
        schema,
        ...(data && { data })
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
    }))
    .catch(err => {
      container.textContent = `Failed to load schema: ${err.message}`;
    });
}

function initCoordinatesEditor(repoBase, size) {
  const container = document.querySelector('#jedison-wxhy');
  container.innerHTML = '<div class="loader"></div>';

  initEditor({
    schemaUrl:   `${repoBase}/coordinates/wxhy.schema.json`,
    exampleUrl:  `${repoBase}/coordinates/${size}.example.json`,
    containerId: 'jedison-wxhy',
    outputId:    'output-wxhy'
  });
}

function initEditors(version) {
  const REPO_BASE = `https://raw.githubusercontent.com/MLB-LED-Scoreboard/mlb-led-scoreboard/${version}`;

  const lazyEditors = {
    'tab-config': {
      schemaUrl:   `${REPO_BASE}/config.schema.json`,
      exampleUrl:  `${REPO_BASE}/config.example.json`,
      containerId: 'jedison-config',
      outputId:    'output-config'
    },
    'tab-teams': {
      schemaUrl:   `${REPO_BASE}/colors/teams.schema.json`,
      exampleUrl:  `${REPO_BASE}/colors/teams.example.json`,
      containerId: 'jedison-teams',
      outputId:    'output-teams'
    },
    'tab-scoreboard': {
      schemaUrl:   `${REPO_BASE}/colors/scoreboard.schema.json`,
      exampleUrl:  `${REPO_BASE}/colors/scoreboard.example.json`,
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
    btn.addEventListener('shown.bs.tab', () => maybeInit(btn.dataset.bsTarget.slice(1)));
  });

  const sizeSelect = document.querySelector('#size-select');
  const sizeLabel  = document.querySelector('#wxhy-size-label');
  const wxhyDownload = document.querySelector('.download-btn[data-target="output-wxhy"]');

  sizeSelect.addEventListener('change', () => {
    sizeLabel.textContent = sizeSelect.value;
    wxhyDownload.dataset.filename = `${sizeSelect.value}.json`;
    initCoordinatesEditor(REPO_BASE, sizeSelect.value);
  });
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
    params.set('version', versionSelect.value);
    window.location.search = params.toString();
  });

  initEditors(version);
}

init();

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
