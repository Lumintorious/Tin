const { parseNewType } = require("./typeParser");

function testIs(tag, value) {
	return (token) => {
		if ((tag && token.tag === tag) && (value && token.value === value)) {
			return true;
		} else {
			return false;
		}
	}
}

const applyableKeywords = ["return", "mutable"]

class Definition {
	constructor(name, value, isFirstDeclaration = true, isMutable = false, type) {
		this.tag = 'Definition'; // tag of the AST node
		this.name = name;          // Name of the variable
		this.value = value;      // Lambda function associated with the definition
		this.type = type
	}
}

class Cast {
	constructor(expression, type) {
		this.tag = "Cast";
		this.expression = expression;
		this.type = type;
	}
}

class IfStatement {
	constructor(condition, trueBranch, falseBranch) {
		this.tag = "IfStatement";
		this.condition = condition;
		this.trueBranch = trueBranch;
		this.falseBranch = falseBranch;
	}
}

class Lambda {
	constructor(params, block) {
		this.tag = "Lambda"
		this.params = params
		this.block = block
	}
}

class Block {
	constructor(statements) {
		this.tag = 'Block';       // tag of the AST node
		this.statements = statements.filter(s => s !== null)
	}
}

const isQuotation = testIs(null, '"')
class Literal {
	constructor(value, type) {
		this.tag = 'Literal';     // tag of the AST node
		this.type = type;
		this.value = value;        // Value of the literal (number, string, etc.)
	}
}

class Apply {
	constructor(callee, args) {
		this.tag = "Apply"
		this.callee = callee
		this.args = args
	}
}

// Parenthesis-surrounded expression. Eg. ( value )
class Group {
	constructor(value) {
		this.tag = "Group";
		this.value = value;
	}
}

class Identifier {
	constructor(value) {
		this.tag = 'Identifier';     // tag of the AST node
		this.value = value;        // Value of the literal (number, string, etc.)
		// this.isType = value.charAt(0) === value.charAt(0).toUpperCase()
	}
}

class Parameter {
	constructor(name, type, defaultValue) {
		this.tag = 'Parameter';    // tag of the AST node
		this.name = name;           // Name of the parameter
		this.type = type;  // tag annotation of the parameter
		this.defaultValue = defaultValue
	}
}

class BinaryExpression {
	constructor(left, operator, right) {
		this.tag = 'BinaryExpression';    // tag of the AST node
		this.left = left;           // Name of the parameter
		this.operator = operator;
		this.right = right  // tag annotation of the parameter
	}
}

class AppliedKeyword {
	constructor(keyword, param) {
		this.tag = "AppliedKeyword"
		this.keyword = keyword
		this.param = param
	}
}

const PRECEDENCE = {
	'.': 100,  // Field access
	'*': 10,   // Multiplication
	'/': 10,   // Division
	'+': 9,    // Addition
	'-': 9,    // Subtraction
	'==': 8,   // Equality
	'!=': 8,   // Inequality
	'<': 7,    // Less than
	'>': 7,    // Greater than
	'<=': 7,   // Less than or equal to
	'>=': 7,   // Greater than or equal to
	'&&': 6,   // Logical AND
	'||': 5,   // Logical OR
	'&': 4,
	'|': 3,
	'@': 2,
	// ':': 1,
	// '=': 0  // Assignment (right-associative)
};


const body = [];
class Parser {
	constructor(tokens) {
		this.tokens = tokens;
		this.current = 0;
	}

	parse() {
		while (this.current < this.tokens.length) {
			const statement = this.parseStatement();
			if (statement) {
				body.push(statement);
			}
		}
		return new Block(body);
	}

	is(tokenValue) {
		return this.peek().value === tokenValue;
	}

	isA(tokentag) {
		return this.peek().tag === tokentag;
	}

	parseStatement() {
		let token = this.peek();

		if (token.tag === "INDENT" || token.tag === "DEDENT") {
			this.consume("INDENT")
			token = this.peek();
		}

		if (this.is("def") || this.is("let")) {
			return this.parseDefinition();
		}

		if (token.tag === "KEYWORD" && token.value === "print") {
			return this.parsePrintStatement();
		}

		if (token.tag === "NEWLINE") {
			this.consume("NEWLINE"); // Ignore newlines
			return null; // Empty statement
		}



		let left = this.parseExpression()
		while (this.peek() && this.peek().value === "=") {
			// Consume the operator
			this.consume('OPERATOR');

			// Parse the right-hand side with precedence rules (note: higher precedence for right-side)
			const right = this.parseExpression();

			// Combine into a binary expression
			console.log(left)
			left = new Definition(left.value, right, true, true, left.type.value);

			// left = new BinaryExpression(left, operator, right);
		}

		return left;
	}

