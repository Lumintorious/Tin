import { transformAsync } from "@babel/core";
import fs from "fs/promises";
import { install } from 'source-map-support';

install();
export async function load(url, context, defaultLoad) {
	if (url.startsWith("node:")) return defaultLoad(url, context, defaultLoad);
	if (url.endsWith(".mjs")) {
		const filePath = url.substring(8);//new URL(url).pathname;
		const source = await fs.readFile(filePath, "utf8");
		const log = console.error;
		console.error = () => { }
		const { code } = await transformAsync(source, {
			filename: filePath,
			presets: [],
			plugins: ["@babel/plugin-proposal-do-expressions"],
		});
		return { format: "module", source: "const exports = {};" + code, shortCircuit: true };
	}
	return defaultLoad(url, context, defaultLoad);
}