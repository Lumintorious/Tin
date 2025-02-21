import { TokenPos } from "./Lexer";
import {
   SquareTypeToValueLambda,
   SquareApply,
   DataDef,
   Make,
   TypeCheck,
} from "./Parser";
import {
   SquareTypeToTypeLambda,
   Cast,
   Group,
   Change,
   Block,
   Assignment,
   IfStatement,
   TypeDef,
   RoundValueToValueLambda,
   RoundTypeToTypeLambda,
   RoundApply,
   Select,
   UnaryOperator,
   Identifier,
   WhileLoop,
   AstNode,
   Term,
   Literal,
   BinaryExpression,
   Optional,
} from "./Parser";
import { Symbol, Scope, TypePhaseContext } from "./Scope";
import {
   AnyType,
   AppliedGenericType,
   BinaryOpType,
   GenericNamedType,
   LiteralType,
   MarkerType,
   NamedType,
   OptionalType,
   RoundValueToValueLambdaType,
   SquareTypeToTypeLambdaType,
   SquareTypeToValueLambdaType,
   StructType,
   Type,
   TypeOfTypes,
   TypeRoundValueToValueLambda,
   VarargsType,
} from "./Types";

export function getConstructorName(typeName: string) {
   return typeName;
}
// TYPE INFERENCER
export class TypeChecker {
   // errors: TypeErrorList;
   // outerScope: Scope;
   // fileScope: Scope;
   // run: number = 0;
   // constructor() {
   //    this.errors = new TypeErrorList();
   //    this.outerScope = new Scope("Language");
   //    this.fileScope = new Scope("File", this.outerScope);
   // }
   context: TypePhaseContext;
   constructor(context: TypePhaseContext) {
      this.context = context;
   }

   resolvedGeneric(type: AppliedGenericType, scope: Scope): Type {
      let callee = type.callee;
      if (callee instanceof Identifier) {
         callee = scope.lookupType(callee.value);
      }
      if (callee instanceof NamedType) {
         callee = scope.lookupType(callee.name);
      }
      if (callee && callee instanceof RoundValueToValueLambdaType) {
         const actualParams = type.parameterTypes;
         const expectedParams = callee.paramTypes;
         let params: { [_: string]: Type } = {};
         expectedParams.forEach((p, i) => {
            if (p.name) {
               params[p.name] = actualParams[i];
            }
         });
         const resolved = scope.resolveGenericTypes(callee.returnType, params);
         type.resolved = resolved;
         return type.resolved;
      }
      if (callee && callee instanceof SquareTypeToTypeLambdaType) {
         const actualParams = type.parameterTypes;
         const expectedParams = callee.paramTypes;
         let params: { [_: string]: Type } = {};
         expectedParams.forEach((p, i) => {
            if (p.name) {
               params[p.name] = actualParams[i];
            }
         });
         const resolved = scope.resolveGenericTypes(callee.returnType, params);
         type.resolved = resolved;
         return type.resolved;
      }
      throw new Error("Could not resolve generic type " + type.toString());
   }

   typeCheckChange(node: Change, scope: Scope) {
      this.typeCheck(node.lhs, scope);
      this.typeCheck(node.value, scope);
      const leftType = this.context.inferencer.infer(node.lhs, scope);
      const rightType = this.context.inferencer.infer(node.value, scope);
      if (!rightType.isAssignableTo(leftType, scope)) {
         if (node.lhs instanceof Identifier) {
            const symbol = scope.lookup(node.lhs.value);
            if (
               symbol.shadowing &&
               rightType.isAssignableTo(symbol.shadowing?.typeSymbol, scope)
            ) {
               scope.remove(node.lhs.value);
               return;
            }
         }

         let name = "";
         if (node.lhs instanceof Identifier) {
            name = node.lhs.value;
         }
         if (node.lhs instanceof Select) {
            name = node.lhs.field;
         }
         this.context.errors.add(
            `Setting of variable ${name}`,
            leftType,
            rightType,
            node.position
         );
      }
   }

   typeCheck(node: AstNode, scope: Scope) {
      if (node instanceof Block) {
         const innerScope = scope.innerScopeOf(node);
         node.statements.forEach((c) =>
            this.typeCheck.bind(this)(c, innerScope)
         );
      } else if (node instanceof Assignment && node.value) {
         this.typeCheck(node.value, scope);
      } else if (node instanceof Change) {
         this.typeCheckChange(node as Change, scope);
      } else if (node instanceof RoundApply) {
         this.typeCheckApply(node, scope);
      } else if (node instanceof RoundValueToValueLambda) {
         this.typeCheckRoundValueToValueLambda(node, scope);
      } else if (node instanceof SquareTypeToValueLambda) {
         this.typeCheckSquareTypeToValueLambda(node, scope);
      } else if (node instanceof IfStatement) {
         const innerScope = scope.innerScopeOf(node);
         const trueScope = innerScope.innerScopeOf(node.trueBranch);
         this.typeCheck(node.condition, innerScope);
         this.typeCheck(node.trueBranch, trueScope);
         if (node.falseBranch) {
            this.typeCheck(node.falseBranch, innerScope);
         }
      }
   }

