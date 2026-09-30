const runtime = window.__w2g;
const config = window.__w2gConfig;

if (!runtime) {
	console.error('[nodeck] Runtime not found');
	return;
}

if (!config) {
	runtime.Logger.error('[nodeck] Config not found');
	return;
}

const {
	Logger,
	registerCommand
} = runtime;

const {
	imgSrc
} = config;

if (!imgSrc) {
	Logger.error('[nodeck] imgSrc not found');
	return;
}

const IMAGE_ID = 'nodeck-img';

let imageElement = null;
let imageRequestController = null;

const previousBodyVisibility =
	document.body.style.visibility;

function createImageElement() {
	const existingImage =
		document.getElementById(IMAGE_ID);

	if (existingImage) {
		Logger.warn(
			'[nodeck] Remove existing image',
			existingImage
		);

		existingImage.remove();
	}

	const image = document.createElement('img');

	image.id = IMAGE_ID;
	image.alt = '';
	image.src = addCacheBuster(imgSrc);

	Object.assign(image.style, {
		position: 'fixed',
		inset: '0',
		width: '100vw',
		height: '100vh',
		objectFit: 'cover',
		zIndex: '99',
		visibility: 'visible'
	});

	image.addEventListener('load', () => {
		Logger.info(
			'[nodeck] Image loaded',
			image.currentSrc || image.src
		);
	});

	image.addEventListener('error', event => {
		Logger.error(
			'[nodeck] Failed loading image',
			image.src,
			event
		);
	});

	document.body.appendChild(image);
	return image;
}

function addCacheBuster(url) {
	const endpoint = new URL(url, location.href);
	endpoint.searchParams.set('t', Date.now());
	return endpoint.toString();
}

async function changeImage(sourceUrl) {
	const normalizedUrl = sourceUrl?.trim();

	if (!normalizedUrl) {
		Logger.warn('[nodeck] No URL was given');
		return;
	}

	try {
		new URL(normalizedUrl);
	} catch {
		Logger.error(
			'[nodeck] Invalid URL',
			normalizedUrl
		);
		return;
	}

	Logger.info(
		'[nodeck] changeImage was started',
		normalizedUrl
	);

	if (imageRequestController) {
		imageRequestController.abort();
	}

	imageRequestController = new AbortController();

	try {
		const endpoint = new URL(imgSrc, location.href);

		endpoint.searchParams.set(
			'src',
			normalizedUrl
		);

		endpoint.searchParams.set(
			't',
			Date.now()
		);

		const response = await fetch(
			endpoint.toString(), {
				method: 'GET',
				cache: 'no-store',
				signal: imageRequestController.signal
			}
		);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status} ${response.statusText}`);
		}

		Logger.info(
			'[nodeck] Connection to endpoint successful', {
				status: response.status,
				source: normalizedUrl
			}
		);

		if (!imageElement?.isConnected) {
			Logger.warn('[nodeck] Image not found, attempting creation');

			imageElement = createImageElement();
		}

		imageElement.src = addCacheBuster(imgSrc);
	} catch (error) {
		if (error?.name === 'AbortError') {
			Logger.info('[nodeck] Previous image change will be aborted');
			return;
		}

		Logger.error(
			'[nodeck] Changing image failed',
			error
		);
	} finally {
		imageRequestController = null;
	}
}

function cleanup() {
	Logger.info('[nodeck] Starting cleanup');

	if (imageRequestController) {
		imageRequestController.abort();
		imageRequestController = null;
	}

	imageElement?.remove();
	imageElement = null;

	document.body.style.visibility = previousBodyVisibility;

	Logger.info('[nodeck] Cleanup finished');
}

function initialize() {
	Logger.info('[nodeck] Initialize script');

	document.body.style.visibility = 'hidden';

	imageElement = createImageElement();

	registerCommand('img', changeImage);

	window.__w2gCleanup = cleanup;

	Logger.info(
		'[nodeck] Completed initialization', {
			imageEndpoint: imgSrc,
			commands: ['img']
		}
	);
}

initialize();
