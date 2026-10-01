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

	window.__w2gCleanup = cleanup;

	Logger.info(
		'[nodeck] Completed initialization', {
			imageEndpoint: imgSrc,
			commands: ['img']
		}
	);
}

initialize();
