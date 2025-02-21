"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeErrorList = exports.TypeChecker = exports.Scope = exports.Symbol = exports.StructType = exports.MarkerType = exports.BinaryOpType = exports.AppliedGenericType = exports.SquareTypeToTypeLambdaType = exports.SquareTypeToValueLambdaType = exports.TypeRoundValueToValueLambda = exports.RoundValueToValueLambdaType = exports.OptionalType = exports.GenericNamedType = exports.VarargsType = exports.LiteralType = exports.ModuleType = exports.NamedType = exports.TypeOfTypes = exports.AnyTypeClass = exports.UncheckedType = exports.Type = void 0;
exports.getConstructorName = getConstructorName;
const Lexer_1 = require("./Lexer");
const Parser_1 = require("./Parser");
const Parser_2 = require("./Parser");
const Parser_3 = require("./Parser");
function getConstructorName(typeName) {
	return typeName;
}
class Type {
	constructor(tag = "Unknown") {
		this.isForwardReferenceable = false;
		this.tag = tag;
		if (tag === "Unknown") {
			throw new Error("Abstract Type initialization");
		}
	}
	named(name) {
		this.name = name;
		return this;
	}
	isAssignableTo(other, scope) {
		if (!other) {
			throw new Error("Found undefined type");
		}
		return this.extends(other, scope) || other.isExtendedBy(this, scope);
	}
	extends(other, scope) {
		return false; // By default, types are not assignable to each other unless overridden
	}
	isExtendedBy(other, scope) {
		return false;
	}
	equals(other) {
		return this.toString() === other.toString(); // Use string representation for equality check
	}
	located(start, end) {
		if (start && end) {
			this.position = new Lexer_1.TokenPos(start.start, end.end);
		}
		return this;
	}
	toString() {
		return `Unknown ${this.tag}`; // Base export class
	}
}
exports.Type = Type;
class UncheckedType extends Type {
	constructor() {
		super("Unchecked");
	}
}
exports.UncheckedType = UncheckedType;
class AnyTypeClass extends Type {
	constructor() {
		super("Any");
	}
	isAssignableTo(other, scope) {
		return true;
	}
	extends(other, scope) {
		// Named types are assignable if they are equal (same name)
		return other instanceof AnyTypeClass;
	}
	isExtendedBy() {
		return true;
	}
	toString() {
		return "Any";
	}
}
exports.AnyTypeClass = AnyTypeClass;
const AnyType = new AnyTypeClass();
class TypeOfTypes extends Type {
	constructor() {
		super("TypeOfTypes");
	}
	toString() {
		return "TypeOfTypes";
	}
}
exports.TypeOfTypes = TypeOfTypes;
class NamedType extends Type {
	constructor(name) {
		super("NamedType");
		this.name = name;
	}
	isPrimitive() {
		return Object.keys(NamedType.PRIMITIVE_TYPES).includes(this.name);
	}
	isAssignableTo(other, scope) {
		if (this.name === "Nothing") {
			return true;
		}
		const realType = scope.lookupType(this.name);
		if ((other instanceof NamedType || other instanceof GenericNamedType) &&
			this.name === other.name &&
			realType !== undefined) {
			return true;
		}
		if (realType instanceof NamedType) {
			if (super.isAssignableTo(other, scope)) {
				return true;
			}
			if (this.name === other.name &&
				Object.keys(NamedType.PRIMITIVE_TYPES).includes(this.name)) {
				return true;
			}
			return false;
		}
		realType.name = this.name;
		return realType.isAssignableTo(other, scope);
	}
	extends(other, scope) {
		// Named types are assignable if they are equal (same name)
		return other instanceof NamedType && this.name === other.name;
	}
	isExtendedBy(other, scope) {
		return ((other instanceof NamedType && this.name === other.name) ||
			(other.name !== undefined && other.name === this.name));
	}
	toString() {
		return this.name;
	}
}
exports.NamedType = NamedType;
NamedType.PRIMITIVE_TYPES = {
	Int: new NamedType("Int"),
	Number: new NamedType("Number"),
	String: new NamedType("String"),
	Boolean: new NamedType("Boolean"),
	Nothing: new NamedType("Nothing"),
	Type: new NamedType("Type"),
	Any: AnyType,
};
class ModuleType extends Type {
	constructor(scope) {
		super("ModuleType");
		this.scope = scope;
	}
	extends(other, scope) {
		return false;
	}
	isExtendedBy(other, scope) {
		return false;
	}
}
exports.ModuleType = ModuleType;
class LiteralType extends Type {
	constructor(value, type) {
		super("LiteralType");
		this.value = value;
		this.type = type;
	}
	extends(other, scope) {
		if (other instanceof LiteralType &&
			this.type.extends(other.type, scope) &&
			this.value === other.value) {
			return true;
		}
		return this.type.extends(other, scope);
	}
	isExtendedBy(other, scope) {
		return (other instanceof LiteralType &&
			other.type.extends(this.type, scope) &&
			other.value === this.value);
	}
	toString() {
		return this.value;
	}
}
exports.LiteralType = LiteralType;
class VarargsType extends Type {
	constructor(type) {
		super("VarargsType");
		this.type = type;
	}
	toString() {
		return "..." + this.type.toString();
	}
}
exports.VarargsType = VarargsType;
class GenericNamedType extends Type {
	constructor(name, extendedType, superType) {
		super("GenericNamedType");
		this.name = name;
		this.extendedType = extendedType;
		this.superType = superType;
	}
	extends(other, scope) {
		// Named types are assignable if they are equal (same name)
		return ((other instanceof NamedType || other instanceof GenericNamedType) &&
			this.name === other.name);
	}
	isExtendedBy(other, scope) {
		return ((other instanceof NamedType || other instanceof GenericNamedType) &&
			this.name === other.name);
	}
	toString() {
		return this.name;
	}
}
exports.GenericNamedType = GenericNamedType;
class OptionalType extends Type {
	constructor(type) {
		super("OptionalType");
		this.type = type;
	}
	isAssignableTo(other, scope) {
		console.log("Checking " + this.toString() + " vs. " + other.toString())
		return (
			// this.type.isAssignableTo(other, scope) ||
			this.extends(other, scope) || other.isExtendedBy(this, scope));
	}
	isSame(other, scope) {
		return this.type.isAssignableTo(other.type, scope);
	}
	extends(other, scope) {
		// Named types are assignable if they are equal (same name)
		if (other instanceof OptionalType && this.isSame(other, scope)) {
			return true;
		}
		return (this.type.extends(other, scope) ||
			other === NamedType.PRIMITIVE_TYPES.Nothing);
	}
	isExtendedBy(other, scope) {
		if (other instanceof OptionalType && this.isSame(other, scope)) {
			return true;
		}
		return (this.type.isExtendedBy(other, scope) ||
			other === NamedType.PRIMITIVE_TYPES.Nothing);
	}
	toString() {
		return this.type.toString() + "?";
	}
}
exports.OptionalType = OptionalType;
// Type of a RoundValueToValueLambda: (Int) => String
class RoundValueToValueLambdaType extends Type {
	constructor(paramTypes, returnType, isGeneric) {
		super("RoundValueToValueLambdaType");
		this.isFirstParamThis = false;
		paramTypes.forEach((p) => {
			if (p.tag === undefined) {
				throw new Error("Empty type");
			}
		});
		this.paramTypes = paramTypes;
		this.returnType = returnType;
		this.isGeneric = isGeneric;
		this.isForwardReferenceable = true;
	}
	extends(other, scope) {
		if (!(other instanceof RoundValueToValueLambdaType))
			return false;
		// Check if parameter types are contravariant
		const paramCheck = this.paramTypes.length === other.paramTypes.length &&
			this.paramTypes.every((paramType, index) => {
				return other.paramTypes[index].isAssignableTo(paramType, scope);
			});
		// Return type must be covariant
		const returnCheck = this.returnType.isAssignableTo(other.returnType, scope);
		return paramCheck && returnCheck;
	}
	isExtendedBy(other, scope) {
		return (other instanceof RoundValueToValueLambdaType &&
			other.extends(this, scope));
	}
	toString() {
		if (this.name) {
			return this.name;
		}
		const paramsStr = this.paramTypes.map((t) => t.toString()).join(", ");
		return `${this.isGeneric ? "[" : "("}${paramsStr}${this.isGeneric ? "]" : ")"} => ${this.returnType ? this.returnType.toString() : "undefined"}`;
	}
}
exports.RoundValueToValueLambdaType = RoundValueToValueLambdaType;
// A RoundValueToValueLambda of Types: [T] => List[T]
// ???
class TypeRoundValueToValueLambda extends Type {
	constructor(paramTypes, returnType) {
		super("TypeRoundValueToValueLambda");
		this.paramTypes = paramTypes;
		this.returnType = returnType;
	}
	toString() {
		const paramsStr = this.paramTypes.map((t) => t.toString()).join(", ");
		return `[${paramsStr}] => ${this.returnType ? this.returnType.toString() : "undefined"}`;
	}
}
exports.TypeRoundValueToValueLambda = TypeRoundValueToValueLambda;
class SquareTypeToValueLambdaType extends Type {
	constructor(paramTypes, returnType) {
		super("SquareTypeToValueLambdaType");
		this.paramTypes = paramTypes;
		this.returnType = returnType;
	}
	toString() {
		return `[${this.paramTypes
			.map((p) => p.toString())
			.join(", ")}] => ${this.returnType.toString()}`;
	}
}
exports.SquareTypeToValueLambdaType = SquareTypeToValueLambdaType;
class SquareTypeToTypeLambdaType extends Type {
	constructor(paramTypes, returnType) {
		super("SquareTypeToTypeLambdaType");
		this.paramTypes = paramTypes;
		this.returnType = returnType;
	}
	toString() {
		return `[${this.paramTypes
			.map((p) => p.toString())
			.join(", ")}] => ${this.returnType.toString()}`;
	}
}
exports.SquareTypeToTypeLambdaType = SquareTypeToTypeLambdaType;
class AppliedGenericType extends Type {
	constructor(callee, parameterTypes) {
		super("AppliedGenericType");
		this.callee = callee;
		this.parameterTypes = parameterTypes;
	}
	extends(other, scope) {
		if (!this.resolved) {
			this.resolved = scope.resolveAppliedGenericTypes(this);
		}
		if (this.resolved) {
			return this.resolved.extends(other, scope);
		}
		else if (other instanceof AppliedGenericType) {
			if (scope
				.resolveAppliedGenericTypes(this)
				.extends(scope.resolveAppliedGenericTypes(other), scope)) {
				return true;
			}
			let areAllParamsEqual = true;
			if (this.parameterTypes.length !== other.parameterTypes.length) {
				areAllParamsEqual = false;
			}
			else {
				for (let i = 0; i < this.parameterTypes.length; i++) {
					if (!this.parameterTypes[i].isAssignableTo(other.parameterTypes[i], scope)) {
						areAllParamsEqual = false;
						break;
					}
				}
			}
			return areAllParamsEqual && this.callee.extends(other.callee, scope);
		}
		else {
			return false;
		}
	}
	isExtendedBy(other, scope) {
		var _a;
		if (!this.resolved) {
			this.resolved = scope.resolveAppliedGenericTypes(this);
		}
		if (other instanceof AppliedGenericType &&
			this.callee.name === ((_a = other.callee) === null || _a === void 0 ? void 0 : _a.name) &&
			this.callee.name !== undefined &&
			scope.lookupType(this.callee.name) !== undefined) {
			return true;
		}
		else if (this.resolved) {
			return this.resolved.isExtendedBy(other, scope);
		}
		else {
			return false;
		}
	}
	toString() {
		var _a;
		const paramsStr = this.parameterTypes.map((t) => t.toString()).join(", ");
		return `${(_a = this.callee.name) !== null && _a !== void 0 ? _a : `{${this.callee.toString()}}`}[${paramsStr}]`;
	}
}
exports.AppliedGenericType = AppliedGenericType;
class BinaryOpType extends Type {
	constructor(left, operator, right) {
		super("BinaryOpType");
		this.left = left;
		this.operator = operator;
		this.right = right;
	}
	isAssignableTo(other, scope) {
		if (this.operator === "&" &&
			other instanceof BinaryOpType &&
			other.operator === "&") {
			return ((this.left.isExtendedBy(other.left, scope) &&
				this.right.isExtendedBy(other.right, scope)) ||
				(this.right.isExtendedBy(other.left, scope) &&
					this.left.isExtendedBy(other.right, scope)));
		}
		else if (this.operator === "&") {
			return (this.left.isExtendedBy(other, scope) ||
				this.right.isExtendedBy(other, scope));
		}
		else if (this.operator === "|" &&
			other instanceof BinaryOpType &&
			other.operator === "|") {
			return ((this.left.extends(other.left, scope) &&
				this.right.extends(other.right, scope)) ||
				(this.right.extends(other.left, scope) &&
					this.left.extends(other.right, scope)));
		}
		else if (this.operator === "|") {
			return (this.left.isAssignableTo(other, scope) &&
				this.right.isAssignableTo(other, scope));
		}
		else {
			return super.isAssignableTo(other, scope);
		}
	}
	extends(other, scope) {
		if (this.operator === "&") {
			return (other.isAssignableTo(this.left, scope) &&
				other.isAssignableTo(this.right, scope));
		}
		if (this.operator === "|" &&
			other instanceof BinaryOpType &&
			other.operator === "|") {
			return ((this.left.extends(other.left, scope) &&
				this.right.extends(other.right, scope)) ||
				(this.right.extends(other.left, scope) &&
					this.left.extends(other.right, scope)));
		}
		else if (this.operator === "|") {
			return (this.left.extends(other, scope) || this.right.extends(other, scope));
		}
		return false;
	}
	isExtendedBy(other, scope) {
		if (this.operator === "|" &&
			other instanceof BinaryOpType &&
			other.operator === "|") {
			return (this.left.isExtendedBy(other.left, scope) ||
				this.right.isExtendedBy(other.right, scope) ||
				this.right.isExtendedBy(other.left, scope) ||
				this.left.isExtendedBy(other.right, scope));
		}
		else if (this.operator === "|") {
			return (other.isAssignableTo(this.left, scope) ||
				other.isAssignableTo(this.right, scope));
		}
		return false;
	}
	toString() {
		return `${this.left.toString()} ${this.operator} ${this.right.toString()}`;
	}
}
exports.BinaryOpType = BinaryOpType;
class MarkerType extends Type {
	constructor() {
		super("MarkerType");
	}
	extends(other, scope) {
		return other instanceof MarkerType && other.name === this.name;
	}
	isExtendedBy(other, scope) {
		return other instanceof AnyTypeClass;
	}
	toString() {
		return `Marker { ${this.name || "Unknown"} }`;
	}
}
exports.MarkerType = MarkerType;
class StructType extends Type {
	constructor(fields) {
		super("StructType");
		this.fields = fields; // Array of { name, type } objects
	}
	extends(other, scope) {
		if (!(other instanceof StructType))
			return false;
		// Check if every field in this type exists in the other and is assignable
		return this.fields.every((field) => {
			const otherField = other.fields.find((f) => f.name === field.name);
			return (otherField &&
				field.typeSymbol.isAssignableTo(otherField.typeSymbol, scope));
		});
	}
	isExtendedBy(other, scope) {
		if (!(other instanceof StructType))
			return false;
		// Check if every field in this type exists in the other and is assignable
		return this.fields.every((field) => {
			const otherField = other.fields.find((f) => f.name === field.name);
			return (otherField !== undefined &&
				field.typeSymbol.isAssignableTo(otherField.typeSymbol, scope));
		});
	}
	toString() {
		var _a;
		return ((_a = this.name) !== null && _a !== void 0 ? _a : `StructType(${this.fields.map((f) => `${f.name}::${f.typeSymbol.toString()}`)})`);
	}
}
exports.StructType = StructType;
class Symbol {
	constructor(name, typeSymbol, ast) {
		this.run = 0;
		this.name = name;
		this.typeSymbol = typeSymbol;
		this.ast = ast;
	}
	located(start, end) {
		if (start && end) {
			this.position = new Lexer_1.TokenPos(start.start, end.end);
		}
		return this;
	}
	// Used to change all fields so the reference doesn't change
	// Happens only when filling in an UncheckedType symbol
	rewriteFrom(template) {
		if (!(template.typeSymbol instanceof UncheckedType)) {
			throw new Error("Attempted to rewrite a checked type symbol. Only unchecked type symbols from run 0 can be rewritten in run 1.");
		}
		this.name = template.name;
		this.typeSymbol = template.typeSymbol;
		this.ast = template.ast;
		this.run = template.run;
		this.position = template.position;
		this.index = template.index;
	}
}
exports.Symbol = Symbol;
class Scope {
	constructor(name, parent) {
		this.symbols = new Map();
		this.typeSymbols = new Map();
		this.symbolsByAst = new Map();
		this.typeSymbolsByAst = new Map();
		this.childrenByAst = new Map();
		this.currentIndex = 0;
		this.run = 0;
		this.name = name;
		this.parent = parent;
		if (parent) {
			this.run = parent.run;
		}
	}
	absorbAllFrom(scope) {
		scope.symbols.forEach((v, k) => this.symbols.set(k, v));
		scope.typeSymbols.forEach((v, k) => this.typeSymbols.set(k, v));
		scope.symbolsByAst.forEach((v, k) => this.symbolsByAst.set(k, v));
		scope.typeSymbolsByAst.forEach((v, k) => this.typeSymbolsByAst.set(k, v));
		scope.childrenByAst.forEach((v, k) => this.childrenByAst.set(k, v));
		this.currentIndex = this.currentIndex + scope.currentIndex;
	}
	setRun(runNumber) {
		this.run = runNumber;
		this.childrenByAst.forEach((v) => {
			v.setRun(runNumber);
		});
	}
	innerScopeOf(astNode, canCreate = false) {
		const ast = astNode;
		if (!ast.key) {
			ast.key = Scope.currentKey++;
		}
		const child = this.childrenByAst.get(ast.key);
		if (!child && !canCreate) {
			throw new Error("Could not find child scope " + this.toPath());
		}
		if (child) {
			return child;
		}
		else {
			const child = new Scope(astNode.tag, this);
			child.run = this.run;
			this.childrenByAst.set(ast.key, child);
			return child;
		}
	}
	toString() {
		return "Scope { " + this.name + " }";
	}
	toPath() {
		let str = "";
		let now = this;
		while (now !== undefined) {
			str = now.name + "." + str;
			now = now.parent;
		}
		return str.substring(0, str.length - 1);
	}
	mapAst(astNode, symbol) {
		if (symbol instanceof Symbol) {
			this.symbolsByAst.set(astNode, symbol);
		}
		else if (symbol instanceof Type) {
			this.typeSymbolsByAst.set(astNode, symbol);
		}
	}
	// Define a new symbol in the current scope
	declare(name, symbol, redeclare = false) {
		if (this.symbols.has(name)) {
			const existingSymbol = this.symbols.get(name);
			if ((existingSymbol === null || existingSymbol === void 0 ? void 0 : existingSymbol.typeSymbol) instanceof UncheckedType) {
				existingSymbol.rewriteFrom(symbol);
				return;
			}
			else if (existingSymbol && existingSymbol.run == this.run) {
				if (!redeclare) {
					throw new Error(`Symbol ${name} is already declared.`);
				}
			}
			else {
				symbol.run = this.run;
			}
		}
		console.log(`${name}: ${symbol.typeSymbol.toString()} @ ${this.toPath()}`);
		symbol.run = this.run;
		if (!symbol.index) {
			symbol.index = this.currentIndex++;
		}
		this.symbols.set(name, symbol);
		if (symbol.ast) {
			this.symbolsByAst.set(symbol.ast, symbol);
			if (symbol.ast instanceof Parser_3.Assignment) {
				symbol.ast.symbol = symbol;
			}
		}
	}
	declareType(name, typeSymbol) {
		if (this.typeSymbols.has(name)) {
			const existingSymbol = this.typeSymbols.get(name);
			if (existingSymbol && existingSymbol.run == this.run) {
				throw new Error(`Symbol ${name} is already declared.`);
			}
			else {
				typeSymbol.run = this.run;
			}
		}
		console.log(name + ": " + typeSymbol);
		typeSymbol.run = this.run;
		// [T] => type:
		//   value: T
		if (typeSymbol instanceof SquareTypeToTypeLambdaType &&
			typeSymbol.returnType instanceof StructType) {
			typeSymbol.name = name;
			const constructorName = getConstructorName(name);
			const constructorSymbol = new Symbol(constructorName, new SquareTypeToValueLambdaType(typeSymbol.paramTypes, new RoundValueToValueLambdaType(typeSymbol.returnType.fields.map((f) => f.typeSymbol), new AppliedGenericType(new NamedType(name), typeSymbol.paramTypes))));
			this.declare(constructorName, constructorSymbol);
		}
		else if (typeSymbol instanceof StructType) {
			const constructorName = getConstructorName(name);
			const constructorSymbol = new Symbol(constructorName, new RoundValueToValueLambdaType(typeSymbol.fields.map((f) => f.typeSymbol), new NamedType(name)));
			this.declare(constructorName, constructorSymbol);
		}
		else if (typeSymbol instanceof MarkerType) {
			const constructorName = getConstructorName(name);
			const constructorSymbol = new Symbol(constructorName, new RoundValueToValueLambdaType([], new NamedType(name)));
			this.declare(constructorName, constructorSymbol);
		}
		else if (typeSymbol instanceof RoundValueToValueLambdaType &&
			typeSymbol.returnType instanceof StructType) {
			typeSymbol.name = name;
			const constructorName = getConstructorName(name);
			const structTypeSymbol = typeSymbol.returnType;
			const constructorSymbol = new Symbol(constructorName, new RoundValueToValueLambdaType(structTypeSymbol.fields.map((f) => f.typeSymbol), typeSymbol).named(constructorName));
			this.declare(constructorName, constructorSymbol);
		}
		typeSymbol.name = name;
		if (!typeSymbol.index) {
			typeSymbol.index = this.currentIndex++;
		}
		this.typeSymbols.set(name, typeSymbol);
	}
	// Lookup a symbol, check parent scope if not found
	lookup(name, scopeName = "") {
		if (this.symbols.has(name)) {
			return this.symbols.get(name);
		}
		else if (this.parent) {
			return this.parent.lookup(name, this.name + "." + scopeName);
		}
		throw new Error(`Symbol ${name} not found. ${[...this.symbols.keys()]}; Scope = ` +
			this.name +
			"." +
			scopeName);
	}
	hasSymbol(name) {
		var _a, _b;
		return this.symbols.has(name) || ((_b = (_a = this.parent) === null || _a === void 0 ? void 0 : _a.hasSymbol(name)) !== null && _b !== void 0 ? _b : false);
	}
	hasTypeSymbol(name) {
		var _a, _b;
		return (this.typeSymbols.has(name) ||
			((_b = (_a = this.parent) === null || _a === void 0 ? void 0 : _a.hasTypeSymbol(name)) !== null && _b !== void 0 ? _b : false));
	}
	lookupByAst(ast, scopeName = "") {
		if (this.symbolsByAst.has(ast)) {
			return this.symbolsByAst.get(ast);
		}
		else if (this.parent) {
			return this.parent.lookupByAst(ast, this.name + "." + scopeName);
		}
		throw new Error(`Symbol from AST not found. ${[...this.symbols.keys()]}; Scope = ` +
			this.name +
			"." +
			scopeName);
	}
	lookupType(name, scopeName = "") {
		if (this.typeSymbols.has(name)) {
			return this.typeSymbols.get(name);
		}
		else if (this.parent) {
			return this.parent.lookupType(name, this.name + "." + scopeName);
		}
		throw new Error(`Type Symbol ${name} not found. Scope = ` + this.name + "." + scopeName);
	}
	lookupTypeByAst(ast) {
		if (this.typeSymbolsByAst.has(ast)) {
			return this.typeSymbolsByAst.get(ast);
		}
		else if (this.parent) {
			return this.parent.lookupTypeByAst(ast);
		}
		throw new Error(`Type Symbol from AST not found. ${[
			...this.symbols.keys(),
		]}; Scope = ` + this.name);
	}
	resolveNamedType(type) {
		if (type instanceof NamedType) {
			const realType = this.lookupType(type.name);
			realType.name = type.name;
			return realType;
		}
		else {
			return type;
		}
	}
	resolveAppliedGenericTypes(type) {
		if (!(type instanceof AppliedGenericType)) {
			return type;
		}
		const typeCallee = this.resolveNamedType(type.callee);
		if (!(typeCallee instanceof SquareTypeToTypeLambdaType)) {
			throw new Error("Attempted to apply generic parameters to non type lambda. Was " +
				typeCallee.toString());
		}
		const calledArgs = type.parameterTypes;
		const expectedArgs = typeCallee.paramTypes;
		const params = {};
		for (let i = 0; i < calledArgs.length; i++) {
			params[expectedArgs[i].name] = calledArgs[i];
		}
		type.resolved = this.resolveGenericTypes(typeCallee.returnType, params);
		return type.resolved;
	}
	resolveGenericTypes(type, parameters = {}) {
		switch (type.tag) {
			case "NamedType":
				if (type.name && Object.keys(parameters).includes(type.name)) {
					const param = parameters[type.name];
					if (param instanceof Parser_3.Identifier) {
						return new NamedType(param.value);
					}
					else {
						return param;
					}
				}
				else {
					return type;
				}
			case "GenericNamedType":
				if (type.name && Object.keys(parameters).includes(type.name)) {
					const param = parameters[type.name];
					if (param instanceof Parser_3.Identifier) {
						return new NamedType(param.value);
					}
					else {
						return param;
					}
				}
				else {
					return type;
				}
			case "AppliedGenericType":
				if (type instanceof AppliedGenericType) {
					const callee = this.resolveGenericTypes(type.callee, parameters);
					const params = type.parameterTypes.map((p) => this.resolveGenericTypes(p, parameters));
					return new AppliedGenericType(callee, params);
				}
				return type;
			case "RoundValueToValueLambdaType":
				const lambdaType = type;
				const resolvedParams = lambdaType.paramTypes.map((pt) => {
					return this.resolveGenericTypes(pt, parameters);
				});
				const returnType = this.resolveGenericTypes(lambdaType.returnType, parameters);
				const result = new RoundValueToValueLambdaType(resolvedParams, returnType);
				return result;
			case "StructType":
				if (!(type instanceof StructType)) {
					throw new Error("What the hell??");
				}
				const mappedFields = type.fields.map((f) => {
					return new Symbol(f.name, this.resolveGenericTypes(f.typeSymbol, parameters));
				});
				return new StructType(mappedFields);
			case "OptionalType":
				const optionalType = type;
				const newInnerType = this.resolveGenericTypes(optionalType.type, parameters);
				return new OptionalType(newInnerType);
			case "LiteralType":
				return type;
			case "BinaryOpType":
				const bType = type;
				return new BinaryOpType(this.resolveGenericTypes(bType.left, parameters), bType.operator, this.resolveGenericTypes(bType.right, parameters));
			default:
				throw new Error("Can't handle type " +
					type.toString() +
					" when resolving generic named types.");
		}
	}
}
exports.Scope = Scope;
Scope.maxRuns = 1;
Scope.currentKey = 0;
// TYPE INFERENCER
class TypeChecker {
	constructor() {
		this.run = 0;
		this.DEFINED_OPERATIONS = {
			NumberNumberNumber: ["+", "-", "*", "/", "**"],
			NumberNumberBoolean: [">", "<", "<=", ">=", "=="],
			StringAnyString: ["+"],
		};
		this.errors = new TypeErrorList();
		this.outerScope = new Scope("Language");
		this.fileScope = new Scope("File", this.outerScope);
	}
	deduceCommonType(type1, type2, scope) {
		if (type1.isAssignableTo(type2, scope)) {
			return type2;
		}
		return new BinaryOpType(type1, "|", type2);
	}
	infer(node, scope) {
		let inferredType;
		switch (node.tag) {
			case "Literal":
				inferredType = this.inferLiteral(node, scope);
				break;
			case "Identifier":
				inferredType = this.inferIdentifier(node, scope);
				break;
			// case "WhileLoop":
			//    inferredType = this.inferWhileLoop(node as WhileLoop, scope);
			//    break;
			case "Make":
				const type = scope.resolveNamedType(this.translate(node.type, scope));
				if (!(type instanceof StructType)) {
					throw new Error("Was not struct type");
				}
				return new RoundValueToValueLambdaType(type.fields.map((f) => f.typeSymbol), type);
			case "Optional":
				inferredType = NamedType.PRIMITIVE_TYPES.Boolean;
				break;
			case "IfStatement":
				inferredType = this.inferIfStatemnet(node, scope);
				break;
			case "BinaryExpression":
				inferredType = this.inferBinaryExpression(node, scope);
				break;
			case "RoundValueToValueLambda":
				inferredType = this.inferRoundValueToValueLambda(node, scope);
				break;
			case "SquareTypeToValueLambda":
				if (!(node instanceof Parser_1.SquareTypeToValueLambda)) {
					throw new Error("Bad type");
				}
				inferredType = this.inferSquareTypeToValueLambda(node, scope);
				break;
			case "SquareTypeToTypeLambda":
				if (!(node instanceof Parser_2.SquareTypeToTypeLambda)) {
					throw new Error("Bad type");
				}
				inferredType = this.inferSquareTypeToTypeLambda(node, scope);
				break;
			case "RoundTypeToTypeLambda":
				inferredType = new TypeOfTypes();
				break;
			case "Block":
				inferredType = this.inferBlock(node, scope);
				break;
			case "RoundApply":
				inferredType = this.inferRoundApply(node, scope);
				break;
			case "SquareApply":
				inferredType = this.inferSquareApply(node, scope);
				break;
			case "Select":
				inferredType = this.inferSelect(node, scope);
				break;
			case "TypeDef":
				inferredType = this.inferTypeDef(node, scope);
				break;
			case "Change":
				inferredType = AnyType;
				break;
			case "DataDef":
				inferredType = this.inferData(node, scope);
				break;
			case "Assignment":
				inferredType = NamedType.PRIMITIVE_TYPES.Nothing;
				break;
			case "TypeCheck":
				inferredType = NamedType.PRIMITIVE_TYPES.Boolean;
				break;
			case "Cast":
				inferredType = this.translate(node.type, scope);
				scope.resolveNamedType(inferredType);
				break;
			case "WhileLoop":
				inferredType = NamedType.PRIMITIVE_TYPES.Nothing;
				break;
			case "Group":
				inferredType = this.infer(node.value, scope);
				break;
			default:
				throw new Error("Could not infer '" + node.tag + "' - " + node.position);
				inferredType = new Type(); // Unknown type by default
		}
		return inferredType;
	}
	inferData(node, scope) {
		return this.translate(new Parser_3.TypeDef(node.fieldDefs), scope);
	}
	inferIfStatemnet(node, scope) {
		const innerScope = scope.innerScopeOf(node);
		const trueBranchType = this.infer(node.trueBranch, innerScope.innerScopeOf(node.trueBranch));
		let falseBranchType = NamedType.PRIMITIVE_TYPES.Nothing;
		if (node.falseBranch !== undefined) {
			falseBranchType = this.infer(node.falseBranch, innerScope);
		}
		return this.deduceCommonType(trueBranchType, falseBranchType, scope);
	}
	inferTypeDef(node, scope) {
		const fieldSymbols = node.fieldDefs.map((field) => {
			let fieldType;
			if (field.type) {
				fieldType = this.translate(field.type, scope);
			}
			else if (field.defaultValue) {
				fieldType = this.infer(field.defaultValue, scope);
			}
			else {
				fieldType = new Type();
			}
			return new Symbol(field.name, fieldType, field);
		});
		return new StructType(fieldSymbols);
	}
	inferSquareTypeToTypeLambda(node, scope) {
		return new SquareTypeToTypeLambdaType(node.parameterTypes.map((p) => {
			const paramType = this.translate(p, scope);
			if (paramType instanceof GenericNamedType) {
				return paramType;
			}
			else {
				throw new Error("Expected Generic type as parameter of square lambda, but it wasn't,");
			}
		}), this.translate(node.returnType, scope));
	}
	inferSquareTypeToValueLambda(node, scope) {
		const innerScope = scope.innerScopeOf(node);
		return new SquareTypeToValueLambdaType(node.parameterTypes.map((p) => {
			const paramType = this.translate(p, innerScope);
			if (paramType instanceof GenericNamedType) {
				return paramType;
			}
			else {
				throw new Error("Expected Generic type as parameter of square lambda, but it wasn't,");
			}
		}), this.infer(node.block, innerScope));
	}
	buildWhileLoop(node, scope) {
		const innerScope = scope.innerScopeOf(node, true);
		this.build(node.condition, innerScope);
		if (node.condition instanceof Parser_3.BinaryExpression &&
			node.condition.operator === "!=" &&
			node.condition.left instanceof Parser_3.Identifier &&
			node.condition.right instanceof Parser_3.Identifier &&
			node.condition.right.value === "nothing") {
			const leftType = this.resolveFully(this.infer(node.condition.left, scope), scope);
			if (leftType instanceof OptionalType) {
				innerScope.declare(node.condition.left.value, new Symbol(node.condition.left.value, leftType.type));
			}
		}
		if (node.start) {
			this.build(node.start, innerScope);
		}
		if (node.eachLoop) {
			this.build(node.eachLoop, innerScope);
		}
		this.build(node.action, innerScope);
	}
	inferSquareApply(node, scope) {
		// const calleeType = this.infer(node.callee, scope);
		let calleeType;
		try {
			calleeType = this.infer(node.callee, scope);
		}
		catch (e) {
			calleeType = NamedType.PRIMITIVE_TYPES.Type;
		}
		// For future, check if calleeType is Type, only then go into Generic[Type] building
		if (calleeType.toString() == "Type") {
			const calleeAsType = scope.resolveNamedType(this.translate(node.callee, scope));
			if (calleeAsType instanceof SquareTypeToTypeLambdaType) {
				const actualParams = node.typeArgs.map((t) => this.translate(t, scope));
				const expectedParams = calleeAsType.paramTypes;
				let params = {};
				expectedParams.forEach((p, i) => {
					if (p.name) {
						params[p.name] = actualParams[i];
					}
				});
				return scope.resolveGenericTypes(calleeAsType.returnType, params);
			}
		}
		else if (calleeType instanceof SquareTypeToValueLambdaType) {
			const calledArgs = node.typeArgs.map((t) => this.translate(t, scope));
			const expectedArgs = calleeType.paramTypes;
			const params = {};
			for (let i = 0; i < calledArgs.length; i++) {
				params[expectedArgs[i].name] = calledArgs[i];
			}
			return scope.resolveGenericTypes(calleeType.returnType, params);
		}
		throw new Error(`Not calling a function. Object ${node.callee.tag} is of type ${calleeType.toString()}`);
	}
	isCapitalized(str) {
		return str.charAt(0) === str.charAt(0).toUpperCase();
	}
	// func = [T, X] -> (thing: T, other: X) -> thing
	// func(12, "Something")
	// = Number
	inferRoundApply(node, scope) {
		const calleeType = scope.resolveNamedType(this.infer(node.callee, scope));
		if (node.callee instanceof Parser_3.Identifier &&
			this.isCapitalized(node.callee.value)) {
			const type = scope.resolveNamedType(this.translate(node.callee, scope));
			if (type instanceof StructType) {
				return type;
			}
			else if (type instanceof MarkerType) {
				return type;
			}
			else {
				throw new Error("Cannot call constructor function for non struct-type. Was " +
					type.toString());
			}
		}
		else if (calleeType instanceof RoundValueToValueLambdaType) {
			return calleeType.returnType;
		}
		else if (calleeType instanceof SquareTypeToValueLambdaType &&
			calleeType.returnType instanceof RoundValueToValueLambdaType) {
			const mappings = {};
			this.fillInSquareApplyParamsOnRoundApply(calleeType.returnType, calleeType, node, scope, mappings);
			const inferredType = scope.resolveGenericTypes(calleeType.returnType.returnType, mappings);
			node.calledInsteadOfSquare = true;
			return inferredType;
		}
		throw new Error(`Not calling a function. Object ${node.callee.tag} is of type ${calleeType.toString()}`);
	}
	// Questionable
	inferSelect(node, scope) {
		let ownerType = this.infer(node.owner, scope);
		if (node.ammortized && ownerType instanceof OptionalType) {
			ownerType = ownerType.type;
		}
		if (ownerType instanceof AppliedGenericType &&
			ownerType.resolved !== undefined) {
			ownerType = ownerType.resolved;
		}
		if (ownerType instanceof NamedType) {
			ownerType = scope.lookupType(ownerType.name);
		}
		if (ownerType instanceof AppliedGenericType) {
			ownerType = this.resolvedGeneric(ownerType, scope);
		}
		let fields = this.getAllKnownFields(ownerType, scope);
		fields = fields.filter((f) => f.name === node.field);
		if (!fields[0] || !fields[0].typeSymbol) {
			throw new Error(`Field '${node.field}' could not be found on '` +
				ownerType.toString() +
				"'");
		}
		let result = fields[0].typeSymbol;
		if (node.ammortized) {
			result = new OptionalType(result);
		}
		return result;
	}
	getAllKnownFields(type, scope) {
		if (type instanceof NamedType) {
			return this.getAllKnownFields(scope.resolveNamedType(type), scope);
		}
		if (type instanceof StructType) {
			return type.fields;
		}
		else if (type instanceof BinaryOpType && type.operator == "&") {
			return [
				...this.getAllKnownFields(type.left, scope),
				...this.getAllKnownFields(type.right, scope),
			];
		}
		else if (type instanceof BinaryOpType && type.operator == "|") {
			const leftFields = this.getAllKnownFields(type.left, scope);
			const rightFields = this.getAllKnownFields(type.right, scope);
			const commonFields = [];
			for (const leftField of leftFields) {
				const rightField = rightFields.find((f) => f.name === leftField.name);
				if (rightField === undefined)
					continue;
				const leftType = scope.resolveNamedType(leftField.typeSymbol);
				const rightType = scope.resolveNamedType(rightField.typeSymbol);
				if (rightType.isAssignableTo(leftType, scope)) {
					commonFields.push(leftField);
				}
				else if (leftType.isAssignableTo(rightType, scope)) {
					commonFields.push(rightField);
				}
			}
			return commonFields;
		}
		else if (type instanceof BinaryOpType && type.operator === "&") {
			const leftFields = this.getAllKnownFields(type.left, scope);
			const rightFields = this.getAllKnownFields(type.right, scope);
			return [...leftFields, ...rightFields];
		}
		else if (type instanceof OptionalType) {
			return [];
		}
		else if (type instanceof AppliedGenericType) {
			return this.getAllKnownFields(scope.resolveAppliedGenericTypes(type), scope);
		}
		else {
			throw new Error("Could not deduce fields of type " + type.toString());
		}
		return [];
	}
	inferBlock(node, scope) {
		// TO DO: change to find returns recursively
		let innerScope = scope.innerScopeOf(node);
		if (node.statements.length === 0) {
			return new Type();
		}
		return this.infer(node.statements[node.statements.length - 1], innerScope);
	}
	inferLiteral(node, scope) {
		// Handle different literal types (assuming 'Number' is one type)
		if (node.type === "Any" && node.value === "") {
			return AnyType;
		}
		return new LiteralType(String(node.value), scope.lookupType(node.type));
	}
	inferIdentifier(node, scope) {
		const symbol = scope.lookup(node.value); // ?? scope.lookupType(node.value);
		if (!symbol) {
			if (node.value.charAt(0) === node.value.charAt(0).toUpperCase()) {
				return NamedType.PRIMITIVE_TYPES.Type;
			}
			throw new Error(`Undefined identifier: ${node.value}`);
		}
		return symbol.typeSymbol;
	}
	inferBinaryExpression(node, scope) {
		const leftType = this.infer(node.left, scope);
		const rightType = this.infer(node.right, scope);
		// Here, you would define the logic to determine the resulting type based on the operator
		// For example, if the operator is '+', you might expect both operands to be of type 'Int'
		const Number = scope.lookupType("Number");
		const String = scope.lookupType("String");
		const Boolean = scope.lookupType("Boolean");
		if (leftType.isAssignableTo(String, scope)) {
			const entry = this.DEFINED_OPERATIONS.StringAnyString;
			if (entry.includes(node.operator)) {
				return String;
			}
		}
		if (node.operator === "?:") {
			const realLeftType = leftType instanceof OptionalType ? leftType.type : leftType;
			return this.deduceCommonType(leftType, rightType, scope);
		}
		if ((leftType.isAssignableTo(Number, scope) &&
			rightType.isAssignableTo(Number, scope),
			scope)) {
			const entry = this.DEFINED_OPERATIONS.NumberNumberNumber;
			if (entry.includes(node.operator)) {
				return Number;
			}
		}
		if (leftType.isAssignableTo(Number, scope) &&
			rightType.isAssignableTo(Number, scope)) {
			const entry = this.DEFINED_OPERATIONS.NumberNumberBoolean;
			if (entry.includes(node.operator)) {
				return Boolean;
			}
		}
		if (node.operator === "&") {
			return new BinaryOpType(leftType, "&", rightType);
		}
		if (node.operator === "|") {
			return new BinaryOpType(leftType, "|", rightType);
		}
		// Return a BinaryOpType if types are not directly inferrable
		return new BinaryOpType(leftType, node.operator, rightType);
	}
	inferRoundTypeToTypeLambda(node, scope) {
		const paramScope = scope.innerScopeOf(node);
		node.parameterTypes.forEach((p) => {
			if (p instanceof Parser_3.Assignment && p.lhs instanceof Parser_3.Identifier) {
				paramScope.declareType(p.lhs.value, new GenericNamedType(p.lhs.value, p.value ? this.infer(p.value, scope) : undefined));
			}
		});
		const type = new TypeRoundValueToValueLambda(node.parameterTypes.map((p) => {
			if (p instanceof Parser_3.Assignment && p.lhs instanceof Parser_3.Identifier) {
				return this.translate(p.lhs, paramScope);
			}
			else {
				throw new Error("Params weren't assignment types");
			}
		}), this.infer(node.returnType, paramScope));
		return type;
	}
	// func = [T, X] -> (thing: T, other: X) -> 2
	// func(12, "Hello")
	// T: Number, X: String
	fillInSquareApplyParamsOnRoundApply(roundLambda, squareLambda, roundApply, scope, mappings) {
		const expectedValueParams = roundLambda.paramTypes;
		const expectedTypeParams = squareLambda.paramTypes.map((p) => {
			const pType = p;
			if (pType instanceof GenericNamedType) {
				return pType;
			}
			else {
				throw new Error("Expected generic types for SquareTypeToTypeLambda");
			}
		});
		const suppliedParams = roundApply.args;
		for (let i = 0; i < suppliedParams.length; i++) {
			const typeofSuppliedParam = this.infer(suppliedParams[i], scope);
			const typeofExpectedParam = expectedValueParams[i];
			if (typeofExpectedParam instanceof NamedType ||
				typeofExpectedParam instanceof GenericNamedType) {
				const typeNameToFind = typeofExpectedParam.name;
				const indexOfTypeInSquareLambda = expectedTypeParams.findIndex((v) => v.name === typeNameToFind);
				mappings[typeNameToFind] = typeofSuppliedParam;
			}
		}
	}
	// (i: Number) -> i + 2
	inferRoundValueToValueLambda(node, scope) {
		const innerScope = scope.innerScopeOf(node);
		innerScope.run = this.run;
		let paramTypes = [];
		// Check for Varargs expected type
		if (node.params[0] &&
			node.params[0] instanceof Parser_3.Assignment &&
			node.params[0].type &&
			node.params[0].type instanceof Parser_3.UnaryOperator &&
			node.params[0].type.operator === "...") {
			const param = node.params[0];
			const paramType = new AppliedGenericType(innerScope.lookupType("Array"), [
				this.translate(node.params[0].type.expression, innerScope),
			]);
			// paramType.resolved = innerScope.lookup("Array").returnType;
			paramTypes = [paramType];
			if (param instanceof Parser_3.Assignment && param.lhs instanceof Parser_3.Identifier) {
				if (!innerScope.hasSymbol(param.lhs.value)) {
					innerScope.declare(param.lhs.value, new Symbol(param.lhs.value, paramType, param));
				}
			}
		}
		else {
			paramTypes = node.params.map((param) => {
				let type;
				if (param instanceof Parser_3.Assignment) {
					if (param.type) {
						type = this.translate(param.type, innerScope);
					}
					else if (param.value) {
						type = this.infer(param.value, innerScope);
					}
				}
				else if (node.isTypeLambda &&
					param instanceof Parser_3.Assignment &&
					param.lhs instanceof Parser_3.Identifier) {
					type = new NamedType(param.lhs.value);
				}
				if (!type) {
					throw new Error("Cannot tell type. Maybe you used : instead of :: " +
						param.tag);
					type = new Type();
				}
				// if (
				//    param instanceof Assignment &&
				//    param.lhs instanceof Identifier
				// ) {
				//    innerScope.declare(
				//       param.lhs.value,
				//       new Symbol(param.lhs.value, type, param)
				//    );
				// }
				return type;
				// throw new Error(`Missing type annotation or default value for parameter: ${param.name}`);
			});
		}
		if (node.isTypeLambda &&
			node instanceof Parser_3.RoundValueToValueLambda &&
			node.block instanceof Parser_3.Block &&
			node.block.statements[0]) {
			node.params.forEach((p) => {
				if (p instanceof Parser_3.Assignment && p.lhs instanceof Parser_3.Identifier) {
					innerScope.declareType(p.lhs.value, new NamedType(p.lhs.value));
				}
			});
			const returnType = this.translate(node.block.statements[0], innerScope);
			const lambdaType = new RoundValueToValueLambdaType(paramTypes, returnType, true);
			return lambdaType;
		}
		else {
			const returnType = this.infer(node.block, innerScope);
			if (node.explicitType) {
				const explicitType = this.translate(node.explicitType, innerScope);
				if (!returnType.isAssignableTo(explicitType, scope)) {
					this.errors.add(`Return type of lambda`, explicitType, returnType, node.position, new Error());
				}
			}
			const lambdaType = new RoundValueToValueLambdaType(paramTypes, returnType);
			return lambdaType;
		}
	}
	resolvedGeneric(type, scope) {
		let callee = type.callee;
		if (callee instanceof Parser_3.Identifier) {
			callee = scope.lookupType(callee.value);
		}
		if (callee instanceof NamedType) {
			callee = scope.lookupType(callee.name);
		}
		if (callee && callee instanceof RoundValueToValueLambdaType) {
			const actualParams = type.parameterTypes;
			const expectedParams = callee.paramTypes;
			let params = {};
			expectedParams.forEach((p, i) => {
				if (p.name) {
					params[p.name] = actualParams[i];
				}
			});
			const resolved = scope.resolveGenericTypes(callee.returnType, params);
			type.resolved = resolved;
			return type.resolved;
		}
		if (callee && callee instanceof SquareTypeToTypeLambdaType) {
			const actualParams = type.parameterTypes;
			const expectedParams = callee.paramTypes;
			let params = {};
			expectedParams.forEach((p, i) => {
				if (p.name) {
					params[p.name] = actualParams[i];
				}
			});
			const resolved = scope.resolveGenericTypes(callee.returnType, params);
			type.resolved = resolved;
			return type.resolved;
		}
		throw new Error("Could not resolve generic type " + type.toString());
	}
	translate(node, scope) {
		var _a;
		switch (node.tag) {
			case "Identifier":
				// return scope.lookupType((node as Identifier).value);
				return new NamedType(node.value);
			case "Literal":
				const literal = node;
				return new LiteralType(String(literal.value), NamedType.PRIMITIVE_TYPES[literal.type]);
			case "Assignment":
				if (node instanceof Parser_3.Assignment &&
					!node.isDeclaration &&
					node.symbol) {
					return (_a = node.symbol) === null || _a === void 0 ? void 0 : _a.typeSymbol;
				}
				if (node instanceof Parser_3.Assignment &&
					node.lhs instanceof Parser_3.Identifier &&
					!node.value) {
					const name = node.lhs.value;
					const extendedType = node.type
						? this.translate(node.type, scope)
						: undefined;
					return new GenericNamedType(name, extendedType);
				}
				console.log(node);
				return new Type();
			case "UnaryOperator":
				if (!(node instanceof Parser_3.UnaryOperator)) {
					throw Error("Not right type");
				}
				if (node.operator === "...") {
					return new VarargsType(this.translate(node.expression, scope));
				}
				else {
					throw new Error("Unexpected unary operator");
				}
			case "GenericNamedType":
				if (!(node instanceof GenericNamedType)) {
					throw Error("Not right type");
				}
				return node;
			case "RoundTypeToTypeLambda":
				if (!(node instanceof Parser_3.RoundTypeToTypeLambda)) {
					throw Error("Not right type");
				}
				return new RoundValueToValueLambdaType(node.parameterTypes.map((p) => {
					let translated = this.translate(p, scope);
					if (translated instanceof GenericNamedType) {
						return new NamedType(translated.name);
					}
					return translated;
				}), this.translate(node.returnType, scope));
			case "RoundValueToValueLambda":
				// return new RoundValueToValueLambdaType(node.params.map(p => this.translate(p, scope/)))
				if (!(node instanceof Parser_3.RoundValueToValueLambda)) {
					throw new Error("Weird type");
				}
				const innerScope = scope.innerScopeOf(node, true);
				innerScope.run = this.run;
				// innerScope.declareType("T", new NamedType("T"));
				const type = new RoundValueToValueLambdaType(node.params.map((p) => this.translate(p, innerScope)), this.translate(node.block.statements[0], innerScope), node.isTypeLambda);
				if (node.params.length > 0 &&
					node.params[0] instanceof Parser_3.Assignment &&
					node.params[0].lhs instanceof Parser_3.Identifier &&
					node.params[0].lhs.value === "this") {
					type.isFirstParamThis = true;
				}
				return type;
			case "SquareTypeToTypeLambda":
				// return new RoundValueToValueLambdaType(node.params.map(p => this.translate(p, scope/)))
				if (!(node instanceof Parser_2.SquareTypeToTypeLambda)) {
					throw new Error("Weird type");
				}
				const innerScope2 = scope.innerScopeOf(node, true);
				innerScope2.run = this.run;
				innerScope2.declareType("T", new NamedType("T"));
				const genericParameters = node.parameterTypes.map((p) => {
					const param = this.translate(p, innerScope2);
					if (param instanceof GenericNamedType) {
						return param;
					}
					else {
						throw new Error("Expected Generic parameter, but it wasn't");
					}
				});
				return new SquareTypeToTypeLambdaType(genericParameters, this.translate(node.returnType, innerScope2));
			case "SquareApply":
				if (!(node instanceof Parser_1.SquareApply)) {
					return new Type();
				}
				return new AppliedGenericType(this.translate(node.callee, scope), node.typeArgs.map((arg) => this.translate(arg, scope)));
			case "TypeDef":
				if (!(node instanceof Parser_3.TypeDef)) {
					return new Type();
				}
				if (node.fieldDefs.length === 0) {
					return new MarkerType();
				}
				const fieldTypes = node.fieldDefs.map((f) => {
					let fieldType;
					if (f.type) {
						fieldType = this.translate(f.type, scope);
					}
					else if (f.defaultValue) {
						fieldType = this.infer(f.defaultValue, scope);
					}
					else {
						fieldType = new Type();
					}
					return new Symbol(f.name, fieldType, f);
				});
				return new StructType(fieldTypes);
			case "RoundApply":
				if (!(node instanceof Parser_3.RoundApply)) {
					return new Type();
				}
				throw new Error("Was type apply, but not isTypeRoundValueToValueLambda. ");
			case "BinaryExpression":
				if (!(node instanceof Parser_3.BinaryExpression)) {
					return new Type();
				}
				return new BinaryOpType(this.translate(node.left, scope), node.operator, this.translate(node.right, scope));
			case "Optional":
				if (!(node instanceof Parser_3.Optional)) {
					return new Type();
				}
				return new OptionalType(this.translate(node.expression, scope));
			case "Group":
				if (node instanceof Parser_2.Group) {
					return this.translate(node.value, scope);
				}
			default:
				throw new Error("Could not translate " + node.tag);
		}
	}
	typeCheck(node, scope) {
		if (node instanceof Parser_3.Block) {
			const innerScope = scope.innerScopeOf(node);
			node.statements.forEach((c) => this.typeCheck.bind(this)(c, innerScope));
		}
		else if (node instanceof Parser_3.Assignment && node.value) {
			this.typeCheck(node.value, scope);
		}
		else if (node instanceof Parser_3.RoundApply) {
			this.typeCheckApply(node, scope);
		}
		else if (node instanceof Parser_3.RoundValueToValueLambda) {
			this.typeCheckRoundValueToValueLambda(node, scope);
		}
		else if (node instanceof Parser_1.SquareTypeToValueLambda) {
			this.typeCheckSquareTypeToValueLambda(node, scope);
		}
		else if (node instanceof Parser_3.IfStatement) {
			const innerScope = scope.innerScopeOf(node);
			const trueScope = innerScope.innerScopeOf(node.trueBranch);
			this.typeCheck(node.condition, innerScope);
			this.typeCheck(node.trueBranch, trueScope);
			if (node.falseBranch) {
				this.typeCheck(node.falseBranch, innerScope);
			}
		}
	}
	typeCheckRoundValueToValueLambda(node, scope) {
		const innerScope = scope.innerScopeOf(node);
		node.params.forEach((p) => this.typeCheck(p, innerScope));
		this.typeCheck(node.block, innerScope);
	}
	typeCheckSquareTypeToValueLambda(node, scope) {
		const innerScope = scope.innerScopeOf(node);
		// node.pforEach((p) => this.typeCheck(p, innerScope));
		this.typeCheck(node.block, innerScope);
	}
	// typeCheckSquareApply(apply: SquareApply, scope: Scope) {
	// 	apply.
	// }
	typeCheckApply(apply, scope) {
		scope = scope.innerScopeOf(apply);
		let typeSymbol = this.infer(apply.callee, scope);
		if (apply.callee instanceof Parser_3.Identifier &&
			this.isCapitalized(apply.callee.value)) {
			const type = scope.resolveNamedType(this.translate(apply.callee, scope));
			if (type instanceof StructType) {
				typeSymbol = new RoundValueToValueLambdaType(type.fields.map((f) => f.typeSymbol), type);
			}
			else if (type instanceof MarkerType) {
				typeSymbol = new RoundValueToValueLambdaType([], type);
			}
			else {
				throw new Error("Cannot call constructor function for non struct-type");
			}
		}
		apply.args.forEach((p) => {
			this.typeCheck(p, scope);
		});
		if (typeSymbol instanceof RoundValueToValueLambdaType) {
			const params = typeSymbol.paramTypes;
			if (params[0] &&
				params[0] instanceof AppliedGenericType &&
				params[0].callee.name === "Array") {
				const expectedType = scope.resolveNamedType(params[0].parameterTypes[0]);
				const firstArgType = () => scope.resolveAppliedGenericTypes(this.infer(apply.args[0], scope));
				if (apply.args.length > 0 &&
					firstArgType().isAssignableTo(scope.resolveAppliedGenericTypes(params[0]), scope)) {
					// It's ok, array expected, array gotten
				}
				else {
					apply.args.forEach((p, i) => {
						const gottenType = this.infer(p, scope);
						if (!gottenType.isAssignableTo(expectedType, scope)) {
							this.errors.add(`Parameter ${i} of ${apply.callee instanceof Parser_3.Identifier
								? apply.callee.value
								: "Anonymous function"}`, expectedType, gottenType, apply.position, new Error());
						}
					});
					apply.takesVarargs = true;
				}
			}
			else {
				let hasThisParamIncrement = typeSymbol.isFirstParamThis ? 1 : 0;
				apply.args.forEach((p, i) => {
					if (!(typeSymbol instanceof RoundValueToValueLambdaType)) {
						return;
					}
					const type = scope.resolveNamedType(this.infer(p, scope));
					const expectedType = scope.resolveNamedType(typeSymbol.paramTypes[i + hasThisParamIncrement]);
					if (!type.isAssignableTo(expectedType, scope)) {
						this.errors.add(`Parameter ${i} of ${apply.callee instanceof Parser_3.Identifier
							? apply.callee.value
							: "Anonymous function"}`, typeSymbol.paramTypes[i], type, apply.position, new Error());
					}
				});
			}
			// }
		}
	}
	// Build symbol table from AST
	static fromAST(ast, existingFileScopes = []) {
		const typeChecker = new TypeChecker();
		existingFileScopes.forEach((s) => {
			typeChecker.fileScope.absorbAllFrom(s);
		});
		const languageScope = typeChecker.outerScope;
		for (const t in NamedType.PRIMITIVE_TYPES) {
			languageScope.typeSymbols.set(t, NamedType.PRIMITIVE_TYPES[t]);
		}
		languageScope.declare("print", new Symbol("print", new RoundValueToValueLambdaType([NamedType.PRIMITIVE_TYPES.Any], NamedType.PRIMITIVE_TYPES.Nothing), new Parser_3.RoundValueToValueLambda([], new Parser_3.Block([]))));
		languageScope.declare("debug", new Symbol("debug", new RoundValueToValueLambdaType([NamedType.PRIMITIVE_TYPES.Any], NamedType.PRIMITIVE_TYPES.Nothing), new Parser_3.RoundValueToValueLambda([], new Parser_3.Block([]))));
		const innerArrayScope = new Scope("inner-array", languageScope);
		innerArrayScope.declareType("T", new GenericNamedType("T"));
		const arrayStruct = new StructType([
			new Symbol("length", new RoundValueToValueLambdaType([], languageScope.lookupType("Number"))),
			new Symbol("at", new RoundValueToValueLambdaType([new NamedType("Number")], new GenericNamedType("T"))),
		]);
		languageScope.declareType("Array", new SquareTypeToTypeLambdaType([new GenericNamedType("T")], arrayStruct));
		languageScope.declare("Array", new Symbol("Array", new SquareTypeToValueLambdaType([new GenericNamedType("T")], new RoundValueToValueLambdaType([
			new AppliedGenericType(new NamedType("Array"), [
				new GenericNamedType("T"),
			]),
		], new AppliedGenericType(new NamedType("Array"), [
			new GenericNamedType("T"),
		]), true))), true);
		languageScope.declare("nothing", new Symbol("nothing", NamedType.PRIMITIVE_TYPES.Nothing, new Parser_3.Identifier("nothing")));
		const fileScope = typeChecker.fileScope;
		typeChecker.outerScope = fileScope;
		fileScope.run = 0;
		typeChecker.build(ast, fileScope);
		typeChecker.run = 1;
		typeChecker.outerScope.setRun(1);
		typeChecker.fileScope.setRun(1); // Recursive
		typeChecker.build(ast, fileScope);
		return typeChecker;
	}
	resolveFully(type, scope) {
		if (type instanceof NamedType) {
			if (type.isPrimitive()) {
				return type;
			}
			else {
				return this.resolveFully(scope.resolveNamedType(type), scope);
			}
		}
		else if (type instanceof AppliedGenericType) {
			return this.resolveFully(scope.resolveAppliedGenericTypes(type), scope);
		}
		else {
			return type;
		}
	}
	// Walk through the AST and infer types for definitions
	build(node, scope) {
		if (node instanceof Parser_3.Assignment) {
			this.buildSymbolForAssignment(node, scope);
		}
		else if (node instanceof Parser_3.Block) {
			const innerBlockScope = scope.innerScopeOf(node, true);
			node.statements.forEach((statement) => this.build(statement, innerBlockScope));
		}
		else if (node instanceof Parser_3.RoundApply) {
			const innerBlockScope = scope.innerScopeOf(node, true);
			node.args.forEach((statement) => this.build(statement, innerBlockScope));
			this.build(node.callee, scope);
		}
		else if (node instanceof Parser_3.RoundValueToValueLambda) {
			this.buildRoundValueToValueLambda(node, scope);
		}
		else if (node instanceof Parser_1.SquareTypeToValueLambda) {
			this.buildSquareTypeToValueLambda(node, scope);
		}
		else if (node instanceof Parser_3.WhileLoop) {
			this.buildWhileLoop(node, scope);
		}
		else if (node instanceof Parser_3.IfStatement) {
			const innerScope = scope.innerScopeOf(node, true);
			const trueScope = innerScope.innerScopeOf(node.trueBranch, true);
			if (node.condition instanceof Parser_3.BinaryExpression &&
				node.condition.operator === "!=" &&
				node.condition.left instanceof Parser_3.Identifier &&
				node.condition.right instanceof Parser_3.Identifier &&
				node.condition.right.value === "nothing") {
				const leftType = this.resolveFully(this.infer(node.condition.left, trueScope), trueScope);
				if (leftType instanceof OptionalType) {
					trueScope.declare(node.condition.left.value, new Symbol(node.condition.left.value, leftType.type));
				}
			}
			if (node.condition instanceof Parser_1.TypeCheck &&
				node.condition.term instanceof Parser_3.Identifier) {
				const presumedType = this.translate(node.condition.type, trueScope);
				trueScope.declare(node.condition.term.value, new Symbol(node.condition.term.value, presumedType, node.condition.term));
			}
			this.build(node.condition, innerScope);
			this.build(node.trueBranch, trueScope);
			if (node.falseBranch) {
				this.build(node.falseBranch, innerScope);
			}
		}
	}
	buildRoundValueToValueLambda(node, scope) {
		const innerScope = scope.innerScopeOf(node, true);
		node.params.forEach((p) => {
			if (p instanceof Parser_3.Assignment && p.lhs instanceof Parser_3.Identifier) {
				const hasSymbol = innerScope.hasSymbol(p.lhs.value);
				if (hasSymbol) {
					return;
				}
				this.build(p, innerScope);
			}
		});
		this.build(node.block, innerScope);
	}
	buildSquareTypeToValueLambda(node, scope) {
		const innerScope = scope.innerScopeOf(node, true);
		node.parameterTypes.forEach((p) => {
			const type = this.translate(p, innerScope);
			if (type instanceof GenericNamedType) {
				if (!innerScope.hasTypeSymbol(type.name)) {
					innerScope.declareType(type.name, type);
				}
			}
		});
		this.build(node.block, innerScope);
	}
	buildSymbolForAssignment(node, scope) {
		// If it's not a declaration
		if (this.run == 0 &&
			node.lhs instanceof Parser_3.Identifier &&
			scope.hasSymbol(node.lhs.value)) {
			node.isDeclaration = false;
			return;
		}
		const lhs = node.lhs;
		// Means it's a parameter
		if (!node.value) {
			if (node.type && node.lhs instanceof Parser_3.Identifier) {
				const symbol = new Symbol(node.lhs.value, this.translate(node.type, scope), node);
				scope.declare(node.lhs.value, symbol);
			}
			return;
		}
		this.build(node.value, scope);
		let rhsType = this.infer(node.value, scope);
		if (!node.type) {
			if (rhsType instanceof LiteralType) {
				rhsType = rhsType.type;
			}
			scope.mapAst(node, rhsType ? rhsType : new Type());
		}
		else {
			let nodeType = scope.resolveNamedType(this.translate(node.type, scope));
			if (nodeType instanceof AppliedGenericType) {
				scope.resolveAppliedGenericTypes(nodeType);
			}
			if (!rhsType.isAssignableTo(scope.resolveNamedType(nodeType), scope)) {
				this.errors.add(`Assignment of ${node.lhs instanceof Parser_3.Identifier ? node.lhs.value : "term"}`, nodeType, rhsType, node.position, new Error());
			}
			else {
				rhsType = scope.resolveNamedType(nodeType);
			}
		}
		if (node.lhs instanceof Parser_3.Identifier &&
			(node.isTypeLevel || node.lhs.isTypeLevel) &&
			node.lhs.value) {
			if (node.value instanceof Parser_3.RoundTypeToTypeLambda) {
				scope.declareType(node.lhs.value, this.translate(node.value, scope));
			}
			else {
				const symbolToDeclare = this.translate(node.value, scope);
				if (!scope.hasTypeSymbol(node.lhs.value)) {
					scope.declareType(node.lhs.value, symbolToDeclare);
				}
			}
			return;
		}
		if (!(lhs instanceof Parser_3.Identifier)) {
			throw new Error("LHS was not Identifier");
		}
		let symbol = new Symbol(lhs.value, rhsType, node);
		if (node.isDeclaration || node.isParameter) {
			symbol = symbol.located(node.position, node.position);
			if (!scope.hasSymbol(lhs.value)) {
				scope.declare(lhs.value, symbol);
				node.symbol = symbol;
			}
		}
	}
}
exports.TypeChecker = TypeChecker;
class TypeErrorList {
	constructor() {
		this.errors = [];
	}
	add(hint, expectedType, insertedType, position, errorForStack) {
		this.errors.push({
			hint,
			expectedType,
			insertedType,
			position,
			errorForStack,
		});
	}
	throwAll(showStack = true) {
		if (this.errors.length > 0) {
			const message = "There are type errors:\n" +
				this.errors
					.map((e) => {
						var _a, _b;
						return `- ${e.hint}; Expected '${e.expectedType.toString()}', but got '${e.insertedType}' at line ${(_a = e.position) === null || _a === void 0 ? void 0 : _a.start.line}, column ${(_b = e.position) === null || _b === void 0 ? void 0 : _b.start.column}`;
					})
					.join("\n");
			console.error(message);
			process.exit(-1);
		}
	}
}
exports.TypeErrorList = TypeErrorList;
