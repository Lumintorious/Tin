class Lexer {
	constructor(input) {
		this.input = input;
		this.position = 0;
		this.line = 1;
		this.column = 1;
		this.keywords = ['def', 'let', 'return', 'type', 'if', 'else', 'while', 'for', "mutable", "true", "false", "void"];
		this.operators = ['->', '=>', '&&', '=', '+', '*', '@', '/', '-', ':', ',', '.', '&', '|', '<', '>', '?'];
		this.parens = ['(', '[', '{', '}', ']', ')']
		this.indentStack = [0];  // To track indentation levels
	}

	// Get next token
	nextToken() {
		if (this.position >= this.input.length) return null;

		let char = this.peek();

		if (char === "#") {
			this.consumeComment();
			char = this.peek();
		}

		if (char === '"') return this.lexString();

		// Handle newline and indent/dedent logic
		if (char === '\n') {
			return this.consumeNewline();
		}

		// Handle indentation after a newline
		if (this.column === 1) {
			const indentToken = this.handleIndentation();
			if (indentToken) return indentToken;  // Emit INDENT or DEDENT if needed
		}

		// Skip whitespaces but track line and column numbers
		if (/\s/.test(char)) {
			this.handleWhitespace();
			return this.nextToken();
		}

		// Tokenize numbers
		if (/\d/.test(char)) return this.tokenizeNumber();

		// Tokenize identifiers or keywords
		if (/[a-zA-Z_]/.test(char)) return this.tokenizeIdentifierOrKeyword();

		// Tokenize operators
		for (let op of this.operators) {
			if (this.input.slice(this.position).startsWith(op)) {
				return this.tokenizeOperator(op);
			}
		}

		for (let p of this.parens) {
			if (this.input.slice(this.position).startsWith(p)) {
				return this.tokenizeParens(p);
			}
		}

		throw new Error(`Unknown character at ${this.line}:${this.column}: '${char}'`);
	}

	// Handle newlines and indentation levels
	consumeNewline() {
		this.position++;
		this.line++;
		this.column = 1;
		return {
			tag: 'NEWLINE',
			value: '\n',
			start: { line: this.line - 1, column: this.column },
			end: { line: this.line, column: this.column }
		};
	}

	consumeComment() {
		while (this.peek() !== '\n') {
			this.position++;
			this.column++;
		}
	}

	// Handle indentation and dedentation
	handleIndentation() {
		let indentLength = 0;

		// Count spaces or tabs for indentation
		while (this.peek() === ' ' || this.peek() === '\t') {
			indentLength += (this.peek() === ' ') ? 1 : 4;  // Treat tab as 4 spaces
			this.position++;
			this.column++;
		}

		const previousIndent = this.indentStack[this.indentStack.length - 1];

		if (indentLength > previousIndent) {
			this.indentStack.push(indentLength);
			return {
				tag: 'INDENT',
				value: indentLength,
				start: { line: this.line, column: 1 },
				end: { line: this.line, column: this.column }
			};
		}

		if (indentLength < previousIndent) {
			this.indentStack.pop();
			return {
				tag: 'DEDENT',
				value: indentLength,
				start: { line: this.line, column: 1 },
				end: { line: this.line, column: this.column }
			};
		}

		return null;  // No indentation change
	}

	// Handle whitespaces (ignore them except for indentation)
	handleWhitespace() {
		while (/\s/.test(this.peek()) && this.peek() !== '\n') {
			this.position++;
			this.column++;
		}
	}

	lexString() {
		const startChar = this.peek();  // Either ' or "
		let start = this.position;
		let startColumn = this.column;

		// Move past the opening quote
		this.position++;
		this.column++;

		let stringLiteral = '';

		while (this.position < this.input.length) {
			const char = this.peek();

			// Break on closing quote or escape sequence
			if (char === startChar) {
				this.position++;
				this.column++;
				break;
			}

			// Handle escape characters
			if (char === '\\') {
				this.position++;
				this.column++;
				const nextChar = this.peek();
				if (nextChar === 'n') {
					stringLiteral += '\n';
				} else if (nextChar === 't') {
					stringLiteral += '\t';
				} else if (nextChar === '"' || nextChar === "'") {
					stringLiteral += nextChar; // Add the escaped quote
				} else {
					stringLiteral += nextChar; // Add the character as is
				}
				this.position++;
				this.column++;
				continue;
			}

			stringLiteral += char;
			this.position++;
			this.column++;
		}

		return {
			tag: 'STRING',
			value: stringLiteral,
			start: { line: this.line, column: startColumn },
			end: { line: this.line, column: this.column }
		};
	}

	// Tokenize numbers
	tokenizeNumber() {
		let start = this.position;
		let startColumn = this.column;

		while (/\d/.test(this.peek())) {
			this.position++;
			this.column++;
		}

		const value = this.input.slice(start, this.position);
		return {
			tag: 'NUMBER',
			value,
			start: { line: this.line, column: startColumn },
			end: { line: this.line, column: this.column }
		};
	}

	// Tokenize identifiers or keywords
	tokenizeIdentifierOrKeyword() {
		let start = this.position;
		let startColumn = this.column;

		while (this.peek() !== undefined && /[a-zA-Z_]/.test(this.peek())) {
			this.position++;
			this.column++;
		}

		const value = this.input.slice(start, this.position);
		const tag = this.keywords.includes(value) ? 'KEYWORD' : 'IDENTIFIER';

		return {
			tag,
			value,
			start: { line: this.line, column: startColumn },
			end: { line: this.line, column: this.column }
		};
	}

	// Tokenize operators
	tokenizeOperator(operator) {
		const startColumn = this.column;
		this.position += operator.length;
		this.column += operator.length;
		return {
			tag: 'OPERATOR',
			value: operator,
			start: { line: this.line, column: startColumn },
			end: { line: this.line, column: this.column }
		};
	}

	tokenizeParens(parens) {
		const startColumn = this.column;
		this.position += parens.length;
		this.column += parens.length;
		return {
			tag: 'PARENS',
			value: parens,
			start: { line: this.line, column: startColumn },
			end: { line: this.line, column: this.column }
		};
	}

	// Helper to get the current character
	peek() {
		return this.input[this.position];
	}
}

// // Test case for indent/dedent and newline handling
// const lexer = new Lexer(`def add = (x: Int, y: Int) ->
// 	let z = x + y
// 	print z`);

// let token;
// while ((token = lexer.nextToken()) !== null) {
// 	console.log(token);
// }

module.exports = { Lexer }

