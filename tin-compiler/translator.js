const fs = require('node:fs');
const { randomUUID } = require('crypto');

function translateFile(fileStatementsBlock) {
	const requisites = fs.readFileSync("./tin-compiler/tin.stdlib.js");
	return requisites + ";\n" + translate(fileStatementsBlock)
}

function createConstructor(typeDef) {
	const parameters = "(" + typeDef.fieldDefs.map((param, i) => {
		return `_p${i}${param.defaultValue ? (" = " + translate(param.defaultValue)) : ""}`
	}) + ")"

	return parameters + " => ({" + typeDef.fieldDefs.map((param, i) => {
		return `${param.name}: _p${i}`
	}) + "})"
}

function translate(term, args) {
	if (term === undefined || term === null) {
		return "undefined"
	}
	switch (term.tag) {
		case "AppliedKeyword":
			return `${term.keyword} (${translate(term.param)})`
		case "Block":
			let last;
			last = term.statements.pop()
			const isAssignment = last.tag === "Assignment"
			return [...term.statements.map(st => translate(st)), ((!isAssignment && args && args.returnLast) ? "return " : "") + `${translate(last)}`].join(";\n")
		case "Group":
			return `(${translate(term.value)})`
		case "Select":
			return `${translate(term.owner)}.${translate(term.field)}`
		case "Assignment":
			return `${term.isDeclaration ? "var " : ""}${translate(term.lhs)} ${(term.type ? `/*${translate(term.type)}*/` : (term.typeSymbol ? `/* ${term.typeSymbol.toString()} */` : ""))}${term.value ? ` = ${translate(term.value)}` : ""}`
		case "Literal":
			if (term.type === "String") {
				return `"${term.value}"`
			} else if (term.type === "Number" || term.type === "Boolean") {
				return `${term.value}`
			} else {
				return 'null'
			}
		case "Cast":
			return `(${translate(term.expression)}) /* as ${translate(term.type)} */`
		case "Identifier":
			return term.value
		case "Lambda":
			return `function(${term.params.map(p => translate(p)).join(", ")}) {\n${translate(term.block, { returnLast: true })}\n}`
		case "LambdaType":
			return `(${term.parameterTypes.map(t => translate(t)).join(", ")}) => ${translate(term.returnType)}`
		case "IfStatement":
			return `((${translate(term.condition)}) ? (${translate(term.trueBranch)}) : (${translate(term.falseBranch)})) `
		case "BinaryExpression":
			if (term.operator === "=") {
				return `const ${term.left.value} ${term.left.type ? ("/*" + term.left.type + "*/") : ""} = ${translate(term.right)}`
			}
			if (term.operator === "|") {
				return translate({ tag: "Apply", callee: { tag: "Identifier", value: "_TIN_UNION_OBJECTS" }, args: [term.left, term.right] })
			}
			if (term.operator === "&") {
				return translate({ tag: "Apply", callee: { tag: "Identifier", value: "_TIN_INTERSECT_OBJECTS" }, args: [term.left, term.right] })
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
			return `${term.name}: { type: ${term.type}, defaultValue: ${translate(term.defaultValue)} }`
		default:
			return "(? " + term.tag + " ?)"
	}
}

module.exports.translateFile = translateFile;