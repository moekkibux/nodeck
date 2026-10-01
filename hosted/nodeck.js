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

const DEFAULT_ZOOM = 100;
const MIN_ZOOM = 10;
const MAX_ZOOM = 500;

let imageZoom = DEFAULT_ZOOM;

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
		width: 'auto',
		height: 'auto',
		minWidth: '100vw',
		minHeight: '100vh',
		transform: `scale(${imageZoom / 100})`,
		transformOrigin: 'center center',
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
		'[nodeck] Image change started',
		normalizedUrl
	);

	imageRequestController?.abort();

	const requestController = new AbortController();
	imageRequestController = requestController;

	try {
		const endpoint = new URL(
			imgSrc,
			location.href
		);

		endpoint.searchParams.set(
			'src',
			normalizedUrl
		);

		endpoint.searchParams.set(
			't',
			Date.now().toString()
		);

		await fetch(endpoint.toString(), {
			method: 'GET',
			mode: 'no-cors',
			cache: 'no-store',
			signal: requestController.signal
		});

		Logger.info(
			'[nodeck] Image change request was sent', {
				source: normalizedUrl
			}
		);

		if (!imageElement?.isConnected) {
			Logger.warn(
				'[nodeck] Image element not found, recreating it'
			);

			imageElement = createImageElement();
		}

		await delay(250);

		imageElement.src =
			addCacheBuster(imgSrc);
	} catch (error) {
		if (error?.name === 'AbortError') {
			Logger.info(
				'[nodeck] Previous image change was aborted'
			);

			return;
		}

		Logger.error(
			'[nodeck] Image change failed',
			error
		);
	} finally {
		if (
			imageRequestController === requestController
		) {
			imageRequestController = null;
		}
	}
}

function changeImageZoom(value) {
	const argument = value?.trim().toLowerCase();

	if (!argument) {
		Logger.info(
			'[nodeck] Current image zoom',
			`${imageZoom}%`
		);

		return;
	}

	let requestedZoom;

	if (argument === 'reset') {
		requestedZoom = DEFAULT_ZOOM;
	} else {
		const normalizedValue =
			argument.endsWith('%')
				? argument.slice(0, -1).trim()
				: argument;

		requestedZoom = Number(normalizedValue);
	}

	if (!Number.isFinite(requestedZoom)) {
		Logger.error(
			'[nodeck] Invalid zoom value',
			value
		);

		return;
	}

	if (
		requestedZoom < MIN_ZOOM ||
		requestedZoom > MAX_ZOOM
	) {
		Logger.warn(
			'[nodeck] Zoom value is outside the allowed range. The next possible value will be used', {
				requested: requestedZoom,
				minimum: MIN_ZOOM,
				maximum: MAX_ZOOM
			}
		);
	}
	
	imageZoom = clamp(requestedZoom, MIN_ZOOM, MAX_ZOOM);

	if (!imageElement?.isConnected) {
		Logger.warn(
			'[nodeck] Image element not found, recreating it'
		);

		imageElement = createImageElement();
	}

	imageElement.style.transform =
		`scale(${imageZoom / 100})`;

	Logger.info(
		'[nodeck] Image zoom changed',
		`${imageZoom}%`
	);
}

function clamp(value, min, max) {
	return Math.max(min, Math.min(value, max));
}

function delay(ms) {
	return new Promise(resolve => {
		window.setTimeout(resolve, ms);
	});
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
	registerCommand('zoom', changeImageZoom);

	window.__w2gCleanup = cleanup;

	Logger.info(
		'[nodeck] Completed initialization', {
			imageEndpoint: imgSrc,
			commands: ['img', 'zoom']
		}
	);
}

initialize();
