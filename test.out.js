function TIN_TYPE(typeId, constructor, descriptor) {
	constructor._tinFields = descriptor;
	constructor._tinTypeId = typeId;
	constructor["&"] = () => {
		throw new Error("Cannot automatically create intersection type instance. Ambiguous parameter order")
	}
	return constructor
}

const Int = Number

const print = (...args) => console.log(...args);
const Cat  = TIN_TYPE("30a1f0d7-d9b6-4795-a5fd-88ca704806e7", (_p0,_p1) => ({name: _p0,age: _p1}), {name: { type: String, defaultValue: null },age: { type: Int, defaultValue: 1 }});
const Pokemon  = TIN_TYPE("3f2b107b-7d32-4c49-b4a4-9da2e40a8610", (_p0,_p1) => ({damage: _p0,health: _p1}), {damage: { type: Int, defaultValue: null },health: { type: Int, defaultValue: null }});
const add  = function(x, y/*Int*/) {
const q /*Int*/ = 1 + 2;
return x + y
};
const myCat  = Cat("Kitty", 12);
((1 < 2) ? (print(32)) : (print(44))) ;
print(myCat . name)