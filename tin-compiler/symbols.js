class Type {
	constructor(tag) {
		this.tag = tag
		if (tag === undefined) {
			throw new Error("Found unknown type")
		}
	}

	named(name) {
		this.name = name;
		return this;
	}

	isAssignableTo(other) {
		if (!other) {
			throw new Error("Found undefined type")
		}
		return this.extends(other) || other.isExtendedBy(this);
	}

	extends(other) {
		return false; // By default, types are not assignable to each other unless overridden
	}

	isExtendedBy(other) {
		return false;
	}

	equals(other) {
		return this.toString() === other.toString(); // Use string representation for equality check
	}

	located(start) {
		this.location = start;
		return this;
	}

	toString() {
		return `Unknown(${this.tag}, ${this.type})`; // Base class
	}
}

class AnyTypeClass extends Type {
	constructor(name) {
		super(name);
	}

	extends(other) {
		// Named types are assignable if they are equal (same name)
		return other instanceof AnyTypeClass;
	} Number

	isExtendedBy() {
		return true;
	}

	toString() {
		return "Any";
	}
}

const AnyType = new AnyTypeClass("Any");


class NamedType extends Type {
	static PRIMITIVE_TYPES = {
		Int: new NamedType("Int"),
		Number: new NamedType("Number"),
		String: new NamedType("String"),
		Boolean: new NamedType("Boolean"),
		Void: new NamedType("Void"),
		Type: new NamedType("Type"),
		Any: AnyType
	}

	constructor(name) {
		super("NamedType");
		this.name = name;
	}

	extends(other) {
		// Named types are assignable if they are equal (same name)
		return other instanceof NamedType && this.name === other.name;
	}

	isExtendedBy(other) {
		return other instanceof NamedType && this.name === other.name;
	}

	toString() {
		return this.name;
	}
}

class VarargsType extends Type {
	constructor(type) {
		super("VarargsType");
		this.type = type;
	}

	toString() {
		return "..." + this.type.toString()
	}
}

class GenericNamedType extends Type {
	constructor(name, extendedType, superType) {
		super("GenericNamedType");
		this.name = name;
		this.extendedType = extendedType;
		this.superType = superType;
	}

	extends(other) {
		// Named types are assignable if they are equal (same name)
		return other instanceof NamedType && this.name === other.name;
	}

	isExtendedBy(other) {
		return other instanceof NamedType && this.name === other.name;
	}

	toString() {
		return this.name;
	}
}

class OptionalType extends Type {
	constructor(type) {
		super();
		this.tag = "OptionalType";
		this.type = type;
	}

	extends(other) {
		// Named types are assignable if they are equal (same name)
		return this.type.extends(other);
	}

	isExtendedBy(other) {
		return other.isAssignableTo(this.type);
	}

	toString() {
		return this.type.toString() + "?";
	}
}

class LambdaType extends Type {
	constructor(paramTypes, returnType, isGeneric) {
		super("LambdaType");
		paramTypes.forEach(p => {
			if (p.tag === undefined) {
				throw new Error("Empty type")
			}
		})
		this.paramTypes = paramTypes;
		this.returnType = returnType;
		this.isGeneric = isGeneric;
		this.isForwardReferenceable = true;
	}

	extends(other) {
		if (!(other instanceof LambdaType)) return false;

		// Check if parameter types are contravariant
		const paramCheck = this.paramTypes.length === other.paramTypes.length &&
			this.paramTypes.every((paramType, index) => other.paramTypes[index].isAssignableTo(paramType));

		// Return type must be covariant
		const returnCheck = this.returnType.isAssignableTo(other.returnType);

		return paramCheck && returnCheck;
	}

	toString() {
		if (this.name) {
			return this.name;
		}
		const paramsStr = this.paramTypes.map(t => t.toString()).join(', ');
		return `${this.isGeneric ? '[' : '('}${paramsStr}${this.isGeneric ? ']' : ')'} => ${this.returnType ? this.returnType.toString() : "undefined"}`;
	}
}

