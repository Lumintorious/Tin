const JsSymbol = Symbol;
import { Token, TokenPos, CodePoint } from "./Lexer";
import { Symbol } from "./Scope";
import { RoundValueToValueLambdaType, Type } from "./Types";
const applyableKeywords = [
   "return",
   "set",
   "import",
   "unchecked",
   "link",
   "private",
];

class Modifier<T = undefined> {
   readonly value: T;
   constructor(value: T = undefined as any) {
      this.value = value;
   }
}

export const IN_RETURN_BRANCH = new Modifier();
export const VAR_RETURNING_FUNC_IN_INVAR_PLACE = new Modifier();
export const INVAR_RETURNING_FUNC_IN_VAR_PLACE = new Modifier();

export class AstNode {
   static toCheckForPosition: AstNode[] = [];
   static currentNumber = 0;
   readonly tag: string;
   position?: TokenPos;
   isTypeLevel?: boolean;
   isInValueContext?: boolean;
   id: number = AstNode.currentNumber++;
   modifiers = new Set<Modifier>();
   constructor(tag: string) {
      this.tag = tag;
      AstNode.toCheckForPosition.push(this);
   }

   is(modifier: Modifier) {
      return this.modifiers.has(modifier);
   }

   modify(modifier: Modifier) {
      this.modifiers.add(modifier);
   }

   modifyFrom(other: AstNode, modifier: Modifier) {
      if (other.modifiers.has(modifier)) {
         this.modifiers.add(modifier);
      } else {
         this.modifiers.delete(modifier);
      }
   }

   show() {
      return this.tag.toLowerCase();
   }

   showCode() {
      return "";
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
   isLink?: boolean;
   private?: boolean;
   constructor(lhs: Term, value?: Term, isDeclaration = true, type?: Term) {
      super("Assignment"); // tag of the AST node
      this.lhs = lhs; // Name of the variable
      this.value = value; // RoundValueToValueLambda function associated with the Assignment
      this.type = type;
      this.isDeclaration = isDeclaration;
      if (lhs instanceof Identifier) {
         this.isTypeLevel =
            lhs.tag === "Identifier" &&
            lhs.value.charAt(0) === lhs.value.charAt(0).toUpperCase() &&
            !lhs.value.includes("@");
      }
   }

   mutable(mutable: boolean) {
      this.isMutable = mutable;
      return this;
   }

   showCode(): string {
      return `${this.lhs} = ${this.value}`;
   }
}

// EXPRESSIONS

// Something that can be evaluated to a VALUE at runtime
export class Term extends Statement {
   inferredType?: Type;
   translatedType?: Type;
   varTypeInInvarPlace?: boolean = false;
   invarTypeInVarPlace?: boolean = false;
   capturedName?: string;
   clojure?: Symbol[];
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

export class Tuple extends Term {
   expressions: Term[];
   constructor(expressions: Term[]) {
      super("Tuple");
      this.expressions = expressions;
   }
}

export class IfStatement extends Term {
   condition: Term;
   trueBranch: Term;
   falseBranch?: Term;
   constructor(condition: Term, trueBranch: Term, falseBranch?: Term) {
      super("IfStatement");
      this.condition = condition;
      this.trueBranch =
         trueBranch instanceof Block ? trueBranch : new Block([trueBranch]);
      this.falseBranch =
         falseBranch instanceof Block
            ? falseBranch
            : falseBranch
            ? new Block([falseBranch])
            : undefined;
   }
}

export class WhileLoop extends Statement {
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
   specifiedType?: Term;
   isTypeLambda?: boolean;
   type?: RoundValueToValueLambdaType;
   name?: string;
   pure: boolean = true;
   capturesMutableValues: boolean = false;
   constructor(
      params: Term[],
      block: Block,
      specifiedType?: Term,
      pure: boolean = true,
      capturesMutableValues: boolean = false
   ) {
      super("RoundValueToValueLambda");
      this.params = params;
      this.block = block;
      this.specifiedType = specifiedType;
      this.pure = pure;
      this.capturesMutableValues = capturesMutableValues;
   }

