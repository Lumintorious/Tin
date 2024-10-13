class Type {
	constructor(tag) {
		this.tag = tag
	}

	isAssignableTo(other) {
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
	}

	canAssign() {
		return true;
	}

	toString() {
		return this.name;
	}
}

const AnyType = new AnyTypeClass();


class NamedType extends Type {
	static PRIMITIVE_TYPES = {
		Int: new NamedType("Int"),
		String: new NamedType("String"),
		Boolean: new NamedType("Boolean"),
		Void: new NamedType("Void"),
		Type: new NamedType("Type")
	}

	constructor(name) {
		super();
		this.tag = "NamedType";
		this.name = name;
	}

	extends(other) {
		// Named types are assignable if they are equal (same name)
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
	constructor(paramTypes, returnType) {
		super();
		this.tag = "LambdaType";
		this.paramTypes = paramTypes;
		this.returnType = returnType;
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
		const paramsStr = this.paramTypes.map(t => t.toString()).join(', ');
		return `(${paramsStr}) => ${this.returnType.toString()}`;
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
		super();
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
		super();
		this.tag = "StructType";
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
		return this.name;
	}
}


class Symbol {
	constructor(name, typeSymbol, ast) {
		this.name = name;
		this.typeSymbol = typeSymbol;
		this.ast = ast;
	}
}


class Scope {
	constructor(parent, symbols) {
		this.parent = parent;
		this.symbols = symbols;
	}
}

// TYPE INFERENCER
class TypeInferencer {
	constructor(symbolTable) {
		this.symbolTable = symbolTable;
	}

	infer(node) {
		let inferredType;
		switch (node.tag) {
			case 'Literal':
				inferredType = this.inferLiteral(node);
				break;
			case 'Identifier':
				inferredType = this.inferIdentifier(node);
				break;
			case 'BinaryExpression':
				inferredType = this.inferBinaryExpression(node);
				break;
			case 'Assignment':
				inferredType = this.inferAssignment(node);
				break;
			case 'Lambda':
				inferredType = this.inferLambda(node);
				break;
			case 'Block':
				inferredType = this.inferBlock(node)
				break;
			case 'TypeDef':
				inferredType = new TypeDefType();
				break;
			case "Apply":
				inferredType = this.infer(node.callee).returnType;
				break;
			// Add more cases for other AST nodes as needed
			case 'Select':
				inferredType = this.inferSelect(node);
				break;
			default:
				inferredType = new Type(); // Unknown type by default
		}
		// node.typeSymbol = inferredType.toString();
		return inferredType;
	}

	inferSelect(node) {
		const ownerType = this.infer(node.owner)
		const fieldType = ownerType.fields.filter(f => f.name === node.field.value)[0].type
		return fieldType;
	}

	inferBlock(node) {
		// TO DO: change to find returns recursively
		if (node.statements.length === 0) {
			return new Type(node.tag, node.type);
		}
		return this.infer(node.statements[node.statements.length - 1])
	}

	inferLiteral(node) {
		// Handle different literal types (assuming 'Number' is one type)
		return this.symbolTable.lookupType(node.type)
	}

	inferIdentifier(node) {
		if (node.value.charAt(0) === node.value.charAt(0).toUpperCase()) {
			return NamedType.PRIMITIVE_TYPES.Type;
		}
		const symbol = this.symbolTable.lookup(node.value);
		if (!symbol) {
			throw new Error(`Undefined identifier: ${node.value}`);
		}
		return symbol.typeSymbol;
	}

	inferBinaryExpression(node) {
		const leftType = this.infer(node.left);
		const rightType = this.infer(node.right);
		// Here, you would define the logic to determine the resulting type based on the operator
		// For example, if the operator is '+', you might expect both operands to be of type 'Int'
		if (node.operator === '-') {
			if (leftType.isAssignableTo(this.symbolTable.lookupType("Int")) && rightType.isAssignableTo(this.symbolTable.lookupType("Int"))) {
				return this.symbolTable.lookupType("Int");
				// return new NamedType('Int'); // Result of Int + Int is Int
			}
			// Add more checks for other operators and types as needed
		}

		// Return a BinaryOpType if types are not directly inferrable
		return new BinaryOpType(leftType, node.operator, rightType);
	}