	parseApply(callee) {
		this.consume('PARENS', '('); // Consume '('
		const args = [];

		// Parse arguments (expressions)
		while (this.peek().value !== ')') {
			this.omit("NEWLINE")
			this.omit("INDENT")
			this.omit("DEDENT")
			args.push(this.parseExpression());
			// If there's a comma, consume it and continue parsing more arguments
			this.omit("NEWLINE")
			this.omit("INDENT")
			this.omit("DEDENT")
			if (this.peek().value === ',') {
				this.consume('OPERATOR', ',');
			}
		}

		this.consume('PARENS', ')'); // Consume ')'

		return new Apply(callee, args);  // Return a function application node
	}

	parseDefinition() {
		this.consume("KEYWORD", "def");
		const name = this.consume("IDENTIFIER").value;
		this.consume("OPERATOR", "=");
		const lambda = this.parseExpression(); // Parse the lambda function
		return new Definition(name, lambda);
	}

	parseExpression(precedence = 0) {
		let left = this.parsePrimary();  // Parse the left-hand side (like a literal or identifier)

		while (this.peek() && this.peek().tag === 'PARENS' && this.peek().value === '(') {
			left = this.parseApply(left);
		}


		if (this.is(":")) {
			this.consume(":");
			const type = this.consume("IDENTIFIER");
			left = new Cast(left, type);
		}

		// Continue parsing if we find a binary operator with the appropriate precedence
		while (this.peek() && this.isBinaryOperator(this.peek())) {
			const operator = this.peek().value;
			const operatorPrecedence = PRECEDENCE[operator];

			// Only continue if the operator has higher precedence than the current one
			if (operatorPrecedence < precedence) {
				break;
			}

			// Consume the operator
			this.consume('OPERATOR');

			// Parse the right-hand side with precedence rules (note: higher precedence for right-side)
			const right = this.parseExpression(operatorPrecedence + 1);

			// Combine into a binary expression

			if (operator === "=" && left.tag === "Cast" && left.expression.tag === "Identifier") {
				console.log(left)
				left = new Definition(left.expression.value, right, true, true, left.type.value);
				break;
			}

			left = new BinaryExpression(left, operator, right);
		}

		return left;
	}

	// Check if the next token is a binary operator
	isBinaryOperator(token) {
		return token.tag === 'OPERATOR' && PRECEDENCE.hasOwnProperty(token.value);
	}

	parseParameters() {
		const params = [];
		while (this.peek().tag !== "OPERATOR" || this.peek().value !== ")") {
			const paramName = this.consume("IDENTIFIER").value;
			this.consume("OPERATOR", ":");
			const paramtag = this.consume("IDENTIFIER").value;
			params.push({ name: paramName, tag: paramtag });
			if (this.peek().tag === "OPERATOR" && this.peek().value === ",") {
				this.consume("OPERATOR", ",");
			}
		}
		this.consume("OPERATOR", ")");
		return params;
	}


	parseLambda() {
		// Ensure we have the opening parenthesis for the parameters
		this.consume('PARENS', '('); // This should throw an error if not found
		let isTypeLevel = false;

		const parameters = [];

		// Parse parameters until we reach the closing parenthesis
		while (this.peek().tag !== 'PARENTHESIS_CLOSE') {
			// Parse each parameter
			// const param = this.parseParameter();
			const param = this.parseExpression();
			parameters.push(param);

			// Check for a comma to separate parameters
			if (this.peek().tag === 'OPERATOR') {
				this.consume('OPERATOR', ',');
			} else {
				break; // No more parameters, exit the loop
			}
		}

		this.consume('PARENS', ')'); // Consume the closing parenthesis

		// Now check for the arrow (-> / =>) indicating the function body
		const arrow = this.consume("OPERATOR")
		if (arrow.value === "->") {
			// Value Level
		} else if (arrow.value === "=>") {
			// Type Level
		} else {
			this.createError("Expected -> or =>", token)
		}

		// Parse the body of the lambda (this could be another expression)
		let body = this.parseExpression(); // You would need a parseExpression function
		if (body.tag !== "Block") {
			body = new Block([body])
		}
		return new Lambda(parameters, body)
	}

	parsePrintStatement() {
		this.consume("KEYWORD", "print");
		const argument = this.parseExpression(); // Can parse any expression
		this.consume("NEWLINE"); // Expect a newline after print statement
		return new PrintStatement(argument);
	}

