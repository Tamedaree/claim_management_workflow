import ReactDOM from "react-dom/client";
import App from "@/App.jsx";
import "@/index.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <ThemeProvider defaultTheme="system">
    <App />
  </ThemeProvider>,
);
