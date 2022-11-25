import { rankWith, scopeEndsWith } from '@jsonforms/core';

export default rankWith(
  3, //increase rank as needed
  scopeEndsWith('rating')
);