   isFirstParamThis() {
      if (
         this.params[0] instanceof Assignment &&
         this.params[0].lhs instanceof Identifier &&
         this.params[0].lhs.value === "self"
      ) {
         return true;
      }
      return false;
   }

   show(): string {
      return this.name ?? "anon";
   }

   showCode(): string {
      return `(${this.params.map((p) => p.toString()).join(", ")}) -> \n ${
         this.block
      }`;
   }
}

// [T] -> 1 + 2
export class SquareTypeToValueLambda extends Term {
   parameterTypes: Term[];
   block: Term;
   pure: boolean;
   capturesMutableValues: boolean = false;
   constructor(
      parameterTypes: Term[],
      block: Term,
      pure: boolean,
      capturesMutableValues: boolean = false
   ) {
      super("SquareTypeToValueLambda");
      this.parameterTypes = parameterTypes;
      this.block = block;
      this.pure = pure;
      this.capturesMutableValues = capturesMutableValues;
   }
}

// [T] => List[T]
export class SquareTypeToTypeLambda extends Term {
   parameterTypes: Term[];
   returnType: Term;
   name?: string;
   constructor(parameterTypes: Term[], returnType: Term) {
      super("SquareTypeToTypeLambda");
      this.parameterTypes = parameterTypes;
      this.returnType = returnType;
      this.isTypeLevel = true;
   }
}

export class Block extends Term {
   statements: Statement[];
   skipReturn: boolean = false;
   constructor(statements: (Statement | null)[], skipReturn: boolean = false) {
      super("Block");
      this.statements = statements.filter((s) => s !== null);
      this.skipReturn = skipReturn;
   }
}

// 123 | "Hello" | true
export class Literal extends Term {
   static STRING = "String";
   static NUMBER = "Number";
   static BOOLEAN = "Boolean";
   static VOID = "Boolean";
   static ANY = "Anything";

   value: String | Number | Boolean;
   type: "String" | "Number" | "Boolean" | "Void" | "Anything";
   isTypeLiteral: boolean = false;

   constructor(
      value: String | Number | Boolean,
      type: "String" | "Number" | "Boolean" | "Void" | "Anything"
   ) {
      super("Literal"); // tag of the AST node
      this.type = type;
      this.value = value; // Value of the literal (number, string, etc.)
   }
}

export class GenericTypeMap {
   private map: Map<string, Type> = new Map();
   private order: [string, Type][] = [];

   set(key: string, value: Type) {
      this.map.set(key, value);
      this.order.push([key, value]);
   }

   get(key: string) {
      return this.map.get(key);
   }

   at(i: number) {
      return this.order[i];
   }
}

export interface PotentialTypeArgs {
   getTypeArgs(): GenericTypeMap | undefined;
   initTypeArgs(map: GenericTypeMap): void;
}

// callee(args, args, args)
export class RoundApply extends Term implements PotentialTypeArgs {
   callee: Term;
   args: [string, Term][];
   takesVarargs?: boolean;
   calledInsteadOfSquare: boolean = false;
   paramOrder: [number, number][] = [];
   isFirstParamThis: boolean = false;
   isAnObjectCopy: boolean = false;
   autoFilledSquareParams?: Type[];
   isCallingAConstructor: boolean = false;
   bakedInThis?: Term;
   callsPure?: boolean = true;
   autoFilledSquareTypeParams?: GenericTypeMap;
   constructor(callee: Term, args: [string, Term][]) {
      super("RoundApply");
      this.callee = callee;
      this.args = args;
   }

   getTypeArgs(): GenericTypeMap | undefined {
      return this.autoFilledSquareTypeParams;
   }

   initTypeArgs(map: GenericTypeMap): void {
      this.autoFilledSquareTypeParams = map;
   }
}

export class SquareApply extends Term {
   callee: Term;
   typeArgs: Term[];
   isCallingAConstructor: boolean = false;
   bakedInThis?: Term;
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
   isFromSelfClojure?: boolean;
   constructor(value: string) {
      super("Identifier"); // tag of the AST node
      this.value = value; // Value of the literal (number, string, etc.)
      // this.isType = value.charAt(0) === value.charAt(0).toUpperCase()
   }

   show() {
      return this.value;
   }