class TypeLambda extends Type {
	constructor(paramTypes, returnType) {
		super("TypeLambda");
		this.paramTypes = paramTypes;
		this.returnType = returnType;
	}

	toString() {
		const paramsStr = this.paramTypes.map(t => t.toString()).join(', ');
		return `[${paramsStr}] => ${this.returnType ? this.returnType.toString() : "undefined"}`;
	}
}

class AppliedGenericType extends Type {
	constructor(callee, parameterTypes) {
		super("AppliedGenericType");
		this.callee = callee;
		this.parameterTypes = parameterTypes;
	}

	extends(other) {
		return this.resolved.extends(other);
	}

	isExtendedBy(other) {
		// return true;
		return this.resolved.isExtendedBy(other)
	}

	toString() {
		const paramsStr = this.parameterTypes.map(t => t.toString()).join(', ');
		return `${this.callee.name ?? `{${this.callee.toString()}}`}[${paramsStr}]`;
	}
}

class BinaryOpType extends Type {
	constructor(left, operator, right) {
		super();
		this.tag = "BinaryOpType";
		this.left = left;
		this.operator = operator;
		this.right = right;
	}

	extends(other) {
		if (this.operator === '&') {
			return other.isAssignableTo(this.left) && other.isAssignableTo(this.right);
		}
		return false;
	}

	isExtendedBy(other) {
		if (this.operator === "|") {
			return other.isAssignableTo(this.left) || other.isAssignableTo(this.right);
		}
		return false;
	}

	toString() {
		return `${this.left.toString()} ${this.operator} ${this.right.toString()}`;
	}
}

class TypeDefType extends Type {
	constructor(fields) {
		super("TypeDefType");
	}

	extends(other) {
		return false;
	}

	toString() {
		return `Type`
	}
}

class StructType extends Type {
	constructor(fields) {
		super("StructType");
		this.fields = fields; // Array of { name, type } objects
	}

	extends(other) {
		if (!(other instanceof StructType)) return false;

		// Check if every field in this type exists in the other and is assignable
		return this.fields.every(field => {
			const otherField = other.fields.find(f => f.name === field.name);
			return otherField && field.type.isAssignableTo(otherField.type);
		});
	}

	toString() {
		return this.name ?? `StructType(${this.fields.map(f => f.name)})`;
	}
}


class Symbol {
	constructor(name, typeSymbol, ast) {
		this.name = name;
		this.typeSymbol = typeSymbol;
		this.ast = ast;
	}

	located(start) {
		this.start = start;
		return this;
	}
}


class Scope {
	static maxRuns = 1;

	constructor(name, parent, symbols = new Map(), typeSymbols = new Map()) {
		this.name = name;
		this.parent = parent;
		this.symbols = symbols;
		this.typeSymbols = typeSymbols;
		this.currentIndex = 0;
		this.run = 0;
	}

	toString() {
		return "Scope { " + this.name + " }";
	}

	toPath() {
		let str = "";
		let now = this;
		if (now) {
			str += now.name + " - ";
			now = now.parent
		}
		return str;
	}

	// Define a new symbol in the current scope
	declare(name, symbol) {
		if (this.symbols.has(name)) {
			const existingSymbol = this.symbols.get(name)
			if (existingSymbol.run == this.run) {
				throw new Error(`Symbol ${name} is already declared.`);
			} else {
				symbol.run = this.run
			}
		}
		symbol.run = this.run;
		if (!symbol.index) {
			symbol.index = this.currentIndex++;
		}
		this.symbols.set(name, symbol);
	}