   typeCheckRoundValueToValueLambda(
      node: RoundValueToValueLambda,
      scope: Scope
   ) {
      const innerScope = scope.innerScopeOf(node);
      node.params.forEach((p) => this.typeCheck(p, innerScope));
      this.typeCheck(node.block, innerScope);
   }

   typeCheckSquareTypeToValueLambda(
      node: SquareTypeToValueLambda,
      scope: Scope
   ) {
      const innerScope = scope.innerScopeOf(node);
      // node.pforEach((p) => this.typeCheck(p, innerScope));
      this.typeCheck(node.block, innerScope);
   }

   // typeCheckSquareApply(apply: SquareApply, scope: Scope) {
   // 	apply.
   // }

   typeCheckApply(apply: RoundApply, scope: Scope) {
      scope = scope.innerScopeOf(apply);
      let typeSymbol = this.context.inferencer.infer(apply.callee, scope);
      if (
         apply.callee instanceof Identifier &&
         this.context.inferencer.isCapitalized(apply.callee.value)
      ) {
         const type = scope.resolveNamedType(
            this.context.translator.translate(apply.callee, scope)
         );
         if (type instanceof StructType) {
            typeSymbol = new RoundValueToValueLambdaType(
               type.fields.map((f) => f.typeSymbol),
               type
            );
         } else if (type instanceof MarkerType) {
            typeSymbol = new RoundValueToValueLambdaType([], type);
         } else {
            throw new Error(
               "Cannot call constructor function for non struct-type"
            );
         }
      }
      apply.args.forEach((p) => {
         this.typeCheck(p, scope);
      });

      if (typeSymbol instanceof RoundValueToValueLambdaType) {
         const params = typeSymbol.paramTypes;
         if (
            params[0] &&
            params[0] instanceof AppliedGenericType &&
            params[0].callee.name === "Array"
         ) {
            const expectedType = scope.resolveNamedType(
               params[0].parameterTypes[0]
            );
            const firstArgType = () =>
               scope.resolveAppliedGenericTypes(
                  this.context.inferencer.infer(apply.args[0], scope)
               );
            if (
               apply.args.length > 0 &&
               firstArgType().isAssignableTo(
                  scope.resolveAppliedGenericTypes(params[0]),
                  scope
               )
            ) {
               // It's ok, array expected, array gotten
            } else {
               apply.args.forEach((p, i) => {
                  const gottenType = this.context.inferencer.infer(p, scope);
                  if (!gottenType.isAssignableTo(expectedType, scope)) {
                     this.context.errors.add(
                        `Parameter ${i} of ${
                           apply.callee instanceof Identifier
                              ? apply.callee.value
                              : "Anonymous function"
                        }`,
                        expectedType,
                        gottenType,
                        apply.position,
                        new Error()
                     );
                  }
               });
               apply.takesVarargs = true;
            }
         } else {
            let hasThisParamIncrement = typeSymbol.isFirstParamThis ? 1 : 0;
            apply.args.forEach((p, i) => {
               if (!(typeSymbol instanceof RoundValueToValueLambdaType)) {
                  return;
               }
               const type = scope.resolveNamedType(
                  this.context.inferencer.infer(p, scope)
               );
               const expectedType = scope.resolveNamedType(
                  typeSymbol.paramTypes[i + hasThisParamIncrement]
               );
               if (!type.isAssignableTo(expectedType, scope)) {
                  this.context.errors.add(
                     `Parameter ${i} of ${
                        apply.callee instanceof Identifier
                           ? apply.callee.value
                           : "Anonymous function"
                     }`,
                     typeSymbol.paramTypes[i],
                     type,
                     apply.position,
                     new Error()
                  );
               }
            });
         }

         // }
      }
   }
}

export class TypeErrorList {
   errors: {
      hint: string;
      expectedType: Type;
      insertedType: Type;
      position?: TokenPos;
      errorForStack?: Error;
   }[];
   constructor() {
      this.errors = [];
   }

   add(
      hint: string,
      expectedType: Type,
      insertedType: Type,
      position?: TokenPos,
      errorForStack?: Error
   ) {
      this.errors.push({
         hint,
         expectedType,
         insertedType,
         position,
         errorForStack,
      });
   }

   throwAll(showStack = true) {
      if (this.errors.length > 0) {
         const message =
            "There are type errors:\n" +
            this.errors
               .map(
                  (e) =>
                     `- ${
                        e.hint
                     }; Expected '${e.expectedType.toString()}', but got '${
                        e.insertedType
                     }' at line ${e.position?.start.line}, column ${
                        e.position?.start.column
                     }`
               )
               .join("\n");
         console.error(message);
         process.exit(-1);
      }
   }
}
