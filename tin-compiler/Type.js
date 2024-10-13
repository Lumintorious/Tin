class Type {
	isAssignableTo(other) {
		return false; // By default, types are not assignable to each other unless overridden
	}

	equals(other) {
		return this.toString() === other.toString(); // Use string representation for equality check
	}

	toString() {
		return 'Unknown'; // Base class
	}
}

const PRIMITIVES = [
	new NamedType("Int"),
	new NamedType("String"),
]

class NamedType extends Type {
	constructor(name) {
		super();
		this.name = name;
	}

	isAssignableTo(other) {
		// Named types are assignable if they are equal (same name)
		return other instanceof NamedType && this.name === other.name;
	}

	toString() {
		return this.name;
	}
}

class LambdaType extends Type {
	constructor(paramTypes, returnType) {
		super();
		this.paramTypes = paramTypes;
		this.returnType = returnType;
	}

	isAssignableTo(other) {
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
		this.left = left;
		this.operator = operator;
		this.right = right;
	}

	isAssignableTo(other) {
		if (this.operator === '|') {
			// Union type: assignable if either left or right is assignable to the target type
			return this.left.isAssignableTo(other) || this.right.isAssignableTo(other);
		} else if (this.operator === '&') {
			// Intersection type: assignable only if both left and right are assignable to the target type
			return this.left.isAssignableTo(other) && this.right.isAssignableTo(other);
		}
		return false;
	}

	toString() {
		return `${this.left.toString()} ${this.operator} ${this.right.toString()}`;
	}
}

class StructType extends Type {
	constructor(fields) {
		super();
		this.fields = fields; // Array of { name, type } objects
	}

	isAssignableTo(other) {
		if (!(other instanceof StructType)) return false;

		// Check if every field in this type exists in the other and is assignable
		return this.fields.every(field => {
			const otherField = other.fields.find(f => f.name === field.name);
			return otherField && field.type.isAssignableTo(otherField.type);
		});
	}

	toString() {
		const fieldsStr = this.fields.map(field => `${field.name}: ${field.type.toString()}`).join('; ');
		return `type { ${fieldsStr} }`;
	}
}