	declareType(name, typeSymbol) {
		if (this.typeSymbols.has(name)) {
			const existingSymbol = this.typeSymbols.get(name)
			if (existingSymbol.run == this.run) {
				throw new Error(`Symbol ${name} is already declared.`);
			} else {
				typeSymbol.run = this.run
			}
		}
		typeSymbol.run = this.run;
		if (typeSymbol.tag === "StructType") {
			typeSymbol.name = name
			const constructorSymbol = new Symbol(name, new LambdaType(typeSymbol.fields.map(f => f.type), typeSymbol).named(name))
			this.declare(name, constructorSymbol)
		}
		if (typeSymbol.tag === "LambdaType" && typeSymbol.returnType instanceof StructType) {
			typeSymbol.name = name
			const structTypeSymbol = typeSymbol.returnType
			const constructorSymbol = new Symbol(name, new LambdaType(structTypeSymbol.fields.map(f => f.type), typeSymbol).named(name))
			this.declare(name, constructorSymbol)
		}

		typeSymbol.name = name;
		if (!typeSymbol.index) {
			typeSymbol.index = this.currentIndex++;
		}
		this.typeSymbols.set(name, typeSymbol);
	}

	// Lookup a symbol, check parent scope if not found
	lookup(name) {
		if (this.symbols.has(name)) {
			return this.symbols.get(name);
		} else if (this.parent) {
			return this.parent.lookup(name);
		}
		throw new Error(`Symbol ${name} not found. ${[...this.symbols.keys()]}; Scope = ` + this.name);
	}

	lookupType(name) {
		if (this.typeSymbols.has(name)) {
			return this.typeSymbols.get(name);
		} else if (this.parent) {
			return this.parent.lookupType(name);
		}
		throw new Error(`Type Symbol ${name} not found. Scope = ` + this.toPath());
	}
}

// TYPE INFERENCER
class TypeInferencer {
	constructor(symbolTable) {
		this.symbolTable = symbolTable;
		this.run = 0;
	}

	infer(node, scope) {
		let inferredType;
		switch (node.tag) {
			case 'Literal':
				inferredType = this.inferLiteral(node, scope);
				break;
			case 'Identifier':
				inferredType = this.inferIdentifier(node, scope);
				break;
			case 'BinaryExpression':
				inferredType = this.inferBinaryExpression(node, scope);
				break;
				break;
			case 'Lambda':
				inferredType = this.inferLambda(node, scope);
				break;
			case 'LambdaType':
				inferredType = this.inferLambdaType(node, scope);
				break;
			case 'Block':
				inferredType = this.inferBlock(node, scope)
				break;
			case 'TypeDef':
				inferredType = new TypeDefType();
				break;
			case "Apply":
				inferredType = this.inferApply(node, scope);
				break;
			// Add more cases for other AST nodes as needed
			case 'Select':
				inferredType = this.inferSelect(node, scope);
				break;
			default:
				inferredType = new Type(); // Unknown type by default
		}
		// node.typeSymbol = inferredType.toString();
		return inferredType;
	}

	inferApply(node, scope) {
		if (node.isTypeLambda) {
			let nodeCallee = node.callee;
			if (node.callee.tag === "Identifier") {
				nodeCallee = scope.lookup(node.callee.value);
			}
			if (nodeCallee.typeSymbol && nodeCallee.typeSymbol.tag === "TypeLambda") {
				const actualParams = node.args.map(n => {
					return this.translateTypeNodeToType(n, scope)
				})
				const genericParamsToFill = nodeCallee.typeSymbol.paramTypes
				let params = {}
				for (let i = 0; i <= actualParams.length; i++) {
					const actual = actualParams[i]
					const generic = genericParamsToFill[i]
					if (!actual || !generic) {
						continue;
					}
					params[generic.name] = actual;
				}
				const returnTypeGeneric = nodeCallee.typeSymbol.returnType
				return this.resolveGenericTypes(returnTypeGeneric, params)
			} else {
				return this.infer(node.callee, scope).returnType;
			}
		} else {
			if (node.callee.tag === "Identifier") {
				const lookup = scope.lookup(node.callee.value);
				return lookup.typeSymbol.returnType;
			}
			return this.infer(node.callee, scope).returnType;
		}
	}

