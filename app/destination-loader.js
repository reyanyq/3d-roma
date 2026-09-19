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
  document.querySelector('#detail-collection').textContent = `${config.name.toUpperCase()} COLLECTION`;
  document.querySelector('#sources-content').innerHTML = sourcesHtml;

  const navigation = document.querySelector('#destination-switch');
  navigation.replaceChildren(...registry.map(item => {
    const link = document.createElement('a');
    link.href = `?destination=${encodeURIComponent(item.id)}`;
    link.textContent = `${item.city} · ${item.name}`;
    if (item.id === config.slug) link.setAttribute('aria-current', 'page');
    return link;
  }));
}

export async function loadDestination() {
  const registryUrl = new URL('../destinations/index.json', import.meta.url);
  const registry = await json(registryUrl);
  const requested = new URLSearchParams(location.search).get('destination') || registry[0].id;
  const entry = registry.find(item => item.id === requested) || registry[0];
  const configUrl = new URL(`../destinations/${entry.config}`, import.meta.url);
  const config = await json(configUrl);
  const base = new URL('./', configUrl);
  const [geo, locations, photos, transport, sourcesHtml, landTriangles] = await Promise.all([
    json(new URL(config.data.map, base)),
    json(new URL(config.data.places, base)),
    json(new URL(config.data.photos, base)),
    json(new URL(config.data.transport, base)),
    text(new URL(config.data.sources, base)),
    config.data.landTriangles
      ? json(new URL(config.data.landTriangles, base))
      : Promise.resolve(null)
  ]);
  for (const photo of Object.values(photos)) photo.src = new URL(photo.src, document.baseURI).href;
  config.sidebar.image = new URL(config.sidebar.image, document.baseURI).href;
  const destination = {...config, geo, locations, photos, transport};
  if (landTriangles) destination.landTriangles = landTriangles;
  hydrate(destination, registry, sourcesHtml);
  return destination;
}
