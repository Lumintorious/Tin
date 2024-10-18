import { Token, TokenPos, CodePoint } from "./Lexer";
const applyableKeywords = ["return", "mutable"];
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

export class Assignment extends AstNode {
   lhs: Term;
   value?: Term;
   type: any;
   isDeclaration: boolean;
   isTypeLevel?: boolean;
   constructor(lhs: Term, value?: Term, isDeclaration = true, type = null) {
      super("Assignment"); // tag of the AST node
      this.lhs = lhs; // Name of the variable
      this.value = value; // Lambda function associated with the Assignment
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

export class Lambda extends Term {
   params: Term[];
   block: Block;
   isTypeLambda?: boolean;
   constructor(params: Term[], block: Block, isTypeLambda?: boolean) {
      super("Lambda");
      this.params = params;
      this.block = block;
      this.isTypeLambda = isTypeLambda;
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

   value: String | Number | Boolean;
   type: "String" | "Number" | "Boolean" | "Void";

   constructor(
      value: String | Number | Boolean,
      type: "String" | "Number" | "Boolean" | "Void"
   ) {
      super("Literal"); // tag of the AST node
      this.type = type;
      this.value = value; // Value of the literal (number, string, etc.)
   }
}

// callee(args, args, args)
export class Apply extends Term {
   callee: Term;
   args: Term[];
   isTypeLambda?: boolean;
   constructor(callee: Term, args: Term[], isTypeLambda?: boolean) {
      super("Apply");
      this.callee = callee;
      this.args = args;
      this.isTypeLambda = isTypeLambda;
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
   constructor(expression: Term) {
      super("Optional");
      this.expression = expression;
   }
}

export class Select extends Term {
   owner: Term;
   field: string;
   constructor(owner: Term, field: string) {
      super("Select");
      this.owner = owner;
      this.field = field;
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

const PRECEDENCE: { [_: string]: number } = {
   ".": 100, // Field access
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

   parseStatement(): Statement | null {
      let token = this.peek();

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

   parseApply(callee: Term, isTypeLambda?: boolean) {
      const start = this.consume("PARENS", isTypeLambda ? "[" : "("); // Consume '('
      const args: Term[] = [];

      // Parse arguments (expressions)
      while (this.peek() && this.peek().value !== (isTypeLambda ? "]" : ")")) {
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

      const end = this.consume("PARENS", isTypeLambda ? "]" : ")"); // Consume ')'

      return new Apply(callee, args, isTypeLambda).fromTo(
         start.position,
         end.position
      ); // Return a function application node
   }

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

      if (this.is("::")) {
         this.consume("::");
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

         // Parse the right-hand side with precedence rules (note: higher precedence for right-side)
         const right = this.parseExpression(operatorPrecedence + 1);

         // Combine into a binary expression

         if (operator === "=" && left.tag === "Select") {
            left = new Assignment(left, right, false, null).fromTo(
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
            left = new Assignment(left, right, true, null).fromTo(
               left.position,
               this.peek()?.position ?? new CodePoint(-1, -1, -1)
            );
            break;
         }

         if (operator === "." && right instanceof Identifier) {
            left = new Select(left, right.value);
         } else {
            left = new BinaryExpression(left, operator, right);
         }
      }

      if (this.peek() && this.peek().value === "?") {
         this.consume("OPERATOR");
         left = new Optional(left);
      }

      return left;
   }

   // Check if the next token is a binary operator
   isBinaryOperator(token: Token) {
      return token.tag === "OPERATOR" && PRECEDENCE.hasOwnProperty(token.value);
   }

   // parseParameters() {
   //    const params: Parameter[] = [];
   //    while (this.peek().tag !== "OPERATOR" || this.peek().value !== ")") {
   //       const paramName = this.consume("IDENTIFIER").value;
   //       this.consume("OPERATOR", "::");
   //       const paramtag = this.consume("IDENTIFIER").value;
   //       params.push(new Parameter( paramName, paramtag, null);
   //       if (this.peek().tag === "OPERATOR" && this.peek().value === ",") {
   //          this.consume("OPERATOR", ",");
   //       }
   //    }
   //    this.consume("OPERATOR", ")");
   //    return params;
   // }

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
   // LambdaType = the type of a lambda that takes values and returns values (T) -> List[T]
   parseLambda(isTypeLambda?: boolean): Lambda | LambdaTypeTerm {
      // Ensure we have the opening parenthesis for the parameters
      this.consume("PARENS", isTypeLambda ? "[" : "("); // This should throw an error if not found
      let isTypeLevel = false;

      const parameters: Assignment[] = [];

      // Parse parameters until we reach the closing parenthesis
      while (this.peek().value !== ")" && this.peek().value !== "]") {
         // Parse each parameter
         // const param = this.parseParameter();
         const paramTerm: Term = this.parseExpression();
         const param = this.resolveAsAssignment(paramTerm);
         if (param instanceof Assignment) {
            param.isDeclaration = false;

            parameters.push(param);
         }

         // Check for a comma to separate parameters
         if (this.peek().tag === "OPERATOR") {
            this.consume("OPERATOR", ",");
         } else {
            break; // No more parameters, exit the loop
         }
      }

      this.consume("PARENS", isTypeLambda ? "]" : ")"); // Consume the closing parenthesis

      // Now check for the arrow (-> / =>) indicating the function body
      const arrow = this.consume("OPERATOR");
      if (arrow.value === "->") {
         // Value Level
         // Parse the body of the lambda (this could be another expression)
         let body = this.parseExpression(); // You would need a parseExpression function
         let block: Block;
         if (body instanceof Block) {
            block = body;
         } else {
            block = new Block([body]);
         }
         return new Lambda(parameters, block, isTypeLambda);
      } else if (arrow.value === "=>") {
         // Type Level
         let returnType = this.parseExpression(0, true);
         if (returnType.isTypeLevel) {
            this.createError(
               "Expected type-level expression, got " + returnType.tag,
               arrow
            );
         }
         return new LambdaTypeTerm(parameters, returnType);
      } else {
         return this.createError("Expected -> or =>", this.peek());
      }
   }

   parseIfStatement() {
      this.consume("KEYWORD", "if");
      const condition = this.parseExpression();
      this.consume("KEYWORD", "then");
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

   parseGrouping() {
      this.consume("PARENS", "{"); // Consume '('
      const expr = this.parseExpression();
      this.consume("PARENS", "}"); // Consume ')'
      return new Group(expr);
   }

   parseParameter(): Parameter {
      const identifierToken = this.consume("IDENTIFIER"); // Expecting the identifier
      let type: string | undefined;
      let defaultValue: Term | undefined;

      // Check for type annotation (e.g., : tag)
      if (this.peek().tag === "OPERATOR" && this.peek().value === ":") {
         this.consume("OPERATOR", ":"); // Consume the colon
         const typeToken = this.consume("IDENTIFIER"); // Expecting the tag identifier
         type = typeToken.value; // Store the tag
      }

      if (this.peek().tag === "OPERATOR" && this.peek().value === "=") {
         this.consume("OPERATOR", "="); // Consume the colon
         defaultValue = this.parseExpression(); // Expecting the tag identifier
      }

      return new Parameter(identifierToken.value, type, defaultValue);
   }

   parseAppliedKeyword() {
      const keyword = this.consume("KEYWORD");
      return new AppliedKeyword(
         keyword.value,
         new Identifier(this.consume("IDENTIFIER").value)
      );
   }

   parseBlock() {
      // Ensure the current token is INDENT
      this.consume("NEWLINE");
      this.consume("INDENT"); // This should throw an error if not found

      const statements: Statement[] = [];

      while (true) {
         const token = this.peek();

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

      if (token.value === "(") {
         this.current--;
         return this.parseLambda(); // Handle lambda expressions
      }

      if (token.value === "[") {
         this.current--;
         return this.parseLambda(true); // Handle lambda expressions
      }

      if (token.tag === "NEWLINE" && this.peek().tag === "INDENT") {
         this.current--;
         return this.parseBlock(); // Grouping with parentheses
      }

      if (token.tag === "PARENS" && token.value === "{") {
         this.current--;
         return this.parseGrouping(); // Grouping with parentheses
      }

      if (token.value === "if") {
         this.current--;
         return this.parseIfStatement();
      }

      if (token.value === ")") {
         return new Identifier("WTF");
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
         expectedtag &&
         expectedtag !== token.tag &&
         expectedValue &&
         token.value !== expectedValue
      ) {
         throw this.createError(
            `Expected '${expectedValue}', but got '${token.value}'`,
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
      throw new Error(
         `${message} at line ${token.position.start.line}, column ${token.position.start.column}, token = ${token.tag}`
      );
   }
}

export class TypeDef extends Term {
   fieldDefs: FieldDef[];
   constructor(fieldDefs: FieldDef[]) {
      super("TypeDef");
      this.fieldDefs = fieldDefs;
      this.isTypeLevel = true;
   }
}

export class FieldDef extends AstNode {
   name: string;
   type: Term;
   defaultValue?: Term;
   constructor(name: string, type: Term, defaultValue?: Term) {
      super("FieldDef");
      this.name = name;
      this.type = type;
      this.defaultValue = defaultValue;
      this.isTypeLevel = true;
   }
}

// (Int) => String
export class LambdaTypeTerm extends Term {
   parameterTypes: Term[];
   returnType: Term;
   constructor(parameterTypes: Term[], returnType: Term) {
      super("LambdaType");
      this.parameterTypes = parameterTypes;
      this.returnType = returnType;
      this.isTypeLevel = true;
   }
}

// export function parseLambdaType(parser: Parser) {
//    // Expect the opening parenthesis for parameters
//    parser.expect("(");

//    const params: Term[] = [];

//    // Parse parameters until we hit a closing parenthesis
//    while (parser.peek().tag !== "PARENS" || parser.peek().value !== ")") {
//       const param = parser.parseParameterType();
//       params.push(param);

//       // Check for a comma to separate parameters
//       if (parser.peek().tag === "OPERATOR" && parser.peek().value === ",") {
//          parser.nextToken(); // Consume the comma
//       } else {
//          break; // Exit loop if no more parameters
//       }
//    }

//    parser.expect(")"); // Expect the closing parenthesis

//    // Expect the return type Assignment
//    parser.expect("OPERATOR", "=>"); // Expect '=>'

//    const returnType = parser.parseType(); // Parse the return type

//    return new LambdaTypeTerm(params, returnType);
// }

export function parseNewType(parser: Parser): Term {
   let token: Token = parser.consume("KEYWORD");
   if (token.value !== "type") {
      throw new Error(
         `Expected 'type', but got '${token.value}' at line ${token.position.start.line}, column ${token.position.start.column}`
      );
   }

   // Expect INDENT (start of type block)
   parser.consume("NEWLINE");
   token = parser.consume("INDENT");

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

      if (token.tag === "IDENTIFIER") {
         const fieldName = token.value;
         let ident = parser.consume("IDENTIFIER");

         // Expect a colon followed by the type of the field
         parser.consume("OPERATOR");

         // Expect the type of the field
         let type = parser.consume("IDENTIFIER");

         const fieldType = token.value;
         let defaultValue: Term | undefined = undefined;

         // Check if there is a default value (expect '=' operator)
         if (
            parser.peek() &&
            parser.peek().tag === "OPERATOR" &&
            parser.peek().value === "="
         ) {
            parser.consume("OPERATOR", "=");

            // Expect a literal value for the default
            defaultValue = parser.parseExpression();
         }
         // Add field to the type node
         fieldDefs.push(
            new FieldDef(fieldName, new Identifier(type.value), defaultValue)
         );
      } else {
         throw new Error(
            `Unexpected token: ${token.tag} at line ${token.position.start.line}, column ${token.position.start.column}`
         );
      }
   }

   return new TypeDef(fieldDefs);
}