	inferSelect(node, scope) {
		let ownerType = this.infer(node.owner, scope)
		if (ownerType.resolved !== undefined) {
			ownerType = ownerType.resolved
		}
		const fields = ownerType.fields.filter(f => f.name === node.field.value)
		if (!fields[0] || !fields[0].type) {
			throw new Error(`Field '${node.field.value}' could not be found on '` + ownerType.toString() + "'")
		}
		return fields[0].type;
	}

	inferBlock(node, scope) {
		// TO DO: change to find returns recursively
		if (node.statements.length === 0) {
			return new Type();
		}
		return this.infer(node.statements[node.statements.length - 1], scope)
	}

	inferLiteral(node, scope) {
		// Handle different literal types (assuming 'Number' is one type)
		return scope.lookupType(node.type)
	}

	inferIdentifier(node, scope) {
		if (node.value.charAt(0) === node.value.charAt(0).toUpperCase()) {
			return NamedType.PRIMITIVE_TYPES.Type;
		}
		const symbol = scope.lookup(node.value);
		if (!symbol) {
			throw new Error(`Undefined identifier: ${node.value}`);
		}
		return symbol.typeSymbol;
	}

	DEFINED_OPERATIONS = {
		NumberNumberNumber: ["+", "-", "*", "/"],
		NumberNumberBoolean: [">", "<", "<=", ">=", "=="],
		StringAnyString: ["+"]
	}

