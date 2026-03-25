const MINIMUM_SUPPORTED_VERSION = 9;

const versionSelect = document.querySelector('#version-select');

function isEligible(tagName) {
  const match = tagName.match(/^v?(\d+)\./);
  return match && parseInt(match[1], 10) >= MINIMUM_SUPPORTED_VERSION;
}

function initEditor({ schemaUrl, exampleUrl, containerId, outputId }) {
  const container = document.querySelector(`#${containerId}`);
  const output = document.querySelector(`#${outputId}`);

  const fetches = [
    fetch(schemaUrl).then(res => res.json()),
    exampleUrl ? fetch(exampleUrl).then(res => res.json()).catch(() => null) : Promise.resolve(null)
  ];

  Promise.all(fetches)
    .then(([schema, exampleData]) => {
      const jedison = new Jedison.Create({
        container,
        theme: new Jedison.ThemeBootstrap5(),
        schema
      });

      if (exampleData) jedison.setValue(exampleData);

      function updateOutput() {
        output.textContent = JSON.stringify(jedison.getValue(), null, 2);
      }

      jedison.on('change', updateOutput);
      updateOutput();
    })
    .catch(err => {
      container.textContent = `Failed to load schema: ${err.message}`;
    });
}

function initCoordinatesEditor(repoBase, size) {
  const container = document.querySelector('#jedison-wxhy');
  container.innerHTML = '';

  initEditor({
    schemaUrl:  `${repoBase}/coordinates/wxhy.schema.json`,
    exampleUrl: `${repoBase}/coordinates/${size}.example.json`,
    containerId: 'jedison-wxhy',
    outputId:    'output-wxhy'
  });
}

function initEditors(version) {
  const REPO_BASE = `https://raw.githubusercontent.com/MLB-LED-Scoreboard/mlb-led-scoreboard/${version}`;

  [
    {
      schemaUrl: `${REPO_BASE}/config.schema.json`,
      exampleUrl: `${REPO_BASE}/config.example.json`,
      containerId: 'jedison-config',
      outputId: 'output-config'
    },
    {
      schemaUrl: `${REPO_BASE}/colors/teams.schema.json`,
      exampleUrl: `${REPO_BASE}/colors/teams.example.json`,
      containerId: 'jedison-teams',
      outputId: 'output-teams'
    },
    {
      schemaUrl: `${REPO_BASE}/colors/scoreboard.schema.json`,
      exampleUrl: `${REPO_BASE}/colors/scoreboard.example.json`,
      containerId: 'jedison-scoreboard',
      outputId: 'output-scoreboard'
    }
  ].forEach(initEditor);

  const sizeSelect = document.querySelector('#size-select');
  const sizeLabel  = document.querySelector('#wxhy-size-label');

  initCoordinatesEditor(REPO_BASE, sizeSelect.value);

  sizeSelect.addEventListener('change', () => {
    sizeLabel.textContent = sizeSelect.value;
    initCoordinatesEditor(REPO_BASE, sizeSelect.value);
  });
}

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

document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = document.querySelector(`#${btn.dataset.target}`);
    navigator.clipboard.writeText(target.textContent).then(() => {
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy to clipboard'; }, 2000);
    });
  });
});