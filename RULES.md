# Variable values

### Assignment

-  Invariable LHS, Invariable RHS = LHS is set to RHS `let lhs = rhs`
-  Variable LHS, Variable RHS = LHS is set to a new wrapped variable value `let lhs = {\_: rhs.\_}`
-  Variable LHS, Invariable RHS = LHS's value is set to RHS `let lhs = {_:rhs}`
-  Invariable LHS, Variable RHS = LHS is set to RHS's value `let lhs = rhs._`

### Lambda parameters

-  Same as assignments, where LHS is the expected param value, RHS is the applied param value

### Constructors

-  Invariable ExpParam, Invariable GotParam = ExpParam is set a new wrapped variable value GotParam `lhs = {_:rhs}`
-  Variable ExpParam, Variable GotParam = GotParam is passed as is `lhs = rhs`
-  Variable ExpParam, Invariable GotParam = ExpParam's value is set to GotParam `lhs._ = rhs`
-  Invariable ExpParam, Variable GotParam = ExpParam is set to GotParam's value `lhs = rhs._`
