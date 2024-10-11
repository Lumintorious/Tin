const { Lexer } = require("./lexer");
const { Parser } = require("./customParser");
const fs = require('node:fs');
const { escape } = require("node:querystring");
const { translateFile } = require("./translator.js")

function tokenTablePrint(tokens) {
	let str = "";
	for (let i = 0; i <= tokens.length; i++) {
		const t = tokens[i];
		if (t === undefined) {
			str += "--undefined--"
		} else {
			str += t.tag.padEnd(12, ' ') + " | " + String(t.value || "").replace("\n", '').padEnd(12, ' ') + " | " + String(t.start.line).padStart(3, ' ') + ", " + String(t.start.column).padEnd(5, ' ') + "\n";
		}
	}
	return str;
}

let inputFile = process.argv[2]
if (!inputFile.endsWith(".tin")) {
	inputFile = inputFile + ".tin"
}

fs.readFile(inputFile, 'utf8', (err, data) => {
	if (err) {
		console.error(err);
		return;
	}

	// Test case for position tracking
	const lexer = new Lexer(data);

	let tokens = [];
	let token;
	while ((token = lexer.nextToken()) !== null) {
		tokens.push(token)
	}
	fs.writeFile(process.argv[2] + ".tok.txt", tokenTablePrint(tokens), () => {
		// Create a parser instance
		const parser = new Parser(tokens);
		const ast = parser.parse();
		const { typeCheck } = require("./typeCheckerAuto");
		fs.writeFile(process.argv[2] + ".ast.json", JSON.stringify(ast, null, 2), () => {
			const translatedStr = translateFile(ast);
			// typeCheck(ast);
			fs.writeFile(process.argv[2] + ".out.js", translatedStr, () => {
				require("./../" + process.argv[2] + ".out.js")
			})
		})
	})

});