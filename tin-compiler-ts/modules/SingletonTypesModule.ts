import { Identifier, IN_TYPE_CONTEXT, Select } from "tin-compiler-ts/Parser";
import { Scope, TypePhaseContext } from "tin-compiler-ts/Scope";
import { SingletonType, Type } from "tin-compiler-ts/Types";

export const SingletonTypesModule = {
   selectToSingleton(
      node: Select,
      nodeType: Type,
      scope: Scope,
      allowsSingletonType: boolean
   ) {
      const rootOwner = node.getRootMostOwner();
      if (allowsSingletonType && rootOwner instanceof Identifier) {
         const symbol = scope.lookup(rootOwner.value);
         return new SingletonType(symbol, nodeType, node);
      }
      return nodeType;
   },

   selectToSingletonType(
      node: Select,
      scope: Scope,
      context: TypePhaseContext
   ) {
      const asName = node.nameAsSelectOfIdentifiers();
      if (asName !== undefined) {
         if (!context.inferencer.isCapitalized(asName)) {
            if (scope.hasSymbol(asName)) {
               // Has symbol such as Value.default
               const symbol = scope.lookup(asName);
               node.isBeingTreatedAsIdentifier = true;
               node.isTypeLevel = true;
               node.modify(IN_TYPE_CONTEXT);
               return new SingletonType(symbol, symbol.typeSymbol);
            } else {
               // Is a select of static fields on an identifier
               const root = node.getRootMostOwner();
               if (root instanceof Identifier) {
                  const rootSymbol = scope.lookup(root.value);

                  node.modify(IN_TYPE_CONTEXT);
                  return new SingletonType(
                     rootSymbol,
                     context.inferencer.infer(node, scope, {
                        allowsSingletonType: true,
                     }),
                     node
                  );
               }
            }
         }
         return scope.lookupType(asName).typeSymbol;
      } else {
         throw new Error(
            `Cannot convert select "${node.show()}" to singleton type: ` +
               `No name found in select.`
         );
      }
   },
};
