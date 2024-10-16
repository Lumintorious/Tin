const { parseNewType, LambdaType } = require("./typeParser");

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

class Assignment {
	constructor(lhs, value, isDeclaration = true, type) {
		this.tag = 'Assignment'; // tag of the AST node
		this.lhs = lhs;          // Name of the variable
		this.value = value;      // Lambda function associated with the Assignment
		this.type = type
		this.isDeclaration = isDeclaration;
		this.isTypeLevel = lhs.tag === "Identifier" && lhs.value.charAt(0) === lhs.value.charAt(0).toUpperCase()
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
	constructor(params, block, isTypeLambda) {
		this.tag = "Lambda"
		this.params = params
		this.block = block
		this.isTypeLambda = isTypeLambda
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
	constructor(callee, args, isTypeLambda) {
		this.tag = "Apply"
		this.callee = callee
		this.args = args
		this.isTypeLambda = isTypeLambda
	}
}

// Parenthesis-surrounded expression. Eg. ( value )
class Group {
	constructor(value) {
		this.tag = "Group";
		this.value = value;
	}
}

class UnaryOperator {
	constructor(operator, expression) {
		this.tag = "UnaryOperator";
		this.operator = operator;
		this.expression = expression;
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

class Optional {
	constructor(expression) {
		this.tag = "Optional";
		this.expression = expression;
	}
}

class Select {
	constructor(owner, field) {
		this.tag = 'Select';
		this.owner = owner;
		this.field = field;
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
	'=': 0  // Assignment (right-associative)
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
		return this.peek() && this.peek().value === tokenValue;
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
			return this.parseAssignment();
		}

		if (token.tag === "KEYWORD" && token.value === "print") {
			return this.parsePrintStatement();
		}

		if (token.tag === "NEWLINE") {
			this.consume("NEWLINE"); // Ignore newlines
			return null; // Empty statement
		}



		return this.parseExpression();
	}

	parseApply(callee, isTypeLambda) {
		const start = this.consume('PARENS', isTypeLambda ? '[' : '('); // Consume '('
		const args = [];

		// Parse arguments (expressions)
		while (this.peek() && this.peek().value !== (isTypeLambda ? ']' : ')')) {
			this.omit("NEWLINE")
			this.omit("INDENT")
			this.omit("DEDENT")
			args.push(this.parseExpression());
			// If there's a comma, consume it and continue parsing more arguments
			this.omit("NEWLINE")
			this.omit("INDENT")
			this.omit("DEDENT")
			if (this.peek() && this.peek().value === ',') {
				this.consume('OPERATOR', ',');
			}
		}

		const end = this.consume('PARENS', isTypeLambda ? ']' : ')'); // Consume ')'

		return new Apply(callee, args, isTypeLambda).fromTo(start, end);  // Return a function application node
	}


	parseExpression(precedence = 0, stopAtEquals = false) {
		const startPos = this.peek().start;
		let left;  // Parse the left-hand side (like a literal or identifier)

		if (this.peek() && this.peek().value === "...") {
			this.consume("OPERATOR", "...")
			left = this.parsePrimary();
			left = new UnaryOperator("...", left);
		} else {
			left = this.parsePrimary();
		}

		while (this.peek() && this.peek().tag === 'PARENS' && this.peek().value === '[') {

			left = this.parseApply(left, true);
		}

		while (this.peek() && this.peek().tag === 'PARENS' && this.peek().value === '(') {
			left = this.parseApply(left);
		}

		if (this.is("::")) {
			this.consume("::");
			// const type = this.consume("IDENTIFIER");
			const type = this.parseExpression(-1, true);
			left = new Cast(left, type).fromTo(startPos, this.peek().end);
		}

		// Continue parsing if we find a binary operator with the appropriate precedence
		while ((!stopAtEquals || !this.is("=")) && this.peek() && this.isBinaryOperator(this.peek())) {
			const operator = this.peek().value;
			const operatorPrecedence = PRECEDENCE[operator];

			// Only continue if the operator has higher precedence than the current one
			if (operatorPrecedence < precedence) {
				break;
			}

			// Consume the operator
			this.consume('OPERATOR');

			if (operator === "?") {
				left = new Optional(left)
				break
			}

			// Parse the right-hand side with precedence rules (note: higher precedence for right-side)
			const right = this.parseExpression(operatorPrecedence + 1);

			// Combine into a binary expression

			if (operator === "=" && left.tag === "Select") {
				left = new Assignment(left, right, false).fromTo(left.position.start, this.peek().end);
				break;
			}

			if (operator === "=" && left.tag === "Cast" && left.expression.tag === "Identifier") {
				left = new Assignment(left.expression, right, true, left.type).fromTo(left.position.start, this.peek().end);
				break;
			}

			if (operator === "=" && left.tag === "Identifier") {
				left = new Assignment(left, right, true).fromTo(left.position.start, this.peek()?.end ?? '-1');
				break;
			}

			if (operator === ".") {
				left = new Select(left, right)
			} else {
				left = new BinaryExpression(left, operator, right);
			}

		}

		if (this.peek() && this.peek().value === "?") {
			this.consume("OPERATOR")
			left = new Optional(left)
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
			this.consume("OPERATOR", "::");
			const paramtag = this.consume("IDENTIFIER").value;
			params.push({ name: paramName, tag: paramtag });
			if (this.peek().tag === "OPERATOR" && this.peek().value === ",") {
				this.consume("OPERATOR", ",");
			}
		}
		this.consume("OPERATOR", ")");
		return params;
	}

	// If an Identifier or Cast, turn into Assignment with missing value or type
	resolveAsAssignment(param) {
		if (param.tag === "Cast") {
			param = new Assignment(param.expression, undefined, true, param.type).fromTo(param.position.start, this.peek().end)
		}
		if (param.tag === "Identifier") {
			param = new Assignment(param, undefined, true, undefined).fromTo(param.position.start, this.peek().end)
		}
		return param;
	}

	// TypeLamda = lambda that takes types and returns types [T] -> List[T]
	// LambdaType = the type of a lambda that takes values and returns values (T) -> List[T]
	parseLambda(isTypeLambda) {
		// Ensure we have the opening parenthesis for the parameters
		this.consume('PARENS', isTypeLambda ? '[' : '('); // This should throw an error if not found
		let isTypeLevel = false;

		const parameters = [];

		// Parse parameters until we reach the closing parenthesis
		while (this.peek().value !== ")" && this.peek().value !== "]") {
			// Parse each parameter
			// const param = this.parseParameter();
			let param = this.parseExpression();
			param = this.resolveAsAssignment(param);
			param.isDeclaration = false;

			parameters.push(param);

			// Check for a comma to separate parameters
			if (this.peek().tag === 'OPERATOR') {
				this.consume('OPERATOR', ',');
			} else {
				break; // No more parameters, exit the loop
			}
		}

		this.consume('PARENS', isTypeLambda ? ']' : ')'); // Consume the closing parenthesis

		// Now check for the arrow (-> / =>) indicating the function body
		const arrow = this.consume("OPERATOR")
		if (arrow.value === "->") {
			// Value Level
			// Parse the body of the lambda (this could be another expression)
			let body = this.parseExpression(); // You would need a parseExpression function
			if (body.tag !== "Block") {
				body = new Block([body])
			}
			return new Lambda(parameters, body, isTypeLambda)
		} else if (arrow.value === "=>") {
			// Type Level
			let returnType = this.parseExpression(0, true);
			if (returnType.isTypeLevel) {
				this.createError("Expected type-level expression, got " + returnType.tag, arrow)
			}
			return new LambdaType(parameters, returnType)
		} else {
			this.createError("Expected -> or =>", this.peek())
		}


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

	parseString(token) {
		return new Literal(String(token.value), "String");
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
			return this.parseString(token)
		}
		if (token.value === "true" || token.value === "false") {
			return new Literal(token.value, "Boolean")
		}
		if (token.value === "void") {
			return new Literal(token.value, "Void")
		}
		if (token.tag === 'IDENTIFIER') {
			return new Identifier(token.value).fromTo(token, token);
		}

		if (token.value === "type") {
			this.current--
			return parseNewType(this)
		}

		if (token.value === "(") {
			this.current--;
			return this.parseLambda(); // Handle lambda expressions
		}

		if (token.value === "[") {
			this.current--;
			return this.parseLambda(true); // Handle lambda expressions
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

		if (token.value === ")") {
			return new Identifier("WTF")
		}
		this.createError(`Unexpected token: ${token.value}`, token, new Error());
	}

	omit(expectedTag) {
		if (this.peek() && this.peek().tag === expectedTag) {
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
		// console.log("Consumed " + token.value, "Peek: " + this.peek().value, new Error())
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

Object.prototype.fromTo = function (startToken, endToken) {
	this.position = {
		start: startToken,
		end: endToken
	}
	return this;
}

module.exports = { Parser }