	parseIfStatement() {
		this.consume("KEYWORD", "if");
		const condition = this.parseExpression();
		this.consume("KEYWORD", "then");
		const trueBranch = this.parseExpression();
		let falseBranch = null;
		if (this.is("else")) {
			this.consume("KEYWORD", "else")
			falseBranch = this.parseExpression();
		}
		return new IfStatement(condition, trueBranch, falseBranch);
	}

	parseGrouping() {
		this.consume('PARENS', '{'); // Consume '('
		const expr = this.parseExpression();
		this.consume('PARENS', '}'); // Consume ')'
		return new Group(expr);
	}

	parseParameter() {
		const identifierToken = this.consume('IDENTIFIER'); // Expecting the identifier
		let type = null;
		let defaultValue = null;

		// Check for type annotation (e.g., : tag)
		if (this.peek().tag === 'OPERATOR' && this.peek().value === ':') {
			this.consume('OPERATOR', ':'); // Consume the colon
			const typeToken = this.consume('IDENTIFIER'); // Expecting the tag identifier
			type = typeToken.value; // Store the tag
		}

		if (this.peek().tag === 'OPERATOR' && this.peek().value === '=') {
			this.consume('OPERATOR', '='); // Consume the colon
			defaultValue = this.parseExpression(); // Expecting the tag identifier
		}

		return new Parameter(identifierToken.value, type, defaultValue)
	}

	parseAppliedKeyword() {
		const keyword = this.consume("KEYWORD")
		return new AppliedKeyword(keyword.value, new Identifier(this.consume("IDENTIFIER")))
	}

	parseBlock() {
		// Ensure the current token is INDENT
		this.consume('NEWLINE')
		this.consume('INDENT'); // This should throw an error if not found

		const statements = [];

		while (true) {
			const token = this.peek();

			// Check if we reach a DEDENT token
			if (token.tag === 'DEDENT') {
				this.consume('DEDENT'); // Exit the block
				break;
			}

			// Parse a statement (you can have a function to parse different kinds of statements)
			const statement = this.parseStatement(); // Implement this function based on your language rules
			statements.push(statement);
		}

		return new Block(statements)
	}

	// Parse primary expressions like literals or identifiers
	parsePrimary() {
		const token = this.consume();

		if (applyableKeywords.includes(token.value)) {
			this.current--;
			return this.parseAppliedKeyword();
		}
		if (token.tag === 'NUMBER') {
			return new Literal(Number(token.value), "Number");
		}
		if (token.tag === 'STRING') {
			return new Literal(String(token.value), "String");
		}
		if (token.tag === 'IDENTIFIER') {
			return new Identifier(token.value);
		}

		if (token.value === "type") {
			this.current--
			return parseNewType(this)
		}

		if (token.value === "(") {
			this.current--;
			return this.parseLambda(); // Handle lambda expressions
		}

		if (token.tag === 'NEWLINE' && this.peek().tag === "INDENT") {
			this.current--;
			return this.parseBlock();  // Grouping with parentheses
		}

		if (token.tag === 'PARENS' && token.value === '{') {
			this.current--;
			return this.parseGrouping();  // Grouping with parentheses
		}

		if (token.value === "if") {
			this.current--;
			return this.parseIfStatement();
		}

		this.createError(`Unexpected token: ${token.value}`, token, new Error());
	}

	omit(expectedTag) {
		if (this.peek().tag === expectedTag) {
			this.current++
		}
	}

	consume(expectedtag, expectedValue) {
		const token = this.peek();
		if ((expectedtag && expectedtag !== token.tag) && (expectedValue && token.value !== expectedValue)) {
			throw this.createError(
				`Expected '${expectedValue}', but got '${token.value}'`,
				token,
				new Error()
			);
		}
		this.current++;
		return token;
	}

	expect(expectedtag, expectedValue) {
		const token = this.peek();
		if ((expectedtag && expectedtag !== token.tag) && (expectedValue && token.value !== expectedValue)) {
			throw this.createError(
				`Expected '${expectedValue}', but got '${token.value}'`,
				token,
				new Error()
			);
		}
	}

	peek(at = 0) {
		return this.tokens[this.current + at];
	}

	testPeek(...tags) {
		for (let i = 0; i <= tags.length; i++) {
			if (this.peek(i).tag !== tags[i]) {
				return false;
			}
		}
		return true;
	}

	createError(message, token, e) {
		const position = token.position || { line: 0, column: 0 };
		throw new Error(
			`${message} at line ${token.start.line}, column ${token.start.column}, token = ${token.tag}`, e
		);
	}
}

// Create a parser instance
// const parser = new Parser(tokens);
// try {
// 	const ast = parser.parse();
// 	console.log(JSON.stringify(ast, null, 2));
// } catch (error) {
// 	console.error(error.message);
// }

module.exports = { Parser }