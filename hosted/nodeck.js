(() => {
	const { imgSrc } = window.__w2gConfig
    const registerCommand = window.__w2gRegisterCommand

	let isDebug = true

	function popup(text, ms = 5000) {
		if (!isDebug) return

		const el = document.createElement('div')
		el.textContent = text
		el.style.cssText =
			'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
			'background:#000c;color:#fff;padding:12px 20px;border-radius:8px;' +
			'font:16px sans-serif;z-index:1000000;white-space:pre-wrap;' +
			'max-width:80vw;visibility:visible'

		document.body.append(el)
		setTimeout(() => el.remove(), ms)
	}

	const img = Object.assign(document.createElement('img'), {
		id: 'sos-img',
		src: imgSrc,
		style:
			'position:fixed;inset:0;width:100vw;height:100vh;' +
			'object-fit:cover;z-index:999999;visibility:visible'
	})

	document.body.style.visibility = 'hidden'
	document.body.append(img)

    registerCommand('debug', () => {
        isDebug != isDebug
        popup(`Debug mode: ${isDebug}`)
    })

    registerCommand('img', async url => {
        if (!url) return

        popup(url)

        const endpoint = new URL(imgSrc)

        await fetch(`${endpoint}&src=${encodeURIComponent(url)}`)

        endpoint.searchParams.set('_t', Date.now())
        img.src = endpoint
    })

	window.__w2gCleanup = () => {
		img.remove()
		document.body.style.visibility = ''
	}
})()