	inferBinaryExpression(node, scope) {
		const leftType = this.infer(node.left, scope);
		const rightType = this.infer(node.right, scope);
		// Here, you would define the logic to determine the resulting type based on the operator
		// For example, if the operator is '+', you might expect both operands to be of type 'Int'
		const Number = scope.lookupType("Number")
		const String = scope.lookupType("String")
		const Boolean = scope.lookupType("Boolean")
		if (leftType.isAssignableTo(Number) && rightType.isAssignableTo(Number)) {
			const entry = this.DEFINED_OPERATIONS.NumberNumberNumber;
			if (entry.includes(node.operator)) {
				return Number;
			}
		}
		if (leftType.isAssignableTo(Number) && rightType.isAssignableTo(Number)) {
			const entry = this.DEFINED_OPERATIONS.NumberNumberBoolean;
			if (entry.includes(node.operator)) {
				return Boolean;
			}
		}
		if (leftType.isAssignableTo(String)) {
			const entry = this.DEFINED_OPERATIONS.StringAnyString;
			if (entry.includes(node.operator)) {
				return String;
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

	inferLambdaType(node, scope) {
		const paramScope = new Scope("type-lambda-params", scope)
		node.parameterTypes.forEach(p => {
			paramScope.declareType(p.lhs.value, new GenericNamedType(p.lhs.value, p.value ?? AnyType))
		})
		const type = new TypeLambda(node.parameterTypes.map(p => this.translateTypeNodeToType(p.lhs, paramScope)), this.infer(node.returnType, paramScope))
		return type
	}

	inferLambda(node, scope) {
		const innerScope = node.innerScope ?? new Scope("innerLambda", scope);
		innerScope.run = this.run;
		let paramTypes = [];
		if (node.params[0] && node.params[0].type && node.params[0].type.tag === "UnaryOperator" && node.params[0].type.operator === "...") {
			const param = node.params[0]
			const paramType = new AppliedGenericType(innerScope.lookupType("Array"), [this.translateTypeNodeToType(node.params[0].type.expression, scope)])
			paramType.resolved = innerScope.lookup("Array").returnType
			paramTypes = [paramType]
			innerScope.declare(param.lhs.value, new Symbol(param.lhs.value, paramType, param))
		} else {
			paramTypes = node.params.map(param => {
				let type
				if (param.type) {
					type = this.translateTypeNodeToType(param.type, innerScope);
				} else if (param.defaultValue) {
					type = this.typeInferencer.infer(param.defaultValue, innerScope);
				} else if (node.isTypeLambda) {
					type = new NamedType(param.lhs.value)
				}
				if (!type) {
					throw new Error("Cannot tell type. Maybe you used : instead of ::")
					type = new Type();
				}

				innerScope.declare(param.lhs.value, new Symbol(param.lhs.value, type, param))

				return type;
				// throw new Error(`Missing type annotation or default value for parameter: ${param.name}`);
			});
		}

		if (node.isTypeLambda && node.block.statements[0]) {
			node.params.forEach(p => {
				innerScope.declareType(p.lhs.value, new NamedType(p.lhs.value))
			});
			const returnType = this.translateTypeNodeToType(node.block.statements[0], innerScope)
			const lambdaType = new LambdaType(paramTypes, returnType, true);
			return lambdaType;
		} else {
			node.block.scope = innerScope;
			const returnType = this.infer(node.block, innerScope);
			const lambdaType = new LambdaType(paramTypes, returnType);
			return lambdaType;
		}
	}

	getGenericParamMapping(apply, scope) {

	}

	resolveGenericTypes(type, parameters = {}) {
		switch (type.tag) {
			case "NamedType":
				if (Object.keys(parameters).includes(type.name)) {
					return new NamedType(parameters[type.name].value)
				} else {
					return type;
				}
			case "GenericNamedType":
				if (Object.keys(parameters).includes(type.name)) {
					const name = parameters[type.name]
					if (name.tag && name.tag === "Identifier") {
						return new NamedType(name.value)
					}
					if (name.tag && name.tag === "NamedType") {
						return name
					} else {
						return new NamedType(name)
					}
				} else {
					return type;
				}
			case "AppliedGenericType":
				return type;
			case "LambdaType":
				const resolvedParams = type.paramTypes.map(pt => {
					return this.resolveGenericTypes(pt, parameters)
				})
				const returnType = this.resolveGenericTypes(type.returnType, parameters)
				const result = new LambdaType(resolvedParams, returnType)
				return result
			default:
				return type;
		}
	}

	translateTypeNodeToType(node, scope) {
		switch (node.tag) {
			case "Identifier":
				return scope.lookupType(node.value)
			// return new NamedType(node.value);
			case "Assignment":
				return new Type()
			case "UnaryOperator":
				if (node.operator === "...") {
					return new VarargsType(this.translateTypeNodeToType(node.expression, scope))
				} else {
					throw new Error("Unexpected unary operator")
				}
			case "GenericNamedType":
				return node;
			case "LambdaType":
				if (node.isTypeLevel) {
					const innerScope = new Scope("inner-lambda-type", scope);
					node.parameterTypes.forEach(p => innerScope.declareType(p.lhs.value, new GenericNamedType(p.lhs.value)))
					const params = node.parameterTypes.map(p => this.translateTypeNodeToType(p.lhs, innerScope))
					return new LambdaType(params, this.translateTypeNodeToType(node.returnType, innerScope), node.isTypeLambda)
				}
				return new LambdaType(node.parameterTypes.map(p => this.translateTypeNodeToType(p, scope)), this.translateTypeNodeToType(node.returnType, scope), node.isTypeLambda)
			case 'Lambda':
				// return new LambdaType(node.params.map(p => this.translateTypeNodeToType(p, scope/)))
				const innerScope = node.innerScope ?? new Scope("inner-lambda", scope)
				innerScope.run = this.run;
				node.innerScope = innerScope;
				innerScope.declareType("T", new NamedType("T"))
				return new LambdaType(node.params.map(p => this.translateTypeNodeToType(p, innerScope)), this.translateTypeNodeToType(node.block.statements[0], innerScope), node.isTypeLambda)
			case "TypeDef":
				const fieldTypes = node.fieldDefs.map(f => {
					return { name: f.name, type: scope.lookupType(f.type) }
					// return { name: f.name, type: new NamedType(f.type) }
				})
				return new StructType(fieldTypes);
			case "Apply":
				if (node.isTypeLambda) {
					const applied = new AppliedGenericType(this.translateTypeNodeToType(node.callee, scope), node.args.map(arg => this.translateTypeNodeToType(arg, scope)))
					let callee = node.callee;
					if (callee.tag === "Identifier") {
						callee = scope.lookupType(callee.value);
					}
					if (callee && callee.tag === "LambdaType") {
						const actualParams = node.args
						const expectedParams = callee.paramTypes
						let params = {}
						expectedParams.forEach((p, i) => {
							params[p.name] = actualParams[i]
						})
						const resolved = this.resolveGenericTypes(callee.returnType, params)
						applied.resolved = resolved;
					}
					return applied;
				}
				throw new Error("Was type apply, but not isTypeLambda.")
			case "BinaryExpression":
				return new BinaryOpType(this.translateTypeNodeToType(node.left, scope), node.operator, this.translateTypeNodeToType(node.right, scope))
			case "Optional":
				return new OptionalType(this.translateTypeNodeToType(node.expression, scope))
			default:
				return new Type();
		}
	}
}



class SymbolTable {
	constructor(parent = null) {
		this.parent = parent;
		this.errors = new TypeErrorList()
		this.typeInferencer = new TypeInferencer(this);
		this.outerScope = new Scope("outer", null)
		this.outerScope.run = 0;
		this.run = 0;
	}

	typeCheck(node, scope) {
		switch (node.tag) {
			case "Block":
				node.statements.forEach(c => this.typeCheck.bind(this)(c, scope));
				break;
			case "Assignment":
				this.typeCheck(node.value, scope)
				break;
			case "Apply":
				this.typeCheckApply(node, scope);
				break;
			case "Lambda":
				break;
			default:
			// DO NOTHING
		}
	}

	typeCheckApply(apply, scope) {
		let symbol = apply.callee.tag === "Identifier" ? scope.lookup(apply.callee.value) : this.typeInferencer.infer(apply.callee, scope)
		// If a Type-Value Lambda [T] => value
		if (apply.isTypeLambda) {
			const applyType = this.typeInferencer.infer(apply, scope)
			const callee = this.typeInferencer.infer(apply.callee, scope)
			apply.args.forEach(arg => {
				const translatedType = this.typeInferencer.translateTypeNodeToType(arg, scope)
			})
			return;
		}

		if ((symbol.typeSymbol.paramTypes[0].tag === "AppliedGenericType" && symbol.typeSymbol.paramTypes[0].callee.name === "Array")) {
			const paramType = symbol.typeSymbol.paramTypes[0]
			// paramType.resolved = this.typeInferencer.resolveGenericTypes(paramType)
			const callee = paramType.callee
			apply.takesVarargs = true;
			if (callee && callee.tag === "LambdaType") {
				// const actualParams = node.args
				// const expectedParams = callee.paramTypes
				// let params = {}
				// expectedParams.forEach((p, i) => {
				// 	params[p.name] = actualParams[i]
				// })
				const resolved = this.typeInferencer.resolveGenericTypes(callee.returnType, {})
				paramType.resolved = resolved;
			}

		}
		const callee = symbol.typeSymbol.paramTypes[0].callee
		if (symbol.typeSymbol.paramTypes[0].tag === "VarargsType" || callee && callee.name === "Array") {
			const expectedType = symbol.typeSymbol.paramTypes[0]
			apply.takesVarargs = true;
			apply.args.forEach((p, i) => {
				const type = this.typeInferencer.infer(p, scope)
				if (!type.isAssignableTo(expectedType)) {
					this.errors.add(`Parameter ${i} of ${apply.callee.value}`, expectedType, type, apply.position, new Error())
				}
			})
		} else {
			apply.args.forEach((p, i) => {
				const type = this.typeInferencer.infer(p, scope)
				if (!type.isAssignableTo(symbol.typeSymbol.paramTypes[i])) {
					// console.log(symbol.typeSymbol.paramTypes[i], type)
					this.errors.add(`Parameter ${i} of ${apply.callee.value} (${apply.isTypeLambda ? "Type" : "Values"})`, symbol.typeSymbol.paramTypes[i], type, apply.position, new Error())
				}
			})
		}

	}

	// Build symbol table from AST
	static fromAST(ast) {
		const symbolTable = new SymbolTable();
		const scope = symbolTable.outerScope;
		for (const t in NamedType.PRIMITIVE_TYPES) {
			scope.typeSymbols.set(t, NamedType.PRIMITIVE_TYPES[t])
		}
		scope.declare("print", new Symbol("print", new LambdaType([NamedType.PRIMITIVE_TYPES.Any], NamedType.PRIMITIVE_TYPES.Void), {}))
		const innerArrayScope = new Scope("inner-array", scope)
		innerArrayScope.declareType("T", new GenericNamedType("T"))
		const arrayStruct = new StructType([{ name: "length", type: scope.lookupType("Number")/*new VarargsType(scope.lookupType("T"))*/ }])
		scope.declareType("Array", new LambdaType(
			[new GenericNamedType("T")],
			arrayStruct,
			true
		))
		const fileScope = new Scope("file - ", scope)
		symbolTable.fileScope = fileScope;
		fileScope.run = 0
		symbolTable.build(ast, fileScope);
		symbolTable.run = 1;
		symbolTable.typeInferencer.run = 1;
		symbolTable.outerScope.run = 1;
		fileScope.run = 1;
		symbolTable.build(ast, fileScope);
		return symbolTable;
	}

	// Walk through the AST and infer types for definitions
	build(node, scope) {
		switch (node.tag) {
			case 'Assignment':
				this.inferAssignment(node, scope);
				break;
			case 'Block':
				node.statements.forEach(statement => this.build(statement, scope));
				break;
			case 'IfStatement':
				this.build(node.condition, scope);
				this.build(node.trueBranch, scope);
				this.build(node.falseBranch, scope);
				break;
			default:
				// Skip over literals, identifiers, and other non-definition nodes
				break;
		}
	}

	inferAssignment(node, scope) {
		const lhs = node.lhs;
		const rhsType = this.typeInferencer.infer(node.value, scope);
		if (node.isTypeLevel && node.lhs.value) {
			if (node.value.tag === 'Lambda' && !node.value.isTypeLambda) {
				scope.declareType(node.lhs.value, this.typeInferencer.infer(node.value, scope))
			} else {
				scope.declareType(node.lhs.value, this.typeInferencer.translateTypeNodeToType(node.value, scope))
			}
			return;
		}
		const symbol = new Symbol(lhs.value, rhsType, node);
		if (!node.type) {
			node.typeSymbol = rhsType ? rhsType.toString() : "undefined";
			node.type = rhsType ? rhsType.node : {};
		} else if (!rhsType.isAssignableTo(this.typeInferencer.translateTypeNodeToType(node.type, scope))) {
			this.errors.add(`Assignment of ${node.lhs.value}`, this.typeInferencer.translateTypeNodeToType(node.type, scope), rhsType, node.position);
		}
		if (node.isDeclaration) {
			if (rhsType instanceof TypeDefType) {
				scope.declareType(lhs.value, this.typeInferencer.translateTypeNodeToType(node.value, scope).located(node.start))
			} else {
				scope.declare(lhs.value, symbol.located(node.start));
			}
		}
	}
}

class TypeErrorList {
	constructor() {
		this.errors = []
	}

	add(hint, expectedType, insertedType, position, errorForStack) {
		this.errors.push({ hint, expectedType, insertedType, position, errorForStack })
	}

	throwAll(showStack = true) {
		if (this.errors.length > 0) {
			const message = "There are type errors:\n" + this.errors.map(e => `- ${e.hint}; Expected '${e.expectedType.toString()}', but got '${e.insertedType}' at line ${e.position.start.line}, column ${e.position.start.column} ${showStack && e.errorForStack ? e.errorForStack.stack.toString() : ""}`).join("\n")
			console.error(message);
			process.exit(-1)
		}
	}
}

module.exports.SymbolTable = SymbolTable;