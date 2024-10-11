const fs = require('node:fs');
const { randomUUID } = require('crypto');

function translateFile(fileStatementsBlock) {
	const requisites = fs.readFileSync("./tin-compiler/tin.stdlib.js");
	return requisites + ";\n" + translate(fileStatementsBlock)
}

function createConstructor(typeDef) {
	const parameters = "(" + typeDef.fieldDefs.map((param, i) => {
		return "_p" + i
	}) + ")"

	return parameters + " => ({" + typeDef.fieldDefs.map((param, i) => {
		return `${param.name}: _p${i}`
	}) + "})"
}

function translate(term, args) {
	switch (term.tag) {
		case "AppliedKeyword":
			return `${term.keyword} (${translate(term.param)})`
		case "Block":
			let last;
			last = term.statements.pop()
			return [...term.statements.map(st => translate(st)), ((args && args.returnLast) ? "return " : "") + `${translate(last)}`].join(";\n")
		case "Group":
			return `(${translate(term.value)})`
		case "Definition":
			return `const ${term.name} ${(term.type ? `/*${term.type}*/` : "")} = ${translate(term.value)}`
		case "Literal":
			if (term.type === "String") {
				return `"${term.value}"`
			} else {
				return `${term.value}`
			}
		case "Cast":
			return `(${translate(term.expression)}) /* as ${translate(term.type)} */`
		case "Identifier":
			return term.value
		case "Lambda":
			return `function(${term.params.map(p => p.name + (p.type ? `/*${p.type}*/` : "") + (p.defaultValue ? ` = ${translate(p.defaultValue)}` : "")).join(", ")}) {\n${translate(term.block, { returnLast: true })}\n}`
		case "IfStatement":
			return `((${translate(term.condition)}) ? (${translate(term.trueBranch)}) : (${translate(term.falseBranch)})) `
		case "BinaryExpression":
			if (term.operator === "=") {
				return `const ${term.left.value} ${term.left.type ? ("/*" + term.left.type + "*/") : ""} = ${translate(term.right)}`
			}
			if (!["+", "-", "*", "/", "&&", "||", "->", "<", ">", "<=", ">=", "."].includes(term.operator)) {
				return translate(term.left) + '["' + term.operator + '"](' + translate(term.right) + ')'
			}
			return translate(term.left) + " " + term.operator + " " + translate(term.right)
		case "Apply":
			return translate(term.callee) + "(" + term.args.map(arg => translate(arg)).join(", ") + ")"
		case "TypeDef":
			return `TIN_TYPE("${randomUUID()}", ${createConstructor(term)}, {${term.fieldDefs.map(f => translate(f))}})`
		case "FieldDef":
			return `${term.name}: { type: ${term.type}, defaultValue: ${term.defaultValue} }`
		default:
			return "(? " + term.tag + " ?)"
	}
}

module.exports.translateFile = translateFile;