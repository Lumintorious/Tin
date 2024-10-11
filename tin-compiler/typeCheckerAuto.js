function typeCheck(ast, typeDefinitions = {}) {
	// Helper to check if a type is defined
	const getType = (name) => typeDefinitions[name] || null;

	// Helper to check type compatibility
	const isTypeCompatible = (actualType, expectedType) => {
		return actualType === expectedType || (expectedType === null); // Allow null for optional values
	};

	// Check if an expression has a type
	function checkExpression(node) {
		switch (node.tag) {
			case 'Identifier':
				return getType(node.value) ? node.value : null;

			case 'Literal':
				return node.type; // Return the type of the literal (e.g., "String", "Number")

			case 'BinaryExpression':
				const leftType = checkExpression(node.left);
				const rightType = checkExpression(node.right);
				// Assuming the result type is the left type for assignment
				return leftType || rightType;

			case 'Lambda':
				// Check parameter default values as expressions
				node.params.forEach((param) => {
					if (param.defaultValue) {
						checkExpression(param.defaultValue);
					}
				});
				checkNode(node.block); // Check the block inside the lambda
				return null; // Lambdas don't have a direct return type

			case 'Apply':
				const calleeType = checkExpression(node.callee);
				// Return the type of the callee (function)
				return calleeType;

			case 'TypeDef':
				return null; // Type definitions themselves don't have a type in this context

			default:
				throw new Error(`Unknown AST node type: '${node.tag}'.`);
		}
	}

	// Main function to iterate through the AST and validate types
	function checkNode(node) {
		switch (node.tag) {
			case 'Block':
				node.statements.forEach(checkNode);
				break;

			case 'BinaryExpression':
				// For assignment (e.g., x = TypeDef)
				if (node.operator === '=') {
					const varName = node.left.value;
					const rightTypeDef = node.right;

					if (rightTypeDef.tag === 'TypeDef') {
						// Register type definition
						typeDefinitions[varName] = rightTypeDef.fieldDefs.reduce((acc, field) => {
							acc[field.name] = field.type;
							return acc;
						}, {});
					} else {
						const rightType = checkExpression(node.right);
						const varType = getType(varName);
						if (!varType) {
							throw new Error(`Variable '${varName}' is not defined.`);
						}
						if (!isTypeCompatible(rightType, varType)) {
							throw new Error(`Type mismatch: '${rightType}' is not compatible with '${varType}' for variable '${varName}'.`);
						}
					}
				}
				break;

			case 'Lambda':
				node.params.forEach((param) => {
					if (param.type) {
						if (!getType(param.type)) {
							throw new Error(`Type '${param.type}' is not defined for parameter '${param.name}'.`);
						}
					}
				});
				checkNode(node.block); // Check the block inside the lambda
				break;

			case 'IfStatement':
				const conditionType = checkExpression(node.condition);
				if (conditionType !== 'Boolean') {
					throw new Error(`Condition of if statement must be of type 'Boolean', but got '${conditionType}'.`);
				}
				checkNode(node.trueBranch);
				checkNode(node.falseBranch);
				break;

			case 'Apply':
				// Check if the function is defined
				const functionName = node.callee.value;
				const funcType = getType(functionName);
				if (!funcType) {
					throw new Error(`Function '${functionName}' is not defined.`);
				}
				// Check argument types
				node.args.forEach((arg) => {
					const argType = checkExpression(arg);
					// Ensure argType matches the expected type
					if (!isTypeCompatible(argType, funcType)) {
						throw new Error(`Argument type '${argType}' is not compatible with expected type '${funcType}' for function '${functionName}'.`);
					}
				});
				break;

			case 'TypeDef':
				// Register the type definition
				const typeName = node.fieldDefs[0]?.name; // Assume first field is the type name
				typeDefinitions[typeName] = {};
				node.fieldDefs.forEach(field => {
					typeDefinitions[typeName][field.name] = field.type;
				});
				break;

			case 'Definition':
				// Check variable definition without keywords
				const defVarName = node.name; // Use the name field directly
				const defValue = node.value;

				// Check the right side expression for type compatibility
				const definedType = checkExpression(defValue);

				// Register the variable in typeDefinitions
				if (node.type) {
					// If a type is explicitly defined
					typeDefinitions[defVarName] = node.type;
				} else {
					// Infer type from the value expression
					typeDefinitions[defVarName] = definedType;
				}

				if (!definedType) {
					throw new Error(`Type for variable '${defVarName}' could not be determined.`);
				}
				break;

			default:
				throw new Error(`Unknown AST node type: '${node.tag}'.`);
		}
	}

	// Check the entire AST starting from the root
	checkNode(ast);
}

// Run type checking
// try {
// 	typeCheck(ast);
// 	console.log("Type checking passed.");
// } catch (error) {
// 	console.error("Type checking failed:", error.message);
// }

module.exports.typeCheck = typeCheck