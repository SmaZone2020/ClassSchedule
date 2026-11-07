import { createRoot } from "react-dom/client";
import SettingsRoot from "./SettingsRoot";
import { installDevMock } from "../devMock";
import "../styles/settings-tw.css";

installDevMock();

const container = document.getElementById("root");
if (container) createRoot(container).render(<SettingsRoot />);
