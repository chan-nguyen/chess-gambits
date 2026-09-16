Every file in this directory MUST be rejected by the validator, each for one named reason.
`adversarial.test.ts` asserts the issue code and a fragment of the message for each one.
A validator with no tests that must fail is not a validator.

These files are excluded from Prettier (`.prettierignore`): several are deliberately
malformed, and reformatting them would repair the defect they exist to carry.
