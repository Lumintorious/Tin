"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateFile = translateFile;
const node_fs_1 = __importDefault(require("node:fs"));
const crypto_1 = require("crypto");
const Parser_1 = require("./Parser");
const Parser_2 = require("./Parser");
const TypeChecker_1 = require("./TypeChecker");
const Parser_3 = require("./Parser");
function translateFile(fileStatementsBlock, scope) {
    const requisites = node_fs_1.default.readFileSync("./tin-compiler-ts/tin.stdlib.js");
    return requisites + ";\n" + translate(fileStatementsBlock, scope);
}
function createConstructor(typeDef, scope) {
    if (typeDef.fieldDefs.length === 0) {
        return "() => undefined";
    }
    const parameters = "(" +
        typeDef.fieldDefs.map((param, i) => {
            return `_p${i}${param.defaultValue
                ? " = " + translate(param.defaultValue, scope)
                : ""}`;
        }) +
        ")";
    return (parameters +
        " => ({" +
        typeDef.fieldDefs.map((param, i) => {
            return `${param.name}: _p${i}`;
        }) +
        "})");
}
function translate(term, scope, args = {}) {
    if (term === undefined || term === null) {
        return "undefined";
    }
    // AppliedKeywords
    if (term instanceof Parser_1.AppliedKeyword) {
        return `${term.keyword} (${translate(term.param, scope)})`;
        // Block
    }
    else if (term instanceof Parser_1.Block) {
        let last = term.statements.pop();
        const isAssignment = last instanceof Parser_1.Assignment;
        return [
            ...term.statements.map((st) => translate(st, scope)),
            (!isAssignment &&
                args &&
                args.returnLast &&
                !(last instanceof Parser_2.WhileLoop)
                ? "return "
                : "") + `${translate(last, scope)}`,
        ].join(";\n");
        // Group
    }
    else if (term instanceof Parser_1.Group) {
        return `(${translate(term.value, scope)})`;
        // Select
    }
    else if (term instanceof Parser_1.Select) {
        const operator = term.ammortized ? "?." : ".";
        return `${translate(term.owner, scope)}${operator}${term.field}`;
        // Make
    }
    else if (term instanceof Parser_3.Make) {
        if (term.type instanceof Parser_3.Identifier) {
            return term.type.value;
        }
        else {
            throw new Error("Can only use make with a named type. eg. 'Cat'");
        }
        // SquareTypeToValueLambda
    }
    else if (term instanceof Parser_2.SquareTypeToValueLambda) {
        return `function(${term.parameterTypes
            .map((p) => translate(p, scope.innerScopeOf(term, true)))
            .join(", ")}) {\n${translate(term.block, scope.innerScopeOf(term, true), {
            returnLast: true,
        })}\n}`;
        // Change
    }
    else if (term instanceof Parser_2.Change) {
        return `${translate(term.lhs, scope)} = ${translate(term.value, scope)}`;
        // Assignment
    }
    else if (term instanceof Parser_1.Assignment) {
        if (term.value instanceof Parser_1.Literal &&
            term.value.value === "" &&
            term.value.type === "Any") {
            return "";
        }
        let keyword = term.isDeclaration ? "var " : "";
        const scopeDots = [...(scope.toPath().matchAll(/\./g) || [])].length;
        const doExport = scopeDots < 2 && term.isDeclaration ? "export " : "";
        keyword = doExport + keyword;
        const lhs = translate(term.lhs, scope);
        const value = term.value ? " = " + translate(term.value, scope) : "";
        let type = "";
        if (!term.isTypeLevel) {
            try {
                const symbol = term.isDeclaration ? term.symbol : scope.lookup(lhs);
                type =
                    "/* " +
                        (symbol !== undefined ? symbol.typeSymbol.toString() : "???") +
                        "*/";
            }
            catch (e) {
                //
            }
        }
        const constructorName = (0, TypeChecker_1.getConstructorName)(lhs);
        let declareConstructor = "";
        if (term.value instanceof Parser_1.TypeDef) {
            declareConstructor = ""; //`; var ${constructorName} = ${lhs};`;
        }
        else if (term.value instanceof Parser_1.SquareTypeToTypeLambda &&
            term.value.returnType instanceof Parser_1.TypeDef) {
            const surrogateFunc = new Parser_2.SquareTypeToValueLambda(term.value.parameterTypes, new Parser_1.Block([new Parser_1.SquareApply(term.lhs, term.value.parameterTypes)]));
            declareConstructor = "";
            // `; var ${constructorName} = ${translate(
            //    surrogateFunc,
            //    scope
            // )};`;
        }
        return keyword + lhs + type + value + declareConstructor;
        // Literal
    }
    else if (term instanceof Parser_1.Literal) {
        if (term.type === "String") {
            return `"${term.value}"`;
        }
        else if (term.type === "Number" || term.type === "Boolean") {
            return `${term.value}`;
        }
        else {
            return "null";
        }
        // Cast
    }
    else if (term instanceof Parser_1.Cast) {
        return `(${translate(term.expression, scope)}) /* as ${translate(term.type, scope)} */`;
        // Identifier
    }
    else if (term instanceof Parser_3.Identifier) {
        if (term.value === "this") {
            return "$this";
        }
        return term.value;
        // RoundValueToValueLambda
    }
    else if (term instanceof Parser_1.RoundValueToValueLambda) {
        return `function(${term.params
            .map((p) => translate(p, scope.innerScopeOf(term, true)))
            .join(", ")}) {\n${translate(term.block, scope.innerScopeOf(term, true), {
            returnLast: true,
        })}\n}`;
        //RoundTypeToTypeLambda
    }
    else if (term instanceof Parser_1.RoundTypeToTypeLambda) {
        return `(${term.parameterTypes
            .map((t) => translate(t, scope.innerScopeOf(term, true)))
            .join(", ")}) => ${translate(term.returnType, scope.innerScopeOf(term, true))}`;
        // SquareTypeToTypeLambda
    }
    else if (term instanceof Parser_1.SquareTypeToTypeLambda) {
        return `/* [] */(${term.parameterTypes
            .map((t) => translate(t, scope.innerScopeOf(term, true)))
            .join(", ")}) => ${translate(term.returnType, scope.innerScopeOf(term, true))}`;
        // IfStatement
    }
    else if (term instanceof Parser_1.IfStatement) {
        let trueBranch = "";
        if (term.trueBranch instanceof Parser_1.Block &&
            term.trueBranch.statements.length > 1) {
            trueBranch = `((function(){${translate(term.trueBranch, scope, {
                returnLast: true,
            })}})())`;
        }
        else {
            trueBranch = `(${translate(term.trueBranch, scope)})`;
        }
        let falseBranch = "";
        if (term.falseBranch instanceof Parser_1.Block &&
            term.falseBranch.statements.length > 1) {
            falseBranch = `((function(){${translate(term.falseBranch, scope, {
                returnLast: true,
            })}})())`;
        }
        else {
            falseBranch = `(${translate(term.falseBranch, scope)})`;
        }
        return `((${translate(term.condition, scope)}) ? ${trueBranch} : ${falseBranch}) `;
        // BinaryExpression
    }
    else if (term instanceof Parser_2.WhileLoop) {
        const innerScope = scope.innerScopeOf(term, true);
        let parts = translate(term.condition, innerScope);
        if (term.start && term.eachLoop) {
            parts =
                translate(term.start, innerScope) +
                    ";" +
                    parts +
                    ";" +
                    translate(term.eachLoop, innerScope);
        }
        return `${term.start !== undefined ? "for" : "while"} (${parts}) {\n ${translate(term.action, innerScope)} \n}`;
        // BinaryExpression
    }
    else if (term instanceof Parser_1.BinaryExpression) {
        return translateBinaryExpression(term, scope);
        // RoundApply
    }
    else if (term instanceof Parser_1.RoundApply) {
        const takesVarargs = term.takesVarargs;
        const open = takesVarargs ? "(Array(0)([" : "(";
        const close = takesVarargs ? "]))" : ")";
        return ((term.calledInsteadOfSquare ? "() =>" : "") +
            translate(term.callee, scope) +
            open +
            term.args.map((arg) => translate(arg, scope)).join(", ") +
            close);
        // SquareApply
    }
    else if (term instanceof Parser_1.SquareApply) {
        return (translate(term.callee, scope) +
            ".call('Type', " +
            term.typeArgs.map((arg) => translate(arg, scope)).join(", ") +
            ")");
        // TypeDef
    }
    else if (term instanceof Parser_1.TypeDef) {
        return `TIN_TYPE("${(0, crypto_1.randomUUID)()}", ${createConstructor(term, scope)}, {${
        /*term.fieldDefs.map((f) => translate(f, scope))*/ ""}})`;
        // DataDef
    }
    else if (term instanceof Parser_2.DataDef) {
        return `{${term.fieldDefs.map((f) => `${f.name}: ${translate(f.defaultValue, scope)}`)}}`;
        // FieldDef
    }
    else if (term instanceof Parser_1.FieldDef) {
        return `${term.name}: { type: ${translate(term.type, scope)}, defaultValue: ${translate(term.defaultValue, scope)} }`;
        // Optional
    }
    else if (term instanceof Parser_2.Optional) {
        if (term.expression.isTypeLevel || !term.doubleQuestionMark) {
            return translate(term.expression, scope);
        }
        else {
            return `(${translate(term.expression, scope)} !== undefined)`;
        }
        // TypeCheck
    }
    else if (term instanceof Parser_3.TypeCheck) {
        return `${translate(term.type, scope)}.__is_child(${translate(term.term, scope)}) `;
        // Undefined
    }
    else if (term instanceof Parser_3.Import) {
        return `import * as module${moduleNumber} from "@out/${term.path}.tin.out.js";Object.entries(module${moduleNumber++}).forEach(([key, value]) => {
			globalThis[key] = value;
	  });`;
        // Undefined
    }
    else {
        return "(? " + term.tag + " ?)";
    }
}
let moduleNumber = 0;
function translateBinaryExpression(term, scope) {
    if (term.operator === "=" && term.left instanceof Parser_3.Identifier) {
        return `const ${term.left.value} ${term.left instanceof Parser_1.Cast
            ? term.left.type
                ? "/*" + term.left.type + "*/"
                : ""
            : ""} = ${translate(term.right, scope)}`;
    }
    if (term.operator === "|") {
        return translate(new Parser_1.RoundApply(new Parser_3.Identifier("_TIN_UNION_OBJECTS"), [
            term.left,
            term.right,
        ]), scope);
    }
    if (term.operator === "&") {
        return translate(new Parser_1.RoundApply(new Parser_3.Identifier("_TIN_INTERSECT_OBJECTS"), [
            term.left,
            term.right,
        ]), scope);
    }
    if (term.operator === "?:") {
        return `${translate(term.left, scope)} ?? ${translate(term.right, scope)}`;
    }
    if (![
        "+",
        "-",
        "*",
        "**",
        "/",
        "&&",
        "||",
        "->",
        "<",
        ">",
        "<=",
        ">=",
        "==",
        "!=",
        ".",
    ].includes(term.operator)) {
        return (translate(term.left, scope) +
            '["' +
            term.operator +
            '"](' +
            translate(term.right, scope) +
            ")");
    }
    return (translate(term.left, scope) +
        " " +
        term.operator +
        " " +
        translate(term.right, scope));
}
