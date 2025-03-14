"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Lexer = exports.Token = exports.TokenPos = exports.TokenTag = exports.CodePoint = void 0;
class CodePoint {
    constructor(line, column, absolute) {
        this.line = line;
        this.column = column;
        this.absolute = absolute;
    }
}
exports.CodePoint = CodePoint;
var TokenTag;
(function (TokenTag) {
    TokenTag["NUMBER"] = "NUMBER";
    TokenTag["STRING"] = "STRING";
    TokenTag["KEYWORD"] = "KEYWORD";
    TokenTag["OPERATOR"] = "OPERATOR";
    TokenTag["IDENTIFIER"] = "IDENTIFIER";
    TokenTag["PARENS"] = "PARENS";
    TokenTag["MULTIPLE_TOKENS"] = "MULTIPLE_TOKENS";
    TokenTag["INDENT"] = "INDENT";
    TokenTag["DEDENT"] = "DEDENT";
    TokenTag["NEWLINE"] = "NEWLINE";
})(TokenTag || (exports.TokenTag = TokenTag = {}));
class TokenPos {
    constructor(start, end) {
        this.start = start;
        this.end = end;
    }
}
exports.TokenPos = TokenPos;
class Token {
    constructor(tag, value, position) {
        this.tag = tag;
        this.value = value;
        this.position = position;
    }
}
exports.Token = Token;
class MultipleToken extends Token {
    constructor(tokens, position) {
        super(TokenTag.MULTIPLE_TOKENS, "", position);
        this.tokens = tokens;
        this.position = position;
    }
}
class Lexer {
    constructor(input) {
        this.input = input;
        this.position = 0;
        this.line = 1;
        this.column = 1;
        this.keywords = [
            "def",
            "make",
            "let",
            "return",
            "type",
            "data",
            "if",
            "else",
            "while",
            "do",
            "for",
            "true",
            "false",
            "void",
            "set",
            "mut",
            "external",
            "import",
        ];
        this.operators = [
            "...",
            "??",
            "?:",
            "?.",
            "->",
            "=>",
            "&&",
            "::",
            "==",
            "!=",
            ">=",
            "<=",
            "**",
            "=",
            "+",
            "*",
            "@",
            "/",
            "-",
            ":",
            ";",
            ",",
            ".",
            "&",
            "|",
            "<",
            ">",
            "?",
        ];
        this.parens = ["(", "[", "{", "}", "]", ")"];
        this.indentStack = [0]; // To track indentation levels
    }
    lexAllTokens() {
        let tokens = [];
        let token;
        while ((token = this.nextToken()) !== null) {
            tokens.push(token);
        }
        return tokens.flatMap((t) => {
            if (t instanceof MultipleToken) {
                return t.tokens;
            }
            else {
                return [t];
            }
        });
    }
    pruneEmptyLines() {
        let extraIndex = 0;
        let lastNewlinePosition = 0;
        let addedLines = 0;
        while (true) {
            const char = this.peek(extraIndex);
            if (char === undefined) {
                break;
            }
            else if (char === "\n") {
                lastNewlinePosition = extraIndex;
                addedLines++;
            }
            else if (char === "\t" || char === " ") {
            }
            else {
                break;
            }
            extraIndex++;
        }
        this.position += lastNewlinePosition;
        this.line += addedLines;
        this.column = 0;
    }
    // Get next token
    nextToken() {
        if (this.position >= this.input.length)
            return null;
        let char = this.peek();
        if (char === "\n") {
            this.pruneEmptyLines();
        }
        if (char === "#") {
            this.consumeComment();
            char = this.peek();
        }
        if (char === "\n") {
            return this.consumeNewline();
        }
        if (this.column === 1) {
            const indentToken = this.handleIndentation();
            if (indentToken)
                return indentToken;
        }
        if (char === '"')
            return this.lexString();
        // Skip whitespaces but track line and column numbers
        if (/\s/.test(char)) {
            this.handleWhitespace();
            return this.nextToken();
        }
        // Tokenize numbers
        if (/\d/.test(char))
            return this.tokenizeNumber();
        // Tokenize identifiers or keywords
        if (/[a-zA-Z_]/.test(char))
            return this.tokenizeIdentifierOrKeyword();
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
    isEmptyLine() {
        const initialPos = this.position;
        const initialCol = this.column;
        let currentPos = this.position;
        while (currentPos < this.input.length) {
            const char = this.input[currentPos];
            if (char === "\n")
                return true; // Empty line if we reach newline without non-whitespace
            if (!/\s/.test(char))
                return false; // Not an empty line if we encounter any non-whitespace
            currentPos++;
            this.column++;
        }
        this.position = initialPos;
        return false; // End of input reached, so not an empty line
    }
    // Handle newlines and indentation levels
    consumeNewline() {
        this.position++;
        this.line++;
        this.column = 1;
        return new Token(TokenTag.NEWLINE, "\n", new TokenPos(new CodePoint(this.line, 1, this.position), new CodePoint(this.line, this.column, this.position)));
    }
    consumeComment() {
        while (this.peek() !== "\n") {
            this.position++;
            this.column++;
        }
    }
    // Handle indentation and dedentation
    handleIndentation() {
        let indentLength = 0;
        // Count spaces or tabs for indentation
        while (this.peek() === " " || this.peek() === "\t") {
            indentLength += this.peek() === " " ? 1 : 4; // Treat tab as 4 spaces
            this.position++;
            this.column++;
        }
        let previousIndent = this.indentStack[this.indentStack.length - 1];
        if (indentLength > previousIndent) {
            this.indentStack.push(indentLength);
            return new Token(TokenTag.INDENT, String(indentLength), new TokenPos(new CodePoint(this.line, 1, this.position), new CodePoint(this.line, this.column, this.position)));
        }
        // if (indentLength < previousIndent) {
        //    const len = this.indentStack.pop();
        //    console.log(indentLength, len);
        //    return new Token(
        //       TokenTag.DEDENT,
        //       String(len),
        //       new TokenPos(
        //          new CodePoint(this.line, 1, this.position),
        //          new CodePoint(this.line, this.column, this.position)
        //       )
        //    );
        // }
        if (indentLength < previousIndent) {
            const tokens = [];
            while (this.indentStack.length &&
                indentLength < this.indentStack[this.indentStack.length - 1]) {
                const len = this.indentStack.pop();
                tokens.push(new Token(TokenTag.DEDENT, String(len), new TokenPos(new CodePoint(this.line, 1, this.position), new CodePoint(this.line, this.column, this.position))));
            }
            return new MultipleToken(tokens, new TokenPos(new CodePoint(this.line, 1, this.position), new CodePoint(this.line, this.column, this.position)));
        }
        return null; // No indentation change
    }
    // Handle whitespaces (ignore them except for indentation)
    handleWhitespace() {
        while (/\s/.test(this.peek()) && this.peek() !== "\n") {
            this.position++;
            this.column++;
        }
    }
    lexString() {
        const startChar = this.peek(); // Either ' or "
        let start = this.position;
        let startColumn = this.column;
        // Move past the opening quote
        this.position++;
        this.column++;
        let stringLiteral = "";
        let parts = [];
        while (this.position < this.input.length) {
            const char = this.peek();
            // Break on closing quote or escape sequence
            if (char === startChar) {
                this.position++;
                this.column++;
                break;
            }
            if (char === "{") {
                parts.push(new Token(TokenTag.STRING, stringLiteral, new TokenPos(new CodePoint(this.line, startColumn, this.position), new CodePoint(this.line, this.column, this.position))));
                parts.push(new Token(TokenTag.OPERATOR, "+", new TokenPos(new CodePoint(this.line, startColumn, this.position), new CodePoint(this.line, this.column, this.position))));
                stringLiteral = "";
                this.position++;
                this.column++;
                let innerChar = this.peek();
                while (innerChar !== "}") {
                    let innerToken = this.nextToken();
                    if (innerToken != null) {
                        parts.push(innerToken);
                    }
                    else {
                        throw new Error("innerToken was null");
                    }
                    innerChar = this.peek();
                }
                parts.push(new Token(TokenTag.OPERATOR, "+", new TokenPos(new CodePoint(this.line, startColumn, this.position), new CodePoint(this.line, this.column, this.position))));
                this.position++;
                this.column++;
                continue;
            }
            // Handle escape characters
            if (char === "\\") {
                this.position++;
                this.column++;
                const nextChar = this.peek();
                if (nextChar === "n") {
                    stringLiteral += "\n";
                }
                else if (nextChar === "t") {
                    stringLiteral += "\t";
                }
                else if (nextChar === '"' || nextChar === "'") {
                    stringLiteral += nextChar; // Add the escaped quote
                }
                else {
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
        parts.push(new Token(TokenTag.STRING, stringLiteral, new TokenPos(new CodePoint(this.line, startColumn, this.position), new CodePoint(this.line, this.column, this.position))));
        return new MultipleToken(parts, new TokenPos(new CodePoint(this.line, startColumn, this.position), new CodePoint(this.line, this.column, this.position)));
    }
    // Tokenize numbers
    tokenizeNumber() {
        let start = this.position;
        let startColumn = this.column;
        while (/(\d|\.)/.test(this.peek())) {
            this.position++;
            this.column++;
        }
        const value = this.input.slice(start, this.position);
        return new Token(TokenTag.NUMBER, value, new TokenPos(new CodePoint(this.line, startColumn, this.position), new CodePoint(this.line, this.column, this.position)));
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
        const tag = this.keywords.includes(value)
            ? TokenTag.KEYWORD
            : TokenTag.IDENTIFIER;
        return new Token(tag, value, new TokenPos(new CodePoint(this.line, startColumn, this.position), new CodePoint(this.line, this.column, this.position)));
    }
    // Tokenize operators
    tokenizeOperator(operator) {
        const startColumn = this.column;
        this.position += operator.length;
        this.column += operator.length;
        return new Token(TokenTag.OPERATOR, operator, new TokenPos(new CodePoint(this.line, startColumn, this.position), new CodePoint(this.line, this.column, this.position)));
    }
    tokenizeParens(parens) {
        const startColumn = this.column;
        this.position += parens.length;
        this.column += parens.length;
        return new Token(TokenTag.PARENS, parens, new TokenPos(new CodePoint(this.line, startColumn, this.position), new CodePoint(this.line, this.column, this.position)));
    }
    // Helper to get the current character
    peek(i = 0) {
        return this.input[this.position + i];
    }
}
exports.Lexer = Lexer;
