import React from "react";
import ReactDOM from "react-dom/client";
import Playground from "./playground";

// biome-ignore lint/style/noNonNullAssertion: <explanation>
ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<Playground />
	</React.StrictMode>,
);
