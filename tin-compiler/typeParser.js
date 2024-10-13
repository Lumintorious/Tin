class TypeDef {
	constructor(fieldDefs) {
		this.tag = "TypeDef"
		this.fieldDefs = fieldDefs
		this.isTypeLevel = true
	}
}

class FieldDef {
	constructor(name, type, defaultValue) {
		this.tag = "FieldDef"
		this.name = name
		this.type = type
		this.defaultValue = defaultValue
		this.isTypeLevel = true;
	}
}

class LambdaType {
	constructor(parameterTypes, returnType) {
		this.tag = "LambdaType"
		this.parameterTypes = parameterTypes
		this.returnType = returnType
		this.isTypeLevel = true;
	}
}

function parseLambdaType(parser) {
	// Expect the opening parenthesis for parameters
	parser.expect('(');

	const params = [];

	// Parse parameters until we hit a closing parenthesis
	while (parser.peek().tag !== 'PARENS' || parser.peek().value !== ')') {
		const param = parser.parseParameterType();
		params.push(param);

		// Check for a comma to separate parameters
		if (parser.peek().tag === 'OPERATOR' && parser.peek().value === ',') {
			parser.nextToken();  // Consume the comma
		} else {
			break;  // Exit loop if no more parameters
		}
	}

	parser.expect(')');  // Expect the closing parenthesis

	// Expect the return type Assignment
	parser.expect('OPERATOR', '=>'); // Expect '=>'

	const returnType = parser.parseType();  // Parse the return type

	return new LambdaType(params, returnType);
}


function parseNewType(parser) {
	let token = parser.consume('KEYWORD');
	if (token.value !== 'type') {
		throw new Error(`Expected 'type', but got '${token.value}' at line ${token.start.line}, column ${token.start.column}`);
	}

	// Expect INDENT (start of type block)
	parser.consume("NEWLINE")
	token = parser.consume('INDENT');

	let fieldDefs = []

	// Parse fields inside the type block
	while (true) {
		parser.omit("NEWLINE")
		token = parser.peek();
		if (token === undefined) {
			break
		}
		if (token.tag === 'DEDENT') {
			parser.consume('DEDENT');
			break; // End of type Assignment block
		}

		if (token.tag === 'IDENTIFIER') {
			const fieldName = token.value;
			let ident = parser.consume('IDENTIFIER');

			// Expect a colon followed by the type of the field
			parser.consume('OPERATOR');

			// Expect the type of the field
			let type = parser.consume('IDENTIFIER');

			const fieldType = token.value;
			let defaultValue = null;

			// Check if there is a default value (expect '=' operator)
			if (parser.peek() && parser.peek().tag === 'OPERATOR' && parser.peek().value === '=') {
				parser.consume('OPERATOR', "=");

				// Expect a literal value for the default
				token = parser.parseExpression()
				defaultValue = token;
			}
			// Add field to the type node
			fieldDefs.push(new FieldDef(
				fieldName,
				type.value,
				defaultValue
			))
		} else {
			throw new Error(`Unexpected token: ${token.tag} at line ${token.start.line}, column ${token.start.column}`);
		}
	}

	return new TypeDef(fieldDefs);
}


module.exports = {
	TypeDef,
	FieldDef,
	LambdaType,
	parseNewType,
	parseLambdaType
}