	inferLambda(node) {
		const paramTypes = node.params.map(param => {
			if (param.type) {
				return this.translateTypeNodeToType(param.type);
			}
			// Infer default value type if present
			if (param.defaultValue) {
				const x = this.typeInferencer.infer(param.defaultValue);
				return x;
			}

			return new Type(node.tag, node.type);
			// throw new Error(`Missing type annotation or default value for parameter: ${param.name}`);
		});
		const returnType = this.infer(node.block);
		const lambdaType = new LambdaType(paramTypes, returnType);
		return lambdaType;
	}

	translateTypeNodeToType(node) {
		switch (node.tag) {
			case "Identifier":
				return this.symbolTable.lookupType(node.value)
			// return new NamedType(node.value);
			case "Assignment":
				return this.symbolTable.lookupType(node.lhs.value)
			// return new NamedType(node.lhs.value);
			case "LambdaType":
				return new LambdaType(node.parameterTypes.map(p => this.translateTypeNodeToType(p)), this.translateTypeNodeToType(node.returnType))
			case "TypeDef":
				const fieldTypes = node.fieldDefs.map(f => {
					return { name: f.name, type: this.symbolTable.lookupType(f.type) }
					// return { name: f.name, type: new NamedType(f.type) }
				})
				return new StructType(fieldTypes);
			case "BinaryExpression":
				return new BinaryOpType(this.translateTypeNodeToType(node.left), node.operator, this.translateTypeNodeToType(node.right))
			case "Optional":
				console.log(node)
				return new OptionalType(this.translateTypeNodeToType(node.expression))
			default:
				return new Type(node.tag, node.type);
		}
	}
}

// SYMBOL TABLE
print = console.log

class SymbolTable {
	constructor(parent = null) {
		this.parent = parent; // Parent scope (for nested scopes)
		this.symbols = new Map(); // Map to store symbols (variable/function names)
		this.typeSymbols = new Map(); // Map to store types
		for (const t in NamedType.PRIMITIVE_TYPES) {
			this.typeSymbols.set(t, NamedType.PRIMITIVE_TYPES[t])
		}
		this.symbols.set("print", new Symbol("print", new LambdaType([NamedType.PRIMITIVE_TYPES.String], NamedType.PRIMITIVE_TYPES.Void), {}))
		this.errors = new TypeErrorList()
		this.typeInferencer = new TypeInferencer(this); // Type inferencer for the current scope
	}

	typeCheck(node) {
		switch (node.tag) {
			case "Block":
				node.statements.forEach(this.typeCheck.bind(this));
				break;
			case "Apply":
				this.typeCheckApply(node);
				break;
			default:
			// DO NOTHING
		}
	}

	typeCheckApply(apply) {
		if (apply.callee.tag === "Identifier") {
			const symbol = this.lookup(apply.callee.value)
			const args = apply.args;
			console.log(symbol.typeSymbol)
			apply.args.forEach((p, i) => {
				const type = this.typeInferencer.infer(p)
				if (!type.isAssignableTo(symbol.typeSymbol.paramTypes[i])) {
					this.errors.add(`Parameter ${i} of ${apply.callee.value}`, symbol.typeSymbol.paramTypes[i], type, apply.position)
				}
			})
		}
	}

	// Define a new symbol in the current scope
	declare(name, symbol) {
		if (this.symbols.has(name)) {
			throw new Error(`Symbol ${name} is already declared.`);
		}
		this.symbols.set(name, symbol);
	}