   isTypeIdentifier() {
      const parts = this.value.split(/(@|\.)/g);
      const lastPart = parts[parts.length - 1];

      return lastPart.charAt(0) === lastPart.charAt(0).toUpperCase();
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
   unionOwnerComponents?: string[];
   ammortized: boolean = false; // if it's x?.blabla
   isDeclaration: boolean = false; // if it's bla.bla = 5 (not set bla.bla = 5)
   isBeingTreatedAsIdentifier: boolean = false;
   constructor(owner: Term, field: string, ammortized: boolean = false) {
      super("Select");
      this.owner = owner;
      this.field = field;
      this.ammortized = ammortized;
   }

   nameAsSelectOfIdentifiers(): string | undefined {
      let term: Term = this.owner;
      let path = this.field;
      while (term instanceof Select) {
         path = term.field + "." + path;
         term = term.owner;
      }
      if (term instanceof Identifier) {
         path = term.value + "." + path;
      } else {
         return undefined;
      }

      return path;
   }

   show() {
      return this.owner.show() + (this.ammortized ? "?." : ".") + this.field;
   }
}

export class TypeCheck extends Term {
   term: Term;
   type: Term;
   negative: boolean = false;
   constructor(term: Term, type: Term, negative: boolean = false) {
      super("TypeCheck");
      this.term = term;
      this.type = type;
      this.negative = negative;
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

export class ExternalCodeSplice extends Statement {
   contents: string;
   constructor(contents: string) {
      super("ExternalCodeSplice");
      this.contents = contents;
   }
}

const PRECEDENCE: { [_: string]: number } = {
   "?:": 110, // Walrus
   ".": 100, // Field access
   "?.": 100, // Field access
   "**": 50, // Exponentiation
   "*": 40, // Multiplication
   "/": 40, // Division
   "%": 40, // Division
   "+": 30, // Addition
   "-": 30, // Subtraction
   "<": 20, // Less than
   ">": 20, // Greater than
   "<=": 20, // Less than or equal to
   ">=": 20, // Greater than or equal to
   "!=": 18, // Inequality
   "==": 18, // Equality
   "::": 18, // Type Check
   "!:": 18, // Type Check
   "&&": 15, // Logical AND
   "||": 14, // Logical OR
   "&": 13,
   "|": 12,
   ":": 5,
   // (right-associative)
   copy: 1,
   where: 1,
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
      const startPos = this.positionNow();
      while (this.current < this.tokens.length) {
         const statement = this.parseStatement();
         if (statement) {
            this.body.push(statement);
         }
      }
      const endPos = this.positionNow();
      return new Block(this.body).fromTo(startPos, endPos);
   }

   positionNow() {
      return this.tokens[this.current]?.position || { start: 0, end: 0 };
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
      const startPos = this.positionNow();
      if (token.tag === "KEYWORD" && token.value === "import") {
         this.consume();
         const path = this.parseImportString();
         return new Import(path as string).fromTo(startPos, this.positionNow());
      }

      if (token.tag === "INDENT" || token.tag === "DEDENT") {
         this.consume("INDENT");
         token = this.peek();
      }

      if (!token || token.tag === "NEWLINE") {
         token && this.consume("NEWLINE"); // Ignore newlines
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
            this.consume();
         }
      }

      const end = this.consume("PARENS", isSquare ? "]" : ")");

      let result: Term = isSquare
         ? new SquareApply(
              callee,
              args.map(([name, type]) => type)
           )
         : new RoundApply(callee, args);
      if (callee instanceof UnaryOperator) {
         result = new UnaryOperator(callee.operator, result);
         (result as any).expression.callee = callee.expression;
      }

      return result.fromTo(start.position, end.position); // Return a function application node
   }

   isOnNewLine = false;
   parseExpression(
      precedence = 0,
      stopAtEquals = false,
      stopAtDot = false,
      stopAtArrow = false
   ) {
      const startPos = this.positionNow();
      const result = this.parseExpressionRaw(
         precedence,
         stopAtEquals,
         stopAtDot,
         stopAtArrow
      );
      const endPos = this.positionNow();
      return result.fromTo(startPos, endPos);
   }

