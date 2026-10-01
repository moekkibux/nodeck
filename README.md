# nodeck

A small JavaScript runtime for displaying custom content on a [Yodeck](https://www.yodeck.com/) screen while using [Watch2Gether](https://w2g.tv/) as the underlying media player and control interface. I know, stay with me.

The original use case is a shared office TV. Watch2Gether provides music and synchronized playback, while nodeck hides its UI and displays custom content on top of it.

## How it works

The Yodeck player loads a Watch2Gether page. Thankfully, Yodeck's scripting language provides us with the ability to invoke JavaScript when a web page is loaded. And I took that personally.

Commands can be entered through the Watch2Gether chat and are picked up by nodeck. This allows us to control the screen without requiring a separate interface.

For example:
```
/img https://example.org/image.jpg
/zoom 150
```

The image itself can be retrieved through the imageStore backend, which provides a small token-based image cache.

## Structure

The repository contains 3 separate components:

**screen/**

This is the Yodeck-side bootstrapper. The script has to be pasted inside a `runScript(...)` block in the Yodeck scripting language.

**hosted/**

This part is hosted on a web server loaded dynamically by the bootstrapper. This way, I can change the code without having to restart the player after every update. I'm planning to add support for multiple modules in the future.

**imageStore/**

This is the server-side image store. It is used to retrieve external images through a reliable URL and to avoid loading the original image source directly from the Yodeck player. The use is optional, but it adds an additional layer of security.

## Requirements

- A Yodeck player
- A Watch2Gether room (no account required)
- A web server for nodeck.js (hosting it on Github will suffice)
- OPTIONAL: A PHP-capable web server for imageStore, if image caching is desired

## Disclaimer

nodeck is primarily intended for private/internal use and experimentation.

**I do not recommend using nodeck in production or exposing it to the public. Under no circumstances. For any reason. Just don't.**

This project was created for a very specific  and dumb use case, mostly for the entertainment of myself and my colleagues. Use it to amuse yourself, show it to your coworkers, and feel a brief sense of accomplishment. Then, preferably, return to more important things.

Please do not deploy this to production. Please do not build for some reason critical infrastructure around it. If you do, contact me and tell me what company you work for, so that I can avoid it.

It is a small project made for fun. Treat it accordingly.
