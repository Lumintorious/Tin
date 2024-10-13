class TypeChecker {
	constructor(symbolTable) {
		this.symbolTable = symbolTable;
	}

	check(astNode) {
		switch (astNode.tag) {
			case 'Assignment':
				this.checkAssignment(astNode);
				break;
			case 'Definition':
				this.checkDefinition(astNode);
				break;
			case 'Lambda':
				this.checkLambda(astNode);
				break;
			case 'IfStatement':
				this.checkIfStatement(astNode);
				break;
			case 'BinaryExpression':
				this.checkBinaryExpression(astNode);
				break;
			case 'Apply':
				this.checkApply(astNode);
				break;
			case 'Literal':
				this.checkLiteral(astNode);
				break;
			case 'Block':
				this.checkBlock(astNode);
				break;
			case 'Group':
				this.checkGroup(astNode);
				break;
			case 'Cast':
				this.checkCast(astNode);
				break;
			case 'Identifier':
				this.checkIdentifier(astNode);
				break;
			default:
				console.warn(`No type check implemented for: ${astNode.tag}`);
		}
	}

	checkAssignment(node) {
		console.log(`Checking assignment: ${node.lhs.value}`);

		const assignedType = this.getExpressionType(node.value);
		const expectedType = node.type || this.symbolTable.findSymbol(node.lhs.value)?.typeSymbol;

		if (assignedType !== expectedType) {
			console.error(`Type error: Cannot assign ${assignedType} to ${node.lhs.value}, expected ${expectedType}.`);
		} else {
			console.log(`Assignment is type correct for ${node.lhs.value}`);
		}
	}

	checkDefinition(node) {
		console.log(`Checking definition: ${node.name}`);
		this.check(node.value); // Check the assigned value
	}

	checkLambda(node) {
		console.log(`Checking lambda with params: ${node.params.map(p => p.name).join(', ')}`);
		node.params.forEach(param => {
			if (!this.isValidType(param.type)) {
				console.error(`Parameter type error: ${param.name} has invalid type ${param.type}.`);
			}
		});
		this.check(node.block); // Check the lambda's body (block)
	}

	checkIfStatement(node) {
		console.log(`Checking if statement`);
		const conditionType = this.getExpressionType(node.condition);
		if (conditionType !== 'Boolean') {
			console.error(`Type error: If statement condition must be Boolean, got ${conditionType}.`);
		}

		this.check(node.trueBranch);
		if (node.falseBranch) {
			this.check(node.falseBranch);
		}
	}

	checkBinaryExpression(node) {
		console.log(`Checking binary expression`);
		const leftType = this.getExpressionType(node.left);
		const rightType = this.getExpressionType(node.right);

		if (leftType !== rightType) {
			console.error(`Type error: Mismatched types ${leftType} and ${rightType} in binary expression.`);
		}
	}

	checkApply(node) {
		console.log(`Checking function application`);
		const calleeType = this.getExpressionType(node.callee);

		if (!calleeType || calleeType.tag !== 'Lambda') {
			console.error(`Type error: ${node.callee.value} is not a function.`);
			return;
		}

		const expectedParams = calleeType.params;
		const appliedArgs = node.args;

		if (expectedParams.length !== appliedArgs.length) {
			console.error(`Type error: Function ${node.callee.value} expects ${expectedParams.length} arguments, but got ${appliedArgs.length}.`);
			return;
		}

		for (let i = 0; i < appliedArgs.length; i++) {
			const paramType = expectedParams[i].type;
			const argType = this.getExpressionType(appliedArgs[i]);

			if (paramType !== argType) {
				console.error(`Type error: Argument ${i + 1} of ${node.callee.value} should be ${paramType}, but got ${argType}.`);
			} else {
				console.log(`Argument ${i + 1} of ${node.callee.value} is correct.`);
			}
		}
	}

	checkBlock(node) {
		console.log(`Checking block with ${node.statements.length} statements`);
		node.statements.forEach(statement => this.check(statement));
	}

	checkLiteral(node) {
		console.log(`Checking literal: ${node.value}`);
	}

	checkGroup(node) {
		console.log(`Checking grouped expression`);
		this.check(node.value);
	}

	checkCast(node) {
		console.log(`Checking cast`);
		const expressionType = this.getExpressionType(node.expression);
		if (!this.isValidType(node.type)) {
			console.error(`Type error: Invalid cast to type ${node.type}`);
		}
	}

	checkIdentifier(node) {
		console.log(`Checking identifier: ${node.value}`);
		const symbol = this.symbolTable.findSymbol(node.value);
		if (!symbol) {
			console.error(`Type error: Undefined identifier ${node.value}`);
		}
	}

	// This function would extract the type from any expression
	getExpressionType(expression) {
		switch (expression.tag) {
			case 'Literal':
				return expression.type;
			case 'Identifier':
				const symbol = this.symbolTable.findSymbol(expression.value);
				return symbol ? symbol.typeSymbol : null;
			case 'Apply':
				return this.getApplyReturnType(expression);
			case 'BinaryExpression':
				const leftType = this.getExpressionType(expression.left);
				const rightType = this.getExpressionType(expression.right);
				return leftType === rightType ? leftType : 'Unknown';
			default:
				return 'Unknown';
		}
	}

	// This would handle getting the return type from an Apply expression
	getApplyReturnType(applyExpression) {
		const calleeType = this.getExpressionType(applyExpression.callee);
		if (calleeType && calleeType.tag === 'Lambda') {
			return calleeType.returnType;
		}
		return 'Unknown';
	}

	isValidType(type) {
		const validTypes = ['Int', 'String', 'Boolean', 'Cat', 'Animal', /* etc */];
		return validTypes.includes(type);
	}
}


// Initialize symbol table from AST
//  const symbolTable = new SymbolTable();
//  symbolTable.buildScope(ast);  // Assuming AST is available

//  // Walk through symbols and type check
//  const typeChecker = new TypeChecker(symbolTable);
//  symbolTable.walkSymbols(symbol => {
// 	typeChecker.checkSymbol(symbol);
//  });

module.exports.TypeChecker = TypeChecker