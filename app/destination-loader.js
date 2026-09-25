const json = async url => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`无法读取 ${url.pathname}`);
  return response.json();
};

const text = async url => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`无法读取 ${url.pathname}`);
  return response.text();
};

function hydrate(config, registry, sourcesHtml) {
  document.body.classList.toggle('sidebar-disabled', config.features?.sidebar === false);
  document.querySelector('.transport-controls').hidden = Boolean(config.features?.hideTransportControls);
  document.querySelector('#toggle-roads').hidden = Boolean(config.features?.hideRoadControl);
  document.querySelector('#toggle-metro').hidden = Boolean(config.features?.hideMetroControl);
  document.title = config.pageTitle;
  const description = document.querySelector('meta[name="description"]');
  if (description && config.description) description.content = config.description;
  document.querySelector('#brand-title').textContent = config.brandTitle;
  document.querySelector('#brand-en').textContent = config.brandEnglish;
  document.querySelector('#location-label').textContent = config.locationLabel;
  document.querySelector('#sidebar-image').src = config.sidebar.image;
  document.querySelector('#sidebar-image').alt = config.sidebar.imageAlt;
  document.querySelector('#sidebar-caption').childNodes[0].nodeValue = config.sidebar.caption;
  document.querySelector('#sidebar-caption-en').textContent = config.sidebar.captionEnglish;
  document.querySelector('#sidebar-heading').textContent = config.sidebar.heading;
  document.querySelector('#destination-count').textContent = `${config.locations.length} 个目的地`;
  document.querySelector('#sidebar-footer-text').textContent = config.sidebar.footer;
  document.querySelector('#map-kicker-en').textContent = config.kicker.eyebrow;
  document.querySelector('#map-kicker-title').textContent = config.kicker.title;
  document.querySelector('#loading-title').textContent = config.brandTitle;
  document.querySelector('#loading-text').textContent = config.loadingText;
  document.querySelector('#transport-labels').setAttribute('aria-label', `主要道路与${config.transportName}`);
  document.querySelector('#toggle-metro-text').textContent = config.transportName;
  const routeButton = document.querySelector('#toggle-route');
  routeButton.hidden = !config.route;
  if (config.route) {
    const distance = config.route.distanceMeters >= 1000
      ? `${(config.route.distanceMeters / 1000).toFixed(1)} 公里`
      : `${config.route.distanceMeters} 米`;
    document.querySelector('#toggle-route-text').textContent = `推荐路线（${config.route.durationMinutes}分钟）`;
    routeButton.title = `${config.route.name} · 约 ${distance}`;
    routeButton.setAttribute('aria-label', `${config.route.name}，约 ${distance}`);
  }
  document.querySelector('#detail-collection').textContent = `${config.name.toUpperCase()} COLLECTION`;
  document.querySelector('#sources-content').innerHTML = sourcesHtml;

  const navigation = document.querySelector('#destination-switch');
  const label = document.createElement('label');
  label.className = 'destination-caption';
  label.htmlFor = 'destination-select';
  label.textContent = '选择景区';
  const selectWrap = document.createElement('span');
  selectWrap.className = 'destination-select-wrap';
  const select = document.createElement('select');
  select.id = 'destination-select';
  select.className = 'destination-select';
  select.setAttribute('aria-label', '按城市选择景区');
  const grouped = new Map();
  for (const item of registry) {
    if (!grouped.has(item.city)) grouped.set(item.city, []);
    grouped.get(item.city).push(item);
  }
  for (const [city, items] of grouped) {
    const group = document.createElement('optgroup');
    group.label = city;
    for (const item of items) {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.city} · ${item.name}`;
      option.selected = item.id === config.slug;
      group.append(option);
    }
    select.append(group);
  }
  select.addEventListener('change', () => {
    location.href = `?destination=${encodeURIComponent(select.value)}`;
  });
  selectWrap.append(select);
  navigation.replaceChildren(label, selectWrap);
}

export async function loadDestination() {
  const registryUrl = new URL('../destinations/index.json', import.meta.url);
  const registry = await json(registryUrl);
  const requested = new URLSearchParams(location.search).get('destination') || registry[0].id;
  const entry = registry.find(item => item.id === requested) || registry[0];
  const configUrl = new URL(`../destinations/${entry.config}`, import.meta.url);
  const config = await json(configUrl);
  const base = new URL('./', configUrl);
  const [geo, locations, photos, transport, sourcesHtml, landTriangles, route] = await Promise.all([
    json(new URL(config.data.map, base)),
    json(new URL(config.data.places, base)),
    json(new URL(config.data.photos, base)),
    json(new URL(config.data.transport, base)),
    text(new URL(config.data.sources, base)),
    config.data.landTriangles
      ? json(new URL(config.data.landTriangles, base))
      : Promise.resolve(null),
    config.data.route
      ? json(new URL(config.data.route, base))
      : Promise.resolve(null)
  ]);
  for (const photo of Object.values(photos)) photo.src = new URL(photo.src, document.baseURI).href;
  config.sidebar.image = new URL(config.sidebar.image, document.baseURI).href;
  const destination = {...config, geo, locations, photos, transport};
  if (landTriangles) destination.landTriangles = landTriangles;
  if (route) destination.route = route;
  hydrate(destination, registry, sourcesHtml);
  return destination;
}
