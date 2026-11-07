import { createRoot } from "react-dom/client";
import Widget from "./Widget";
import { installDevMock } from "../devMock";
import "../styles/widget-tw.css";
import "../styles/global.css";

installDevMock();

createRoot(document.getElementById("root")!).render(<Widget />);
