import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

(window as unknown as Record<string, unknown>).MonacoEnvironment = {
  getWorker() {
    return new Worker(
      URL.createObjectURL(new Blob(["self.onmessage=()=>{}"], { type: "application/javascript" })),
    );
  },
};

createRoot(document.getElementById("root")!).render(<App />);
