import { createRoot } from "react-dom/client";

const root = document.getElementById("app");

// The server renders index.html, so Vite can't inject React's hot-reload setup. It has to
// finish before any component loads, or the component throws and the page stays blank.
const ready = import.meta.env.DEV ? import("./dev_embed.js") : Promise.resolve();

ready
  .then(() => import("./App"))
  .then(({ default: App }) => {
    createRoot(root).render(<App />);
  })
  .catch((error) => {
    // The error boundary can't catch a module that failed to load, as React isn't running yet.
    console.error(error);
    root.textContent = `This page couldn't load: ${error.message}`;
  });
