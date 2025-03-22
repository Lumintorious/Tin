function thrower(n, i, acc) {
	try {
		while (true) {
			((i == n) ? (do { throw { _v: acc } }) : (do {
				n = n;
				i = i + 1;
				acc = acc + i
			}))
		}
	} catch (e) { if (e._v) { return e._v } else { throw e } }
}

function throwerPrimitive(n, i, acc) {
	try {
		if (i == n) {
			throw acc
		} else {
			throw throwerPrimitive(n, i + 1, acc + i)
		}
	} catch (e) { if (e instanceof Error) { throw e } else { return e } }
}

function returner(n, i, acc) {
	while (true) {
		if (i == n) { return acc } else {
			n = n;
			i = i + 1;
			acc = acc + i
		}
	}
}

const n = 900;
console.time('thrower');
thrower(n, 0, 0);
console.timeEnd('thrower');

console.time('returner');
thrower(n, 0, 0);
console.timeEnd('returner');

console.time('throwerPrimitive');
throwerPrimitive(n, 0, 0);
console.timeEnd('throwerPrimitive');