	declareType(name, typeSymbol) {
		if (this.typeSymbols.has(name)) {
			throw new Error(`Symbol ${name} is already declared.`);
		}
		if (typeSymbol.tag === "StructType") {
			typeSymbol.name = name
			const constructorSymbol = new Symbol(name, new LambdaType(typeSymbol.fields.map(f => f.type), typeSymbol))
			this.declare(name, constructorSymbol)
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
		throw new Error(`Symbol ${name} not found. ${[...this.symbols.keys()]}`);
	}

	lookupType(name) {
		if (this.typeSymbols.has(name)) {
			return this.typeSymbols.get(name);
		} else if (this.parent) {
			return this.parent.lookupType(name);
		}
		throw new Error(`Type Symbol ${name} not found.`);
	}

	// Build symbol table from AST
	static fromAST(ast) {
		const symbolTable = new SymbolTable();
		symbolTable.build(ast);
		return symbolTable;
	}

	// Walk through the AST and infer types for definitions
	build(node) {
		switch (node.tag) {
			case 'Assignment':
				this.inferAssignment(node);
				break;
			case 'Definition':
				this.inferDefinition(node);
				break;
			case 'Block':
				node.statements.forEach(statement => this.build(statement));
				break;
			case 'IfStatement':
				this.build(node.condition);
				this.build(node.trueBranch);
				this.build(node.falseBranch);
				break;
			case 'Lambda':
				this.inferLambda(node);
				break;
			default:
				// Skip over literals, identifiers, and other non-definition nodes
				break;
		}
	}

	inferAssignment(node) {
		const lhs = node.lhs;
		const rhsType = this.typeInferencer.infer(node.value);
		if (node.isTypeLevel && node.lhs.value) {
			this.declareType(node.lhs.value, this.typeInferencer.translateTypeNodeToType(node.value))
			return;
		}
		const symbol = new Symbol(lhs.value, rhsType, node);
		if (!node.type) {
			node.typeSymbol = rhsType.toString();
			node.type = rhsType.node;
		} else if (!rhsType.isAssignableTo(this.typeInferencer.translateTypeNodeToType(node.type))) {
			this.errors.add(`Assignment of ${node.lhs.value}`, this.typeInferencer.translateTypeNodeToType(node.type), rhsType, node.position);
		}
		if (node.isDeclaration) {
			if (rhsType instanceof TypeDefType) {
				this.declareType(lhs.value, this.typeInferencer.translateTypeNodeToType(node.value))
			} else {
				this.declare(lhs.value, symbol);
			}
		}
	}

	inferDefinition(node) {
		const valueType = this.typeInferencer.infer(node.value);
		const symbol = new Symbol(node.name, valueType, node);
		this.declare(node.name, symbol);
	}

	inferLambda(node) {
		const paramTypes = node.params.map(param => {
			if (param.type) {
				return param.type;
			}
			// Infer default value type if present
			if (param.defaultValue) {
				return this.typeInferencer.infer(param.defaultValue);
			}
			throw new Error(`Missing type annotation or default value for parameter: ${param.name} `);
		});

		const returnType = this.typeInferencer.infer(node.block);
		const lambdaType = new LambdaType(paramTypes, returnType);
		// If the lambda is an assignment (declared as a function), bind its type
		if (node.isDeclaration) {
			this.declare(node.name, new Symbol(node.name, lambdaType, node));
		}
	}
}

class TypeErrorList {
	constructor() {
		this.errors = []
	}

	add(hint, expectedType, insertedType, position) {
		this.errors.push({ hint, expectedType, insertedType, position })
	}

	throwAll() {
		if (this.errors.length > 0) {
			const message = "There are type errors:\n" + this.errors.map(e => `- ${e.hint}; Expected '${e.expectedType}', but got '${e.insertedType}' at line ${e.position.start.line}, column ${e.position.start.column} `).join("\n")
			console.error(message);
			process.exit(-1)
		}
	}
}

module.exports.SymbolTable = SymbolTable;