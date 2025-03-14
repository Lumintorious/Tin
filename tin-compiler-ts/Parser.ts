import { Token, TokenPos, CodePoint } from "./Lexer";
import { Symbol } from "./Scope";
import { RoundValueToValueLambdaType } from "./Types";
const applyableKeywords = ["return", "mut", "mutable", "set", "make", "import"];
export class AstNode {
   readonly tag: string;
   position?: TokenPos;
   isTypeLevel?: boolean;
   constructor(tag: string) {
      this.tag = tag;
   }

   fromTo(start?: TokenPos, end?: TokenPos) {
      if (start && end) {
         this.position = {
            start: start.start,
            end: end.end,
         };
      }
      return this;
   }
}

// Independent node that can appear in blocks
export class Statement extends AstNode {
   constructor(tag: string) {
      super(tag);
   }
}

export class Import extends Statement {
   path: string;
   constructor(path: string) {
      super("Import");
      this.path = path;
   }
}

export class Assignment extends AstNode {
   lhs: Term;
   value?: Term;
   type?: Term;
   symbol?: Symbol;
   isDeclaration: boolean;
   isMutable: boolean = false;
   isParameter: boolean = false;
   isTypeLevel?: boolean;
   constructor(lhs: Term, value?: Term, isDeclaration = true, type?: Term) {
      super("Assignment"); // tag of the AST node
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

// EXPRESSIONS

// Something that can be evaluated to a VALUE at runtime
export class Term extends Statement {
   constructor(tag: string) {
      super(tag);
   }
}

// export class Tuple extends Term {
// 	constructor() {
//       super("Tuple");
//    }
// }

export class Cast extends Term {
   expression: Term;
   type: any;
   constructor(expression: Term, type: any) {
      super("Cast");
      this.expression = expression;
      this.type = type;
   }
}

export class IfStatement extends Term {
   condition: Term;
   trueBranch: Term;
   falseBranch?: Term;
   constructor(condition: Term, trueBranch: Term, falseBranch?: Term) {
      super("IfStatement");
      this.condition = condition;
      this.trueBranch = trueBranch;
      this.falseBranch = falseBranch;
   }
}

export class WhileLoop extends Term {
   start?: Term;
   condition: Term;
   eachLoop?: Term;
   action: Term;
   constructor(
      start: Term | undefined,
      condition: Term,
      eachLoop: Term | undefined,
      action: Term
   ) {
      super("WhileLoop");
      this.start = start;
      this.condition = condition;
      this.eachLoop = eachLoop;
      this.action = action;
   }
}

// (i: Number) -> i + 1
export class RoundValueToValueLambda extends Term {
   params: Term[];
   block: Block;
   explicitType?: Term;
   isTypeLambda?: boolean;
   type?: RoundValueToValueLambdaType;
   constructor(params: Term[], block: Block, explicitType?: Term) {
      super("RoundValueToValueLambda");
      this.params = params;
      this.block = block;
      this.explicitType = explicitType;
   }

   isFirstParamThis() {
      if (
         this.params[0] instanceof Assignment &&
         this.params[0].lhs instanceof Identifier &&
         this.params[0].lhs.value === "this"
      ) {
         return true;
      }
      return false;
   }
}

// (Number) => String
export class RoundTypeToTypeLambda extends Term {
   parameterTypes: Term[];
   returnType: Term;
   constructor(parameterTypes: Term[], returnType: Term) {
      super("RoundTypeToTypeLambda");
      this.parameterTypes = parameterTypes;
      this.returnType = returnType;
      this.isTypeLevel = true;
   }
}

// [T] -> 1 + 2
export class SquareTypeToValueLambda extends Term {
   parameterTypes: Term[];
   block: Term;
   constructor(parameterTypes: Term[], block: Term) {
      super("SquareTypeToValueLambda");
      this.parameterTypes = parameterTypes;
      this.block = block;
   }
}

// [T] => List[T]
export class SquareTypeToTypeLambda extends Term {
   parameterTypes: Term[];
   returnType: Term;
   constructor(parameterTypes: Term[], returnType: Term) {
      super("SquareTypeToTypeLambda");
      this.parameterTypes = parameterTypes;
      this.returnType = returnType;
      this.isTypeLevel = true;
   }
}

export class Block extends Term {
   statements: Statement[];
   constructor(statements: (Statement | null)[]) {
      super("Block");
      this.statements = statements.filter((s) => s !== null);
   }
}

// 123 | "Hello" | true
export class Literal extends Term {
   static STRING = "String";
   static NUMBER = "Number";
   static BOOLEAN = "Boolean";
   static VOID = "Boolean";
   static ANY = "Any";

   value: String | Number | Boolean;
   type: "String" | "Number" | "Boolean" | "Void" | "Any";

   constructor(
      value: String | Number | Boolean,
      type: "String" | "Number" | "Boolean" | "Void" | "Any"
   ) {
      super("Literal"); // tag of the AST node
      this.type = type;
      this.value = value; // Value of the literal (number, string, etc.)
   }
}

// callee(args, args, args)
export class RoundApply extends Term {
   callee: Term;
   args: [string, Term][];
   takesVarargs?: boolean;
   calledInsteadOfSquare: boolean = false;
   paramOrder: [number, number][] = [];
   isFirstParamThis: boolean = false;
   isAnObjectCopy: boolean = false;
   constructor(callee: Term, args: [string, Term][]) {
      super("RoundApply");
      this.callee = callee;
      this.args = args;
   }
}

export class SquareApply extends Term {
   callee: Term;
   typeArgs: Term[];
   constructor(callee: Term, typeArgs: Term[]) {
      super("SquareApply");
      this.callee = callee;
      this.typeArgs = typeArgs;
   }
}

// Parenthesis-surrounded expression. Eg. ( value + 2 )
export class Group extends Term {
   value: Term;
   constructor(value: Term) {
      super("Group");
      this.value = value;
   }
}

export class UnaryOperator extends Term {
   operator: string;
   expression: Term;
   constructor(operator: string, expression: Term) {
      super("UnaryOperator");
      this.operator = operator;
      this.expression = expression;
   }
}

// Named values. Assigned beforehand in Assignment
export class Identifier extends Term {
   value: string;
   constructor(value: string) {
      super("Identifier"); // tag of the AST node
      this.value = value; // Value of the literal (number, string, etc.)
      // this.isType = value.charAt(0) === value.charAt(0).toUpperCase()
   }
}

export class Parameter extends Term {
   name: string;
   type?: string;
   defaultValue?: Term;
   constructor(name: string, type?: string, defaultValue?: Term) {
      super("Parameter"); // tag of the AST node
      this.name = name; // Name of the parameter
      this.type = type; // tag annotation of the parameter
      this.defaultValue = defaultValue;
   }
}

export class BinaryExpression extends Term {
   left: Term;
   operator: string;
   right: Term;
   constructor(left: Term, operator: string, right: Term) {
      super("BinaryExpression"); // tag of the AST node
      this.left = left; // Name of the parameter
      this.operator = operator;
      this.right = right; // tag annotation of the parameter
   }
}

export class Optional extends Term {
   expression: Term;
   doubleQuestionMark: boolean = false;
   constructor(expression: Term, doubleQuestionMark: boolean = false) {
      super("Optional");
      this.expression = expression;
      this.doubleQuestionMark = doubleQuestionMark;
   }
}

export class Select extends Term {
   owner: Term;
   field: string;
   ownerComponent?: string;
   ammortized: boolean = false; // if its x?.blabla
   constructor(owner: Term, field: string, ammortized: boolean = false) {
      super("Select");
      this.owner = owner;
      this.field = field;
      this.ammortized = ammortized;
   }
}

export class TypeCheck extends Term {
   term: Term;
   type: Term;
   constructor(term: Term, type: Term) {
      super("TypeCheck");
      this.term = term;
      this.type = type;
   }
}

export class AppliedKeyword extends Term {
   keyword: string;
   param: Term;
   constructor(keyword: string, param: Term) {
      super("AppliedKeyword");
      this.keyword = keyword;
      this.param = param;
   }
}

export class Change extends Term {
   lhs: Term;
   value: Term;
   constructor(lhs: Term, value: Term) {
      super("Change");
      this.lhs = lhs;
      this.value = value;
   }
}

export class Make extends Term {
   type: Term;
   constructor(type: Term) {
      super("Make");
      this.type = type;
   }
}

const PRECEDENCE: { [_: string]: number } = {
   "?:": 110, // Walrus
   ".": 100, // Field access
   "?.": 100, // Field access
   "**": 10, // Exponentiation
   "*": 10, // Multiplication
   "/": 10, // Division
   "+": 9, // Addition
   "-": 9, // Subtraction
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
   // (right-associative)
   "!=": 0, // Inequality
   "==": 0, // Equality
   "::": 0, // Type Check
   "=": 0, // Assignment
};

export class Parser {
   tokens: Token[];
   current: number;
   body: Statement[];
   constructor(tokens: Token[]) {
      this.tokens = tokens;
      this.current = 0;
      this.body = [];
   }

   parse(): Block {
      while (this.current < this.tokens.length) {
         const statement = this.parseStatement();
         if (statement) {
            this.body.push(statement);
         }
      }
      return new Block(this.body);
   }

   is(tokenValue: string) {
      return this.peek() && this.peek().value === tokenValue;
   }

   isA(tokentag: string) {
      return this.peek().tag === tokentag;
   }

   parseImportString(): string {
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

   parseStatement(): Statement | null {
      let token = this.peek();

      if (token.tag === "KEYWORD" && token.value === "import") {
         this.consume();
         const path = this.parseImportString();
         return new Import(path as string);
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

   parseApply(callee: Term, isSquare?: boolean) {
      const start = this.consume("PARENS", isSquare ? "[" : "("); // Consume '('
      const args: [string, Term][] = [];

      // Parse arguments (expressions)
      while (true) {
         if (
            this.peek() &&
            this.peek().tag === "PARENS" &&
            this.peek().value === (isSquare ? "]" : ")")
         ) {
            break;
         }
         this.omit("NEWLINE");
         this.omit("INDENT");
         this.omit("DEDENT");
         let paramName = "";
         if (this.peek().tag === "IDENTIFIER" && this.peek(1).value === "=") {
            console.log(this.peek().value);
            paramName = this.consume().value;
            this.consume("OPERATOR", "=");
         }
         const paramValue = this.parseExpression();
         args.push([paramName, paramValue]);
         // If there's a comma, consume it and continue parsing more arguments
         this.omit("NEWLINE");
         this.omit("INDENT");
         this.omit("DEDENT");
         if (
            this.peek() &&
            (this.peek().tag === "NEWLINE" || this.peek().tag === "OPERATOR") &&
            this.peek().value === ","
         ) {
            this.consume("OPERATOR", ",");
         }
      }

      const end = this.consume("PARENS", isSquare ? "]" : ")");

      const result = isSquare
         ? new SquareApply(
              callee,
              args.map(([name, type]) => type)
           )
         : new RoundApply(callee, args);

      return result.fromTo(start.position, end.position); // Return a function application node
   }
   // parseExpression > parsePrimary
   parseExpression(precedence = 0, stopAtEquals = false) {
      const startPos = this.peek().position;
      let left: Term; // Parse the left-hand side (like a literal or identifier)

      if (this.peek() && this.peek().value === "...") {
         this.consume("OPERATOR", "...");
         left = this.parsePrimary();
         left = new UnaryOperator("...", left);
      } else {
         left = this.parsePrimary();
      }

      while (
         this.peek() &&
         this.peek().tag === "PARENS" &&
         this.peek().value === "["
      ) {
         left = this.parseApply(left, true);
      }

      while (
         this.peek() &&
         this.peek().tag === "PARENS" &&
         this.peek().value === "("
      ) {
         left = this.parseApply(left);
      }

      if (this.is(":")) {
         this.consume(":");
         // const type = this.consume("IDENTIFIER");
         const type = this.parseExpression(-1, true);
         left = new Cast(left, type).fromTo(startPos, this.peek().position);
      }

      // Continue parsing if we find a binary operator with the appropriate precedence
      while (
         (!stopAtEquals || !this.is("=")) &&
         this.peek() &&
         this.isBinaryOperator(this.peek())
      ) {
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
            left = new Assignment(left, right, false).fromTo(
               left.position,
               this.peek().position
            );
            break;
         }

         if (
            operator === "=" &&
            left instanceof Cast &&
            left.tag === "Cast" &&
            left.expression.tag === "Identifier"
         ) {
            left = new Assignment(
               left.expression,
               right,
               true,
               left.type
            ).fromTo(left.position, this.peek().position);
            break;
         }

         if (operator === "=" && left.tag === "Identifier") {
            left = new Assignment(left, right, true).fromTo(
               left.position,
               this.peek()?.position ?? new CodePoint(-1, -1, -1)
            );
            break;
         }

         if (operator === "." && right instanceof Identifier) {
            left = new Select(left, right.value);
         } else if (operator === "?." && right instanceof Identifier) {
            left = new Select(left, right.value, true);
         } else if (
            operator === "?." &&
            right instanceof RoundApply &&
            right.callee instanceof Identifier
         ) {
            const select = new Select(left, right.callee.value, true);
            left = new RoundApply(select, right.args);
         } else if (
            operator === "." &&
            right instanceof RoundApply &&
            right.callee instanceof Identifier
         ) {
            const select = new Select(left, right.callee.value);
            left = new RoundApply(select, right.args);
         } else if (
            operator === "." &&
            right instanceof SquareApply &&
            right.callee instanceof Identifier
         ) {
            const select = new Select(left, right.callee.value);
            left = new SquareApply(select, right.typeArgs);
         } else if (
            operator === "?." &&
            right instanceof SquareApply &&
            right.callee instanceof Identifier
         ) {
            const select = new Select(left, right.callee.value, true);
            left = new SquareApply(select, right.typeArgs);
         } else if (operator === "::" && right) {
            const typeCheck = new TypeCheck(left, right);
            left = typeCheck;
         } else {
            left = new BinaryExpression(left, operator, right);
         }
      }

      if (this.peek() && this.peek().value === "?") {
         this.consume("OPERATOR");
         left = new Optional(left);
      } else if (this.peek() && this.peek().value === "??") {
         this.consume("OPERATOR");
         left = new Optional(left, true);
      }

      return left;
   }

   // Check if the next token is a binary operator
   isBinaryOperator(token: Token) {
      return token.tag === "OPERATOR" && PRECEDENCE.hasOwnProperty(token.value);
   }

   // If an Identifier or Cast, turn into Assignment with missing value or type
   resolveAsAssignment(param: Term): Term {
      if (param instanceof Cast) {
         param = new Assignment(
            param.expression,
            undefined,
            true,
            param.type
         ).fromTo(param.position, this.peek().position);
      }
      if (param instanceof Identifier) {
         param = new Assignment(param, undefined, true, undefined).fromTo(
            param.position,
            this.peek().position
         );
      }
      return param;
   }

   // TypeLamda = lambda that takes types and returns types [T] -> List[T]
   // RoundValueToValueLambdaType = the type of a lambda that takes values and returns values (T) -> List[T]
   parseRoundValueToValueLambda(isSquare?: boolean): Term {
      // Ensure we have the opening parenthesis for the parameters
      this.consume("PARENS", isSquare ? "[" : "("); // This should throw an error if not found
      let isTypeLevel = false;

      const parameters: Term[] = [];
      let groupCatch: Term | undefined = undefined;

      // Parse parameters until we reach the closing parenthesis
      while (true) {
         if (
            this.peek().tag === "PARENS" &&
            (this.peek().value === ")" || this.peek().value === "]")
         ) {
            break;
         }
         // Parse each parameter
         // const param = this.parseParameter();
         const paramTerm: Term = this.parseExpression();
         const param = this.resolveAsAssignment(paramTerm);
         if (param instanceof Assignment) {
            param.isDeclaration = false;
            param.isParameter = true;
         } else {
            groupCatch = param;
         }
         parameters.push(param);

         // Check for a comma to separate parameters
         if (
            this.peek().value === "," &&
            (this.peek().tag === "OPERATOR" || this.peek().tag === "NEWLINE")
         ) {
            this.consume();
         } else {
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
      if (
         this.peek().value != "->" &&
         this.peek().value != "=>" &&
         groupCatch !== undefined
      ) {
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
         let block: Block;
         if (body instanceof Block) {
            block = body;
         } else {
            block = new Block([body]);
         }
         if (isSquare) {
            return new SquareTypeToValueLambda(parameters, block);
         } else {
            return new RoundValueToValueLambda(
               parameters,
               block,
               specifiedType
            );
         }
      } else {
         // Type Level
         let returnType = body;
         if (isSquare) {
            return new SquareTypeToTypeLambda(parameters, returnType);
         } else {
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
      } else {
         return new WhileLoop(undefined, firstPart, undefined, action);
      }
   }

   parseIfStatement() {
      this.consume("KEYWORD", "if");
      const condition = this.parseExpression();
      this.consume("OPERATOR", ",");
      const trueBranch = this.parseExpression();
      let falseBranch: Term;
      if (this.is("else")) {
         this.consume("KEYWORD", "else");
         falseBranch = this.parseExpression();
      } else {
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
      if (
         expression instanceof Assignment &&
         expression.value &&
         keyword.value === "set"
      ) {
         return new Change(expression.lhs, expression.value);
      } else if (
         expression instanceof Assignment &&
         expression.value &&
         keyword.value === "mutable"
      ) {
         expression.isMutable = true;
         return expression;
      } else if (keyword.value === "make") {
         return new Make(expression);
      } else if (keyword.value === "return") {
         return expression;
      } else if (expression instanceof Assignment && keyword.value === "mut") {
         expression.isMutable = true;
         return expression;
      } else {
         throw new Error("'change' can only be applied on assignments");
      }
   }

   parseBlock() {
      // Ensure the current token is INDENT
      this.consume("NEWLINE");
      this.consume("INDENT"); // This should throw an error if not found

      const statements: Statement[] = [];

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

   parseString(token: Token): Literal {
      return new Literal(String(token.value), "String");
   }

   // Parse primary expressions like literals or identifiers
   parsePrimary(): Term {
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
         return new Identifier(token.value).fromTo(
            token.position,
            token.position
         );
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

   omit(expectedTag: string) {
      if (this.peek() && this.peek().tag === expectedTag) {
         this.current++;
      }
   }

   consume(expectedtag?: string, expectedValue?: string) {
      const token = this.peek();
      if (
         token === undefined ||
         (expectedtag &&
            expectedtag !== token.tag &&
            expectedValue &&
            token.value !== expectedValue)
      ) {
         throw this.createError(
            `Expected '${expectedValue}', but got '${
               token ? token.value : "undefined"
            }'. Previous token = ` + this.tokens[this.tokens.length - 1].tag,
            token
         );
      }
      this.current++;
      // console.log("Consumed " + token.value, "Peek: " + this.peek().value, new Error())
      return token;
   }

   peek(at = 0) {
      return this.tokens[this.current + at];
   }

   createError(message: string, token: Token): any {
      const position = token.position || { line: 0, column: 0 };
      this.tokens
         .slice(0, this.current)
         .forEach((t) => console.error(t.tag, t.value));
      throw new Error(
         `${message} at line ${token.position.start.line}, column ${token.position.start.column}, token = ${token.tag}`
      );
   }
}

export class TypeDef extends Term {
   fieldDefs: FieldDef[];
   name?: string;
   constructor(fieldDefs: FieldDef[]) {
      super("TypeDef");
      this.fieldDefs = fieldDefs;
      this.isTypeLevel = true;
   }
}

export class DataDef extends Term {
   fieldDefs: FieldDef[];
   constructor(fieldDefs: FieldDef[]) {
      super("TypeDef");
      this.fieldDefs = fieldDefs;
      this.isTypeLevel = true;
   }
}

export class FieldDef extends AstNode {
   name: string;
   type?: Term;
   defaultValue?: Term;
   constructor(name: string, type?: Term, defaultValue?: Term) {
      super("FieldDef");
      this.name = name;
      this.type = type;
      this.defaultValue = defaultValue;
      this.isTypeLevel = true;
   }
}

export function parseNewType(parser: Parser): Term {
   let token: Token = parser.consume("KEYWORD");
   if (token.value !== "type") {
      throw new Error(
         `Expected 'type', but got '${token.value}' at line ${token.position.start.line}, column ${token.position.start.column}`
      );
   }
   const object = parseObject(parser);

   return new TypeDef(object.fieldDefs);
}

export function parseNewData(parser: Parser): Term {
   let token: Token = parser.consume("KEYWORD");
   if (token.value !== "data") {
      throw new Error(
         `Expected 'data', but got '${token.value}' at line ${token.position.start.line}, column ${token.position.start.column}`
      );
   }
   const object = parseObject(parser);

   return new DataDef(object.fieldDefs);
}

export function parseObject(parser: Parser): DataDef {
   if (parser.peek().value != ":") {
      return new DataDef([]);
   }

   let token = parser.consume("OPERATOR", ":");

   // Expect INDENT (start of type block)
   parser.consume("NEWLINE");
   parser.consume("INDENT");

   let fieldDefs: FieldDef[] = [];

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
      } else if (expr instanceof Assignment && expr.lhs instanceof Identifier) {
         fieldDefs.push(new FieldDef(expr.lhs.value, expr.type, expr.value));
      } else {
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
