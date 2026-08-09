# PoGo Boekenberg Home

Standalone GitHub Pages homepage for the PoGo Boekenberg community.

## Public URL structure

- Homepage: `https://<account>.github.io/home/`
- Community map: `https://<account>.github.io/map/`

The map, Discord, Niantic GraphQL meetup source, calendar fallback, and live event data sources are configured in `config.js`.

## Publish

Create a GitHub repository named `home`, copy these files to its root, and enable GitHub Pages with GitHub Actions. The included workflow publishes the static site on every push to `main`.

No build step or server is required.

## Installable app

The homepage is a Progressive Web App. Supported browsers show an **Install app** button after the site is served over HTTPS. On iPhone and iPad, the button explains how to use Safari's **Add to Home Screen** action. The application shell remains available when the device is offline; live event and meetup content refreshes when connectivity returns.
