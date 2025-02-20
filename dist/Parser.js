"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FieldDef = exports.DataDef = exports.TypeDef = exports.Parser = exports.Make = exports.Change = exports.AppliedKeyword = exports.TypeCheck = exports.Select = exports.Optional = exports.BinaryExpression = exports.Parameter = exports.Identifier = exports.UnaryOperator = exports.Group = exports.SquareApply = exports.RoundApply = exports.Literal = exports.Block = exports.SquareTypeToTypeLambda = exports.SquareTypeToValueLambda = exports.RoundTypeToTypeLambda = exports.RoundValueToValueLambda = exports.WhileLoop = exports.IfStatement = exports.Cast = exports.Term = exports.Assignment = exports.Import = exports.Statement = exports.AstNode = void 0;
exports.parseNewType = parseNewType;
exports.parseNewData = parseNewData;
exports.parseObject = parseObject;
const Lexer_1 = require("./Lexer");
const applyableKeywords = ["return", "mut", "mutable", "set", "make", "import"];
class AstNode {
    constructor(tag) {
        this.tag = tag;
    }
    fromTo(start, end) {
        if (start && end) {
            this.position = {
                start: start.start,
                end: end.end,
            };
        }
        return this;
    }
}
exports.AstNode = AstNode;
// Independent node that can appear in blocks
class Statement extends AstNode {
    constructor(tag) {
        super(tag);
    }
}
exports.Statement = Statement;
class Import extends Statement {
    constructor(path) {
        super("Import");
        this.path = path;
    }
}
exports.Import = Import;
class Assignment extends AstNode {
    constructor(lhs, value, isDeclaration = true, type) {
        super("Assignment"); // tag of the AST node
        this.isMutable = false;
        this.isParameter = false;
        this.lhs = lhs; // Name of the variable
        this.value = value; // RoundValueToValueLambda function associated with the Assignment
        this.type = type;
        this.isDeclaration = isDeclaration;
        if (lhs instanceof Identifier) {
            this.isTypeLevel =
                lhs.tag === "Identifier" &&
                    lhs.value.charAt(0) === lhs.value.charAt(0).toUpperCase();
        }
    }
}
exports.Assignment = Assignment;
// EXPRESSIONS
// Something that can be evaluated to a VALUE at runtime
class Term extends Statement {
    constructor(tag) {
        super(tag);
    }
}
exports.Term = Term;
// export class Tuple extends Term {
// 	constructor() {
//       super("Tuple");
//    }
// }
class Cast extends Term {
    constructor(expression, type) {
        super("Cast");
        this.expression = expression;
        this.type = type;
    }
}
exports.Cast = Cast;
class IfStatement extends Term {
    constructor(condition, trueBranch, falseBranch) {
        super("IfStatement");
        this.condition = condition;
        this.trueBranch = trueBranch;
        this.falseBranch = falseBranch;
    }
}
exports.IfStatement = IfStatement;
class WhileLoop extends Term {
    constructor(start, condition, eachLoop, action) {
        super("WhileLoop");
        this.start = start;
        this.condition = condition;
        this.eachLoop = eachLoop;
        this.action = action;
    }
}
exports.WhileLoop = WhileLoop;
// (i: Number) -> i + 1
class RoundValueToValueLambda extends Term {
    constructor(params, block, explicitType) {
        super("RoundValueToValueLambda");
        this.params = params;
        this.block = block;
        this.explicitType = explicitType;
    }
}
exports.RoundValueToValueLambda = RoundValueToValueLambda;
// (Number) => String
class RoundTypeToTypeLambda extends Term {
    constructor(parameterTypes, returnType) {
        super("RoundTypeToTypeLambda");
        this.parameterTypes = parameterTypes;
        this.returnType = returnType;
        this.isTypeLevel = true;
    }
}
exports.RoundTypeToTypeLambda = RoundTypeToTypeLambda;
// [T] -> 1 + 2
class SquareTypeToValueLambda extends Term {
    constructor(parameterTypes, block) {
        super("SquareTypeToValueLambda");
        this.parameterTypes = parameterTypes;
        this.block = block;
    }
}
exports.SquareTypeToValueLambda = SquareTypeToValueLambda;
// [T] => List[T]
class SquareTypeToTypeLambda extends Term {
    constructor(parameterTypes, returnType) {
        super("SquareTypeToTypeLambda");
        this.parameterTypes = parameterTypes;
        this.returnType = returnType;
        this.isTypeLevel = true;
    }
}
exports.SquareTypeToTypeLambda = SquareTypeToTypeLambda;
class Block extends Term {
    constructor(statements) {
        super("Block");
        this.statements = statements.filter((s) => s !== null);
    }
}
exports.Block = Block;
// 123 | "Hello" | true
class Literal extends Term {
    constructor(value, type) {
        super("Literal"); // tag of the AST node
        this.type = type;
        this.value = value; // Value of the literal (number, string, etc.)
    }
}
exports.Literal = Literal;
Literal.STRING = "String";
Literal.NUMBER = "Number";
Literal.BOOLEAN = "Boolean";
Literal.VOID = "Boolean";
Literal.ANY = "Any";
// callee(args, args, args)
class RoundApply extends Term {
    constructor(callee, args) {
        super("RoundApply");
        this.calledInsteadOfSquare = false;
        this.callee = callee;
        this.args = args;
    }
}
exports.RoundApply = RoundApply;
class SquareApply extends Term {
    constructor(callee, typeArgs) {
        super("SquareApply");
        this.callee = callee;
        this.typeArgs = typeArgs;
    }
}
exports.SquareApply = SquareApply;
// Parenthesis-surrounded expression. Eg. ( value + 2 )
class Group extends Term {
    constructor(value) {
        super("Group");
        this.value = value;
    }
}
exports.Group = Group;
class UnaryOperator extends Term {
    constructor(operator, expression) {
        super("UnaryOperator");
        this.operator = operator;
        this.expression = expression;
    }
}
exports.UnaryOperator = UnaryOperator;
// Named values. Assigned beforehand in Assignment
class Identifier extends Term {
    constructor(value) {
        super("Identifier"); // tag of the AST node
        this.value = value; // Value of the literal (number, string, etc.)
        // this.isType = value.charAt(0) === value.charAt(0).toUpperCase()
    }
}
exports.Identifier = Identifier;
class Parameter extends Term {
    constructor(name, type, defaultValue) {
        super("Parameter"); // tag of the AST node
        this.name = name; // Name of the parameter
        this.type = type; // tag annotation of the parameter
        this.defaultValue = defaultValue;
    }
}
exports.Parameter = Parameter;
class BinaryExpression extends Term {
    constructor(left, operator, right) {
        super("BinaryExpression"); // tag of the AST node
        this.left = left; // Name of the parameter
        this.operator = operator;
        this.right = right; // tag annotation of the parameter
    }
}
exports.BinaryExpression = BinaryExpression;
class Optional extends Term {
    constructor(expression, doubleQuestionMark = false) {
        super("Optional");
        this.doubleQuestionMark = false;
        this.expression = expression;
        this.doubleQuestionMark = doubleQuestionMark;
    }
}
exports.Optional = Optional;
class Select extends Term {
    constructor(owner, field, ammortized = false) {
        super("Select");
        this.ammortized = false; // if its x?.blabla
        this.owner = owner;
        this.field = field;
        this.ammortized = ammortized;
    }
}
exports.Select = Select;
class TypeCheck extends Term {
    constructor(term, type) {
        super("TypeCheck");
        this.term = term;
        this.type = type;
    }
}
exports.TypeCheck = TypeCheck;
class AppliedKeyword extends Term {
    constructor(keyword, param) {
        super("AppliedKeyword");
        this.keyword = keyword;
        this.param = param;
    }
}
exports.AppliedKeyword = AppliedKeyword;
class Change extends Term {
    constructor(lhs, value) {
        super("Change");
        this.lhs = lhs;
        this.value = value;
    }
}
exports.Change = Change;
class Make extends Term {
    constructor(type) {
        super("Make");
        this.type = type;
    }
}
exports.Make = Make;
const PRECEDENCE = {
    "::": 140, // Type Check
    "?:": 110, // Walrus
    ".": 100, // Field access
    "?.": 100, // Field access
    "**": 10, // Exponentiation
    "*": 10, // Multiplication
    "/": 10, // Division
    "+": 9, // Addition
    "-": 9, // Subtraction
    "==": 8, // Equality
    "!=": 8, // Inequality
    "<": 7, // Less than
    ">": 7, // Greater than
    "<=": 7, // Less than or equal to
    ">=": 7, // Greater than or equal to
    "&&": 6, // Logical AND
    "||": 5, // Logical OR
    "&": 4,
    "|": 3,
    "@": 2,
    // ':': 1,
    "=": 0, // Assignment (right-associative)
};
class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.current = 0;
        this.body = [];
    }
    parse() {
        while (this.current < this.tokens.length) {
            const statement = this.parseStatement();
            if (statement) {
                this.body.push(statement);
            }
        }
        return new Block(this.body);
    }
    is(tokenValue) {
        return this.peek() && this.peek().value === tokenValue;
    }
    isA(tokentag) {
        return this.peek().tag === tokentag;
    }
    parseImportString() {
        let str = "";
        while (this.peek().tag !== "NEWLINE") {
            const token = this.consume();
            if (token.tag === "IDENTIFIER") {
                str += token.value;
                continue;
            }
            if (token.value === "/") {
                str += "/";
                continue;
            }
            throw new Error("Expected import string, but got " + token.tag);
        }
        return str;
    }
    parseStatement() {
        let token = this.peek();
        if (token.tag === "KEYWORD" && token.value === "import") {
            this.consume();
            const path = this.parseImportString();
            return new Import(path);
        }
        if (token.tag === "INDENT" || token.tag === "DEDENT") {
            this.consume("INDENT");
            token = this.peek();
        }
        if (token.tag === "NEWLINE") {
            this.consume("NEWLINE"); // Ignore newlines
            return null; // Empty statement
        }
        return this.parseExpression();
    }
    parseApply(callee, isSquare) {
        const start = this.consume("PARENS", isSquare ? "[" : "("); // Consume '('
        const args = [];
        // Parse arguments (expressions)
        while (this.peek() && this.peek().value !== (isSquare ? "]" : ")")) {
            this.omit("NEWLINE");
            this.omit("INDENT");
            this.omit("DEDENT");
            args.push(this.parseExpression());
            // If there's a comma, consume it and continue parsing more arguments
            this.omit("NEWLINE");
            this.omit("INDENT");
            this.omit("DEDENT");
            if (this.peek() && this.peek().value === ",") {
                this.consume("OPERATOR", ",");
            }
        }
        const end = this.consume("PARENS", isSquare ? "]" : ")");
        const result = isSquare
            ? new SquareApply(callee, args)
            : new RoundApply(callee, args);
        return result.fromTo(start.position, end.position); // Return a function application node
    }
    // parseExpression > parsePrimary
    parseExpression(precedence = 0, stopAtEquals = false) {
        var _a, _b;
        const startPos = this.peek().position;
        let left; // Parse the left-hand side (like a literal or identifier)
        if (this.peek() && this.peek().value === "...") {
            this.consume("OPERATOR", "...");
            left = this.parsePrimary();
            left = new UnaryOperator("...", left);
        }
        else {
            left = this.parsePrimary();
        }
        while (this.peek() &&
            this.peek().tag === "PARENS" &&
            this.peek().value === "[") {
            left = this.parseApply(left, true);
        }
        while (this.peek() &&
            this.peek().tag === "PARENS" &&
            this.peek().value === "(") {
            left = this.parseApply(left);
        }
        if (this.is(":")) {
            this.consume(":");
            // const type = this.consume("IDENTIFIER");
            const type = this.parseExpression(-1, true);
            left = new Cast(left, type).fromTo(startPos, this.peek().position);
        }
        // Continue parsing if we find a binary operator with the appropriate precedence
        while ((!stopAtEquals || !this.is("=")) &&
            this.peek() &&
            this.isBinaryOperator(this.peek())) {
            const operator = this.peek().value;
            const operatorPrecedence = PRECEDENCE[operator];
            // Only continue if the operator has higher precedence than the current one
            if (operatorPrecedence < precedence) {
                break;
            }
            // Consume the operator
            this.consume("OPERATOR");
            if (operator === "?") {
                left = new Optional(left);
                break;
            }
            if (operator === "??") {
                left = new Optional(left, true);
                break;
            }
            let right;
            // if (operator === "&" && this.peek().value === "{") {
            //    right = parseObject(this);
            // } else {
            right = this.parseExpression(operatorPrecedence + 1);
            // }
            // Parse the right-hand side with precedence rules (note: higher precedence for right-side)
            // Combine into a binary expression
            if (operator === "=" && left.tag === "Select") {
                left = new Assignment(left, right, false).fromTo(left.position, this.peek().position);
                break;
            }
            if (operator === "=" &&
                left instanceof Cast &&
                left.tag === "Cast" &&
                left.expression.tag === "Identifier") {
                left = new Assignment(left.expression, right, true, left.type).fromTo(left.position, this.peek().position);
                break;
            }
            if (operator === "=" && left.tag === "Identifier") {
                left = new Assignment(left, right, true).fromTo(left.position, (_b = (_a = this.peek()) === null || _a === void 0 ? void 0 : _a.position) !== null && _b !== void 0 ? _b : new Lexer_1.CodePoint(-1, -1, -1));
                break;
            }
            if (operator === "." && right instanceof Identifier) {
                left = new Select(left, right.value);
            }
            else if (operator === "?." && right instanceof Identifier) {
                left = new Select(left, right.value, true);
            }
            else if (operator === "?." &&
                right instanceof RoundApply &&
                right.callee instanceof Identifier) {
                const select = new Select(left, right.callee.value, true);
                left = new RoundApply(select, right.args);
            }
            else if (operator === "." &&
                right instanceof RoundApply &&
                right.callee instanceof Identifier) {
                const select = new Select(left, right.callee.value);
                left = new RoundApply(select, right.args);
            }
            else if (operator === "." &&
                right instanceof SquareApply &&
                right.callee instanceof Identifier) {
                const select = new Select(left, right.callee.value);
                left = new SquareApply(select, right.typeArgs);
            }
            else if (operator === "?." &&
                right instanceof SquareApply &&
                right.callee instanceof Identifier) {
                const select = new Select(left, right.callee.value, true);
                left = new SquareApply(select, right.typeArgs);
            }
            else if (operator === "::" && right) {
                const typeCheck = new TypeCheck(left, right);
                left = typeCheck;
            }
            else {
                left = new BinaryExpression(left, operator, right);
            }
        }
        if (this.peek() && this.peek().value === "?") {
            this.consume("OPERATOR");
            left = new Optional(left);
        }
        else if (this.peek() && this.peek().value === "??") {
            this.consume("OPERATOR");
            left = new Optional(left, true);
        }
        return left;
    }
    // Check if the next token is a binary operator
    isBinaryOperator(token) {
        return token.tag === "OPERATOR" && PRECEDENCE.hasOwnProperty(token.value);
    }
    // If an Identifier or Cast, turn into Assignment with missing value or type
    resolveAsAssignment(param) {
        if (param instanceof Cast) {
            param = new Assignment(param.expression, undefined, true, param.type).fromTo(param.position, this.peek().position);
        }
        if (param instanceof Identifier) {
            param = new Assignment(param, undefined, true, undefined).fromTo(param.position, this.peek().position);
        }
        return param;
    }
    // TypeLamda = lambda that takes types and returns types [T] -> List[T]
    // RoundValueToValueLambdaType = the type of a lambda that takes values and returns values (T) -> List[T]
    parseRoundValueToValueLambda(isSquare) {
        // Ensure we have the opening parenthesis for the parameters
        this.consume("PARENS", isSquare ? "[" : "("); // This should throw an error if not found
        let isTypeLevel = false;
        const parameters = [];
        let groupCatch = undefined;
        // Parse parameters until we reach the closing parenthesis
        while (this.peek().value !== ")" && this.peek().value !== "]") {
            // Parse each parameter
            // const param = this.parseParameter();
            const paramTerm = this.parseExpression();
            const param = this.resolveAsAssignment(paramTerm);
            if (param instanceof Assignment) {
                param.isDeclaration = false;
                param.isParameter = true;
            }
            else {
                groupCatch = param;
            }
            parameters.push(param);
            // Check for a comma to separate parameters
            if (this.peek().tag === "OPERATOR") {
                this.consume("OPERATOR", ",");
            }
            else {
                break; // No more parameters, exit the loop
            }
        }
        this.consume("PARENS", isSquare ? "]" : ")"); // Consume the closing parenthesis
        // Now check for the arrow (-> / =>) indicating the function body
        let specifiedType;
        if (this.peek().value === ":") {
            this.consume("OPERATOR", ":");
            specifiedType = this.parseExpression();
        }
        if (this.peek().value != "->" &&
            this.peek().value != "=>" &&
            groupCatch !== undefined) {
            this.omit("NEWLINE");
            return new Group(groupCatch);
        }
        let arrow = this.consume("OPERATOR");
        let body = this.parseExpression(undefined, true);
        const givesType = body.isTypeLevel || arrow.value === "=>"; // arrow.value === "=>";
        if (!givesType) {
            // Value Level
            // Parse the body of the lambda (this could be another expression)
            // You would need a parseExpression function
            let block;
            if (body instanceof Block) {
                block = body;
            }
            else {
                block = new Block([body]);
            }
            if (isSquare) {
                return new SquareTypeToValueLambda(parameters, block);
            }
            else {
                return new RoundValueToValueLambda(parameters, block, specifiedType);
            }
        }
        else {
            // Type Level
            let returnType = body;
            if (isSquare) {
                return new SquareTypeToTypeLambda(parameters, returnType);
            }
            else {
                return new RoundTypeToTypeLambda(parameters, returnType);
            }
        }
    }
    parseWhileLoop() {
        this.consume("KEYWORD", "while");
        const firstPart = this.parseExpression();
        let secondPart = undefined;
        let thirdPart = undefined;
        if (this.is(";")) {
            this.consume("OPERATOR", ";");
            secondPart = this.parseExpression();
            this.consume("OPERATOR", ";");
            thirdPart = this.parseExpression();
        }
        this.consume("KEYWORD", "do");
        const action = this.parseExpression();
        if (secondPart !== undefined && thirdPart !== undefined) {
            return new WhileLoop(firstPart, secondPart, thirdPart, action);
        }
        else {
            return new WhileLoop(undefined, firstPart, undefined, action);
        }
    }
    parseIfStatement() {
        this.consume("KEYWORD", "if");
        const condition = this.parseExpression();
        this.consume("OPERATOR", ",");
        const trueBranch = this.parseExpression();
        let falseBranch;
        if (this.is("else")) {
            this.consume("KEYWORD", "else");
            falseBranch = this.parseExpression();
        }
        else {
            falseBranch = new Literal("null", "Void");
        }
        return new IfStatement(condition, trueBranch, falseBranch);
    }
    // parseGrouping() {
    //    this.consume("PARENS", "{"); // Consume '('
    //    const expr = this.parseExpression();
    //    this.consume("PARENS", "}"); // Consume ')'
    //    return new Group(expr);
    // }
    parseAppliedKeyword() {
        const keyword = this.consume("KEYWORD");
        const expression = this.parseExpression();
        if (expression instanceof Assignment &&
            expression.value &&
            keyword.value === "set") {
            return new Change(expression.lhs, expression.value);
        }
        else if (expression instanceof Assignment &&
            expression.value &&
            keyword.value === "mutable") {
            expression.isMutable = true;
            return expression;
        }
        else if (keyword.value === "make") {
            return new Make(expression);
        }
        else if (keyword.value === "return") {
            return expression;
        }
        else if (expression instanceof Assignment && keyword.value === "mut") {
            expression.isMutable = true;
            return expression;
        }
        else {
            throw new Error("'change' can only be applied on assignments");
        }
    }
    parseBlock() {
        // Ensure the current token is INDENT
        this.consume("NEWLINE");
        this.consume("INDENT"); // This should throw an error if not found
        const statements = [];
        while (true) {
            const token = this.peek();
            if (token === undefined) {
                break;
            }
            // Check if we reach a DEDENT token
            if (token.tag === "DEDENT") {
                this.consume("DEDENT"); // Exit the block
                break;
            }
            // Parse a statement (you can have a function to parse different kinds of statements)
            const statement = this.parseStatement(); // Implement this function based on your language rules
            if (statement) {
                statements.push(statement);
            }
        }
        return new Block(statements);
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
        if (token.tag === "NUMBER") {
            return new Literal(Number(token.value), "Number");
        }
        if (token.tag === "STRING") {
            return this.parseString(token);
        }
        if (token.value === "external") {
            return new Literal("", "Any");
        }
        if (token.value === "true" || token.value === "false") {
            return new Literal(token.value, "Boolean");
        }
        if (token.value === "void") {
            return new Literal(token.value, "Void");
        }
        if (token.tag === "IDENTIFIER") {
            return new Identifier(token.value).fromTo(token.position, token.position);
        }
        if (token.value === "type") {
            this.current--;
            return parseNewType(this);
        }
        if (token.value === "data") {
            this.current--;
            return parseNewData(this);
        }
        if (token.value === "(") {
            this.current--;
            return this.parseRoundValueToValueLambda(); // Handle lambda expressions
        }
        if (token.value === "[") {
            this.current--;
            return this.parseRoundValueToValueLambda(true); // Handle lambda expressions
        }
        if (token.tag === "NEWLINE" && this.peek().tag === "INDENT") {
            this.current--;
            return this.parseBlock(); // Grouping with parentheses
        }
        // if (token.tag === "PARENS" && token.value === "{") {
        //    this.current--;
        //    return this.parseGrouping(); // Grouping with parentheses
        // }
        if (token.value === "while") {
            this.current--;
            return this.parseWhileLoop();
        }
        if (token.value === "if") {
            this.current--;
            return this.parseIfStatement();
        }
        return this.createError(`Unexpected token: ${token.value}`, token);
    }
    omit(expectedTag) {
        if (this.peek() && this.peek().tag === expectedTag) {
            this.current++;
        }
    }
    consume(expectedtag, expectedValue) {
        const token = this.peek();
        if (token === undefined ||
            (expectedtag &&
                expectedtag !== token.tag &&
                expectedValue &&
                token.value !== expectedValue)) {
            throw this.createError(`Expected '${expectedValue}', but got '${token ? token.value : "undefined"}'`, token);
        }
        this.current++;
        // console.log("Consumed " + token.value, "Peek: " + this.peek().value, new Error())
        return token;
    }
    peek(at = 0) {
        return this.tokens[this.current + at];
    }
    createError(message, token) {
        const position = token.position || { line: 0, column: 0 };
        throw new Error(`${message} at line ${token.position.start.line}, column ${token.position.start.column}, token = ${token.tag}`);
    }
}
exports.Parser = Parser;
class TypeDef extends Term {
    constructor(fieldDefs) {
        super("TypeDef");
        this.fieldDefs = fieldDefs;
        this.isTypeLevel = true;
    }
}
exports.TypeDef = TypeDef;
class DataDef extends Term {
    constructor(fieldDefs) {
        super("TypeDef");
        this.fieldDefs = fieldDefs;
        this.isTypeLevel = true;
    }
}
exports.DataDef = DataDef;
class FieldDef extends AstNode {
    constructor(name, type, defaultValue) {
        super("FieldDef");
        this.name = name;
        this.type = type;
        this.defaultValue = defaultValue;
        this.isTypeLevel = true;
    }
}
exports.FieldDef = FieldDef;
function parseNewType(parser) {
    let token = parser.consume("KEYWORD");
    if (token.value !== "type") {
        throw new Error(`Expected 'type', but got '${token.value}' at line ${token.position.start.line}, column ${token.position.start.column}`);
    }
    const object = parseObject(parser);
    return new TypeDef(object.fieldDefs);
}
function parseNewData(parser) {
    let token = parser.consume("KEYWORD");
    if (token.value !== "data") {
        throw new Error(`Expected 'data', but got '${token.value}' at line ${token.position.start.line}, column ${token.position.start.column}`);
    }
    const object = parseObject(parser);
    return new DataDef(object.fieldDefs);
}
function parseObject(parser) {
    if (parser.peek().value != ":") {
        return new DataDef([]);
    }
    let token = parser.consume("OPERATOR", ":");
    // Expect INDENT (start of type block)
    parser.consume("NEWLINE");
    parser.consume("INDENT");
    let fieldDefs = [];
    // Parse fields inside the type block
    while (true) {
        token = parser.peek();
        if (token === undefined) {
            break;
        }
        if (token.tag === "DEDENT") {
            parser.consume("DEDENT");
            break; // End of type Assignment block
        }
        // if (token.tag === "IDENTIFIER") {
        const expr = parser.parseExpression();
        if (expr instanceof Cast && expr.expression instanceof Identifier) {
            fieldDefs.push(new FieldDef(expr.expression.value, expr.type));
        }
        else if (expr instanceof Assignment && expr.lhs instanceof Identifier) {
            fieldDefs.push(new FieldDef(expr.lhs.value, expr.type, expr.value));
        }
        else {
            console.log(expr);
            throw new Error("Malformed syntax at new object");
        }
        parser.omit("NEWLINE");
        // } else {
        //    throw new Error(
        //       `Unexpected token: ${token.tag} at line ${token.position.start.line}, column ${token.position.start.column}`
        //    );
        // }
    }
    // parser.consume("PARENS", "}");
    return new DataDef(fieldDefs);
}
