import { createRoot } from "react-dom/client";

// The server renders index.html, so Vite can't inject React's hot-reload setup. It has to
// finish before any component loads, or the component throws and the page stays blank.
const ready = import.meta.env.DEV ? import("./dev_embed.js") : Promise.resolve();

ready
  .then(() => import("./App"))
  .then(({ default: App }) => {
    createRoot(document.getElementById("app")).render(<App />);
  });
