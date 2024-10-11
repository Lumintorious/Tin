function typeCheck(term, definitions = {}, errors = []) {
	switch (term.tag) {
		case "Definition":
			typeCheck(value, { ...definitions }, errors)
		case "Block":
			term.statements.foreach(s => typeCheck(s, { ...definitions }, errors))
		case "Apply":

	}
}