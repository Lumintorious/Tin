import * as module0 from "file://C:\\Users\\Razvan\\Documents\\Tin\\tin-out\\stdlib.tin.out.mjs";Object.entries(module0).forEach(([key, value]) => {
				globalThis[key] = value;
		  });;
import * as module1 from "file://C:\\Users\\Razvan\\Documents\\Tin\\tin-out\\collections\\Iterable.tin.out.mjs";Object.entries(module1).forEach(([key, value]) => {
				globalThis[key] = value;
		  });;


	const JsMap = globalThis.Map;

;
export var MapOps = /* [] */(K, V) => _S(Symbol("MapOps"), (_p0,_p1,_p2) => ({put: _p0,get: _p1,remove: _p2}), lazy(Type('MapOps', (obj) => Reflect.ownKeys(obj).includes(MapOps._s))._and(Struct(Array(0)([
						Parameter("put",
					
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("key",
					K,
					() => { return (undefined)})
		,,Parameter("value",
					V,
					() => { return (undefined)})
		,]),
				{}))
			,
					() => { return (undefined)})
		,,Parameter("get",
					
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("key",
					K,
					() => { return (undefined)})
		,]),
				{}))
			,
					() => { return (undefined)})
		,,Parameter("remove",
					
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("key",
					K,
					() => { return (undefined)})
		,]),
				{}))
			,
					() => { return (undefined)})
		,
			])))));
export var MapEntry = /* [] */(A, B) => _S(Symbol("MapEntry"), (_p0,_p1) => ({key: _p0,value: _p1}), lazy(Type('MapEntry', (obj) => Reflect.ownKeys(obj).includes(MapEntry._s))._and(Struct(Array(0)([
						Parameter("key",
					A,
					() => { return (undefined)})
		,,Parameter("value",
					B,
					() => { return (undefined)})
		,
			])))));
export var Map = /* [] */(K, V) => (() => { const _left = Type$get(MapOps).call('Type', K, V); return _A(_left, Type$get(Iterable).call('Type', MapEntry.call('Type', K, V)));})();
;
export var Map$create/* [K, V] -> Map[K, V]*/ = function(K, V) {try{
throw Map$of.call('Type', K, V)(Array(0)([]))
} catch(e) { if(e instanceof Error) {throw e} else {return e} } };


	const Map$of = (K, V) => (args) => {
		const map = new JsMap(args.Array._rawArray.map(p => [p.MapEntry.key, p.MapEntry.value]))
		const ops = MapOps(K, V)(
			function(key, value)  {
				map.set(key, value);
				return this;
			}, 
			(key) => map.get(key),
			function (key) {
				map.delete(key);
				return this;
			}
		)
		const getIterator = () => {
			const jsIterator = map.keys();
			return Iterator(MapEntry(K, V))(
				() => {
					const n = jsIterator.next();
					if (!n.done) {
						return MapEntry(K, V)(n.value, map.get(n.value))
					} else {
						return undefined;
					}
				}
			)
		}

		return _TIN_INTERSECT_OBJECTS(ops, Iterable(MapEntry(K, V))(getIterator));
	}