   // parseExpression > parsePrimary
   parseExpressionRaw(
      precedence = 0,
      stopAtEquals = false,
      stopAtDot = false,
      stopAtArrow = false
   ) {
      const startPos = this.peek().position;
      let left: Term; // Parse the left-hand side (like a literal or identifier)

      if (this.peek() && this.peek().value === "!") {
         this.consume("OPERATOR", "!");
         left = this.parsePrimary();
         left = new UnaryOperator("!", left);
      } else if (this.peek() && this.peek().value === "-") {
         this.consume("OPERATOR", "-");
         left = this.parsePrimary();
         left = new UnaryOperator("-", left);
      } else if (this.peek() && this.peek().value === "var") {
         this.consume("OPERATOR", "var");
         left = this.parseExpression(precedence, true, false, true);
         left = new UnaryOperator("var", left);
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
         const type = this.parseExpression(-1, true, true);
         left = new Cast(left, type).fromTo(startPos, this.peek().position);
      }

      // Continue parsing if we find a binary operator with the appropriate precedence
      const whileLoopStart = this.positionNow();
      while (
         (!stopAtEquals || !this.is("=")) &&
         (!stopAtEquals || !this.is("~=")) &&
         (!stopAtDot || !this.is(".")) &&
         (!stopAtArrow || !this.is("->")) &&
         (!stopAtArrow || !this.is("~>")) &&
         this.peek()
         // this.peek().tag === "NEWLINE" ||
         // !this.peek(1) ||
         // this.peek(1).tag === "INDENT" ||
         // this.peek(1).tag === "DEDENT")
      ) {
         const operator = this.peek().value;
         if (this.peek().tag !== "OPERATOR") {
            break;
         }
         if (operator === "where") {
            this.consume("OPERATOR", ":");
         }
         if (this.peek()?.tag === "NEWLINE" && this.peek().value === "\n") {
            this.consume("NEWLINE");
            if (this.peek()?.tag === "INDENT") {
               this.consume("INDENT");
            } else if (this.peek()?.tag === "DEDENT") {
               break; // Stop processing if dedented (expression ends)
            }
         }
         if (!this.peek() || !this.isBinaryOperator(this.peek())) {
            break;
         }
         const operatorPrecedence = PRECEDENCE[operator];
         const thisLoopStart = this.positionNow();
         left = left.fromTo(whileLoopStart, thisLoopStart);

         // Only continue if the operator has higher precedence than the current one
         if (operatorPrecedence < precedence) {
            break;
         }

         // Consume the operator
         this.consume("OPERATOR");

         if (operator === "?") {
            const optional = new Optional(left);
            // (~X)?
            if (optional.expression instanceof UnaryOperator) {
               const unary = new UnaryOperator(
                  optional.expression.operator,
                  optional.expression.expression
               );
               // ~(X)
               unary.expression = new Optional(unary.expression);
               // optional.expression = optional.expression.expression;
               left = unary;
            } else {
               left = optional;
            }
            break;
         }

         let right;
         if (this.is("NEWLINE")) {
            this.consume("NEWLINE");
            this.consume("INDENT");
         }

         right = this.parseExpression(operatorPrecedence + 1);

         // Parse the right-hand side with precedence rules (note: higher precedence for right-side)

         // Combine into a binary expression

         if ((operator === "=" || operator === "~=") && left.tag === "Select") {
            left = new Assignment(left, right, false)
               .mutable(operator === "~=")
               .fromTo(left.position, this.peek()?.position);
            break;
         }

         if (
            (operator === "=" || operator === "~=") &&
            left instanceof Cast &&
            left.tag === "Cast" &&
            (left.expression.tag === "Identifier" ||
               left.expression.tag === "Select")
         ) {
            left = new Assignment(left.expression, right, true, left.type)
               .mutable(operator === "~=")
               .fromTo(left.position, this.peek()?.position);
            break;
         }

         if (
            (operator === "=" || operator === "~=") &&
            left.tag === "Identifier"
         ) {
            left = new Assignment(left, right, true)
               .mutable(operator === "~=")
               .fromTo(
                  left.position,
                  this.peek()?.position ?? new CodePoint(-1, -1, -1)
               );
            break;
         }
         if (
            operator === "." &&
            left instanceof UnaryOperator &&
            right instanceof Identifier
         ) {
            left = new UnaryOperator(
               left.operator,
               new Select(left.expression, right.value)
            );
         } else if (operator === "." && right instanceof Identifier) {
            left = new Select(left, right.value).fromTo(
               whileLoopStart,
               this.positionNow()
            );
         } else if (operator === "?." && right instanceof Identifier) {
            left = new Select(left, right.value, true).fromTo(
               whileLoopStart,
               this.positionNow()
            );
         } else if (
            operator === "?." &&
            right instanceof RoundApply &&
            right.callee instanceof Identifier
         ) {
            const select = new Select(left, right.callee.value, true).fromTo(
               whileLoopStart,
               this.positionNow()
            );
            left = new RoundApply(select, right.args);
         } else if (
            operator === "." &&
            right instanceof RoundApply &&
            right.callee instanceof Identifier
         ) {
            const select = new Select(left, right.callee.value).fromTo(
               whileLoopStart,
               this.positionNow()
            );
            left = new RoundApply(select, right.args);
         } else if (
            operator === "." &&
            right instanceof RoundApply &&
            right.callee instanceof SquareApply &&
            right.callee.callee instanceof Identifier
         ) {
            const select = new Select(left, right.callee.callee.value).fromTo(
               whileLoopStart,
               this.positionNow()
            );
            left = new RoundApply(
               new SquareApply(select, right.callee.typeArgs),
               right.args
            );
         } else if (
            operator === "." &&
            right instanceof SquareApply &&
            right.callee instanceof Identifier
         ) {
            const select = new Select(left, right.callee.value).fromTo(
               whileLoopStart,
               this.positionNow()
            );
            left = new SquareApply(select, right.typeArgs);
         } else if (
            operator === "?." &&
            right instanceof SquareApply &&
            right.callee instanceof Identifier
         ) {
            const select = new Select(left, right.callee.value, true).fromTo(
               whileLoopStart,
               this.positionNow()
            );
            left = new SquareApply(select, right.typeArgs);
         } else if (
            operator === "." &&
            right instanceof Cast &&
            right.expression instanceof Identifier
         ) {
            left = new Select(left, right.expression.value).fromTo(
               whileLoopStart,
               this.positionNow()
            );
            left = new Cast(left, right.type);
         } else if (operator === "::" && right) {
            const typeCheck = new TypeCheck(left, right);
            left = typeCheck;
         } else if (operator === "!:" && right) {
            const typeCheck = new TypeCheck(left, right, true);
            left = typeCheck;
         } else {
            if (operator === "where") {
               const param = new Assignment(
                  new Identifier("self"),
                  undefined,
                  undefined,
                  left
               );
               if (!(right instanceof Block)) {
                  right = new Block([right]);
               }
               left = new RefinedDef(
                  new RoundValueToValueLambda([param], right)
               );
            } else {
               left = new BinaryExpression(left, operator, right);
            }
         }
         left = left.fromTo(whileLoopStart, this.positionNow());
      }
      // this.omit("INDENT");

      // if (this.isOnNewLine) {
      //    this.consume("NEWLINE");
      //    this.consume("DEDENT");
      // }

      if (this.peek() && this.peek().value === "?") {
         this.consume("OPERATOR");
         const optional = new Optional(left);
         if (optional.expression instanceof UnaryOperator) {
            const unary = new UnaryOperator(
               optional.expression.operator,
               optional.expression.expression
            );
            unary.expression = new Optional(unary.expression);
            left = unary;
         } else {
            left = optional;
         }
      }

      return left.fromTo(whileLoopStart, this.positionNow());
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
      const groupCatch: Term[] = [];
      const lambdaStart = this.positionNow();

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
         const paramStart = this.positionNow();
         const paramTerm: Term = this.parseExpression();
         const param = this.resolveAsAssignment(paramTerm);
         if (param instanceof Assignment) {
            param.isDeclaration = false;
            param.isParameter = true;
            if (param.type && !param.value) {
               groupCatch.push(
                  new Cast(param.lhs, param.type).fromTo(
                     paramStart,
                     this.positionNow()
                  )
               );
            } else {
               groupCatch.push(param.lhs);
            }
         } else {
            groupCatch.push(param);
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
      if (this.peek() && this.peek().value === ":") {
         this.consume("OPERATOR", ":");
         specifiedType = this.parseExpression(0, false, false, true);
      }
      if (
         (!this.peek() ||
            (this.peek().value != "->" &&
               this.peek().value != "~>" &&
               this.peek().value != "?>" &&
               (this.peek().value != "=>" || !isSquare))) &&
         groupCatch.length > 0
      ) {
         if (this.peek().value !== ",") {
            this.omit("NEWLINE");
         }
         let result: Term = new Group(groupCatch[0]).fromTo(
            lambdaStart,
            this.positionNow()
         );
         if (groupCatch.length > 1) {
            result = new Tuple(groupCatch).fromTo(
               lambdaStart,
               this.positionNow()
            );
         }
         if (specifiedType) {
            result = new Cast(result, specifiedType);
         }
         return result;
      }
      let arrow;
      if (this.peek().value === "->") {
         arrow = this.consume("OPERATOR", "->");
      } else if (this.peek().value === "~>") {
         arrow = this.consume("OPERATOR", "~>");
      } else if (this.peek().value === "?>") {
         arrow = this.consume("OPERATOR", "?>");
      } else {
         arrow = this.consume();
      }
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
            block = new Block([body]).fromTo(lambdaStart, this.positionNow());
         }
         if (isSquare) {
            return new SquareTypeToValueLambda(
               parameters,
               block,
               arrow.value === "->",
               arrow.value === "~~>"
            ).fromTo(lambdaStart, this.positionNow());
         } else {
            return new RoundValueToValueLambda(
               parameters,
               block,
               specifiedType,
               arrow.value === "->",
               arrow.value === "~~>"
            ).fromTo(lambdaStart, this.positionNow());
         }
      } else {
         // Type Level
         let returnType = body;
         if (isSquare) {
            return new SquareTypeToTypeLambda(parameters, returnType).fromTo(
               lambdaStart,
               this.positionNow()
            );
         } else {
            let block: Block;
            if (body instanceof Block) {
               block = body;
            } else {
               block = new Block([body]).fromTo(
                  lambdaStart,
                  this.positionNow()
               );
            }
            return new RoundValueToValueLambda(
               parameters,
               block,
               specifiedType,
               arrow.value === "->",
               arrow.value === "~~>"
            ).fromTo(lambdaStart, this.positionNow());
            // return new RoundTypeToTypeLambda(parameters, returnType).fromTo(
            //    lambdaStart,
            //    this.positionNow()
            // );
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
      this.consume("OPERATOR", ",");
      const action = this.parseExpression();
      if (secondPart !== undefined && thirdPart !== undefined) {
         return new WhileLoop(firstPart, secondPart, thirdPart, action);
      } else {
         return new WhileLoop(undefined, firstPart, undefined, action);
      }
   }

   parseIfStatement() {
      const ifStart = this.positionNow();
      this.consume("KEYWORD", "if");
      const condition = this.parseExpression();
      this.consume("OPERATOR", ",");
      const trueBranch = this.parseExpression();
      let falseBranch: Term;
      this.omit("NEWLINE");
      if (this.is("else")) {
         this.consume("KEYWORD", "else");
         falseBranch = this.parseExpression();
      } else {
         falseBranch = new Literal("null", "Void").fromTo(
            ifStart,
            this.positionNow()
         );
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
      } else if (expression instanceof Assignment && keyword.value === "link") {
         expression.private = true;
         expression.isLink = true;
         return expression;
      } else if (expression instanceof Assignment && keyword.value === "link") {
         expression.private = true;
         expression.isLink = true;
         return expression;
      } else if (
         expression instanceof Assignment &&
         expression.value &&
         keyword.value === "private"
      ) {
         expression.private = true;
         return expression;
      } else if (keyword.value === "make") {
         return new Make(expression);
      } else if (keyword.value === "return") {
         return new AppliedKeyword("return", expression);
      } else if (keyword.value === "unchecked") {
         return new AppliedKeyword("unchecked", expression);
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
      return new Literal(String(token.value), "String").fromTo(
         token.position,
         token.position
      );
   }

   parsePrimary(): Term {
      const startPos = this.positionNow();
      let result = this.parsePrimaryRaw();
      if (this.peek() && this.peek().value === "?") {
         this.consume("OPERATOR");
         const optional = new Optional(result);
         if (optional.expression instanceof UnaryOperator) {
            const unary = new UnaryOperator(
               optional.expression.operator,
               optional.expression.expression
            );
            unary.expression = new Optional(unary.expression);
            result = unary;
         } else {
            result = optional;
         }
      }
      const endPos = this.positionNow();
      return result.fromTo(startPos, endPos);
   }

   // Parse primary expressions like literals or identifiers
   parsePrimaryRaw(): Term {
      const token = this.consume();

      if (token.value === "data") {
         this.current--;
         return parseNewType(this);
      }

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
         if (this.peek().tag === "STRING") {
            return new AppliedKeyword(
               "external",
               new Literal(this.consume().value, "String")
            );
         } else {
            return new Literal("", "Anything");
         }
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

      if (token.value === "refined") {
         const parsedChecker = this.parseRoundValueToValueLambda(
            this.peek().value === "["
         );
         if (parsedChecker instanceof RoundValueToValueLambda) {
            return new RefinedDef(parsedChecker);
         } else {
            throw new Error("Was not round lambda");
         }
      }

      // if (token.value === "data") {
      //    this.current--;
      //    return parseNewData(this);
      // }

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
      return token;
   }

   peek(at = 0) {
      return this.tokens[this.current + at];
   }

   createError(message: string, token: Token): any {
      const position = token.position || { line: 0, column: 0 };
      // this.tokens
      //    .slice(0, this.current)
      //    .forEach((t) => console.error(t.tag, t.value));
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

export class RefinedDef extends Term {
   lambda: RoundValueToValueLambda;
   constructor(lambda: RoundValueToValueLambda) {
      super("RefinedDef");
      this.lambda = lambda;
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
   mutable: boolean = false;
   constructor(
      name: string,
      type?: Term,
      defaultValue?: Term,
      mutable: boolean = false
   ) {
      super("FieldDef");
      this.name = name;
      this.type = type;
      this.defaultValue = defaultValue;
      this.isTypeLevel = true;
      this.mutable = mutable;
   }
}

export function parseNewType(parser: Parser): Term {
   let token: Token = parser.consume("KEYWORD");
   if (token.value !== "data") {
      throw new Error(
         `Expected 'data', but got '${token.value}' at line ${token.position.start.line}, column ${token.position.start.column}`
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
   const start = parser.positionNow();
   if (parser.peek().value != ":") {
      return new DataDef([]).fromTo(start, parser.positionNow());
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

      if (!parser.peek()) {
         break;
      }

      let mutable = false;
      if (
         parser.peek().tag === "KEYWORD" &&
         parser.peek().value === "mutable"
      ) {
         parser.consume("KEYWORD", "mutable");
         mutable = true;
      }
      let expr;
      const exprStart = parser.positionNow();
      try {
         expr = parser.parseExpression();
      } catch (e) {
         break;
      }
      if (expr instanceof Cast && expr.expression instanceof Identifier) {
         fieldDefs.push(
            new FieldDef(
               expr.expression.value,
               expr.type,
               undefined,
               mutable
            ).fromTo(exprStart, parser.positionNow())
         );
      } else if (expr instanceof Assignment && expr.lhs instanceof Identifier) {
         fieldDefs.push(
            new FieldDef(expr.lhs.value, expr.type, expr.value, mutable).fromTo(
               exprStart,
               parser.positionNow()
            )
         );
      } else {
         console.log(expr);
         throw new Error(
            "Malformed syntax at new object" + expr.position?.start.line
         );
      }
      parser.omit("NEWLINE");
      // } else {
      //    throw new Error(
      //       `Unexpected token: ${token.tag} at line ${token.position.start.line}, column ${token.position.start.column}`
      //    );
      // }
   }

   // parser.consume("PARENS", "}");
   const end = parser.positionNow();
   return new DataDef(fieldDefs).fromTo(start, end);
}
